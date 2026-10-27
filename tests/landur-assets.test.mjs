// La interfaz de LANDUR se sirve desde dos listas de recursos independientes: el
// servidor autónomo (`projects/landur/server/app.mjs`) y el montaje del portal
// (`namecheap/server/landur.mjs`). Si una se atrasa, el módulo que importa `app.js`
// responde 404, la aplicación no evalúa y en producción queda una pantalla en blanco.
//
// Ya pasó: se agregó `voice.mjs` al servidor autónomo y no al portal. Esta prueba
// deriva la lista de los propios archivos, para que la próxima vez falle acá.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { portalFixture } from './helpers/portal-fixture.mjs';

const landurRoot = path.resolve('projects/landur');
const source = name => fs.readFileSync(path.join(landurRoot, 'public', name), 'utf8');

// Todo lo que la aplicación necesita para arrancar, leído de los artefactos reales.
function requiredShell() {
  const files = new Set();
  for (const match of source('index.html').matchAll(/(?:href|src)="\.\/([^"]+)"/g)) files.add(match[1]);
  for (const match of source('app.js').matchAll(/from\s+'\.\/([^']+)'/g)) files.add(match[1]);
  const shell = source('sw.js').match(/const SHELL = \[([^\]]*)\]/);
  assert.ok(shell, 'no se pudo leer la lista SHELL del service worker');
  for (const entry of shell[1].split(',').map(value => value.trim().replace(/^'|'$/g, '')).filter(Boolean)) files.add(entry);
  return [...files].sort();
}

test('ambas superficies sirven todo lo que la interfaz de LANDUR necesita', async t => {
  const files = requiredShell();
  assert.ok(files.includes('app.js'), files.join(', '));
  assert.ok(files.includes('voice.mjs'), `el módulo del dictado falta en la lista derivada: ${files.join(', ')}`);

  const [{ Ledger }, { createApp }] = await Promise.all([
    import('../projects/landur/server/ledger.mjs'),
    import('../projects/landur/server/app.mjs')
  ]);
  const ledger = new Ledger();
  const server = createApp({ ledger, demo: true, insecureCookies: true });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); ledger.close(); });

  for (const file of files)
    assert.equal((await fetch(`${base}/${file}`)).status, 200, `el servidor autónomo debe servir /${file}`);

  const portal = await portalFixture();
  try {
    const auth = await portal.login('landur');
    for (const file of files)
      assert.equal((await portal.request(`/landur/${file}`, auth)).status, 200, `el portal debe servir /landur/${file}`);
    assert.equal((await portal.request('/landur/', auth)).status, 200);
  } finally {
    await portal.close();
  }
});

// Lo mismo vale para las rutas de API: las dos superficies mantienen su propia lista y una
// ruta que el cliente llama y una superficie desconoce llega al usuario como 404.
test('las dos superficies conocen las rutas de API que llama el cliente', async () => {
  const [{ appApiRoutes }, { portalApiRoutes }] = await Promise.all([
    import('../projects/landur/server/app.mjs'),
    import('../namecheap/server/landur.mjs')
  ]);
  // El portal reemplaza estas tres a propósito: la sesión la administra RIVECT.
  const standaloneOnly = new Set(['/api/login', '/api/demo', '/api/logout']);
  const clientPaths = [...new Set([...source('app.js').matchAll(/['"`](\/api\/[A-Za-z0-9/_.-]+)['"`]/g)].map(match => match[1]))];
  assert.ok(clientPaths.length >= 8, `no se derivaron las rutas del cliente: ${clientPaths.join(', ')}`);

  const methodsFor = (routes, target) => routes.filter(route => {
    const [, routePath] = route.split(' ');
    return routePath === target || (routePath.endsWith('/*') && target.startsWith(routePath.slice(0, -1)));
  }).map(route => route.split(' ')[0]).sort();

  for (const path of clientPaths) {
    const standalone = methodsFor(appApiRoutes, path);
    assert.ok(standalone.length, `el servidor autónomo no conoce ${path}`);
    const portal = methodsFor(portalApiRoutes, path);
    if (standaloneOnly.has(path)) { assert.equal(portal.length, 0, `el portal no debe exponer ${path}`); continue; }
    assert.ok(portal.length, `el portal no conoce ${path}`);
    assert.deepEqual(portal, standalone, `las dos superficies no coinciden en ${path}`);
  }
});
