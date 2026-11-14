// Sincronía automática: el aviso de la planilla, el reloj y el botón comparten una sola corrida,
// los avisos seguidos se juntan, y una falla no tumba nada ni llena la auditoría.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoSync, syncIntervalMs, tokenMatches} from '../server/auto-sync.mjs';
import {integrationsAgainst, saveSheets} from './helpers/integrations-fixture.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Espera una condición en vez de un tiempo fijo: la prueba no depende de qué tan cargado esté el servidor.
async function until(condition, limit = 5000) {
  const start = Date.now();
  while (!condition()) { if (Date.now() - start > limit) assert.fail('la condición no se cumplió a tiempo'); await sleep(10); }
}
const sales = ledger => ledger.snapshot('landur').operations.filter(o => o.kind === 'sale' && !o.reversed_by).length;

test('auto: dos avisos a la vez comparten la misma corrida y no duplican nada', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const auto = createAutoSync({ledger, workspace: 'landur', connections, minGapMs: 40});
  const [a, b] = await Promise.all([auto.trigger('webhook'), auto.trigger('reloj')]);
  assert.equal(a, b); // la misma corrida
  assert.equal(a.ok, true);
  assert.equal(a.created, 8); // 2 ventas + 2 cobros + 2 materiales + 2 envíos
  assert.equal(sales(ledger), 2);
  // El segundo aviso quedó agendado para después del intervalo mínimo: corre y no encuentra nada nuevo.
  await until(() => auto.status().last.reason === 'diferida');
  assert.equal(auto.status().last.created, 0);
  assert.equal(sales(ledger), 2);
  auto.stop(); ledger.close();
});

test('auto: un aviso dentro del intervalo mínimo se agenda en vez de correr de nuevo', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const auto = createAutoSync({ledger, workspace: 'landur', connections, minGapMs: 120});
  await auto.trigger('webhook');
  const second = await auto.trigger('webhook');
  assert.deepEqual(second, {queued: true});
  assert.equal(auto.status().pending, true);
  await until(() => auto.status().last.reason === 'diferida');
  assert.equal(auto.status().pending, false);
  auto.stop(); ledger.close();
});

test('auto: sin conexión guardada lo dice y no falla', async () => {
  const {ledger, connections} = await integrationsAgainst();
  const auto = createAutoSync({ledger, workspace: 'landur', connections, minGapMs: 0});
  const result = await auto.trigger('webhook');
  assert.equal(result.ok, false);
  assert.match(result.message, /Todavía no hay una conexión/);
  auto.stop(); ledger.close();
});

test('auto: una planilla sin compartir no tumba el proceso y la auditoría no se llena', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId, sheetName: 'privada'}));
  const auto = createAutoSync({ledger, workspace: 'landur', connections, minGapMs: 0});
  const first = await auto.trigger('webhook');
  await auto.trigger('webhook'); await auto.trigger('webhook');
  assert.equal(first.ok, false);
  assert.match(first.message, /compartí la planilla/);
  const errors = ledger.snapshot('landur').audit.filter(entry => entry.action === 'sync.sheets.error');
  assert.equal(errors.length, 1); // tres fallas iguales, un solo asiento
  auto.stop(); ledger.close();
});

test('auto: el reloj interno sincroniza solo y se detiene', async () => {
  const {ledger, connections, accountId} = await integrationsAgainst();
  connections.save(ledger, 'landur', 'tester', saveSheets({accountId}));
  const auto = createAutoSync({ledger, workspace: 'landur', connections, everyMs: 30, minGapMs: 0});
  auto.start();
  await until(() => auto.status().last?.reason === 'reloj');
  assert.equal(sales(ledger), 2);
  auto.stop();
  await sleep(60); // por si había una corrida en vuelo al detener
  const at = auto.status().last.at;
  await sleep(100);
  assert.equal(auto.status().last.at, at); // detenido: no hay más corridas
  ledger.close();
});

test('auto: el intervalo se interpreta y se acota', () => {
  assert.equal(syncIntervalMs(undefined), 300000);
  assert.equal(syncIntervalMs(''), 300000);
  assert.equal(syncIntervalMs('0'), 0);
  assert.equal(syncIntervalMs('abc'), 0);
  assert.equal(syncIntervalMs('1'), 60000);
  assert.equal(syncIntervalMs('99999'), 1440 * 60000);
});

test('auto: el token se compara sin atajos', () => {
  const token = 'a'.repeat(40);
  assert.equal(tokenMatches(token, token), true);
  assert.equal(tokenMatches(token, token + 'a'), false);
  assert.equal(tokenMatches(token, ''), false);
  assert.equal(tokenMatches('', ''), false);
  assert.equal(tokenMatches(token, undefined), false);
});
