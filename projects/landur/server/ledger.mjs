import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { parseImport } from './csv.mjs';

export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function money(value, { zero = false } = {}) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})([.,]\d{1,2})?$/.test(value.trim()))
    throw new DomainError('Ingresá un importe válido, sin separadores de miles y con hasta 2 decimales.');
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!zero && cents === 0) throw new DomainError('El importe debe ser mayor que cero.');
  return cents;
}
function text(value, name, max = 180) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new DomainError(`${name}: completá un valor de hasta ${max} caracteres.`);
  return value.trim();
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
    throw new DomainError('Ingresá una fecha válida.');
  return value;
}
function currency(value) {
  if (!['UYU', 'USD', 'BRL'].includes(value)) throw new DomainError('Seleccioná una moneda admitida.');
  return value;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}

// Comprobantes: viven dentro de la misma base privada, así que el respaldo y la
// restauración ya probados los incluyen sin depender de un directorio extra ni de
// permisos nuevos en el hosting. El tipo se decide por los bytes del archivo y no por
// lo que declare el cliente: una extensión mentirosa no debe servir HTML desde el dominio.
const EVIDENCE_LIMIT = 1572864;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// No basta con mirar la firma: un archivo firmado pero ilegible se acepta igual, no se
// puede recortar en el teléfono y tampoco se puede mostrar. Se comprueba además que el
// archivo esté completo, que es lo que impide que un PNG truncado pase la validación.
const EVIDENCE_TYPES = new Map([
  ['image/jpeg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b.subarray(-2).equals(Buffer.from([0xff, 0xd9]))],
  ['image/png', b => b.subarray(0, 8).equals(PNG_SIGNATURE) && b.subarray(-8, -4).toString('latin1') === 'IEND'],
  ['image/webp', b => b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'],
  ['application/pdf', b => b.subarray(0, 5).toString('latin1') === '%PDF-' && b.subarray(-1024).includes('%%EOF')]
]);
function evidenceName(value) {
  const name = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]/g, '-').trim();
  if (!name || name.length > 120) throw new DomainError('El nombre del archivo debe tener entre 1 y 120 caracteres.');
  return name;
}
function evidenceBytes(value) {
  // Se acepta con o sin el prefijo `data:` porque el cliente recorta la foto antes de enviarla.
  const base64 = String(value ?? '').replace(/^data:[^,]*,/, '');
  if (!base64 || base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new DomainError('No se pudo leer el archivo adjunto.');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length) throw new DomainError('No se pudo leer el archivo adjunto.');
  if (bytes.length > EVIDENCE_LIMIT) throw new DomainError(`El comprobante debe pesar ${Math.round(EVIDENCE_LIMIT / 1024)} KB o menos. Reducí la foto e intentá otra vez.`, 413);
  return bytes;
}

// Esquema versionado con `PRAGMA user_version`. Cada paso se aplica una sola vez y
// dentro de una transacción: si falla, la base queda como estaba. La versión 1 es el
// esquema original del constructor (creado con IF NOT EXISTS), así que el mismo punto
// de partida sirve para una base nueva y para una que ya existía sin marca de versión.
export const MIGRATIONS = [
  () => {},
  db => {
    const has = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some(entry => entry.name === column);
    // `ADD COLUMN IF NOT EXISTS` no existe en SQLite: la comprobación es explícita.
    if (!has('operations', 'reversed_by')) db.exec('ALTER TABLE operations ADD COLUMN reversed_by TEXT');
    if (!has('operations', 'reversed_at')) db.exec('ALTER TABLE operations ADD COLUMN reversed_at TEXT');
    if (!has('applications', 'reversed')) db.exec('ALTER TABLE applications ADD COLUMN reversed INTEGER NOT NULL DEFAULT 0');
  },
  db => {
    db.exec(`CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES workspaces(id),
      operation TEXT NOT NULL REFERENCES operations(id), name TEXT NOT NULL, mime TEXT NOT NULL,
      bytes INTEGER NOT NULL CHECK(bytes > 0), sha256 TEXT NOT NULL, content BLOB NOT NULL,
      created_at TEXT NOT NULL, actor TEXT NOT NULL
    )`);
  }
];
export class Ledger {
  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, demo INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL,
        kind TEXT NOT NULL, currency TEXT NOT NULL, opening INTEGER NOT NULL CHECK(opening >= 0),
        cutoff TEXT NOT NULL, verified INTEGER NOT NULL, accessible INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES workspaces(id), kind TEXT NOT NULL,
        concept TEXT NOT NULL, date TEXT NOT NULL, currency TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
        source TEXT NOT NULL, external_id TEXT, related_id TEXT, category TEXT, created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS external_once ON operations(workspace, source, external_id) WHERE external_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY, operation TEXT NOT NULL REFERENCES operations(id),
        account TEXT NOT NULL REFERENCES accounts(id), amount INTEGER NOT NULL CHECK(amount != 0)
      );
      CREATE TABLE IF NOT EXISTS obligations (
        id TEXT PRIMARY KEY, operation TEXT NOT NULL REFERENCES operations(id), due TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY, operation TEXT NOT NULL REFERENCES operations(id),
        target TEXT NOT NULL REFERENCES operations(id), amount INTEGER NOT NULL CHECK(amount > 0)
      );
      CREATE TABLE IF NOT EXISTS audit (
        id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES workspaces(id),
        actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS requests (
        workspace TEXT NOT NULL REFERENCES workspaces(id), key TEXT NOT NULL, fingerprint TEXT NOT NULL,
        result TEXT NOT NULL, PRIMARY KEY(workspace, key)
      );
    `);
    this.migrate();
  }
  migrate() {
    let current = this.db.prepare('PRAGMA user_version').get().user_version;
    while (current < MIGRATIONS.length) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        MIGRATIONS[current](this.db);
        this.db.exec(`PRAGMA user_version = ${current + 1}`);
        this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
      current++;
    }
  }
  workspace(id, demo = false) { this.db.prepare('INSERT OR IGNORE INTO workspaces VALUES (?,?)').run(id, Number(demo)); }
  // Libera los espacios demo cuyas sesiones vencieron. Nunca toca el espacio privado.
  purgeDemoWorkspaces() {
    // Solo cuenta una sesión vencida; las filas vencidas quedan en la tabla hasta el próximo alta.
    const ids = this.db.prepare('SELECT id FROM workspaces WHERE demo=1 AND id NOT IN (SELECT workspace FROM sessions WHERE expires>?)').all(Date.now()).map(row => row.id);
    if (!ids.length) return 0;
    const list = ids.map(() => '?').join(',');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`DELETE FROM audit WHERE workspace IN (${list})`).run(...ids);
      this.db.prepare(`DELETE FROM requests WHERE workspace IN (${list})`).run(...ids);
      this.db.prepare(`DELETE FROM applications WHERE operation IN (SELECT id FROM operations WHERE workspace IN (${list})) OR target IN (SELECT id FROM operations WHERE workspace IN (${list}))`).run(...ids, ...ids);
      this.db.prepare(`DELETE FROM obligations WHERE operation IN (SELECT id FROM operations WHERE workspace IN (${list}))`).run(...ids);
      this.db.prepare(`DELETE FROM entries WHERE operation IN (SELECT id FROM operations WHERE workspace IN (${list})) OR account IN (SELECT id FROM accounts WHERE workspace IN (${list}))`).run(...ids, ...ids);
      this.db.prepare(`DELETE FROM operations WHERE workspace IN (${list})`).run(...ids);
      this.db.prepare(`DELETE FROM accounts WHERE workspace IN (${list})`).run(...ids);
      this.db.prepare(`DELETE FROM evidence WHERE workspace IN (${list})`).run(...ids);
      const removed = this.db.prepare(`DELETE FROM workspaces WHERE id IN (${list})`).run(...ids).changes;
      this.db.exec('COMMIT');
      return removed;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  audit(workspace, actor, action, entity) {
    this.db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?)').run(randomUUID(), workspace, actor, action, entity, new Date().toISOString());
  }
  account(workspace, id) {
    const a = this.db.prepare('SELECT * FROM accounts WHERE workspace=? AND id=?').get(workspace, id ?? '');
    if (!a) throw new DomainError('La cuenta no existe o no está disponible en este espacio.', 404);
    return a;
  }
  operation(workspace, id, kind) {
    const op = this.db.prepare('SELECT * FROM operations WHERE workspace=? AND id=? AND kind=?').get(workspace, id ?? '', kind);
    if (!op) throw new DomainError('No se encontró la operación asociada.', 404);
    return op;
  }
  applied(id) { return this.db.prepare('SELECT COALESCE(SUM(amount),0) n FROM applications WHERE target=? AND reversed=0').get(id).n; }
  // Reversión auditada: no borra ni edita la operación original. Registra un
  // contra-asiento vinculado por `related_id`, marca el original y deja constancia en
  // la auditoría. Respeta las dependencias: si algo se apoya en la operación, primero
  // hay que revertir eso, para que ningún saldo quede huérfano ni duplicado.
  reverse(workspace, actor, input) {
    const day = date(input.date);
    const original = this.db.prepare('SELECT * FROM operations WHERE workspace=? AND id=?').get(workspace, String(input.operationId ?? ''));
    if (!original) throw new DomainError('No se encontró la operación a revertir.', 404);
    if (original.kind === 'reversal') throw new DomainError('Una reversión no se revierte: registrá una operación nueva con el dato correcto.');
    if (original.reversed_by) throw new DomainError('Esa operación ya fue revertida.', 409);
    if ((original.kind === 'sale' || original.kind === 'obligation') && this.applied(original.id) > 0)
      throw new DomainError('Primero revertí los cobros o pagos aplicados a esta operación.', 409);
    const dependents = this.db.prepare("SELECT id FROM operations WHERE workspace=? AND related_id=? AND reversed_by IS NULL AND kind NOT IN ('reversal','commission')").all(workspace, original.id);
    if (dependents.length) throw new DomainError('Primero revertí las operaciones asociadas a esta.', 409);
    // La comisión nació de este mismo cobro y no tiene sentido por separado: se revierte junto.
    const commissions = this.db.prepare("SELECT * FROM operations WHERE workspace=? AND related_id=? AND reversed_by IS NULL AND kind='commission'").all(workspace, original.id);
    const id = this.insertReversal(workspace, original, day);
    for (const commission of commissions) this.insertReversal(workspace, commission, day);
    this.audit(workspace, actor, 'reversal.created', id);
    return { id, reversed: original.id, commissions: commissions.length };
  }
  insertReversal(workspace, original, day) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO operations (id,workspace,kind,concept,date,currency,amount,source,external_id,related_id,category,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
      id, workspace, 'reversal', `Reversión: ${original.concept}`.slice(0, 180), day, original.currency,
      original.amount, original.source, null, original.id, original.category, new Date().toISOString());
    for (const entry of this.db.prepare('SELECT account, amount FROM entries WHERE operation=?').all(original.id))
      this.db.prepare('INSERT INTO entries (id,operation,account,amount) VALUES (?,?,?,?)').run(randomUUID(), id, entry.account, -entry.amount);
    // Una aplicación revertida deja de reducir el pendiente de su destino.
    this.db.prepare('UPDATE applications SET reversed=1 WHERE operation=?').run(original.id);
    this.db.prepare('UPDATE operations SET reversed_by=?, reversed_at=? WHERE id=?').run(id, new Date().toISOString(), original.id);
    return id;
  }
  command(workspace, actor, key, input) {
    if (typeof key !== 'string' || !/^[\w-]{16,100}$/.test(key)) throw new DomainError('Falta una clave de operación válida.');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DomainError('La operación no es válida.');
    const hash = createHash('sha256').update(JSON.stringify(stable(input))).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.db.prepare('SELECT * FROM requests WHERE workspace=? AND key=?').get(workspace, key);
      if (previous) {
        if (previous.fingerprint !== hash) throw new DomainError('Esta clave ya fue usada para otra operación.', 409);
        this.db.exec('COMMIT');
        return { ...JSON.parse(previous.result), replayed: true };
      }
      const result = this.execute(workspace, actor, input);
      this.db.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(workspace, key, hash, JSON.stringify(result));
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  // Adjuntar un comprobante no pasa por `command` porque un archivo no es dinero: se
  // valida, se guarda con su hash y se audita. Reintentar con la misma clave devuelve
  // el mismo comprobante en lugar de duplicarlo.
  attachEvidence(workspace, actor, key, input) {
    if (typeof key !== 'string' || !/^[\w-]{16,100}$/.test(key)) throw new DomainError('Falta una clave de operación válida.');
    const name = evidenceName(input?.name);
    const mime = String(input?.mime ?? '');
    const bytes = evidenceBytes(input?.data);
    if (!EVIDENCE_TYPES.get(mime)?.(bytes)) throw new DomainError('El archivo no es una imagen JPEG, PNG o WebP ni un PDF válido, o está incompleto.');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const operationId = String(input?.operationId ?? '');
    const fingerprint = createHash('sha256').update(JSON.stringify(stable({ operationId, name, mime, sha256 }))).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.db.prepare('SELECT * FROM requests WHERE workspace=? AND key=?').get(workspace, key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new DomainError('Esta clave ya fue usada para otro archivo.', 409);
        this.db.exec('COMMIT');
        return { ...JSON.parse(previous.result), replayed: true };
      }
      if (!this.db.prepare('SELECT id FROM operations WHERE workspace=? AND id=?').get(workspace, operationId))
        throw new DomainError('No se encontró la operación a la que querés adjuntar el comprobante.', 404);
      const id = randomUUID();
      this.db.prepare('INSERT INTO evidence (id,workspace,operation,name,mime,bytes,sha256,content,created_at,actor) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(id, workspace, operationId, name, mime, bytes.length, sha256, bytes, new Date().toISOString(), actor);
      const result = { id };
      this.db.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(workspace, key, fingerprint, JSON.stringify(result));
      this.audit(workspace, actor, 'evidence.attached', id);
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  // Solo el espacio dueño del comprobante puede leerlo: la comprobación va en la consulta.
  evidenceFile(workspace, id) {
    const row = this.db.prepare('SELECT id,name,mime,bytes,content FROM evidence WHERE workspace=? AND id=?').get(workspace, String(id ?? ''));
    if (!row) throw new DomainError('El comprobante no existe o no está disponible en este espacio.', 404);
    return { id: row.id, name: row.name, mime: row.mime, bytes: row.bytes, content: Buffer.from(row.content) };
  }
  deleteOperations(workspace, actor, ids, auditAction, account = null) {
    const operations = [...ids].map(id => this.db.prepare('SELECT * FROM operations WHERE workspace=? AND id=?').get(workspace, id)).filter(Boolean);
    const operationIds = operations.map(op => op.id);
    const removedEntries = operationIds.length
      ? this.db.prepare(`SELECT * FROM entries WHERE operation IN (${operationIds.map(() => '?').join(',')})`).all(...operationIds) : [];
    const removedApplications = operationIds.length
      ? this.db.prepare(`SELECT * FROM applications WHERE operation IN (${operationIds.map(() => '?').join(',')}) OR target IN (${operationIds.map(() => '?').join(',')})`).all(...operationIds, ...operationIds) : [];
    const removedObligations = operationIds.length
      ? this.db.prepare(`SELECT * FROM obligations WHERE operation IN (${operationIds.map(() => '?').join(',')})`).all(...operationIds) : [];
    const removedEvidence = operationIds.length
      ? this.db.prepare(`SELECT id,operation,name,mime,bytes,sha256,actor FROM evidence WHERE workspace=? AND operation IN (${operationIds.map(() => '?').join(',')})`).all(workspace, ...operationIds) : [];
    this.audit(workspace, actor, auditAction, JSON.stringify({account,operations,entries:removedEntries,applications:removedApplications,obligations:removedObligations,evidence:removedEvidence}));
    if (operationIds.length) {
      const slots = operationIds.map(() => '?').join(',');
      this.db.prepare(`DELETE FROM evidence WHERE workspace=? AND operation IN (${slots})`).run(workspace,...operationIds);
      this.db.prepare(`DELETE FROM entries WHERE operation IN (${slots})`).run(...operationIds);
      this.db.prepare(`DELETE FROM applications WHERE operation IN (${slots}) OR target IN (${slots})`).run(...operationIds,...operationIds);
      this.db.prepare(`DELETE FROM obligations WHERE operation IN (${slots})`).run(...operationIds);
      this.db.prepare(`DELETE FROM operations WHERE workspace=? AND id IN (${slots})`).run(workspace,...operationIds);
    }
    return {operations:operationIds.length,evidence:removedEvidence.length};
  }
  previewImport(workspace, actor, csv) {
    this.db.exec('BEGIN IMMEDIATE');
    try { return this.execute(workspace, actor, {kind:'import', csv}); }
    finally { this.db.exec('ROLLBACK'); }
  }
  execute(workspace, actor, input) {
    const { kind } = input;
    if (kind === 'import') {
      const rows = parseImport(input.csv), results = [];
      for (const [index, row] of rows.entries()) {
        const key = 'csvrow-' + createHash('sha256').update(JSON.stringify([row.source,row.externalId])).digest('hex');
        const fingerprint = createHash('sha256').update(JSON.stringify(stable(row))).digest('hex');
        const previous = this.db.prepare('SELECT * FROM requests WHERE workspace=? AND key=?').get(workspace,key);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new DomainError(`Fila ${index+2}: la referencia existe con otros datos. Revisá la diferencia.`,409);
          results.push({row:index+2,concept:row.concept,status:'existing',id:JSON.parse(previous.result).id});
          continue;
        }
        let result;
        try { result = this.execute(workspace, actor, row); }
        catch (error) { if (error instanceof DomainError) throw new DomainError(`Fila ${index+2}: ${error.message}`,error.status); throw error; }
        this.db.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(workspace,key,fingerprint,JSON.stringify(result));
        results.push({row:index+2,concept:row.concept,status:'new',id:result.id});
      }
      return {rows:results,created:results.filter(r=>r.status==='new').length,existing:results.filter(r=>r.status==='existing').length};
    }
    if (kind === 'reversal') return this.reverse(workspace, actor, input);
    if (kind === 'payment.delete') {
      const payment = this.db.prepare("SELECT * FROM operations WHERE workspace=? AND id=? AND kind='payment'").get(workspace, String(input.paymentId ?? ''));
      if (!payment) throw new DomainError('No se encontró el pago en este espacio.', 404);
      const ids = new Set([payment.id]);
      if (payment.reversed_by) ids.add(payment.reversed_by);
      return this.deleteOperations(workspace, actor, ids, 'payment.deleted');
    }
    if (kind === 'account.delete') {
      const account = this.account(workspace, String(input.accountId ?? ''));
      const ids = new Set(this.db.prepare('SELECT DISTINCT operation FROM entries WHERE account=?').all(account.id).map(row => row.operation));
      // Decisión registrada (DECISIONES.md, API.md): solo se elimina una cuenta sin movimientos.
      // Si la cuenta tiene entradas de dinero, nada cambia y el historial manda: hay que anular
      // antes cada operación que la use. Ninguna operación financiera se borra desde acá.
      if (ids.size) throw new DomainError('La cuenta tiene movimientos. Anulá primero cada operación que la usa.', 409);
      this.audit(workspace, actor, 'account.deleted', JSON.stringify({account}));
      this.db.prepare('DELETE FROM accounts WHERE workspace=? AND id=?').run(workspace, account.id);
      return { id: account.id };
    }
    if (kind === 'evidence.remove') {
      const evidenceId = String(input.evidenceId ?? '');
      const entry = this.db.prepare('SELECT id,name,operation,sha256 FROM evidence WHERE workspace=? AND id=?').get(workspace, evidenceId);
      if (!entry) throw new DomainError('El comprobante no existe o no está disponible en este espacio.', 404);
      const id = randomUUID();
      this.audit(workspace, actor, 'evidence.removed', JSON.stringify(entry));
      this.db.prepare('DELETE FROM evidence WHERE workspace=? AND id=?').run(workspace, entry.id);
      return { id: entry.id };
    }
    const id = randomUUID();
    if (kind === 'account') {
      const accountKind = input.accountKind;
      if (!['bank', 'wallet', 'cash'].includes(accountKind)) throw new DomainError('Seleccioná el tipo de cuenta.');
      if (typeof input.verified !== 'boolean' || typeof input.accessible !== 'boolean') throw new DomainError('Indicá verificación y accesibilidad del saldo.');
      this.db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?,?,?)').run(id, workspace,
        text(input.name, 'Nombre', 60), accountKind, currency(input.currency), money(input.opening, {zero: true}),
        date(input.cutoff), Number(input.verified), Number(input.accessible));
      this.audit(workspace, actor, 'account.created', id);
      return { id };
    }
    if (!['expense', 'obligation', 'payment', 'transfer', 'withdrawal', 'sale', 'collection'].includes(kind))
      throw new DomainError('Tipo de operación no admitido.');
    let amount = money(input.amount);
    const day = date(input.date);
    const concept = text(input.concept, 'Concepto');
    const unit = currency(input.currency);
    const source = input.source === undefined ? 'manual' : text(input.source, 'Origen', 60);
    const external = input.externalId ? text(input.externalId, 'Referencia externa', 120) : null;
    const category = input.category ? text(input.category, 'Categoría', 60) : null;
    if (external && this.db.prepare('SELECT id FROM operations WHERE workspace=? AND source=? AND external_id=?').get(workspace, source, external))
      throw new DomainError('La referencia externa ya está registrada. Revisá la operación existente.', 409);
    let entries = [], target = null, commission = 0;
    const checkAccount = (accountId) => {
      const a = this.account(workspace, accountId);
      if (a.currency !== unit) throw new DomainError('La moneda no coincide con la cuenta. No se realizan conversiones automáticas.');
      // An opening balance is the start-of-day balance for this date.
      if (day < a.cutoff) throw new DomainError('El movimiento es anterior al saldo inicial. Revisá el corte antes de registrarlo.');
      return a;
    };
    if (['expense', 'payment', 'withdrawal', 'collection', 'transfer'].includes(kind)) {
      const a = checkAccount(input.accountId);
      entries.push([a.id, kind === 'collection' ? amount : -amount]);
    }
    if (kind === 'transfer') {
      const to = checkAccount(input.toAccountId);
      if (to.id === input.accountId) throw new DomainError('Elegí dos cuentas distintas.');
      entries.push([to.id, amount]);
    }
    if (kind === 'payment' || kind === 'collection') {
      target = this.operation(workspace, input.targetId, kind === 'payment' ? 'obligation' : 'sale');
      if (unit !== target.currency) throw new DomainError('La moneda no coincide con la operación pendiente.');
      if (day < target.date) throw new DomainError('La fecha es anterior a la operación asociada. Revisá el registro.');
      if (amount > target.amount - this.applied(target.id)) throw new DomainError('El importe supera el saldo pendiente.', 409);
      if (kind === 'collection') {
        if (input.commission === undefined || input.commission === '') throw new DomainError('Ingresá la comisión real; usá 0 solo si confirmaste que no hubo comisión.');
        commission = money(input.commission, { zero: true });
        if (commission >= amount) throw new DomainError('La comisión debe ser menor que el cobro.');
        entries[0][1] -= commission;
      }
    }
    const due = kind === 'obligation' ? date(input.due) : null;
    this.db.prepare('INSERT INTO operations (id,workspace,kind,concept,date,currency,amount,source,external_id,related_id,category,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id, workspace, kind, concept, day, unit, amount, source, external, target?.id ?? null, category, new Date().toISOString());
    for (const [account, value] of entries) this.db.prepare('INSERT INTO entries VALUES (?,?,?,?)').run(randomUUID(), id, account, value);
    if (due) this.db.prepare('INSERT INTO obligations VALUES (?,?,?)').run(randomUUID(), id, due);
    if (target) this.db.prepare('INSERT INTO applications (id,operation,target,amount) VALUES (?,?,?,?)').run(randomUUID(), id, target.id, amount);
    if (commission) {
      const commissionId = randomUUID();
      this.db.prepare('INSERT INTO operations (id,workspace,kind,concept,date,currency,amount,source,external_id,related_id,category,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(commissionId, workspace, 'commission', `Comisión: ${concept}`, day, unit, commission, source, null, id, 'Comisiones', new Date().toISOString());
    }
    this.audit(workspace, actor, `${kind}.created`, id);
    return { id };
  }
  snapshot(workspace) {
    const accounts = this.db.prepare(`SELECT a.*, a.opening + COALESCE(SUM(e.amount),0) balance FROM accounts a
      LEFT JOIN entries e ON e.account=a.id WHERE a.workspace=? GROUP BY a.id ORDER BY a.rowid`).all(workspace);
    const operations = this.db.prepare(`SELECT o.*, b.due,
      (SELECT COALESCE(SUM(p.amount),0) FROM applications p WHERE p.target=o.id AND p.reversed=0) applied
      FROM operations o LEFT JOIN obligations b ON b.operation=o.id
      WHERE o.workspace=? ORDER BY o.date DESC, o.rowid DESC`).all(workspace);
    const entries = this.db.prepare(`SELECT e.* FROM entries e JOIN operations o ON e.operation=o.id WHERE o.workspace=?`).all(workspace);
    const currencies = [...new Set([...accounts, ...operations].map(a => a.currency))];
    const totals = currencies.map(unit => {
      const ops = operations.filter(o => o.currency === unit);
      // Una operación revertida conserva su contra-asiento en el saldo, pero deja de
      // contar como gasto, venta o deuda vigente.
      const live = ops.filter(o => !o.reversed_by && o.kind !== 'reversal');
      const byKind = (...kinds) => live.filter(o => kinds.includes(o.kind)).reduce((s,o) => s+o.amount,0);
      return {
        currency: unit,
        balance: accounts.filter(a => a.currency === unit).reduce((s,a) => s+a.balance,0),
        verifiedAccessible: accounts.filter(a => a.currency === unit && a.verified && a.accessible).reduce((s,a) => s+a.balance,0),
        payable: live.filter(o => o.kind === 'obligation').reduce((s,o) => s+o.amount-o.applied,0),
        receivable: live.filter(o => o.kind === 'sale').reduce((s,o) => s+o.amount-o.applied,0),
        sales: byKind('sale'), expenses: byKind('expense', 'obligation', 'commission'),
        withdrawals: byKind('withdrawal'), available: null,
      };
    });
    const evidence = this.db.prepare('SELECT id, operation, name, mime, bytes, created_at, actor FROM evidence WHERE workspace=? ORDER BY rowid DESC').all(workspace);
    return { accounts, operations, entries, evidence, totals, policy: 'pending',
      audit: this.db.prepare('SELECT * FROM audit WHERE workspace=? ORDER BY rowid DESC LIMIT 30').all(workspace) };
  }
  seed(workspace) {
    this.workspace(workspace, true);
    if (this.snapshot(workspace).accounts.length) return;
    const run = data => this.command(workspace, 'demo-seed', randomUUID(), data).id;
    const account = (name, accountKind, opening) => run({kind:'account', name, accountKind, opening, currency:'UYU',cutoff:'2026-10-01',verified:true,accessible:true});
    const bank = account('Santander', 'bank', '60000');
    const mp = account('Mercado Pago', 'wallet', '18450');
    const cash = account('Caja de efectivo', 'cash', '7200');
    const op = (kind, concept, amount, extra = {}) => run({kind, concept, amount, date:'2026-10-24',currency:'UYU',...extra});
    const sale = op('sale','Pedido web · Ilumimate × 2','3200',{source:'demo-shopify',externalId:'DEMO-1042'});
    op('collection','Cobro pedido #1042','3200',{accountId:mp,targetId:sale,commission:'331.20',source:'demo-mp',externalId:'DEMO-MP-1042'});
    op('transfer','Liquidación MP → Santander','2800',{accountId:mp,toAccountId:bank});
    op('obligation','UES · envíos de octubre','1490',{due:'2026-10-28',category:'Envíos'});
    op('obligation','Proveedor · materiales','4200',{due:'2026-10-30',category:'Materiales'});
    op('sale','Pedido mayorista · muestra','8600',{source:'demo-manual'});
    op('expense','Embalajes y etiquetas','680',{accountId:cash,category:'Embalaje'});
    op('expense','Publicidad · cargo de prueba','1250',{accountId:bank,category:'Publicidad'});
  }
  close() { this.db.close(); }
}
