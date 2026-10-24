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
  }
  workspace(id, demo = false) { this.db.prepare('INSERT OR IGNORE INTO workspaces VALUES (?,?)').run(id, Number(demo)); }
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
  applied(id) { return this.db.prepare('SELECT COALESCE(SUM(amount),0) n FROM applications WHERE target=?').get(id).n; }
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
    this.db.prepare('INSERT INTO operations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id, workspace, kind, concept, day, unit, amount, source, external, target?.id ?? null, category, new Date().toISOString());
    for (const [account, value] of entries) this.db.prepare('INSERT INTO entries VALUES (?,?,?,?)').run(randomUUID(), id, account, value);
    if (due) this.db.prepare('INSERT INTO obligations VALUES (?,?,?)').run(randomUUID(), id, due);
    if (target) this.db.prepare('INSERT INTO applications VALUES (?,?,?,?)').run(randomUUID(), id, target.id, amount);
    if (commission) {
      const commissionId = randomUUID();
      this.db.prepare('INSERT INTO operations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(commissionId, workspace, 'commission', `Comisión: ${concept}`, day, unit, commission, source, null, id, 'Comisiones', new Date().toISOString());
    }
    this.audit(workspace, actor, `${kind}.created`, id);
    return { id };
  }
  snapshot(workspace) {
    const accounts = this.db.prepare(`SELECT a.*, a.opening + COALESCE(SUM(e.amount),0) balance FROM accounts a
      LEFT JOIN entries e ON e.account=a.id WHERE a.workspace=? GROUP BY a.id ORDER BY a.rowid`).all(workspace);
    const operations = this.db.prepare(`SELECT o.*, b.due,
      (SELECT COALESCE(SUM(p.amount),0) FROM applications p WHERE p.target=o.id) applied
      FROM operations o LEFT JOIN obligations b ON b.operation=o.id
      WHERE o.workspace=? ORDER BY o.date DESC, o.rowid DESC`).all(workspace);
    const entries = this.db.prepare(`SELECT e.* FROM entries e JOIN operations o ON e.operation=o.id WHERE o.workspace=?`).all(workspace);
    const currencies = [...new Set([...accounts, ...operations].map(a => a.currency))];
    const totals = currencies.map(unit => {
      const ops = operations.filter(o => o.currency === unit);
      const byKind = (...kinds) => ops.filter(o => kinds.includes(o.kind)).reduce((s,o) => s+o.amount,0);
      return {
        currency: unit,
        balance: accounts.filter(a => a.currency === unit).reduce((s,a) => s+a.balance,0),
        verifiedAccessible: accounts.filter(a => a.currency === unit && a.verified && a.accessible).reduce((s,a) => s+a.balance,0),
        payable: ops.filter(o => o.kind === 'obligation').reduce((s,o) => s+o.amount-o.applied,0),
        receivable: ops.filter(o => o.kind === 'sale').reduce((s,o) => s+o.amount-o.applied,0),
        sales: byKind('sale'), expenses: byKind('expense', 'obligation', 'commission'),
        withdrawals: byKind('withdrawal'), available: null,
      };
    });
    return { accounts, operations, entries, totals, policy: 'pending',
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
