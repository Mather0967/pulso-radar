// Conexiones Shopify, Meta Ads y Google Sheets: el mismo motor sirve al servidor autónomo y al
// portal, así que sus reglas se prueban acá con proveedores simulados. La clave
// comercial: sincronizar dos veces no duplica nada (deduplicación por
// source + external_id) y los errores de una fila no abortan el lote.
import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationsAgainst, saveShopify, saveMeta, saveSheets, sheetEdits, MINORISTA_ROWS, MINORISTA_HEADER} from './helpers/integrations-fixture.mjs';

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
  assert.equal(summary.skipped.sinCobro, 2);
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.since, '2026-11-08');
  assert.equal(summary.until, '2026-11-09');

  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  assert.equal(ops.filter(o => o.kind === 'sale').length, 2);
  assert.equal(ops.filter(o => o.kind === 'collection').length, 0);
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
  // La fila tiene «Transf.» = FALSE: queda como venta pendiente y no se registra cobro.
  assert.equal(ops.filter(o => o.kind === 'collection').length, 0);
  ledger.close();
});

test('sheets: la pestaña mayorista del Excel entra como venta y no inventa cobro', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'mayorista'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  // Sin Nro. Pedido, sin Estado y sin comisión: 3 ventas, 3 gastos de material y ningún cobro.
  assert.equal(summary.created.length, 6);
  assert.equal(summary.skipped.sinCobro, 3);
  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  assert.equal(ops.filter(o => o.kind === 'collection').length, 0);
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
  assert.equal(summary.created.length, 6);
  const placa = ledger.snapshot('landur').operations.find(o => o.kind === 'expense' && o.concept.includes('Ilumimate placa'));
  assert.equal(placa.amount, 82500); // 825, no 750
  ledger.close();
});

test('sheets: con «no registrar gasto» el material no entra', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'mayorista', materialColumn: 'none'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(summary.created.length, 3); // solo ventas
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
  assert.equal(live[0].external_id, 'row-#1275~2');
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
    sale({Fecha: serial(2026, 11, 8), Cliente: 'Esteban Fernandez', Canal: 'Web', 'Nro. Pedido': '#1275', Pedido: '2 ilumimate1 (Negro)', Unidades: 2, Estado: 'Enviado', Bruto: 970, 'MP Fee': 101, Material: 80, 'Envío': 190}),
    sale({Fecha: serial(2026, 11, 9), Cliente: 'Patricia Martinez', Canal: 'Web', 'Nro. Pedido': '#1276', Pedido: '1 Set Decantador Mundo', Unidades: 1, Estado: 'Enviado', Bruto: 1680, 'MP Fee': 174, Material: 730, 'Envío': 190}),
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
