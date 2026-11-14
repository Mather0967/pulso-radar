// Aviso de la planilla → sincronía. La ruta es la única de LANDUR que no lleva sesión ni `Origin`
// (la llama Apps Script o un cron): se prueba que sin token no existe, que un token malo no entra
// ni se puede adivinar a ritmo, y que con el token correcto la planilla se sincroniza de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLandurPortal } from '../namecheap/server/landur.mjs';
import { Ledger } from '../projects/landur/server/ledger.mjs';
import { createIntegrations } from '../projects/landur/server/integrations.mjs';
import { fakeFetch, saveSheets } from '../projects/landur/tests/helpers/integrations-fixture.mjs';

const TOKEN = 'k'.repeat(40);
async function portal(env) {
  const dir = await mkdtemp(path.join(tmpdir(), 'landur-hook-'));
  // La base queda con la conexión ya guardada, como la dejaría la pantalla de Conexiones.
  const ledger = new Ledger(path.join(dir, 'landur.sqlite'));
  ledger.workspace('landur');
  const account = ledger.command('landur', 'prep', 'account-00000001', { kind: 'account', name: 'Banco QA', accountKind: 'bank', currency: 'USD', opening: '100', cutoff: '2026-10-01', verified: true, accessible: true });
  createIntegrations({ fetchImpl: fakeFetch }).save(ledger, 'landur', 'prep', saveSheets({ accountId: account.id }));
  ledger.close();
  const handler = createLandurPortal({ dataDir: dir, projectRoot: path.resolve(import.meta.dirname, '../projects/landur'), env: { LANDUR_SYNC_MINUTES: '0', ...env }, fetchImpl: fakeFetch });
  return { handler, close: async () => { handler.close(); await rm(dir, { recursive: true, force: true }); } };
}
const hook = (handler, { method = 'POST', headers = {}, query = '' } = {}) =>
  handler(new Request(`https://rivect.test/landur/api/hooks/sync${query}`, { method, headers }), null, '203.0.113.9');

test('hook: sin token configurado, o con uno corto, la ruta no existe', async () => {
  for (const env of [{}, { LANDUR_SYNC_TOKEN: 'corto' }]) {
    const { handler, close } = await portal(env);
    try { assert.equal((await hook(handler, { headers: { authorization: 'Bearer corto' } })).status, 404); }
    finally { await close(); }
  }
});

test('hook: solo POST, y un token malo no entra', async () => {
  const { handler, close } = await portal({ LANDUR_SYNC_TOKEN: TOKEN });
  try {
    assert.equal((await hook(handler, { method: 'GET' })).status, 405);
    assert.equal((await hook(handler)).status, 401);
    assert.equal((await hook(handler, { headers: { authorization: 'Bearer ' + 'x'.repeat(40) } })).status, 401);
    assert.equal((await hook(handler, { headers: { 'x-landur-token': TOKEN.slice(1) } })).status, 401);
  } finally { await close(); }
});

test('hook: los intentos fallidos tienen tope por minuto', async () => {
  const { handler, close } = await portal({ LANDUR_SYNC_TOKEN: TOKEN });
  try {
    const statuses = [];
    for (let i = 0; i < 24; i++) statuses.push((await hook(handler, { headers: { authorization: 'Bearer mal' } })).status);
    assert.equal(statuses.filter(status => status === 401).length, 20);
    assert.equal(statuses.at(-1), 429);
    // Con el tope alcanzado, el token correcto sigue entrando: el tope es de los fallidos.
    assert.equal((await hook(handler, { headers: { authorization: `Bearer ${TOKEN}` }, query: '?wait=1' })).status, 200);
  } finally { await close(); }
});

test('hook: con el token correcto sincroniza la planilla (sin sesión ni Origin)', async () => {
  const { handler, close } = await portal({ LANDUR_SYNC_TOKEN: TOKEN });
  try {
    const response = await hook(handler, { headers: { authorization: `Bearer ${TOKEN}` }, query: '?wait=1' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.ok, true);
    assert.equal(body.result.created, 8);
    assert.deepEqual(body.result.totals, { sheetRows: 3, sheetCents: 438000, appRows: 2, appCents: 265000 });
    // Un segundo aviso no duplica nada (y por el intervalo mínimo queda agendado, no corre ya).
    const again = await hook(handler, { headers: { 'x-landur-token': TOKEN } });
    assert.equal(again.status, 202);
    assert.equal((await again.json()).accepted, true);
  } finally { await close(); }
});
