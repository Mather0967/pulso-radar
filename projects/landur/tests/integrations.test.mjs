// Conexiones Shopify y Meta Ads: el mismo motor sirve al servidor autónomo y al
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
  assert.equal(kinds.filter(k => k === 'commission').length, 2); // la comisión queda explícita

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
  // 3 filas con importe: 2 enviadas + 1 cancelada.
  assert.equal(summary.rows, 3);
  assert.equal(summary.created.length, 4); // 2 ventas + 2 cobros
  assert.equal(summary.skipped.canceladas, 1);
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.since, '2026-11-08');
  assert.equal(summary.until, '2026-11-09');

  const ops = ledger.snapshot('landur').operations.filter(o => o.source === 'sheets');
  assert.equal(ops.filter(o => o.kind === 'sale').length, 2);
  assert.equal(ops.filter(o => o.kind === 'collection').length, 2);
  const sale = ops.find(o => o.kind === 'sale' && o.concept.includes('#1275'));
  assert.equal(sale.amount, 97000);
  assert.match(sale.concept, /Esteban Fernandez/);
  // La comisión sale de la planilla (MP Fee = 101), no de una regla inventada.
  const collection = ops.find(o => o.kind === 'collection' && o.external_id === 'row-#1275-cobro');
  assert.equal(collection.amount, 97000);

  const second = await connections.sync(ledger, 'landur', 'tester', 'sheets', {});
  assert.deepEqual(second.created, []);
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
