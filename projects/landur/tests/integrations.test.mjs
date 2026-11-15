// Conexiones Shopify, Meta Ads y Google Sheets: el mismo motor sirve al servidor autónomo y al
// portal, así que sus reglas se prueban acá con proveedores simulados. La clave
// comercial: sincronizar dos veces no duplica nada (deduplicación por
// source + external_id) y los errores de una fila no abortan el lote.
import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationsAgainst, saveShopify, saveMeta, saveSheets, sheetEdits, MINORISTA_ROWS, MINORISTA_UNPAID_ROWS, MAYORISTA_ROWS, MINORISTA_HEADER} from './helpers/integrations-fixture.mjs';

test('conexiones: el token se guarda completo y se informa enmascarado', async () => {
  const {ledger, connections} = await integrationsAgainst();
  const saved = connections.save(ledger, 'landur', 'tester', saveShopify({}));
  assert.equal(saved.saved, true);
  assert.equal(saved.status.configured, true);
  assert.match(saved.status.tokenMask, /^shpat_…/);
  assert.ok(!JSON.stringify(saved.status).includes(saveShopify({}).accessToken));
  const both = connections.status(ledger, 'landur');
  assert.equal(both.shopify.domain, 'landur-qa.myshopify.com');
  assert.equal(both.meta.configured, false);
  ledger.close();
});

test('shopify: ventas pagas se registran como venta + cobro; test y canceladas se omiten', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveShopify({accountId}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'shopify', {});
  // El proveedor simulado ofrece 4 órdenes: 2 pagas + 1 de prueba + 1 cancelada.
  assert.equal(summary.orders, 4);
  assert.equal(summary.created.length, 4); // 2 ventas + 2 cobros
  assert.equal(summary.skipped.prueba, 1);
  assert.equal(summary.skipped.canceladas, 1);
  assert.deepEqual(summary.errors, []);

  const kinds = ledger.snapshot('landur').operations.map(o => o.kind);
  assert.equal(kinds.filter(k => k === 'sale').length, 2);
  assert.equal(kinds.filter(k => k === 'collection').length, 2);
  // Shopify ya no descuenta comisión: el cobro entra por el total y el ajuste es manual.
  assert.equal(kinds.filter(k => k === 'commission').length, 0);

  // Segunda sincronía: nada nuevo.
  const second = await connections.sync(ledger, 'landur', 'tester', 'shopify', {});
  assert.deepEqual(second.created, []);
  assert.equal(second.skipped.duplicadas, 2);
  ledger.close();
});

test('shopify: moneda ajena al espacio se reporta por fila y no corta el lote', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveShopify({currency: 'BRL', accountId}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'shopify', {});
  assert.equal(summary.errors.length, 2); // las dos órdenes en USD no entran: no hay conversiones
  assert.equal(summary.created.length, 0);
  // Lo único que sale del lote en limpio son las pruebas y las canceladas.
  assert.equal(summary.skipped.prueba, 1);
  assert.equal(summary.skipped.canceladas, 1);
  ledger.close();
});

test('meta: gasto diario por campaña; repetir no duplica', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveMeta({accountId}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'meta', {});
  assert.equal(summary.created.length, 2);
  assert.deepEqual(summary.errors, []);
  const expenses = ledger.snapshot('landur').operations.filter(o => o.kind === 'expense');
  assert.equal(expenses.length, 2);
  assert.ok(expenses.every(o => o.source === 'meta-ads' && o.category === 'Publicidad'));

  const second = await connections.sync(ledger, 'landur', 'tester', 'meta', {});
  assert.deepEqual(second.created, []);
  assert.equal(second.skipped.duplicadas, 2);
  ledger.close();
});

test('meta: sin cuenta elegida, avisa por fila y el resto del lote proceeds', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveMeta({accountId: ''}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'meta', {});
  assert.equal(summary.created.length, 0);
  assert.ok(summary.errors.every(error => /cuenta/.test(error.message)));
  ledger.close();
});

test('sin conexión guardada, la sincronía lo dice claramente', async () => {
  const {ledger, connections} = await integrationsAgainst();
  await assert.rejects(() => connections.sync(ledger, 'landur', 'tester', 'shopify', {}), /Primero guardá la configuración/);
  await assert.rejects(() => connections.sync(ledger, 'landur', 'tester', 'meta', {}), /Primero guardá la configuración/);
  ledger.close();
});

// ................ Google Sheets ................
// La planilla es la fuente de la venta del cliente: se importan filas, no se reinterpretan
// sus números. Sin comisión en la fila no hay cobro, y sin mes no se fecha el día suelto.
test('sheets: la cuenta de servicio se guarda y se informa sin la clave', async () => {
  const {ledger, connections} = await integrationsAgainst();
  const saved = connections.save(ledger, 'landur', 'tester', saveSheets({}));
  assert.equal(saved.saved, true);
  assert.equal(saved.status.clientEmail, 'landur-qa@landur-qa.iam.gserviceaccount.com');
  assert.equal(saved.status.keyMask, 'Clave guardada');
  assert.ok(!JSON.stringify(saved.status).includes('BEGIN PRIVATE KEY'));
  const status = connections.status(ledger, 'landur');
  assert.equal(status.sheets.sheetName, 'minorista');
  assert.equal(status.sheets.month, '2026-11');
  ledger.close();
});

test('sheets: cada fila es una venta y, con cuenta, su cobro; repetir no duplica', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  // 3 filas con importe: 2 activas + 1 cancelada. Las activas tienen «Transf.» = FALSE:
  // dejan su venta y ningún cobro.
  assert.equal(summary.rows, 3);
  assert.equal(summary.created.length, 8); // 2 ventas + 2 cobros + 2 materiales + 2 envíos
  assert.equal(summary.skipped.canceladas, 1);
  assert.equal(summary.skipped.sinCobro, 0);
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.since, '2026-11-08');
  assert.equal(summary.until, '2026-11-09');

  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  assert.equal(ops.filter(o => o.kind === 'sale').length, 2);
  assert.equal(ops.filter(o => o.kind === 'collection').length, 2);
  const sale = ops.find(o => o.kind === 'sale' && o.concept.includes('#1275'));
  assert.equal(sale.amount, 97000);
  assert.equal(sale.date, '2026-11-08');
  assert.match(sale.concept, /Esteban Fernandez/);
  // La comisión sale de la planilla (MP Fee = 101), no de una regla inventada.
  const collection = ops.find(o => o.kind === 'collection' && o.external_id === 'row-#1275-cobro');
  assert.equal(collection.amount, 97000);
  // Material (80) y Envío (190) de la minorista salen como gasto de la misma cuenta.
  const material = ops.find(o => o.kind === 'expense' && o.external_id === 'row-#1275-material');
  const shipping = ops.find(o => o.kind === 'expense' && o.external_id === 'row-#1275-envio');
  assert.equal(material.amount, 8000);
  assert.equal(material.category, 'Materiales');
  assert.equal(shipping.amount, 19000);
  assert.equal(shipping.category, 'Envíos');
  // Saldo = apertura 100 + MP Neto (869) − material (80) − envío (190) + lo mismo de la otra fila.
  const balance = ledger.snapshot('landur').accounts[0].balance;
  assert.equal(balance, 10000 + (86900 - 8000 - 19000) + (150600 - 73000 - 19000));

  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(second.created, []);
  assert.deepEqual(second.reverted, []);
  assert.equal(second.skipped.duplicadas, 2);
  ledger.close();
});

test('sheets: si la fecha es solo el día y no hay mes, no se inventa la fecha', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'solodia', month: ''}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.length, 0);
  assert.equal(summary.skipped.sinFecha, 1);
  assert.match(summary.errors[0].message, /mes de la planilla/);
  ledger.close();
});

test('sheets: sin cuenta elegida se registran las ventas y no se inventa el cobro', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId: ''}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.length, 2);
  assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'collection').length, 0);
  ledger.close();
});

test('sheets: una planilla sin compartir explica qué hacer', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({sheetName: 'privada'}));
  await assert.rejects(() => connections.sync(ledger, 'landur', 'tester', 'sheets', {}), /compartí la planilla/i);
  ledger.close();
});

test('sheets: un enlace, una clave o un mes inválidos se rechazan al guardar', async () => {
  const {ledger, connections} = await integrationsAgainst();
  assert.throws(() => connections.save(ledger, 'landur', 'tester', saveSheets({spreadsheetId: 'no-es-una-planilla'})), /identificador de la planilla/);
  assert.throws(() => connections.save(ledger, 'landur', 'tester', saveSheets({serviceAccount: 'no es json'})), /JSON/);
  assert.throws(() => connections.save(ledger, 'landur', 'tester', saveSheets({month: '2026-13'})), /AAAA-MM/);
  ledger.close();
});

// La regla de cobro por estado la confirma el cliente en la conexión: la importación la
// respeta tal cual y, si no indicó estados, conserva el comportamiento anterior.
test('sheets: con estados de cobro indicados, solo esas filas generan cobro', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'estados', paidStates: 'Enviado'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  // Una fila Enviado (venta + cobro) y una Pendiente (solo venta).
  assert.equal(summary.created.length, 3);
  assert.equal(summary.skipped.sinCobro, 1);
  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  assert.equal(ops.filter(o => o.kind === 'sale').length, 2);
  assert.equal(ops.filter(o => o.kind === 'collection').length, 1);
  assert.match(ops.find(o => o.kind === 'collection').concept, /2001/);
  ledger.close();
});

test('sheets: sin estados indicados se mantiene el cobro en toda fila con comisión', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'estados'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.length, 4); // 2 ventas + 2 cobros
  assert.equal(summary.skipped.sinCobro, 0);
  ledger.close();
});

test('sheets: los estados de cobro se normalizan y se informan en la conexión', async () => {
  const {ledger, connections} = await integrationsAgainst();
  const saved = connections.save(ledger, 'landur', 'tester', saveSheets({paidStates: ' enviado , Entregado , enviado '}));
  assert.equal(saved.status.paidStates, 'enviado, Entregado');
  assert.ok(!JSON.stringify(saved.status).includes('BEGIN PRIVATE KEY'));
  ledger.close();
});

// La planilla se lee con los encabezados exactos del Excel del cliente, no con una versión
// recortada: si una columna cambia de nombre o de lugar, esto lo muestra.
test('sheets: la pestaña minorista real ubica cada columna en su lugar', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  const sale = ops.find(o => o.kind === 'sale' && o.concept.includes('#1275'));
  assert.equal(sale.amount, 97000);
  assert.equal(sale.date, '2026-11-08');
  assert.match(sale.concept, /Esteban Fernandez/);
  assert.match(sale.concept, /2 ilumimate1/); // usa «Pedido», no «Material» ni «Cuenta Landur»
  // Con «Transf.» en TRUE (el fixture marca el pago) cada fila deja su cobro; sin marcar no habría (ver «transf:»).
  assert.equal(ops.filter(o => o.kind === 'collection').length, 2);
  ledger.close();
});

test('sheets: la pestaña mayorista del Excel entra como venta y, con «Transf.» en TRUE, cobra completo', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'mayorista'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  // Sin Nro. Pedido ni comisión y con «Transf.» en TRUE: 3 ventas, 3 gastos de material y 3 cobros completos.
  assert.equal(summary.created.length, 9);
  assert.equal(summary.skipped.sinCobro, 0);
  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  assert.equal(ops.filter(o => o.kind === 'collection').length, 3);
  const placa = ops.find(o => o.kind === 'sale' && o.concept.includes('Ilumimate placa'));
  assert.equal(placa.amount, 294000);
  assert.equal(placa.date, '2026-11-08');
  assert.match(placa.concept, /Mateico/); // usa «Producto» y «Cliente» de esa pestaña
  // El material entra como gasto con el valor de «Material Real» (750), no del +10 %.
  const material = ops.find(o => o.kind === 'expense' && o.concept.includes('Ilumimate placa'));
  assert.equal(material.amount, 75000);
  assert.equal(material.category, 'Materiales');
  assert.equal(material.date, '2026-11-08');
  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(second.created, []);
  ledger.close();
});

// El material de la pestaña mayorista se descuenta como gasto: el cliente elige si usa el
// costo real, el valor con 10 % cargado o ninguno. Sin cuenta no hay caja donde asentarlo.
test('sheets: el gasto de material puede tomar el «Material + 10 %»', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'mayorista', materialColumn: 'plus10'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.created.length, 9);
  const placa = ledger.snapshot('landur').operations.find(o => o.kind === 'expense' && o.concept.includes('Ilumimate placa'));
  assert.equal(placa.amount, 82500); // 825, no 750
  ledger.close();
});

test('sheets: con «no registrar gasto» el material no entra', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'mayorista', materialColumn: 'none'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.length, 6); // ventas y sus cobros
  assert.equal(summary.skipped.sinMaterial, 0);
  assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'expense').length, 0);
  ledger.close();
});

test('sheets: sin cuenta no se asienta el material y se informa', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId: '', sheetName: 'mayorista'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.length, 3);
  assert.equal(summary.skipped.sinMaterial, 3);
  assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'expense').length, 0);
  ledger.close();
});

test('sheets: el costo de material se valida al guardar', async () => {
  const {ledger, connections} = await integrationsAgainst();
  assert.throws(() => connections.save(ledger, 'landur', 'tester', saveSheets({materialColumn: 'inventado'})), /material/i);
  const saved = connections.save(ledger, 'landur', 'tester', saveSheets({}));
  assert.equal(saved.status.materialColumn, 'real'); // por defecto, el costo efectivo
  ledger.close();
});

// Una referencia repetida con otro importe no puede pasar como «ya estaba»: eso perdería plata
// en silencio. Se informa la fila para que se corrija en la planilla.
test('sheets: si la referencia ya existe con otro importe, se revierte y se rehace como dice la planilla', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  ledger.command('landur', 'tester', 'manual-000000001', {kind: 'sale', concept: 'Venta vieja del mismo número', amount: '50.00', currency: 'USD', date: '2026-11-08', source: 'sheets', externalId: 'row-#1275'});
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  assert.deepEqual(summary.reverted.map(item => item.kind), ['sale']);
  const live = ledger.snapshot('landur').operations.filter(o => o.kind === 'sale' && !o.reversed_by && o.concept.includes('#1275'));
  assert.equal(live.length, 1);
  assert.equal(live[0].amount, 97000); // 970 de la planilla, no los 50 viejos
  assert.equal(live[0].external_id, 'row-#1275-r2');
  // Repetir no revierte ni crea nada más.
  const again = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual([again.created, again.reverted], [[], []]);
  ledger.close();
});

// La planilla del cliente cambia después de sincronizar: LANDUR debe quedar igual a la planilla.
test('sheets: importe editado, fila borrada y pedido cancelado después de sincronizar se reflejan', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  const [header, r1275, r1276] = MINORISTA_ROWS;
  const edited = [...r1275]; edited[8] = 1000; edited[9] = 105; edited[10] = 895; // 970 → 1000
  sheetEdits.minorista = [header, edited, r1276];
  try {
    const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.deepEqual(second.errors, []);
    assert.equal(second.reverted.length, 4); // cobro + material + envío + venta de #1275
    const sales = ledger.snapshot('landur').operations.filter(o => o.kind === 'sale' && !o.reversed_by);
    assert.deepEqual(sales.map(o => o.amount).sort(), [100000, 168000]);
    assert.deepEqual(second.totals, {sheetRows: 2, sheetCents: 268000, appRows: 2, appCents: 268000});
    // Se borra la fila #1276: se revierte entera (venta, cobro, material y envío).
    sheetEdits.minorista = [header, edited];
    const third = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.equal(third.reverted.length, 4);
    // Y #1275 pasa a «Cancelado»: tampoco queda como venta.
    const cancelled = [...edited]; cancelled[7] = 'Cancelado';
    sheetEdits.minorista = [header, cancelled];
    const fourth = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.equal(fourth.reverted.length, 4);
    const snapshot = ledger.snapshot('landur');
    assert.equal(snapshot.operations.filter(o => o.kind === 'sale' && !o.reversed_by).length, 0);
    // Todo revertido: la cuenta vuelve a su apertura (100) y no quedan gastos ni ventas vigentes.
    assert.equal(snapshot.accounts[0].balance, 10000);
    assert.deepEqual([snapshot.totals[0].sales, snapshot.totals[0].expenses], [0, 0]);
  } finally { delete sheetEdits.minorista; }
  ledger.close();
});

test('sheets: si la venta tiene un cobro cargado a mano, no se revierte sola', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  const sale = ledger.snapshot('landur').operations.find(o => o.kind === 'sale' && o.concept.includes('#1275'));
  ledger.command('landur', 'tester', 'manual-000000002', {kind: 'collection', concept: 'Cobro a mano', accountId, targetId: sale.id, amount: '970.00', currency: 'USD', commission: '1.00', date: '2026-11-09'});
  const [header, r1275, r1276] = MINORISTA_ROWS;
  const edited = [...r1275]; edited[8] = 1000;
  sheetEdits.minorista = [header, edited, r1276];
  try {
    const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.ok(summary.errors.some(error => /cobros cargados a mano/.test(error.message)), JSON.stringify(summary.errors));
    assert.deepEqual(summary.reverted, []);
    assert.equal(ledger.snapshot('landur').operations.find(o => o.id === sale.id).reversed_by, null);
  } finally { delete sheetEdits.minorista; }
  ledger.close();
});

test('sheets: una pestaña que pierde casi todas sus filas no revierte nada', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({}));
  const row = n => [9, `Cliente ${n}`, 'Web', `#${5000 + n}`, 'MP', '1 lámpara', 1, 'Enviado', 100 + n, 10, 90 + n];
  sheetEdits.minorista = [MINORISTA_HEADER, ...[1, 2, 3, 4, 5, 6, 7, 8].map(row)];
  try {
    await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    sheetEdits.minorista = [MINORISTA_HEADER, row(1), row(2)]; // pestaña equivocada o vaciada por error
    const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.match(summary.errors[0].message, /perdió 6 de 8 filas/);
    assert.deepEqual(summary.reverted, []);
    assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'sale' && !o.reversed_by).length, 8);
  } finally { delete sheetEdits.minorista; }
  ledger.close();
});

test('sheets: una referencia con puntos o dos puntos no rompe la clave de la operación', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'referencias'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.created.length, 4); // 2 ventas + 2 cobros
  ledger.close();
});

// --- Planilla real del cliente: lo que pasó en la demo ---------------------------------------------
// La pestaña real escribe el mes en la primera fecha de cada tramo («Setiembre 16») y después solo el
// día. Antes esa primera fila se perdía y las demás caían en el mes configurado (otro período).
test('sheets: el mes escrito en la fecha rige para las filas siguientes, también tras una cancelada', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({sheetName: 'setiembre'})); // sin cuenta: solo ventas
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  const sales = ledger.snapshot('landur').operations.filter(o => o.kind === 'sale');
  const dates = Object.fromEntries(sales.map(o => [o.concept.split(' · ')[1], o.date]));
  assert.deepEqual(dates, {
    'Milton Guevara': '2026-09-16',
    'Adrian Pinazo Bermudez': '2026-09-16',
    'Francisco Ruiz': '2026-09-17',
    'Beto Octubre': '2026-10-03', // lo fecha el «Octubre 2» de la fila cancelada de arriba
  });
  assert.equal(summary.skipped.canceladas, 1);
  ledger.close();
});

test('sheets: el resultado compara lo que suma la planilla con lo que quedó en LANDUR', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  // Minorista: 970 + 1680 + 1730 en la planilla; la cancelada (1730) no se asienta.
  assert.deepEqual(summary.totals, {sheetRows: 3, sheetCents: 438000, appRows: 2, appCents: 265000});
  ledger.close();
});

// La mayorista real no trae el día: se fecha el 1 del mes de la conexión y se dice cuántas filas fueron así.
test('sheets: sin día en la planilla se fecha el 1 del mes y se informa cuántas filas', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'sinfecha'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.approxDates, 2);
  const sales = ledger.snapshot('landur').operations.filter(o => o.kind === 'sale');
  assert.deepEqual(sales.map(o => o.date), ['2026-11-01', '2026-11-01']);
  assert.deepEqual(summary.totals, {sheetRows: 2, sheetCents: 378000, appRows: 2, appCents: 378000});
  ledger.close();
});

test('sheets: sin día y sin mes en la conexión no se inventa nada', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'sinfecha', month: ''}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.length, 0);
  assert.equal(summary.skipped.sinFecha, 2);
  assert.match(summary.errors[0].message, /falta la fecha/);
  assert.deepEqual(summary.totals, {sheetRows: 2, sheetCents: 378000, appRows: 0, appCents: 0});
  ledger.close();
});

// Dos ventas idénticas sin Nro. Pedido son dos ventas; un Nro. Pedido repetido no se funde en silencio.
test('sheets: filas idénticas sin pedido se registran las dos y un pedido repetido se avisa', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'repetidas'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.filter(item => item.kind === 'sale').length, 3);
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0].message, /#3001 está repetido/);
  assert.deepEqual(summary.totals, {sheetRows: 4, sheetCents: 1180000, appRows: 3, appCents: 1100000});
  // Sincronizar de nuevo no duplica ninguna de las tres.
  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(second.created, []);
  assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'sale').length, 3);
  ledger.close();
});

test('sheets: una fecha con hora cae en su día, no en el siguiente', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({sheetName: 'conhora'}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  const sale = ledger.snapshot('landur').operations.find(o => o.kind === 'sale');
  assert.equal(sale.date, '2025-12-09'); // serial 46000.75 → 9/12/2025 a las 18:00
  ledger.close();
});

// --- Plantilla nueva (docs/plantilla): contrato con el importador ----------------------------------
// Los encabezados se leen del propio generador: si alguien renombra una columna allá, esta prueba falla.
test('plantilla: sus encabezados y reglas entran sin tocar nada y sin avisos', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../docs/plantilla/generar-plantilla.py', import.meta.url), 'utf8');
  const headers = JSON.parse(source.match(/^HEADERS = (\[.*\])$/m)[1]);
  const serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5);
  const row = fields => headers.map(name => fields[name] ?? '');
  const net = (g, f) => (f === '' ? '' : g - f);
  const sale = fields => row({...fields, 'MP Neto': net(fields.Bruto, fields['MP Fee'] ?? ''), 'Ganancia Bruta': fields.Bruto - (fields['MP Fee'] || 0) - (fields.Material || 0) - (fields['Envío'] || 0)});
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'plantilla', month: ''})); // sin «mes de la planilla»
  sheetEdits.plantilla = [headers,
    sale({Fecha: serial(2026, 11, 8), Cliente: 'Esteban Fernandez', Canal: 'Web', 'Nro. Pedido': '#1275', 'Transf.': true, Pedido: '2 ilumimate1 (Negro)', Unidades: 2, Estado: 'Enviado', Bruto: 970, 'MP Fee': 101, Material: 80, 'Envío': 190}),
    sale({Fecha: serial(2026, 11, 9), Cliente: 'Patricia Martinez', Canal: 'Web', 'Nro. Pedido': '#1276', 'Transf.': true, Pedido: '1 Set Decantador Mundo', Unidades: 1, Estado: 'Enviado', Bruto: 1680, 'MP Fee': 174, Material: 730, 'Envío': 190}),
    // Mayorista: misma pestaña, número M-…, sin comisión cargada = vendida pero todavía sin cobro.
    sale({Fecha: serial(2026, 11, 9), Cliente: 'Mateico', Canal: 'Mayorista', 'Nro. Pedido': 'M-001', Pedido: 'Ilumimate placa', Unidades: 30, Estado: 'Enviado', Bruto: 2940, Material: 750}),
    // Las fórmulas pre-armadas dejan filas «vacías» hasta la 500: no cuentan ni avisan.
    row({}), row({}), row({}),
  ];
  try {
    const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.deepEqual(summary.errors, []);
    assert.equal(summary.skipped.vacias, 0);
    assert.equal(summary.approxDates, 0);
    // 3 ventas, 2 cobros (la mayorista no tiene comisión), 3 materiales y 2 envíos (la mayorista no tiene).
    const byKind = Object.fromEntries(['sale', 'collection', 'expense'].map(kind => [kind, summary.created.filter(item => item.kind === kind).length]));
    assert.deepEqual(byKind, {sale: 3, collection: 2, expense: 5});
    assert.equal(summary.skipped.sinCobro, 1);
    assert.deepEqual(summary.totals, {sheetRows: 3, sheetCents: 559000, appRows: 3, appCents: 559000});
    const dates = ledger.snapshot('landur').operations.filter(o => o.kind === 'sale').map(o => o.date).sort();
    assert.deepEqual(dates, ['2026-11-08', '2026-11-09', '2026-11-09']);
    // Saldo = apertura 100 + Ganancia Bruta de las dos cobradas (599 + 586) − material de la mayorista (750).
    assert.equal(ledger.snapshot('landur').accounts[0].balance, 10000 + 59900 + 58600 - 75000);
  } finally { delete sheetEdits.plantilla; }
  ledger.close();
});

// --- «Transf.»: la planilla del cliente marca el pago ahí, no en «Estado» -----------------------------
test('transf: sin TRUE la venta entra y el cobro no; con TRUE entra el cobro', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  sheetEdits.minorista = MINORISTA_UNPAID_ROWS; // tal cual la carga el cliente: Transf. en FALSE
  try {
    const unpaid = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.equal(unpaid.created.filter(item => item.kind === 'sale').length, 2);
    assert.equal(unpaid.created.filter(item => item.kind === 'collection').length, 0);
    assert.equal(unpaid.skipped.sinCobro, 2);
    // Se marca «Transf.» en una de las dos: aparece su cobro, y solo el suyo.
    const [header, r1275, r1276] = MINORISTA_UNPAID_ROWS;
    sheetEdits.minorista = [header, r1275.map((value, column) => (column === 19 ? true : value)), r1276];
    const paid = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.deepEqual(paid.created.map(item => item.kind), ['collection']);
  } finally { delete sheetEdits.minorista; }
  ledger.close();
});

test('transf: si la planilla desmarca el pago el cobro se revierte, y al volver a marcarlo se registra de nuevo', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const [header, r1275] = MINORISTA_ROWS;
  const marked = value => [header, r1275.map((cell, column) => (column === 19 ? value : cell))];
  const live = kind => ledger.snapshot('landur').operations.filter(o => o.kind === kind && !o.reversed_by);
  try {
    sheetEdits.minorista = marked(true);
    await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.equal(live('collection').length, 1);
    sheetEdits.minorista = marked(false);
    const off = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.deepEqual(off.reverted.map(item => item.kind), ['collection']);
    assert.equal(live('collection').length, 0);
    assert.equal(live('sale').length, 1); // la venta sigue
    sheetEdits.minorista = marked(true);
    await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    const back = live('collection');
    assert.equal(back.length, 1);
    assert.equal(back[0].external_id, 'row-#1275-cobro-r2');
  } finally { delete sheetEdits.minorista; }
  ledger.close();
});

test('transf: un valor que no se entiende se avisa y no se inventa el cobro', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const [header, r1275] = MINORISTA_ROWS;
  sheetEdits.minorista = [header, r1275.map((cell, column) => (column === 19 ? 'no sé' : cell))];
  try {
    const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.match(summary.errors[0].message, /Transf/);
    assert.equal(summary.created.filter(item => item.kind === 'collection').length, 0);
  } finally { delete sheetEdits.minorista; }
  ledger.close();
});

// --- Ventas eliminadas en LANDUR: no se rehacen solas, se preguntan ---------------------------------
test('eliminadas: una venta eliminada que sigue en la planilla no vuelve sola; con restoreDeleted sí', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  const sale = ledger.snapshot('landur').operations.find(o => o.kind === 'sale' && o.concept.includes('#1275'));
  // Se elimina como lo hace la app: primero el cobro, el material y el envío, después la venta.
  const children = ledger.snapshot('landur').operations.filter(o => o.external_id?.startsWith('row-#1275-') && !o.reversed_by);
  for (const child of children) ledger.command('landur', 'tester', `eliminar-${child.id}`, {kind: 'reversal', operationId: child.id, date: '2026-11-14'});
  ledger.command('landur', 'tester', `eliminar-${sale.id}`, {kind: 'reversal', operationId: sale.id, date: '2026-11-14'});
  const live = () => ledger.snapshot('landur').operations.filter(o => o.concept.includes('#1275') && !o.reversed_by && o.kind === 'sale').length;
  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(second.skipped.eliminadas, 1);
  assert.equal(live(), 0);
  assert.deepEqual(second.created, []); // ni la venta ni sus gastos ni su cobro
  const restored = await connections.sync(ledger, 'landur', 'tester', 'sheets', {restoreDeleted: true});
  assert.equal(live(), 1);
  assert.deepEqual(restored.created.map(item => item.kind).sort(), ['collection', 'expense', 'expense', 'sale']);
  ledger.close();
});

// --- Corte de la cuenta: un aviso en vez de un error por fila -----------------------------------------
test('corte: las ventas anteriores al saldo inicial entran y se avisa una sola vez con la fecha más vieja', async () => {
  const {ledger, connections} = await integrationsAgainst();
  const late = ledger.command('landur', 'tester', 'account-00000002', {kind: 'account', name: 'Caja nueva', accountKind: 'cash', currency: 'USD', opening: '0', cutoff: '2026-11-13', verified: true, accessible: true});
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId: late.id}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.filter(item => item.kind === 'sale').length, 2);
  assert.equal(summary.created.filter(item => item.kind !== 'sale').length, 0);
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0].message, /2 filas tienen fecha anterior al saldo inicial/);
  assert.match(summary.errors[0].message, /2026-11-13/);
  assert.match(summary.errors[0].message, /del 2026-11-08/);
  ledger.close();
});

// --- Varias pestañas en una conexión (minorista + mayorista) ------------------------------------------
test('pestañas: una conexión lee minorista y mayorista y concilia las dos', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  const saved = connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: ' minorista,mayorista , minorista '}));
  assert.equal(saved.status.sheetName, 'minorista, mayorista'); // se normaliza y no repite
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  // Minorista: 2 ventas + 2 cobros + 2 materiales + 2 envíos. Mayorista: 3 ventas + 3 cobros + 3 materiales.
  assert.equal(summary.created.length, 17);
  assert.deepEqual(summary.totals, {sheetRows: 6, sheetCents: 1326000, appRows: 5, appCents: 1153000});
  const again = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual([again.created, again.reverted], [[], []]);
  ledger.close();
});

test('pestañas: si una no se puede leer no se asienta ni se revierte nada', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'minorista, privada'}));
  await assert.rejects(connections.sync(ledger, 'landur', 'tester', 'sheets', {}), /compartí la planilla/);
  assert.equal(ledger.snapshot('landur').operations.length, 0);
  ledger.close();
});

test('pestañas: una fila borrada de una pestaña se revierte sin tocar la otra', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'minorista, mayorista'}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  const live = () => ledger.snapshot('landur').operations.filter(o => o.kind === 'sale' && !o.reversed_by).length;
  assert.equal(live(), 5);
  const [header, first] = MAYORISTA_ROWS;
  sheetEdits.mayorista = [header, first]; // de tres filas queda una
  try {
    const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.equal(summary.reverted.filter(item => item.kind === 'sale').length, 2);
    assert.equal(live(), 3); // 2 de minorista + 1 de mayorista
  } finally { delete sheetEdits.mayorista; }
  ledger.close();
});

test('pestañas: se aceptan hasta 4 y el nombre se valida pestaña por pestaña', async () => {
  const {ledger, connections} = await integrationsAgainst();
  assert.throws(() => connections.save(ledger, 'landur', 'tester', saveSheets({sheetName: 'a, b, c, d, e'})), /máximo 4/);
  assert.throws(() => connections.save(ledger, 'landur', 'tester', saveSheets({sheetName: 'minorista, ven/tas'})), /solo admite letras/);
  ledger.close();
});

// --- La mayorista real de Rafa (planilla del 24/10) ------------------------------------------------------
// «Octubre» solo en la primera fila, el resto de la columna Fecha vacía, «Transf.» marcado fila por fila,
// sin columna de comisión, y una fila sin importe («Microfono»): nada de eso se le pide cambiar.
test('mayorista real: mes escrito, días vacíos y Transf. mixto entran sin pedirle nada a la planilla', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'Mayorista'}));
  const header = ['Fecha','Cliente','Producto','Unidades','Bruto','Material Real','Material + 10%','Transf.','Ganancia Total','Reinversion','Transf.','Rafa','Parte Vendedor','Transf.','Vendedor','15% Ahorro Personal','15% Ahorro Personal'];
  const row = (date, client, product, units, gross, material, paid) => [date, client, product, units, gross, material, material * 1.1, paid, 0, 0, paid, 0, 0, paid, 'Luis', 0, false];
  sheetEdits.Mayorista = [[], header,
    row('Octubre', 'Matesuru', 'Ilumimate caja', 50, 5000, 2500, true),
    row('', 'ClienteB', 'Ilumimate caja', 100, 10000, 5000, true),
    row('', 'ClienteC', 'Ilumimate placa', 200, 20000, 10000, true),
    row('', 'ClienteD', 'Ilumimate caja', 35, 3500, 1750, true),
    row('', 'ClienteE', 'Ilumimate caja', 120, 12000, 6000, true),
    row('', 'ClienteF', 'Yerbera250', 10, 1000, 500, false),
    row('', 'ClienteG', 'Yerbera500', 10, 1000, 500, false),
    ['', '', 'Microfono', 1],
  ];
  try {
    const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    assert.deepEqual(summary.errors, []);
    assert.equal(summary.approxDates, 7); // sin día: se fechan el 1 del mes que dice la planilla
    assert.equal(summary.skipped.vacias, 1); // «Microfono» no tiene importe
    const sales = ledger.snapshot('landur').operations.filter(o => o.kind === 'sale');
    assert.equal(sales.length, 7);
    assert.ok(sales.every(o => o.date === '2026-10-01'), sales.map(o => o.date).join());
    // Cobran las cinco marcadas con TRUE, completas (esta pestaña no tiene comisión); las otras dos quedan por cobrar.
    const collections = ledger.snapshot('landur').operations.filter(o => o.kind === 'collection');
    assert.equal(collections.length, 5);
    assert.equal(collections.reduce((sum, o) => sum + o.amount, 0), (5000 + 10000 + 20000 + 3500 + 12000) * 100);
    assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'commission').length, 0);
    assert.equal(summary.skipped.sinCobro, 2);
    assert.deepEqual(summary.totals, {sheetRows: 7, sheetCents: 5250000, appRows: 7, appCents: 5250000});
  } finally { delete sheetEdits.Mayorista; }
  ledger.close();
});

// --- Eliminar en bloque las ventas de la planilla (se revierten, no se borran) --------------------------
const liveOf = (ledger, kind) => ledger.snapshot('landur').operations.filter(o => o.kind === kind && !o.reversed_by);

test('limpieza: eliminar las ventas de la planilla revierte cobros, comisiones y gastos y deja el saldo en la apertura', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  const before = ledger.snapshot('landur');
  assert.equal(liveOf(ledger, 'sale').length, 2);
  assert.ok(before.accounts[0].balance !== 10000); // hubo movimiento
  const result = ledger.command('landur', 'tester', 'limpiar-ventas-0001', {kind: 'sales.revert', source: 'sheets', confirm: 'ELIMINAR'});
  assert.equal(result.reverted, 2);
  assert.equal(result.skipped, 0);
  assert.equal(result.total, 97000 + 168000);
  // Nada vigente: ni ventas, ni cobros, ni comisiones, ni gastos; el saldo vuelve a la apertura (100).
  for (const kind of ['sale', 'collection', 'commission', 'expense']) assert.equal(liveOf(ledger, kind).length, 0, kind);
  const after = ledger.snapshot('landur');
  assert.equal(after.accounts[0].balance, 10000);
  assert.deepEqual([after.totals[0].sales, after.totals[0].expenses, after.totals[0].receivable], [0, 0, 0]);
  // No se borró nada: todo sigue en el historial, marcado, y queda la auditoría con el detalle.
  assert.equal(after.operations.filter(o => o.source === 'sheets' && o.kind !== 'reversal').length, before.operations.filter(o => o.source === 'sheets').length);
  const audit = after.audit.find(entry => entry.action === 'sales.reverted');
  assert.ok(audit);
  assert.equal(JSON.parse(audit.entity).reverted, 2);
  ledger.close();
});

test('limpieza: exige la palabra de confirmación y no toca nada sin ella', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  for (const confirm of [undefined, '', 'BORRAR', 'si']) {
    assert.throws(() => ledger.command('landur', 'tester', `limpiar-sin-palabra-${String(confirm)}`.padEnd(24, 'x'), {kind: 'sales.revert', source: 'sheets', confirm}), /ELIMINAR/);
  }
  assert.equal(liveOf(ledger, 'sale').length, 2);
  ledger.close();
});

test('limpieza: con fecha solo se eliminan las anteriores', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {}); // #1275 del 08/11 y #1276 del 09/11
  const result = ledger.command('landur', 'tester', 'limpiar-con-fecha-001', {kind: 'sales.revert', source: 'sheets', before: '2026-11-09', confirm: 'eliminar'});
  assert.equal(result.reverted, 1);
  const remaining = liveOf(ledger, 'sale');
  assert.equal(remaining.length, 1);
  assert.match(remaining[0].concept, /#1276/);
  // La de #1276 conserva su cobro y sus gastos.
  assert.equal(liveOf(ledger, 'collection').length, 1);
  assert.equal(liveOf(ledger, 'expense').length, 2);
  ledger.close();
});

test('limpieza: una venta con un cobro cargado a mano no se toca y se informa', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {}); // sin cuenta: solo ventas
  const sale = ledger.snapshot('landur').operations.find(o => o.kind === 'sale' && o.concept.includes('#1275'));
  ledger.command('landur', 'tester', 'manual-000000003', {kind: 'collection', concept: 'Cobro a mano', accountId, targetId: sale.id, amount: '970.00', currency: 'USD', commission: '1.00', date: '2026-11-09'});
  const result = ledger.command('landur', 'tester', 'limpiar-con-manual-01', {kind: 'sales.revert', source: 'sheets', confirm: 'ELIMINAR'});
  assert.deepEqual([result.reverted, result.skipped], [1, 1]);
  assert.equal(liveOf(ledger, 'sale').length, 1);
  assert.match(liveOf(ledger, 'sale')[0].concept, /#1275/);
  assert.equal(liveOf(ledger, 'collection').length, 1); // el cobro a mano sigue
  ledger.close();
});

test('limpieza: no afecta lo cargado a mano ni deja a la sincronía rehacer lo eliminado sin preguntar', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  ledger.command('landur', 'tester', 'venta-manual-000001', {kind: 'sale', concept: 'Venta a mano', amount: '10.00', currency: 'USD', date: '2026-11-01'});
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  ledger.command('landur', 'tester', 'limpiar-todo-0000001', {kind: 'sales.revert', source: 'sheets', confirm: 'ELIMINAR'});
  assert.deepEqual(liveOf(ledger, 'sale').map(o => o.concept), ['Venta a mano']);
  // La planilla todavía tiene las filas: la sincronía no las rehace sola, pregunta (eliminadas).
  const again = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(again.skipped.eliminadas, 2);
  assert.deepEqual(again.created, []);
  // Con la respuesta afirmativa vuelven, completas.
  const restored = await connections.sync(ledger, 'landur', 'tester', 'sheets', {restoreDeleted: true});
  assert.equal(restored.created.filter(item => item.kind === 'sale').length, 2);
  ledger.close();
});

// --- Canal: la lista de Ventas distingue mayorista de minorista ---------------------------------------------
test('canal: la venta lleva el canal de la planilla como categoría', async () => {
  const {ledger, connections} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({sheetName: 'canales', month: ''}));
  const serial = Math.round((Date.UTC(2026, 10, 9) - Date.UTC(1899, 11, 30)) / 864e5);
  const header = ['Fecha', 'Cliente', 'Canal', 'Nro. Pedido', 'Pedido', 'Unidades', 'Estado', 'Bruto'];
  sheetEdits.canales = [header,
    [serial, 'Ana', 'Web', '#9001', '1 lámpara', 1, 'Enviado', 970],
    [serial, 'Matesuru', 'Mayorista', 'M-001', 'Ilumimate caja', 50, '', 5000],
    [serial, 'Beto', 'Instagram', 'IG0001', '1 lámpara', 1, 'Enviado', 390],
    [serial, 'Sin canal', '', '#9002', '1 lámpara', 1, 'Enviado', 100],
  ];
  try {
    await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
    const byOrder = Object.fromEntries(liveOf(ledger, 'sale').map(o => [o.concept.split(' · ')[0], o.category]));
    assert.deepEqual(byOrder, {'Pedido #9001': 'Web', 'Pedido M-001': 'Mayorista', 'Pedido IG0001': 'Instagram', 'Pedido #9002': null});
  } finally { delete sheetEdits.canales; }
  ledger.close();
});

test('canal: la minorista del cliente trae «Canal» y sus ventas lo conservan', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(liveOf(ledger, 'sale').map(o => o.category), ['Web', 'Web']);
  ledger.close();
});
