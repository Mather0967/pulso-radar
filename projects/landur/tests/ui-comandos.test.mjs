// Todo comando que la interfaz manda a /api/commands tiene que llevar una clave de operación: el servidor la
// exige (es la que evita duplicar al reintentar) y responde «Falta una clave de operación válida» si no llega.
// Los botones masivos de Conexiones la habían olvidado y fallaban solo en el navegador: ninguna prueba del
// servidor lo ve, así que se revisa acá, en el propio código de la interfaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Ledger} from '../server/ledger.mjs';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const calls = source.split(/\r?\n/).map((text, index) => ({text, line: index + 1})).filter(({text}) => text.includes("api('/api/commands'"));

test('interfaz: hay llamadas a /api/commands y todas llevan clave de operación', () => {
  assert.ok(calls.length >= 5, `no se encontraron las llamadas: ${calls.length}`);
  const keyed = /,\s*(crypto\.randomUUID\(\)|key|pendingRequest\.key)\s*\)/;
  for (const {text, line} of calls)
    assert.match(text, keyed, `app.js:${line} manda un comando sin clave de operación`);
});

test('servidor: un comando sin clave de operación se rechaza y con ella pasa', () => {
  const ledger = new Ledger();
  ledger.workspace('landur');
  const command = {kind: 'sales.revert', source: 'sheets', confirm: 'ELIMINAR'};
  assert.throws(() => ledger.command('landur', 'tester', undefined, command), /clave de operación válida/);
  // Una UUID (lo que manda la interfaz) cumple el formato.
  assert.deepEqual(ledger.command('landur', 'tester', crypto.randomUUID(), command).reverted, 0);
  ledger.close();
});
