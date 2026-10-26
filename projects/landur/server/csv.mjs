import { DomainError } from './ledger.mjs';

export const columns = ['kind','date','concept','amount','currency','account_id','due','source','external_id','category'];
// Fixed UTF-8, comma-separated template. Quoted cells and CRLF are supported.
export function parseImport(csv) {
  if (typeof csv !== 'string' || Buffer.byteLength(csv) > 100000) throw new DomainError('El CSV debe ser UTF-8 y pesar como máximo 100 KB.');
  csv = csv.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') { if (csv[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new DomainError('CSV inválido: comillas fuera de posición.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { if (c === '\r' && csv[i+1] === '\n') i++; if (row.some(v => v !== '')) rows.push(row); row = []; }
    } else {
      if (closed) throw new DomainError('CSV inválido: contenido después de cerrar comillas.');
      cell += c;
    }
    if (rows.length > 201) throw new DomainError('Importá como máximo 200 filas por lote.');
  }
  if (quoted) throw new DomainError('CSV inválido: comillas sin cerrar.');
  row.push(cell); if (row.some(v => v !== '')) rows.push(row);
  if (!rows.length || rows[0].join(',') !== columns.join(',')) throw new DomainError(`Usá la plantilla acordada: ${columns.join(',')}`);
  if (rows.length < 2 || rows.length > 201) throw new DomainError('El CSV debe tener entre 1 y 200 operaciones.');
  return rows.slice(1).map((cells, i) => {
    if (cells.length !== columns.length) throw new DomainError(`Fila ${i+2}: cantidad de columnas incorrecta.`);
    const r = Object.fromEntries(columns.map((key,j) => [key,cells[j].trim()]));
    if (!['expense','obligation','sale','withdrawal'].includes(r.kind)) throw new DomainError(`Fila ${i+2}: tipo no admitido. Usá expense, obligation, sale o withdrawal.`);
    if (!r.source || !r.external_id) throw new DomainError(`Fila ${i+2}: origen y referencia externa son obligatorios.`);
    const input = {kind:r.kind,date:r.date,concept:r.concept,amount:r.amount,currency:r.currency,source:r.source,externalId:r.external_id};
    if (['expense','withdrawal'].includes(r.kind)) input.accountId = r.account_id;
    else if (r.account_id) throw new DomainError(`Fila ${i+2}: una venta o deuda pendiente no debe mover una cuenta.`);
    if (r.kind === 'obligation') input.due = r.due;
    else if (r.due) throw new DomainError(`Fila ${i+2}: el vencimiento solo corresponde a una obligación.`);
    if (r.category) input.category = r.category;
    return input;
  });
}
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"','""') + '"';
}
export function exportOperations(state) {
  const header=['id','tipo','fecha','concepto','moneda','importe','aplicado','origen','referencia_externa','operacion_relacionada','categoria','vencimiento'];
  const decimal = n => { const sign = n < 0 ? '-' : '', abs = Math.abs(n); return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`; };
  return '\uFEFF' + [header,...state.operations.map(o => [o.id,o.kind,o.date,o.concept,o.currency,decimal(o.amount),decimal(o.applied),o.source,o.external_id,o.related_id,o.category,o.due])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
