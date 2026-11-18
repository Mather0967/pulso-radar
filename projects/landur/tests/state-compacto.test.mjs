import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Ledger } from '../server/ledger.mjs';

// La pantalla no necesita las revertidas viejas: en producción eran el 82 % de las operaciones y
// `state` tardaba más de 12 s en bajar. Totales, saldos y exportación no pueden cambiar.
test('el estado compacto oculta revertidas viejas sin tocar saldos, totales ni movimientos de la cuenta', t => {
  const ledger = new Ledger(); ledger.workspace('a'); t.after(() => ledger.close());
  const run = input => ledger.command('a', 'tester', randomUUID(), input);
  const account = run({ kind:'account', name:'Banco', accountKind:'bank', currency:'UYU', opening:'60000', cutoff:'2026-10-01', verified:true, accessible:true }).id;
  const op = (kind, extra = {}) => run({ kind, concept:'Prueba sintética', amount:'1490', currency:'UYU', date:'2026-10-24', accountId:account, ...extra }).id;
  const viejo = op('expense'), reciente = op('expense'), vigente = op('expense');
  const reversalViejo = run({ kind:'reversal', operationId:viejo, date:'2026-10-25' }).id;
  const reversalReciente = run({ kind:'reversal', operationId:reciente, date:'2026-10-25' }).id;
  // La reversión del primero ocurrió hace 90 días; la del segundo, recién.
  ledger.db.prepare('UPDATE operations SET reversed_at=? WHERE id=?').run(new Date(Date.now() - 90 * 864e5).toISOString(), viejo);
  const corte = new Date(Date.now() - 30 * 864e5).toISOString();

  const full = ledger.snapshot('a'), compact = ledger.snapshot('a', { hideReversedBefore: corte });
  const ids = snapshot => new Set(snapshot.operations.map(o => o.id));
  assert.ok(ids(full).has(viejo) && ids(full).has(reversalViejo), 'sin opción, el estado sigue completo (exportación)');
  assert.ok(!ids(compact).has(viejo) && !ids(compact).has(reversalViejo), 'la revertida vieja y su contra-asiento se ocultan');
  for (const kept of [reciente, reversalReciente, vigente]) assert.ok(ids(compact).has(kept), 'lo reciente y lo vigente se conservan');
  assert.deepEqual(compact.totals, full.totals);
  assert.equal(compact.accounts[0].balance, full.accounts[0].balance);
  assert.ok(compact.entries.length < full.entries.length);
  assert.ok(compact.entries.every(e => ids(compact).has(e.operation)), 'no quedan asientos de operaciones ocultas');
  assert.equal(compact.accounts[0].movements, full.entries.length, 'la cuenta conserva su cantidad real de asientos');
  assert.equal(full.accounts[0].movements, undefined);
});
