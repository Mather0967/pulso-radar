// Ataque autorizado a la superficie de importación, convertido en regresión.
// Cada caso documenta un payload concreto: la prueba falla si el servidor deja
// de rechazarlo o si una importación parcial llega a persistir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Ledger } from '../server/ledger.mjs';
import { createApp } from '../server/app.mjs';
import { parseImport } from '../server/csv.mjs';

const password = 'synthetic-test-secret-only';
const header = 'kind,date,concept,amount,currency,account_id,due,source,external_id,category';

async function fixture(t) {
  const ledger = new Ledger();
  const server = createApp({ ledger, password, insecureCookies: true });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); ledger.close(); });
  const post = (path, input = {}, cookie = '', extra = {}) => fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-landur-request': '1', origin: base, cookie, ...extra },
    body: JSON.stringify(input)
  });
  const login = async () => {
    const r = await post('/api/login', { password });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  };
  const state = async cookie => (await (await fetch(base + '/api/state', { headers: { cookie } })).json());
  return { ledger, base, post, login, state };
}

test('CSV malformado se rechaza con 400 y no deja datos', async t => {
  const { post, login, state } = await fixture(t);
  const cookie = await login();
  const payloads = [
    ['comillas sin cerrar', header + '\nsale,2026-10-24,"sin cerrar,10,UYU,,,hoja,x1,'],
    ['comillas fuera de posición', header + '\nsale,2026-10-24,ab"cd,10,UYU,,,hoja,x2,'],
    ['contenido tras cerrar comillas', header + '\nsale,2026-10-24,"ab"cd,10,UYU,,,hoja,x3,'],
    ['columnas de menos', header + '\nsale,2026-10-24,Solo tres,10'],
    ['columna final vacía omitida', header + '\nsale,2026-10-24,Cuatro,10,UYU,,,hoja,x5'],
    ['columnas de más', header + '\nsale,2026-10-24,Cuatro,10,UYU,,,hoja,x4,extra,sobra'],
    ['encabezado distinto', 'kind,date,concept\nsale,2026-10-24,Prueba']
  ];
  for (const [name, csv] of payloads) {
    const response = await post('/api/import/preview', { csv }, cookie);
    assert.equal(response.status, 400, `${name}: se esperaba 400`);
  }
  assert.equal((await state(cookie)).operations.length, 0);
});

test('límites de tamaño y cantidad rechazados antes de escribir', async t => {
  const { post, login } = await fixture(t);
  const cookie = await login();
  assert.equal((await post('/api/import/preview', { csv: 'x'.repeat(100001) }, cookie)).status, 400);
  assert.equal((await post('/api/import/preview', { csv: 'x'.repeat(200000) }, cookie)).status, 413);
  const many = [header, ...Array.from({ length: 201 }, (_, i) => `sale,2026-10-24,Fila ${i},10,UYU,,,hoja,e-${i},`)].join('\n');
  assert.equal((await post('/api/import/preview', { csv: many }, cookie)).status, 400);
  // 200 filas es el máximo admitido y debe pasar la vista previa.
  const exactly = [header, ...Array.from({ length: 200 }, (_, i) => `sale,2026-10-24,Fila ${i},10,UYU,,,hoja,f-${i},`)].join('\n');
  assert.equal((await post('/api/import/preview', { csv: exactly }, cookie)).status, 200);
});

test('importes inválidos rechazados por el servidor, no por el cliente', async t => {
  const { post, login, state } = await fixture(t);
  const cookie = await login();
  for (const amount of ['1e3', '-5', '0', '12.345', '1.234,56', 'doce', ' ', '9999999999999']) {
    const csv = `${header}\nsale,2026-10-24,Importe raro,${amount},UYU,,,hoja,a-${encodeURIComponent(amount)},`;
    assert.equal((await post('/api/import/preview', { csv }, cookie)).status, 400, `importe ${amount}`);
  }
  assert.equal((await state(cookie)).operations.length, 0);
});

test('una fila inválida anula el lote completo: el commit no es parcial', async t => {
  const { post, login, state } = await fixture(t);
  const cookie = await login();
  const csv = [header,
    'sale,2026-10-24,Primera válida,100,UYU,,,hoja,ok-1,',
    'sale,2026-10-24,Segunda válida,200,UYU,,,hoja,ok-2,',
    'sale,2026-10-24,Moneda inexistente,300,ARS,,,hoja,ok-3,'
  ].join('\n');
  const response = await post('/api/import/commit', { csv }, cookie, { 'idempotency-key': randomUUID() });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Fila 4/);
  assert.equal((await state(cookie)).operations.length, 0, 'no debe quedar ninguna fila del lote');
});

test('referencia externa repetida con otros datos se detecta y no sobrescribe', async t => {
  const { post, login, state } = await fixture(t);
  const cookie = await login();
  const first = `${header}\nsale,2026-10-24,Original,100,UYU,,,hoja,dup-1,`;
  assert.equal((await post('/api/import/commit', { csv: first }, cookie, { 'idempotency-key': randomUUID() })).status, 200);
  const conflicting = `${header}\nsale,2026-10-24,Cambiada,999,UYU,,,hoja,dup-1,`;
  assert.equal((await post('/api/import/commit', { csv: conflicting }, cookie, { 'idempotency-key': randomUUID() })).status, 409);
  const operations = (await state(cookie)).operations;
  assert.equal(operations.length, 1);
  assert.equal(operations[0].concept, 'Original');
  assert.equal(operations[0].amount, 10000);
});

test('el mismo lote con otra clave no duplica operaciones', async t => {
  const { post, login, state } = await fixture(t);
  const cookie = await login();
  const csv = `${header}\nsale,2026-10-24,Idempotente,100,UYU,,,hoja,repeat-1,`;
  assert.equal((await post('/api/import/commit', { csv }, cookie, { 'idempotency-key': randomUUID() })).status, 200);
  const again = await post('/api/import/commit', { csv }, cookie, { 'idempotency-key': randomUUID() });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).created, 0);
  assert.equal((await state(cookie)).operations.length, 1);
});

test('fórmula inyectada por CSV se guarda literal y se neutraliza al exportar', async t => {
  const { base, post, login } = await fixture(t);
  const cookie = await login();
  const payload = '=HYPERLINK("http://attacker.example","pulsa")';
  const csv = `${header}\nsale,2026-10-24,"${payload.replaceAll('"', '""')}",100,UYU,,,hoja,formula-1,`;
  assert.equal((await post('/api/import/commit', { csv }, cookie, { 'idempotency-key': randomUUID() })).status, 200);
  const exported = await (await fetch(base + '/api/export.csv', { headers: { cookie } })).text();
  assert.ok(exported.includes(`"'=HYPERLINK`), 'la celda debe salir prefijada con apóstrofo');
  assert.ok(!/(^|,)"=HYPERLINK/m.test(exported), 'ninguna celda debe empezar con = sin prefijo');
});

test('texto con NUL y comillas no rompe el almacenamiento ni la exportación', async t => {
  const { base, post, login } = await fixture(t);
  const cookie = await login();
  const concept = 'Proveedor "A" y B\u0000 final';
  const csv = `${header}\nsale,2026-10-24,"${concept.replaceAll('"', '""')}",100,UYU,,,hoja,nul-1,`;
  assert.equal((await post('/api/import/commit', { csv }, cookie, { 'idempotency-key': randomUUID() })).status, 200);
  const exported = await (await fetch(base + '/api/export.csv', { headers: { cookie } })).text();
  assert.ok(exported.includes('""A""'), 'las comillas internas deben duplicarse');
});

test('la importación exige sesión, origen propio y JSON de la aplicación', async t => {
  const { base, post, login } = await fixture(t);
  const csv = `${header}\nsale,2026-10-24,Sin sesión,100,UYU,,,hoja,anon-1,`;
  assert.equal((await post('/api/import/preview', { csv })).status, 401);
  const cookie = await login();
  assert.equal((await post('/api/import/preview', { csv }, cookie, { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await post('/api/import/preview', { csv }, cookie, { 'x-landur-request': '' })).status, 415);
  assert.equal((await post('/api/import/preview', { csv }, cookie, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post('/api/import/preview', { csv }, cookie, { 'content-type': 'application/x-www-form-urlencoded' })).status, 415);
});

test('la importación no se puede colar como comando genérico', async t => {
  const { post, login } = await fixture(t);
  const cookie = await login();
  const csv = `${header}\nsale,2026-10-24,Colada,100,UYU,,,hoja,bypass-1,`;
  const response = await post('/api/commands', { kind: 'import', csv }, cookie, { 'idempotency-key': randomUUID() });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /vista previa/);
});

test('la vista previa no persiste nada aunque repita referencias', async t => {
  const { post, login, state, ledger } = await fixture(t);
  const cookie = await login();
  const csv = `${header}\nsale,2026-10-24,Uno,100,UYU,,,hoja,prev-1,\nsale,2026-10-24,Dos,200,UYU,,,hoja,prev-2,`;
  for (let i = 0; i < 3; i++) assert.equal((await post('/api/import/preview', { csv }, cookie)).status, 200);
  assert.equal((await state(cookie)).operations.length, 0);
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM requests WHERE key LIKE 'csvrow-%'").get().n, 0);
});

test('parseImport es una función total frente a entradas no textuales', () => {
  for (const value of [undefined, null, 42, {}, [], Buffer.from('x'), '']) {
    assert.throws(() => parseImport(value), /CSV|plantilla|filas|200/, String(value));
  }
});
