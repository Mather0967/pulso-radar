import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {portalFixture} from './helpers/portal-fixture.mjs';

const rawRequest = (port, payload) => new Promise((resolve, reject) => {
  const socket = net.connect(port, '127.0.0.1', () => socket.write(payload));
  let data = '';
  socket.setTimeout(5000, () => { socket.destroy(); resolve(data); });
  socket.on('data', chunk => { data += chunk; });
  socket.on('end', () => resolve(data));
  socket.on('error', reject);
});

// Batería de ataques contra el portal real montado en un directorio temporal. Cada caso
// describe el ataque, no la implementación: si alguien cambia una ruta o un permiso, esto
// falla antes de llegar a producción.
const ATTACKS = [];

const SECRET_FILES = [
  '/server/auth.mjs', '/server/main.mjs', '/server/landur.mjs', '/data/identity.json',
  '/data/landur/landur.sqlite', '/.git/config', '/namecheap/server/auth.mjs', '/projects/landur/server/ledger.mjs',
  '/package.json', '/scripts/cpanel-deploy.mjs', '/server/site.mjs'
];

test('sin sesión no hay datos, ni HTML interno, ni archivos del servidor', async () => {
  const f = await portalFixture();
  try {
    for (const path of ['/portal', '/api/projects', '/admin', '/api/admin/users', '/pulso', '/landur/', '/landur/api/state', '/landur/api/export.csv']) {
      const response = await f.request(path);
      assert.ok(response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400),
        `${path} no debe responder ${response.status} sin sesión`);
      const body = await response.text();
      assert.ok(!body.includes('LANDUR'), `${path} no debe filtrar contenido de LANDUR sin sesión`);
      assert.ok(!body.includes('password'), `${path} no debe exponer campos de credenciales`);
    }
    for (const path of SECRET_FILES) {
      const response = await f.request(path);
      assert.ok([404, 401, 403, 303].includes(response.status), `${path} respondió ${response.status}`);
      const body = await response.text();
      assert.ok(!/scrypt|passwordHash|BEGIN PRIVATE|NVIDIA_API_KEY/.test(body), `${path} filtró código o secretos`);
    }
    // Con sesión de administrador tampoco: el servidor no publica código ni datos.
    const admin = await f.login('admin');
    for (const path of SECRET_FILES) {
      const response = await f.request(path, {cookie: admin.cookie});
      const body = await response.text();
      assert.ok(response.status === 404, `${path} con sesión respondió ${response.status}`);
      assert.ok(!/scrypt|passwordHash|BEGIN PRIVATE|NVIDIA_API_KEY|"users"/.test(body), `${path} filtró contenido con sesión`);
    }
  } finally { await f.close(); }
});

test('galletas falsas o alteradas no abren sesión', async () => {
  const f = await portalFixture();
  try {
    for (const cookie of ['rivect_session=', 'rivect_session=deadbeef', 'rivect_session=' + 'a'.repeat(43), 'rivect_session=../../data', 'rivect_session="><script>']) {
      const response = await f.request('/api/projects', {cookie});
      assert.equal(response.status, 401, `galleta ${cookie} no debe autenticar`);
    }
    const real = await f.login('landur');
    const flipped = real.cookie.slice(0, -1) + (real.cookie.endsWith('A') ? 'B' : 'A');
    assert.equal((await f.request('/api/projects', {cookie: flipped})).status, 401, 'un token alterado no vale');
  } finally { await f.close(); }
});

test('CSRF y origen: sin token, con token ajeno o desde otro origen no se escribe', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    const command = {kind: 'account', name: 'Intento', accountKind: 'cash', currency: 'UYU', opening: '1000.00', cutoff: '2026-01-01', verified: false, accessible: true};
    const url = '/landur/api/commands';
    const noToken = await f.request(url, {method: 'POST', cookie, body: command});
    assert.equal(noToken.status, 403, 'sin X-CSRF-Token debe fallar');
    const wrongToken = await f.request(url, {method: 'POST', cookie, csrf: 'csrf-de-otro', body: command});
    assert.equal(wrongToken.status, 403, 'un CSRF ajeno debe fallar');
    const foreignOrigin = await f.request(url, {method: 'POST', cookie, csrf, body: command, origin: 'https://evil.example'});
    assert.equal(foreignOrigin.status, 403, 'un origen ajeno debe fallar');
    const otherUser = await f.login('pulso');
    const stolenCsrf = await f.request(url, {method: 'POST', cookie, csrf: otherUser.csrf, body: command});
    assert.equal(stolenCsrf.status, 403, 'el CSRF de otro usuario no debe servir');
    const ok = await f.request(url, {method: 'POST', cookie, csrf, body: command, headers: {'Idempotency-Key': 'csrf-legit-' + Date.now()}});
    assert.ok(ok.status < 400, `la escritura legítima debe funcionar, dio ${ok.status}`);
    const noKey = await f.request(url, {method: 'POST', cookie, csrf, body: {kind: 'account', name: 'Sin clave', accountKind: 'cash', currency: 'UYU', opening: '0.00', cutoff: '2026-01-01', verified: false, accessible: true}});
    assert.equal(noKey.status, 400, 'sin Idempotency-Key no se acepta la escritura');
    const shortKey = await f.request(url, {method: 'POST', cookie, csrf, body: {kind: 'account', name: 'Clave corta', accountKind: 'cash', currency: 'UYU', opening: '0.00', cutoff: '2026-01-01', verified: false, accessible: true}, headers: {'Idempotency-Key': 'corta'}});
    assert.equal(shortKey.status, 400, 'una clave de operación adivinable no se acepta');
  } finally { await f.close(); }
});

test('cada usuario sólo entra a su proyecto; el de sólo lectura no escribe', async () => {
  const f = await portalFixture();
  try {
    const pulso = await f.login('pulso');
    assert.equal((await f.request('/landur/', {cookie: pulso.cookie})).status, 403, 'Pulso no entra a LANDUR');
    assert.equal((await f.request('/landur/api/state', {cookie: pulso.cookie})).status, 403, 'Pulso no lee la API de LANDUR');
    const none = await f.login('none');
    assert.equal((await f.request('/pulso', {cookie: none.cookie})).status, 403, 'sin permisos no hay proyecto');
    assert.equal((await f.request('/landur/', {cookie: none.cookie})).status, 403, 'sin permisos no hay LANDUR');
    const reader = await f.login('reader');
    const state = await f.request('/landur/api/state', {cookie: reader.cookie});
    assert.equal(state.status, 200, 'viewer puede leer');
    const write = await f.request('/landur/api/commands', {method: 'POST', cookie: reader.cookie, csrf: reader.csrf,
      body: {kind: 'account', name: 'X', accountKind: 'cash', currency: 'UYU', opening: '0.00', cutoff: '2026-01-01', verified: false, accessible: true}});
    assert.equal(write.status, 403, 'viewer no puede escribir');
    for (const path of ['/api/admin/users', '/api/admin/invite', '/api/admin/project-access', '/api/admin/settings']) {
      const isRead = path.includes('users');
      const response = await f.request(path, {cookie: reader.cookie, csrf: reader.csrf, method: isRead ? 'GET' : 'POST', ...(isRead ? {} : {body: {}})});
      assert.ok([403, 404, 405].includes(response.status), `${path} dio ${response.status} a un usuario normal`);
    }
  } finally { await f.close(); }
});

test('no hay traversal a archivos del proyecto ni a la base', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    const probes = [
      '/landur/../server/auth.mjs', '/landur/%2e%2e/server/auth.mjs', '/landur/..%2f..%2fdata/identity.json',
      '/landur/../../data/identity.json', '/landur/api/evidence/../../data/identity.json',
      '/landur/api/evidence/..%2F..%2Fdata%2Fidentity.json', '/landur/api/evidence/%2e%2e%2f%2e%2e%2fidentity.json',
      '/landur/public/../server/auth.mjs', '/landur/%252e%252e/server/auth.mjs', '/landur/app.js%00.png'
    ];
    for (const path of probes) {
      const response = await f.request(path, {cookie, csrf});
      const body = await response.text();
      assert.ok(!/passwordHash|scrypt|"users"|BEGIN PRIVATE/.test(body), `${path} filtró contenido interno`);
      assert.ok([400, 403, 404, 405, 415].includes(response.status), `${path} respondió ${response.status}`);
    }
  } finally { await f.close(); }
});

test('métodos raros, cuerpos enormes y tipos de contenido inesperados se rechazan', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    // TRACE se manda por socket crudo: algunos clientes HTTP lo bloquean antes de salir.
    const trace = await rawRequest(Number(new URL(f.base).port), 'TRACE /portal HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
    assert.ok(!/^HTTP\/1\.[01] 200/.test(trace), 'TRACE no debe responder 200');
    for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
      for (const path of ['/portal', '/landur/', '/landur/api/state', '/api/projects']) {
        const response = await f.request(path, {method, cookie, csrf, ...(method === 'OPTIONS' ? {} : {body: {}})});
        assert.ok(response.status < 500, `${method} ${path} provocó ${response.status}`);
        assert.ok(![200, 201].includes(response.status) || method === 'OPTIONS', `${method} ${path} devolvió ${response.status}`);
      }
    }
    // El rechazo tiene que llegar como respuesta legible: responder y cortar el socket en
    // mitad de la subida hace que el cliente lo vea como error de red, no como 413.
    const big = await f.request('/landur/api/commands', {method: 'POST', cookie, csrf, raw: 'x'.repeat(4_000_000)});
    assert.equal(big.status, 413, 'un cuerpo de 4 MB debe cortarse');
    assert.match(await big.text(), /tamaño permitido/, 'el 413 debe poder leerse del otro lado');
    const wrongType = await f.request('/landur/api/commands', {method: 'POST', cookie, csrf, headers: {'Content-Type': 'text/plain'}, body: {kind: 'x'}});
    assert.equal(wrongType.status, 415, 'se exige JSON explícito');
    for (const raw of ['{', 'null', '[]', '"texto"', '{"kind":null}']) {
      const response = await f.request('/landur/api/commands', {method: 'POST', cookie, csrf, raw});
      assert.ok([400, 415, 422].includes(response.status), `JSON inválido ${raw} dio ${response.status}`);
      assert.ok(response.status < 500, `${raw} provocó ${response.status}`);
    }
    const loginRaw = await f.request('/auth/login', {method: 'POST', raw: '{"email":null,"password":null}'});
    assert.ok(loginRaw.status >= 400 && loginRaw.status < 500, `login con null dio ${loginRaw.status}`);
    const loginArray = await f.request('/auth/login', {method: 'POST', raw: '[]'});
    assert.ok(loginArray.status < 500, `login con array dio ${loginArray.status}`);
  } finally { await f.close(); }
});

test('un cuerpo JSON no puede contaminar prototipos ni crear permisos inexistentes', async () => {
  const f = await portalFixture();
  try {
    const admin = await f.login('admin');
    const pollution = await f.request('/api/admin/project-access', {method: 'PUT', cookie: admin.cookie, csrf: admin.csrf,
      raw: JSON.stringify({id: 'landur', projects: JSON.parse('{"__proto__":{"landur":"editor"},"constructor":{"prototype":{"x":1}}}')})});
    assert.ok(pollution.status < 500, `contaminación de prototipos dio ${pollution.status}`);
    assert.equal({}.landur, undefined, 'el prototipo global no debe quedar contaminado');
    assert.equal({}.x, undefined);
    const invented = await f.request('/api/admin/project-access', {method: 'PUT', cookie: admin.cookie, csrf: admin.csrf,
      body: {id: 'none', projects: {boveda: 'editor'}}});
    assert.equal(invented.status, 400, 'no se puede inventar un proyecto nuevo');
    const evidence = await f.request('/landur/api/evidence/' + '0'.repeat(8) + '-0000-0000-0000-' + '0'.repeat(12), {cookie: admin.cookie});
    assert.equal(evidence.status, 404, 'un comprobante inexistente responde 404, no 500');
  } finally { await f.close(); }
});

test('no se puede inventar identidad, rol ni permisos desde el cliente', async () => {
  const f = await portalFixture();
  try {
    const reader = await f.login('reader');
    const escalate = await f.request('/api/admin/users', {method: 'PUT', cookie: reader.cookie, csrf: reader.csrf,
      body: {id: reader.csrf, role: 'admin'}});
    assert.equal(escalate.status, 403, 'un viewer no se asciende solo');
    const headerSpoof = await f.request('/landur/api/state', {cookie: reader.cookie, headers: {
      'X-User-Id': 'admin', 'oai-authenticated-user-id': 'admin', 'X-Forwarded-User': 'admin'}});
    assert.equal(headerSpoof.status, 200, 'la cabecera no rompe la lectura');
    const after = await headerSpoof.json();
    assert.equal(after.access, 'viewer', 'el acceso sigue viniendo del servidor, no de cabeceras');
    assert.equal(after.actor, 'Lectura LANDUR', 'el actor sigue siendo el de la sesión');
  } finally { await f.close(); }
});

test('el portal escapa nombres de usuario y no refleja HTML', async () => {
  const f = await portalFixture();
  try {
    await f.store.transact(db => { db.users.find(u => u.id === 'admin').name = '<img src=x onerror=alert(1)>Rafa'; });
    const admin = await f.login('admin');
    const page = await f.request('/portal', {cookie: admin.cookie});
    const html = await page.text();
    assert.ok(!html.includes('<img src=x onerror'), 'el nombre no debe inyectarse como HTML');
    assert.ok(html.includes('&lt;img src=x onerror'), 'el nombre debe aparecer escapado');
  } finally { await f.close(); }
});

test('las respuestas traen cabeceras defensivas y nada se cachea', async () => {
  const f = await portalFixture();
  try {
    const {cookie} = await f.login('landur');
    for (const path of ['/login', '/portal', '/landur/', '/landur/app.js', '/landur/styles.css', '/landur/manifest.webmanifest']) {
      const response = await f.request(path, {cookie});
      const headers = response.headers;
      assert.match(headers.get('cache-control') || '', /no-store/, `${path} debe ser no-store`);
      assert.equal(headers.get('x-content-type-options'), 'nosniff', `${path} sin nosniff`);
      assert.equal(headers.get('x-frame-options'), 'DENY', `${path} sin anti-clickjacking`);
      const csp = headers.get('content-security-policy') || '';
      assert.ok(csp.includes("default-src 'self'"), `${path} sin CSP`);
      assert.ok(!csp.includes("'unsafe-eval'"), `${path} CSP demasiado permisiva`);
      assert.ok(!headers.get('access-control-allow-origin'), `${path} no debe abrir CORS`);
    }
    const login = await f.request('/auth/login', {method: 'POST', body: {email: 'landur@example.test', password: f.password}});
    const setCookie = login.headers.get('set-cookie') || '';
    assert.ok(/HttpOnly/i.test(setCookie), 'la galleta debe ser HttpOnly');
    assert.ok(/SameSite=Strict/i.test(setCookie), 'la galleta debe ser SameSite=Strict');
    assert.ok(/Path=\//.test(setCookie), 'la galleta debe ser de raíz');
  } finally { await f.close(); }
});

test('no se puede subir un archivo activo como comprobante', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>').toString('base64');
    for (const [mime, data] of [['image/svg+xml', svg], ['text/html', Buffer.from('<script>alert(1)</script>').toString('base64')], ['application/pdf', Buffer.from('<html><script>alert(1)</script>').toString('base64')]]) {
      const response = await f.request('/landur/api/evidence', {method: 'POST', cookie, csrf,
        headers: {'Idempotency-Key': 'probe-' + mime.replace(/\W/g, '') + '-0123456789'},
        body: {operationId: 'x', name: 'comprobante', mime, data}});
      assert.ok([400, 404].includes(response.status), `${mime} no debe aceptarse (dio ${response.status})`);
    }
  } finally { await f.close(); }
});

test('el login no distingue correos existentes y limita los intentos', async () => {
  const f = await portalFixture();
  try {
    const unknown = await f.request('/auth/login', {method: 'POST', body: {email: 'nadie@example.test', password: 'contraseña-larga-inexistente'}});
    const wrong = await f.request('/auth/login', {method: 'POST', body: {email: 'landur@example.test', password: 'contraseña-larga-inexistente'}});
    assert.equal(unknown.status, wrong.status, 'mismo estado para correo inexistente y contraseña mala');
    assert.equal((await unknown.json()).error, (await wrong.json()).error, 'mismo mensaje: no se enumeran cuentas');
    let last;
    for (let i = 0; i < 12; i++) last = await f.request('/auth/login', {method: 'POST', body: {email: 'landur@example.test', password: 'otra-mala'}});
    assert.equal(last.status, 429, 'tras varios fallos se corta el intento');
  } finally { await f.close(); }
});

test('LANDUR trae su propio acceso: nada del ecosistema y las credenciales de la cuenta', async () => {
  const f = await portalFixture();
  try {
    const page = await f.request('/landur/login');
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /action="\/landur\/api\/login"/, 'el formulario apunta al acceso del proyecto');
    assert.doesNotMatch(html, /Mis proyectos/, 'no se muestra el selector de proyectos');
    assert.doesNotMatch(html, /href="\/portal"/, 'sin camino de vuelta al ecosistema');
    assert.doesNotMatch(html, /csrf/i, 'la pantalla pública no incluye tokens de sesión');
    assert.doesNotMatch(html, /<script/i, 'el acceso funciona sin scripts en línea');
    const attempt = (email, password) => f.request('/landur/api/login', {method: 'POST', raw: new URLSearchParams({email, password}).toString(),
      headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '203.0.113.90'}});
    const unknown = await attempt('nadie@example.test', 'contraseña-larga-inexistente');
    const wrong = await attempt('landur@example.test', 'contraseña-larga-inexistente');
    assert.equal(unknown.headers.get('location'), wrong.headers.get('location'), 'mismo destino: no se enumeran cuentas');
    assert.equal(unknown.headers.get('set-cookie'), null, 'un fallo no abre sesión');
    let blocked;
    for (let i = 0; i < 12; i++) blocked = await attempt('landur@example.test', 'otra-mala');
    assert.equal(blocked.headers.get('location'), '/landur/login?e=limite', 'el acceso de LANDUR hereda el límite de intentos');
    for (const path of ['/landur/login', '/landur/wordmark.png']) {
      const response = await f.request(path);
      assert.ok([200, 303].includes(response.status), `${path} respondió ${response.status}`);
      assert.equal(response.headers.get('access-control-allow-origin'), null, `${path} no debe abrir CORS`);
    }
    const pulso = await f.login('pulso');
    const denied = await f.request('/landur/', pulso);
    assert.equal(denied.status, 403);
    const deniedHtml = await denied.text();
    assert.match(deniedHtml, /LANDUR no está habilitado/);
    assert.doesNotMatch(deniedHtml, /type="password"/, 'no se pide contraseña a quien ya tiene sesión');
  } finally { await f.close(); }
});

// Metodología de `offensive-business-logic` y `offensive-api-security`: cada caso ataca una
// regla del negocio (importes, monedas, carreras, asignación masiva) y no la implementación.
test('lógica de negocio: importes, monedas y carreras no permiten fabricar dinero', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    const send = (body, extra = {}) => f.request('/landur/api/commands', {method: 'POST', cookie, csrf, body, headers: {'Idempotency-Key': randomUUID()}, ...extra});
    const account = (extra = {}) => send({kind: 'account', name: 'Caja', accountKind: 'cash', currency: 'UYU', opening: '1000', cutoff: '2026-10-01', verified: true, accessible: true, ...extra});
    const a = (await (await account({name: 'Caja A'})).json()).id;
    for (const [label, body] of Object.entries({
      'importe negativo': {kind: 'expense', concept: 'x', amount: '-100', currency: 'UYU', date: '2026-10-24', accountId: a},
      'importe cero': {kind: 'expense', concept: 'x', amount: '0', currency: 'UYU', date: '2026-10-24', accountId: a},
      'decimales de más': {kind: 'expense', concept: 'x', amount: '1.001', currency: 'UYU', date: '2026-10-24', accountId: a},
      'moneda inventada': {kind: 'expense', concept: 'x', amount: '100', currency: 'EUR', date: '2026-10-24', accountId: a},
      'fecha anterior al corte': {kind: 'expense', concept: 'x', amount: '100', currency: 'UYU', date: '2020-01-01', accountId: a},
      'tipo de operación inventado': {kind: 'commission', concept: 'x', amount: '100', currency: 'UYU', date: '2026-10-24', accountId: a},
      'transferencia a la misma cuenta': {kind: 'transfer', concept: 'x', amount: '100', currency: 'UYU', date: '2026-10-24', accountId: a, toAccountId: a},
    })) assert.equal((await send(body)).status, 400, label);
    // Asignación masiva: los campos internos del registro se ignoran, no se copian.
    const forged = await (await account({name: 'Caja inyectada', id: '11111111-1111-1111-1111-111111111111', workspace: 'otro', balance: '999999999', demo: true, opening: '0'})).json();
    assert.notEqual(forged.id, '11111111-1111-1111-1111-111111111111', 'el id lo elige el servidor');
    const state = await (await f.request('/landur/api/state', {cookie})).json();
    assert.equal(state.accounts.find(x => x.id === forged.id).balance, 0, 'nadie puede regalarse saldo');
    assert.equal(state.accounts.find(x => x.id === forged.id).workspace, undefined, 'el identificador interno del espacio no se publica');
    // Carrera: cinco cobros simultáneos del total de una venta. Solo uno aplica.
    const sale = (await (await send({kind: 'sale', concept: 'Venta', amount: '1000', currency: 'UYU', date: '2026-10-24'})).json()).id;
    const raced = await Promise.all([1, 2, 3, 4, 5].map(() => send({kind: 'collection', concept: 'Cobro', amount: '1000', currency: 'UYU', date: '2026-10-24', accountId: a, targetId: sale, commission: '0'})));
    assert.equal(raced.filter(r => r.status === 200).length, 1, 'una sola cobranza puede aplicar el total');
    assert.ok(raced.every(r => r.status === 200 || r.status === 409), 'las perdedoras se rechazan con conflicto');
    const after = await (await f.request('/landur/api/state', {cookie})).json();
    assert.equal(after.operations.find(o => o.id === sale).applied, 100000, 'lo aplicado no supera el total de la venta');
    assert.equal(after.accounts.find(x => x.id === a).balance, 200000, 'el saldo refleja un solo cobro');
    // Carrera: dos reversiones simultáneas de la misma operación.
    const expense = (await (await send({kind: 'expense', concept: 'Gasto', amount: '500', currency: 'UYU', date: '2026-10-24', accountId: a})).json()).id;
    const reversals = await Promise.all([1, 2].map(() => send({kind: 'reversal', operationId: expense, date: '2026-10-24'})));
    assert.deepEqual(reversals.map(r => r.status).sort(), [200, 409], 'la segunda reversión no duplica el contra-asiento');
    // Baja con movimientos: sin decisión explícita no se borra nada.
    assert.equal((await send({kind: 'account.delete', accountId: a})).status, 409, 'una cuenta con historial no se borra por omisión');
    assert.ok([400, 403].includes((await send({kind: 'account.delete', accountId: a, mode: 'purge'})).status), 'el borrado total exige confirmación');
    assert.ok((await (await f.request('/landur/api/state', {cookie})).json()).accounts.some(x => x.id === a));
  } finally { await f.close(); }
});

// `offensive-api-security` (API3/API8) y `offensive-business-logic` (inyección en exportaciones):
// nada de lo que escribe el usuario debe llegar activo al navegador ni a una hoja de cálculo.
test('lo que escribe el usuario no se ejecuta: CSV, login y cabeceras', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    const send = body => f.request('/landur/api/commands', {method: 'POST', cookie, csrf, body, headers: {'Idempotency-Key': randomUUID()}});
    const a = (await (await send({kind: 'account', name: 'Caja', accountKind: 'cash', currency: 'UYU', opening: '1000', cutoff: '2026-10-01', verified: true, accessible: true})).json()).id;
    for (const concept of ['=HYPERLINK("http://evil","x")', '+1+1', '@SUM(1+1)', '-2+3', '=cmd|" /C calc"!A0']) {
      assert.equal((await send({kind: 'expense', concept, amount: '1', currency: 'UYU', date: '2026-10-24', accountId: a})).status, 200);
    }
    const csv = await (await f.request('/landur/api/export.csv', {cookie})).text();
    for (const line of csv.split('\r\n').slice(1)) {
      if (!line) continue;
      assert.doesNotMatch(line, /(^|,)"\s*[=+@-]/, 'ninguna celda empieza con un carácter de fórmula');
    }
    // La pantalla de acceso no refleja el parámetro de error: solo muestra textos fijos.
    for (const value of ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>']) {
      const html = await (await f.request('/landur/login?e=' + encodeURIComponent(value))).text();
      assert.ok(!html.includes('onerror'), 'el error no se refleja en el HTML');
      assert.ok(!html.includes('<script'), 'la pantalla de acceso no incluye scripts en línea');
    }
    // Cabeceras del comprobante: el nombre no puede partir la respuesta.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
    const operation = (await (await send({kind: 'expense', concept: 'evidencia', amount: '5', currency: 'UYU', date: '2026-10-24', accountId: a})).json()).id;
    const upload = await f.request('/landur/api/evidence', {method: 'POST', cookie, csrf, headers: {'Idempotency-Key': randomUUID()}, body: {operationId: operation, name: 'factura "rara"\r\nX-Injected: 1.png', mime: 'image/png', data: png.toString('base64')}});
    assert.equal(upload.status, 200, 'la imagen válida se acepta aunque el nombre traiga saltos de línea');
    const file = await f.request('/landur/api/evidence/' + (await upload.json()).id, {cookie});
    assert.equal(file.headers.get('x-injected'), null, 'el nombre no crea cabeceras nuevas');
    assert.match(file.headers.get('content-disposition') || '', /^inline; filename\*=UTF-8''/);
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    // Endurecimiento de sesión: sin autenticación por cabecera, sin override de método.
    assert.equal((await f.request('/landur/api/state', {headers: {'Authorization': 'Bearer ' + csrf}})).status, 401, 'no hay autenticación por Bearer');
    assert.equal((await f.request('/landur/api/state', {cookie, headers: {'X-HTTP-Method-Override': 'DELETE'}})).status, 200, 'el override de método se ignora');
    assert.equal((await f.request('/landur/api/state', {cookie: 'rivect_session=basura; ' + cookie})).status, 200, 'una galleta basura agregada delante no anula la sesión válida');
  } finally { await f.close(); }
});

test('borrado con historial: exige el nombre exacto y la contraseña, y no se puede omitir', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    const send = body => f.request('/landur/api/commands', {method: 'POST', cookie, csrf, body, headers: {'Idempotency-Key': randomUUID()}});
    const a = (await (await send({kind: 'account', name: 'Caja', accountKind: 'cash', currency: 'UYU', opening: '1000', cutoff: '2026-10-01', verified: true, accessible: true})).json()).id;
    await send({kind: 'expense', concept: 'mov', amount: '10', currency: 'UYU', date: '2026-10-24', accountId: a});
    const purge = extra => send({kind: 'account.delete', accountId: a, mode: 'purge', confirm: true, ...extra});
    assert.equal((await purge({confirmName: 'Caja'})).status, 403, 'sin contraseña no se borra el historial');
    assert.equal((await purge({confirmName: 'Caja', password: 'contraseña-que-no-es'})).status, 403, 'con contraseña incorrecta tampoco');
    assert.equal((await purge({confirmName: 'Otra', password: f.password})).status, 400, 'el nombre tiene que ser el de la cuenta');
    assert.ok((await (await f.request('/landur/api/state', {cookie})).json()).accounts.some(x => x.id === a), 'los intentos fallidos no borran nada');
    const ok = await purge({confirmName: 'Caja', password: f.password});
    assert.equal(ok.status, 200, 'con nombre y contraseña correctos se ejecuta');
    const state = await (await f.request('/landur/api/state', {cookie})).json();
    assert.equal(state.accounts.some(x => x.id === a), false);
    assert.ok(state.audit.some(x => x.action === 'account.purged'), 'y queda auditado');
  } finally { await f.close(); }
});

test('la clave de idempotencia es de cada usuario, no del espacio', async () => {
  const f = await portalFixture();
  try {
    const editor = await f.login('landur'), admin = await f.login('admin');
    const key = randomUUID();
    const body = {kind: 'account', name: 'Cuenta idempotente', accountKind: 'cash', currency: 'UYU', opening: '0', cutoff: '2026-10-01', verified: true, accessible: true};
    const first = await f.request('/landur/api/commands', {...editor, method: 'POST', body, headers: {'Idempotency-Key': key}});
    const second = await f.request('/landur/api/commands', {...admin, method: 'POST', body, headers: {'Idempotency-Key': key}});
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    assert.notEqual((await first.json()).id, (await second.json()).id, 'cada usuario ejecuta su propio comando');
    const replay = await f.request('/landur/api/commands', {...editor, method: 'POST', body, headers: {'Idempotency-Key': key}});
    assert.equal((await replay.json()).replayed, true, 'el mismo usuario sí reintenta sin duplicar');
    const changed = await f.request('/landur/api/commands', {...admin, method: 'POST', body: {...body, name: 'Otra'}, headers: {'Idempotency-Key': key}});
    assert.equal(changed.status, 409, 'la misma clave con otro cuerpo sigue siendo un conflicto');
  } finally { await f.close(); }
});

test('el límite de intentos no se evade rotando la IP declarada', async () => {
  const f = await portalFixture();
  try {
    let last;
    for (let i = 0; i < 22; i++)
      last = await f.request('/auth/login', {method: 'POST', body: {email: 'landur@example.test', password: 'mala-' + i}, headers: {'X-Forwarded-For': '198.51.100.' + (10 + i)}});
    assert.equal(last.status, 429, 'la cuenta se bloquea aunque cambie la IP declarada');
    const other = await f.request('/auth/login', {method: 'POST', body: {email: 'admin@example.test', password: f.password}, headers: {'X-Forwarded-For': '203.0.113.200'}});
    assert.equal(other.status, 200, 'el bloqueo es de la cuenta atacada, no global');
  } finally { await f.close(); }
});

test('las escrituras tienen tope por sesión', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    const send = body => f.request('/landur/api/commands', {method: 'POST', cookie, csrf, body, headers: {'Idempotency-Key': randomUUID()}});
    const a = (await (await send({kind: 'account', name: 'Caja', accountKind: 'cash', currency: 'UYU', opening: '1000', cutoff: '2026-10-01', verified: true, accessible: true})).json()).id;
    const statuses = [];
    for (let i = 0; i < 125; i++) statuses.push((await send({kind: 'expense', concept: 'carga ' + i, amount: '1', currency: 'UYU', date: '2026-10-24', accountId: a})).status);
    assert.ok(statuses.includes(429), 'a partir del tope la sesión deja de escribir');
    assert.equal(statuses.filter(s => s === 200).length, 119, 'el tope es de 120 comandos por minuto, contando el alta de la cuenta');
  } finally { await f.close(); }
});

test('cerrar sesión invalida el token en el servidor', async () => {
  const f = await portalFixture();
  try {
    const {cookie, csrf} = await f.login('landur');
    assert.equal((await f.request('/landur/api/state', {cookie})).status, 200);
    const out = await f.request('/landur/api/logout', {method: 'POST', cookie, csrf, body: {}});
    assert.equal(out.status, 200);
    assert.equal((await f.request('/landur/api/state', {cookie})).status, 401, 'el token viejo no debe seguir vivo');
  } finally { await f.close(); }
});
