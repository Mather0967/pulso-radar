// Sincronización automática: se prueba con un motor de conexiones simulado, sin red.
// Lo importante: sólo lo configurado, sólo lo vencido, sin solaparse y sin que un error
// de una conexión frene a las demás.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoSync} from '../server/auto-sync.mjs';

const NOW = Date.parse('2026-11-11T12:00:00Z');
const silent = {warn() {}};

function fake({configured = ['sheets'], lastSync = null, statusOf} = {}) {
  const calls = [];
  const status = statusOf || (() => ({
    shopify: {configured: configured.includes('shopify'), lastSync},
    meta: {configured: configured.includes('meta'), lastSync},
    sheets: {configured: configured.includes('sheets'), lastSync},
  }));
  return {
    calls,
    ledger: {},
    connections: {
      status,
      sync: async (ledger, workspace, actor, kind) => {
        calls.push({kind, actor});
        return {created: [{}], skipped: {revertidas: kind === 'sheets' ? 1 : 0}, errors: []};
      },
    },
  };
}

test('sincronía automática: sincroniza sólo lo configurado', async () => {
  const {calls, connections, ledger} = fake({configured: ['sheets']});
  const auto = createAutoSync({ledger, connections, minutes: 15, now: () => NOW, log: silent});
  const done = await auto.tick();
  assert.deepEqual(calls.map(call => call.kind), ['sheets']);
  assert.equal(calls[0].actor, 'sincronía automática');
  assert.equal(done[0].revertidas, 1);
});

test('sincronía automática: lo sincronizado hace poco no se repite', async () => {
  const {calls, connections, ledger} = fake({lastSync: new Date(NOW - 60_000).toISOString()});
  const auto = createAutoSync({ledger, connections, minutes: 15, now: () => NOW, log: silent});
  assert.deepEqual(await auto.tick(), []);
  assert.deepEqual(calls, []);
});

test('sincronía automática: un error en una conexión no frena las demás', async () => {
  const connections = {
    status: () => ({shopify: {configured: true, lastSync: null}, meta: {configured: true, lastSync: null}, sheets: {configured: false}}),
    sync: async (ledger, workspace, actor, kind) => {
      if (kind === 'shopify') throw new Error('token vencido');
      return {created: [], skipped: {}, errors: []};
    },
  };
  const auto = createAutoSync({ledger: {}, connections, minutes: 15, now: () => NOW, log: silent});
  const done = await auto.tick();
  assert.equal(done.find(entry => entry.kind === 'shopify').error, 'token vencido');
  assert.equal(done.find(entry => entry.kind === 'meta').error, undefined);
});

test('sincronía automática: con 0 minutos queda apagada', async () => {
  const {calls, connections, ledger} = fake({});
  const auto = createAutoSync({ledger, connections, minutes: 0, now: () => NOW, log: silent});
  assert.deepEqual(await auto.tick(), []);
  assert.deepEqual(calls, []);
});
