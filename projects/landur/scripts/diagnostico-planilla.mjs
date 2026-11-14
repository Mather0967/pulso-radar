// Diagnóstico de la conexión Google Sheets. SOLO LECTURA: abre la base en modo `readOnly`,
// no escribe, no migra y no toca la configuración.
//
// Sirve para responder «la planilla tiene X y LANDUR muestra X + 60 mil» separando lo que la
// importación registra: una venta NO mueve la caja, un cobro SÍ entra a la cuenta y un gasto
// sale. También lista posibles duplicados, que es el otro origen habitual de la diferencia.
//
// Uso: node scripts/diagnostico-planilla.mjs <ruta/landur.sqlite> [--json]
import { DatabaseSync } from 'node:sqlite';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/diagnostico-planilla.mjs <ruta/landur.sqlite> [--json]');
  process.exit(2);
}
const asJson = process.argv.includes('--json');

let db;
try { db = new DatabaseSync(file, { readOnly: true }); }
catch (error) {
  console.error(`No se pudo abrir la base en solo lectura: ${error.message}`);
  process.exit(1);
}

const ops = db.prepare(`SELECT id, kind, date, concept, amount, currency, source, external_id, related_id, category
  FROM operations WHERE source = 'sheets' ORDER BY date, created_at`).all();

const money = (cents, currency = 'UYU') => new Intl.NumberFormat('es-UY', { style: 'currency', currency, maximumFractionDigits: 2 })
  .format(Number(cents || 0) / 100);

// 1) Por tipo y moneda: lo que se devenga (venta) no es lo que se mueve (cobro/gasto).
const byKind = {};
for (const op of ops) {
  const key = `${op.currency}|${op.kind}`;
  byKind[key] ??= { currency: op.currency, kind: op.kind, count: 0, cents: 0 };
  byKind[key].count++;
  byKind[key].cents += op.amount;
}

// 2) Por mes: para comparar contra el total que el cliente ve en su planilla.
const byMonth = {};
for (const op of ops) {
  const month = String(op.date).slice(0, 7);
  byMonth[month] ??= { month, sale: 0, collection: 0, expense: 0, commission: 0 };
  if (op.kind in byMonth[month]) byMonth[month][op.kind] += op.amount;
}

// 3) Posibles duplicados: mismo importe y concepto, aunque la fecha haya cambiado. Es el caso
//    típico cuando se cambia el mes de la planilla o se edita una fila sin Nro. Pedido: la
//    referencia externa cambia y la misma venta entra dos veces.
const seen = new Map();
for (const op of ops.filter(item => item.kind === 'sale')) {
  const key = `${op.amount}|${op.concept}`;
  seen.set(key, [...(seen.get(key) || []), op]);
}
const duplicates = [...seen.values()].filter(group => group.length > 1)
  .map(group => ({ concept: group[0].concept, amount: group[0].amount, count: group.length, dates: group.map(op => op.date), refs: group.map(op => op.external_id) }));

// 4) Referencias repetidas: el mismo pedido con más de una venta.
const byRef = new Map();
for (const op of ops) {
  if (op.kind !== 'sale') continue;
  const ref = String(op.external_id || '').replace(/-(cobro|material)$/, '');
  byRef.set(ref, (byRef.get(ref) || 0) + 1);
}
const repeatedRefs = [...byRef.entries()].filter(([, count]) => count > 1).map(([ref, count]) => ({ ref, count }));

// 5) Cobros sin venta asociada y ventas ya cobradas: para saber si la caja está inflada por
//    cobros de pedidos que todavía no se pagaron.
const sales = new Map(ops.filter(op => op.kind === 'sale').map(op => [op.id, op]));
const collections = ops.filter(op => op.kind === 'collection');
const orphanCollections = collections.filter(op => !op.related_id || !sales.has(op.related_id)).length;
const collectedRefs = new Set(collections.map(op => String(op.related_id || '')));

const report = {
  operations: ops.length,
  byKind: Object.values(byKind).sort((a, b) => a.currency.localeCompare(b.currency) || a.kind.localeCompare(b.kind)),
  byMonth: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
  duplicates,
  repeatedRefs,
  orphanCollections,
  collectionsForSales: collections.length,
  salesWithCollection: [...sales.keys()].filter(id => collectedRefs.has(id)).length,
};

if (asJson) { console.log(JSON.stringify(report, null, 2)); db.close(); process.exit(0); }

console.log(`LANDUR · diagnóstico de la planilla  (base: ${file})`);
console.log(`Operaciones con origen «sheets»: ${report.operations}`);
console.log('\nPor tipo y moneda:');
if (!report.byKind.length) console.log('  (no hay operaciones de planilla en esta base)');
for (const row of report.byKind) {
  const note = row.kind === 'sale' ? 'no mueve caja' : row.kind === 'collection' ? 'entra a la cuenta' : row.kind === 'expense' ? 'sale de la cuenta' : row.kind === 'commission' ? 'comisión del cobro' : '';
  console.log(`  ${row.currency}  ${row.kind.padEnd(11)} ${String(row.count).padStart(4)}  ${money(row.cents, row.currency).padStart(16)}  ${note}`);
}
console.log('\nPor mes:');
for (const row of report.byMonth) {
  console.log(`  ${row.month}  ventas ${money(row.sale)} · cobros ${money(row.collection)} · gastos ${money(row.expense)}`);
}
console.log('\nPosibles duplicados (mismo importe y concepto):');
if (!report.duplicates.length) console.log('  ninguno');
for (const group of report.duplicates) {
  console.log(`  ${money(group.amount)}  ${group.concept}  ×${group.count}  fechas [${group.dates.join(', ')}]  refs [${group.refs.join(', ')}]`);
}
console.log('\nReferencias de pedido repetidas:');
if (!report.repeatedRefs.length) console.log('  ninguna');
for (const row of report.repeatedRefs) console.log(`  ${row.ref}  → ${row.count} ventas`);
console.log(`\nCobros registrados: ${report.collectionsForSales} · ventas con cobro: ${report.salesWithCollection}/${sales.size} · cobros sin venta: ${report.orphanCollections}`);
console.log('\nRecordá: el saldo de las cuentas suma cobros y resta gastos; las ventas quedan como pendientes de cobro.');
db.close();
