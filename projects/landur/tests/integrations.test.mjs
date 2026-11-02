// Conexiones Shopify y Meta Ads: el mismo motor sirve al servidor autónomo y al
// portal, así que sus reglas se prueban acá con proveedores simulados. La clave
// comercial: sincronizar dos veces no duplica nada (deduplicación por
// source + external_id) y los errores de una fila no abortan el lote.
import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationsAgainst, saveShopify, saveMeta} from './helpers/integrations-fixture.mjs';

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
