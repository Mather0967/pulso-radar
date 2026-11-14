// Conexiones Shopify, Meta Ads y Google Sheets: el mismo motor sirve al servidor autónomo y al
// portal, así que sus reglas se prueban acá con proveedores simulados. La clave
// comercial: sincronizar dos veces no duplica nada (deduplicación por
// source + external_id) y los errores de una fila no abortan el lote.
import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationsAgainst, saveShopify, saveMeta, saveSheets} from './helpers/integrations-fixture.mjs';

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
  assert.equal(summary.created.length, 2); // 2 ventas
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

  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(second.created, []);
  assert.equal(second.skipped.duplicadas, 0);
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
test('sheets: si la referencia ya existe con otro importe, avisa y no duplica', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  ledger.command('landur', 'tester', 'manual-000000001', {kind: 'sale', concept: 'Otra venta con el mismo número', amount: '50.00', currency: 'USD', date: '2026-11-08', source: 'sheets', externalId: 'row-#1275'});
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.ok(summary.errors.some(error => /ya está registrada con otro importe o fecha/.test(error.message)), JSON.stringify(summary.errors));
  // El resto de la planilla entra igual.
  assert.equal(summary.created.filter(item => item.kind === 'sale').length, 1);
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

test('sheets: con «Transf.» en TRUE la fila registra su venta y su cobro', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'pagados'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.created.length, 4); // 2 ventas + 2 cobros
  assert.equal(summary.skipped.sinCobro, 0);
  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  assert.equal(ops.filter(o => o.kind === 'collection').length, 2);
  ledger.close();
});

test('sheets: un valor que no se entiende en «Transf.» se informa y no cobra', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'transf-raro'}));
  const summary = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.ok(summary.errors.some(error => /Transf/.test(error.message)));
  assert.equal(summary.created.filter(item => item.kind === 'collection').length, 0);
  ledger.close();
});

test('sheets: si la planilla desmarca el pago, el cobro se revierte y el saldo vuelve', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  // El saldo es la apertura de la cuenta más lo que entren los cobros.
  const opening = ledger.snapshot('landur').accounts.find(a => a.id === accountId).balance;
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'pagados'}));
  const first = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(first.created.filter(item => item.kind === 'collection').length, 2);
  assert.ok(ledger.snapshot('landur').accounts.find(a => a.id === accountId).balance > opening);

  // La planilla deja de marcar «Transf.»: ese cobro no corresponde y se revierte.
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'impagos'}));
  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(second.created, []);
  assert.equal(second.skipped.revertidas, 2);
  assert.equal(ledger.snapshot('landur').accounts.find(a => a.id === accountId).balance, opening);
  const ops = ledger.snapshot('landur').operations;
  assert.equal(ops.filter(o => o.kind === 'reversal').length, 4); // 2 cobros + sus 2 comisiones
  assert.equal(ops.filter(o => o.kind === 'collection' && !o.reversed_by).length, 0);

  // Repetir la sincronía no revierte dos veces.
  const third = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(third.skipped.revertidas ?? 0, 0);

  // Vuelve a marcar el pago: el cobro se registra de nuevo, con otra referencia.
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'pagados'}));
  const fourth = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(fourth.created.filter(item => item.kind === 'collection').length, 2);
  const live = ledger.snapshot('landur').operations.filter(o => o.kind === 'collection' && !o.reversed_by);
  assert.equal(live.length, 2);
  assert.ok(live.every(o => /-r2$/.test(o.external_id)));
  ledger.close();
});

test('sheets: una venta eliminada no vuelve sola, y se puede recuperar a pedido', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'pagados'}));
  await connections.sync(ledger, 'landur', 'tester', 'sheets', {});

  const sale = ledger.snapshot('landur').operations.find(o => o.kind === 'sale' && o.concept.includes('#1275'));
  const collection = ledger.snapshot('landur').operations.find(o => o.kind === 'collection' && o.related_id === sale.id);
  // Eliminar una venta es revertirla: primero su cobro, después la venta.
  ledger.reverse('landur', 'tester', {operationId: collection.id, date: sale.date});
  ledger.reverse('landur', 'tester', {operationId: sale.id, date: sale.date});

  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(second.skipped.eliminadas, 1);
  assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'sale' && !o.reversed_by && o.concept.includes('#1275')).length, 0);

  // Con la respuesta explícita, vuelve la venta (y su cobro, que estaba revertido).
  const restored = await connections.sync(ledger, 'landur', 'tester', 'sheets', {restoreDeleted: true});
  assert.equal(restored.created.filter(item => item.kind === 'sale').length, 1);
  assert.equal(restored.created.filter(item => item.kind === 'collection').length, 1);
  const live = ledger.snapshot('landur').operations.find(o => o.kind === 'sale' && !o.reversed_by && o.concept.includes('#1275'));
  assert.ok(live, 'la venta eliminada se vuelve a registrar');
  assert.match(live.external_id, /-r2$/);
  assert.equal(ledger.snapshot('landur').operations.filter(o => o.kind === 'collection' && !o.reversed_by && o.related_id === live.id).length, 1);

  // Sin la marca no se duplica: la venta viva ya está.
  const third = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.equal(third.created.filter(item => item.kind === 'sale').length, 0);
  ledger.close();
});
