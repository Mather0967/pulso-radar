// QA del portal nuevo (/portal/, SPA React). Uso: node scripts/qa-portal-ui.cjs
// Requiere Playwright y, opcionalmente, BROWSER_EXECUTABLE con un Chromium instalado.
// Levanta el portal de prueba (tests/helpers/portal-fixture.mjs) y recorre el portal como admin, landur y reader.
// No corre en CI: es una verificación manual de la interfaz real en el navegador.
const fs = require('node:fs');
const { chromium } = require('playwright');

const SHOTS = '/tmp/claude-0/-home-user-pulso-radar/5ba4fad5-ad69-59ed-bb36-18139de18fe2/scratchpad/shots-portal';
const shot = name => `${SHOTS}/${name}`;
const NEW_PASSWORD = 'nueva-clave-qa-portal-2026';
const tid = id => `[data-testid="${id}"]`;
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const assert = (cond, msg) => { if (!cond) throw new Error('QA portal: ' + msg); };

async function poll(check, msg, timeout = 8000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await check()) return;
    if (Date.now() > end) throw new Error('QA portal: ' + msg);
    await new Promise(r => setTimeout(r, 200));
  }
}

// Inicia sesión por la API. Devuelve la galleta y el token CSRF para las escrituras de prueba.
async function login(f, id, password = f.password) {
  const res = await fetch(f.base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: f.base },
    body: JSON.stringify({ email: `${id}@example.test`, password }),
    redirect: 'manual',
  });
  assert(res.status === 200, `login de ${id} respondió ${res.status}`);
  const raw = res.headers.get('set-cookie');
  assert(raw, `login de ${id} sin set-cookie`);
  const pair = raw.split(';')[0];
  const eq = pair.indexOf('=');
  const data = await res.json();
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), csrf: data.csrf };
}

async function api(f, session, method, path, body) {
  return fetch(f.base + path, {
    method,
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      Origin: f.base,
      Cookie: `${session.name}=${session.value}`,
      'X-CSRF-Token': session.csrf,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function apiJobs(f, session) {
  const res = await api(f, session, 'GET', '/api/calendar/jobs');
  assert(res.status === 200, `GET /api/calendar/jobs respondió ${res.status}`);
  return (await res.json()).jobs;
}

async function seedJob(f, session, job) {
  const res = await api(f, session, 'POST', '/api/calendar/jobs', {
    title: job.title, date: job.date, allDay: true, start: '', end: '', project: job.project,
    kind: 'contacto', assignee: '', status: 'pendiente', notes: '',
  });
  assert(res.status === 201, `no se pudo crear el trabajo de prueba «${job.title}» (${res.status})`);
  return (await res.json()).job;
}

async function newContext(browser, f, cookie, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (cookie) await context.addCookies([{ name: cookie.name, value: cookie.value, url: f.base }]);
  return context;
}

function trackErrors(page, errors, label) {
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
}

async function noHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!overflow, `${label}: hay desborde horizontal`);
}

async function main() {
  const { portalFixture } = await import('../tests/helpers/portal-fixture.mjs');
  fs.mkdirSync(SHOTS, { recursive: true });
  const errors = [];
  let f = null;
  let browser = null;
  const contexts = [];
  try {
    f = await portalFixture();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
      ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
    });

    const today = new Date();
    const todayIso = iso(today);
    const tomorrowIso = iso(addDays(today, 1));
    // Dentro del mismo mes, para que la celda de destino esté en la vista mensual.
    const altIso = iso(addDays(today, today.getDate() < 26 ? 2 : -2));

    // Datos de prueba: uno de Pulso (no debe verlo landur) y uno de LANDUR (sí).
    const adminSession = await login(f, 'admin');
    const pulsoSeed = await seedJob(f, adminSession, { title: 'QA pulso secreto', project: 'pulso', date: tomorrowIso });
    await seedJob(f, adminSession, { title: 'QA landur visible', project: 'landur', date: tomorrowIso });

    // ---- admin: escritorio 1440x900 ----
    const adminContext = await newContext(browser, f, adminSession, 1440, 900);
    contexts.push(adminContext);
    const page = await adminContext.newPage();
    trackErrors(page, errors, 'admin');

    await page.goto(f.base + '/portal/', { waitUntil: 'networkidle' });
    await page.locator(tid('notices-card')).waitFor({ state: 'visible' });
    assert(await page.locator(tid('notice-item')).count() >= 2, 'el administrador no ve los trabajos próximos');
    for (const id of ['pulso', 'landur', 'studio', 'retail'])
      await page.locator(tid(`project-card-${id}`)).waitFor({ state: 'visible' });
    await page.screenshot({ path: shot('home-admin-1440.png') });

    // Buscador Ctrl+K: «cal» muestra Calendario y Enter navega.
    await page.keyboard.press('Control+k');
    await page.locator(tid('command-dialog')).waitFor({ state: 'visible' });
    await page.locator(`${tid('command-dialog')} [role="combobox"]`).fill('cal');
    const commandItems = page.locator(tid('command-item'));
    await poll(async () => (await commandItems.count()) > 0, 'Ctrl+K no muestra resultados para «cal»');
    const firstItem = (await commandItems.first().textContent()) || '';
    assert(/Calendario/i.test(firstItem), `el primer resultado de «cal» no es Calendario: «${firstItem}»`);
    await page.screenshot({ path: shot('command-cal.png') });
    await page.keyboard.press('Enter');
    await page.waitForURL('**/portal/calendario', { timeout: 8000 });

    // ---- calendario: crear, arrastrar con el mouse real, vistas, borrar ----
    await page.locator(tid('cal-title')).waitFor({ state: 'visible' });
    await page.click(tid('cal-new'));
    const field = name => `${tid('job-form')} [name="${name}"]`;
    await page.locator(tid('job-form')).waitFor({ state: 'visible' });
    await page.fill(field('title'), 'Entrevista QA');
    await page.fill(field('date'), todayIso);
    // Radix pinta el casillero como <button role=checkbox>: se hace clic si está tildado.
    if ((await page.getAttribute('#job-allday', 'aria-checked')) === 'true') await page.click('#job-allday');
    await page.fill(field('start'), '10:00');
    await page.fill(field('end'), '11:00');
    await page.selectOption(field('project'), 'pulso');
    await page.selectOption(field('kind'), 'entrevista');
    await page.selectOption(field('status'), 'pendiente');
    await page.fill(field('notes'), 'Creado por la prueba automática.');
    await page.click(tid('job-save'));

    const chip = page.locator('[data-job-id]').filter({ hasText: 'Entrevista QA' }).first();
    await chip.waitFor({ state: 'visible' });
    const jobId = await chip.getAttribute('data-job-id');
    assert(jobId, 'el chip no tiene data-job-id');
    let saved = (await apiJobs(f, adminSession)).find(j => j.id === jobId);
    assert(saved && saved.date === todayIso && saved.title === 'Entrevista QA', 'el trabajo creado no coincide con la API');
    await page.screenshot({ path: shot('calendario-mes.png') });

    // Arrastre con el mouse real: Playwright dragAndDrop no dispara dragstart en <button draggable>.
    const from = await chip.boundingBox();
    const to = await page.locator(`[data-date="${altIso}"]`).first().boundingBox();
    assert(from && to, 'no hay coordenadas para arrastrar');
    const fx = from.x + from.width / 2, fy = from.y + from.height / 2;
    const tx = to.x + to.width / 2, ty = to.y + to.height / 2;
    await page.mouse.move(fx, fy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(fx + ((tx - fx) * i) / 10, fy + ((ty - fy) * i) / 10);
    await page.mouse.up();
    await poll(async () => (await apiJobs(f, adminSession)).find(j => j.id === jobId)?.date === altIso,
      'la fecha no cambió en la API tras arrastrar');

    // Cambiar de vista.
    for (const view of ['view-week', 'view-agenda', 'view-month']) {
      await page.click(tid(view));
      await poll(async () => (await page.getAttribute(tid(view), 'aria-checked')) === 'true',
        `la vista ${view} no quedó marcada`, 3000);
      await page.screenshot({ path: shot(`calendario-${view}.png`) });
    }

    // Borrar con dos clics.
    await page.locator(`[data-job-id="${jobId}"]`).first().click();
    await page.locator(tid('job-form')).waitFor({ state: 'visible' });
    await page.click(tid('job-delete'));
    await page.click(tid('job-delete'));
    await poll(async () => !(await apiJobs(f, adminSession)).some(j => j.id === jobId),
      'el trabajo no se borró en la API');

    // ---- cuenta: sesiones (revocar las demás) y cambio de contraseña ----
    // Segunda sesión del mismo usuario, en otro contexto del navegador.
    const secondSession = await login(f, 'admin');
    const secondContext = await newContext(browser, f, secondSession, 1440, 900);
    contexts.push(secondContext);
    assert((await secondContext.request.get(f.base + '/auth/me')).status() === 200, 'la segunda sesión no entra');

    await page.goto(f.base + '/portal/cuenta', { waitUntil: 'networkidle' });
    await page.locator(tid('sessions-list')).waitFor({ state: 'visible' });
    assert(await page.locator(tid('session-row')).count() >= 2, 'la lista de sesiones no muestra las dos');
    await page.screenshot({ path: shot('cuenta-sesiones.png') });
    await page.click(tid('revoke-others'));
    await page.click(tid('revoke-others-confirm')); // pide confirmación antes de cerrar las demás
    await poll(async () => (await secondContext.request.get(f.base + '/auth/me')).status() === 401,
      'la segunda sesión sigue abierta tras «cerrar las demás»', 8000);
    assert((await adminContext.request.get(f.base + '/auth/me')).status() === 200, 'la sesión actual se cerró por error');

    const passwordSaved = page.waitForResponse(r => r.url().endsWith('/auth/password'));
    await page.fill(tid('account-current'), f.password);
    await page.fill(tid('account-next'), NEW_PASSWORD);
    await page.fill(tid('account-confirm'), NEW_PASSWORD);
    await page.click(tid('account-save'));
    const passwordResponse = await passwordSaved;
    assert(passwordResponse.status() === 200, `el cambio de contraseña respondió ${passwordResponse.status()}`);
    assert(await page.locator(tid('account-error')).count() === 0 || !(await page.locator(tid('account-error')).isVisible()), 'la cuenta muestra error tras cambiar la clave');
    // Una sola vez por API: cada intento de acceso cuenta para el límite.
    const oldStatus = (await fetch(f.base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: f.base }, body: JSON.stringify({ email: 'admin@example.test', password: f.password }) })).status;
    assert(oldStatus === 401, 'la contraseña vieja sigue entrando');
    const newSession = await login(f, 'admin', NEW_PASSWORD);
    assert(newSession.csrf, 'la contraseña nueva no entra');

    // ---- administración: pestañas ----
    await page.goto(f.base + '/portal/administracion', { waitUntil: 'networkidle' });
    for (const tab of ['tab-users', 'tab-grants', 'tab-messages']) {
      await page.click(tid(tab));
      await page.locator(tid(tab)).waitFor({ state: 'visible' });
    }
    await page.screenshot({ path: shot('administracion-mensajes.png') });

    // ---- admin: básicos en tablet y celular ----
    for (const [width, height] of [[768, 1024], [390, 844]]) {
      const ctx = await newContext(browser, f, adminSession, width, height);
      contexts.push(ctx);
      const p = await ctx.newPage();
      trackErrors(p, errors, `admin-${width}`);
      for (const route of ['/portal/', '/portal/calendario', '/portal/cuenta']) {
        await p.goto(f.base + route, { waitUntil: 'networkidle' });
        await noHorizontalScroll(p, `${route} a ${width}px`);
      }
      await p.goto(f.base + '/portal/', { waitUntil: 'networkidle' });
      await p.screenshot({ path: shot(`home-admin-${width}.png`), fullPage: true });
      await ctx.close();
    }

    // ---- landur (editor de landur): nunca ve trabajos de pulso ----
    const landurSession = await login(f, 'landur');
    const landurContext = await newContext(browser, f, landurSession, 1440, 900);
    contexts.push(landurContext);
    const landur = await landurContext.newPage();
    trackErrors(landur, errors, 'landur');
    await landur.goto(f.base + '/portal/', { waitUntil: 'networkidle' });
    await landur.locator(tid('notices-card')).waitFor({ state: 'visible' });
    await landur.locator(tid('notice-item')).filter({ hasText: 'QA landur visible' }).first().waitFor({ state: 'visible' });
    const noticeTexts = await landur.locator(tid('notice-item')).allTextContents();
    assert(!noticeTexts.some(t => t.includes('QA pulso secreto')), 'landur ve un trabajo de pulso en avisos');
    assert(await landur.locator(tid('project-card-pulso')).count() === 0, 'landur ve la tarjeta de Pulso');
    await landur.screenshot({ path: shot('home-landur.png') });

    await landur.keyboard.press('Control+k');
    await landur.locator(tid('command-dialog')).waitFor({ state: 'visible' });
    const landurInput = `${tid('command-dialog')} [role="combobox"]`;
    await landur.locator(landurInput).fill('QA landur');
    await poll(async () => (await landur.locator(tid('command-item')).filter({ hasText: 'QA landur visible' }).count()) > 0,
      'el buscador de landur no encuentra su propio trabajo');
    await landur.locator(landurInput).fill('QA pulso');
    await landur.waitForTimeout(600);
    assert(await landur.locator(tid('command-item')).filter({ hasText: 'QA pulso' }).count() === 0, 'el buscador de landur muestra un trabajo de pulso');
    await landur.keyboard.press('Escape');

    await landur.goto(f.base + '/portal/calendario', { waitUntil: 'networkidle' });
    await landur.locator(tid('cal-title')).waitFor({ state: 'visible' });
    assert(await landur.locator(`[data-job-id="${pulsoSeed.id}"]`).count() === 0, 'el calendario de landur muestra un trabajo de pulso');
    assert(!(await landur.locator('body').innerText()).includes('QA pulso secreto'), 'el calendario de landur menciona un trabajo de pulso');

    await landur.goto(f.base + '/portal/administracion', { waitUntil: 'networkidle' });
    await landur.waitForURL(u => new URL(u).pathname.replace(/\/+$/, '') === '/portal', { timeout: 8000 });
    await landur.locator('[data-sonner-toast]').first().waitFor({ state: 'visible', timeout: 8000 });
    await landur.screenshot({ path: shot('landur-admin-redirige.png') });

    // ---- reader (lector de landur): calendario en solo lectura ----
    const readerSession = await login(f, 'reader');
    const readerContext = await newContext(browser, f, readerSession, 1440, 900);
    contexts.push(readerContext);
    const reader = await readerContext.newPage();
    trackErrors(reader, errors, 'reader');
    await reader.goto(f.base + '/portal/calendario', { waitUntil: 'networkidle' });
    await reader.locator(tid('cal-readonly')).waitFor({ state: 'visible' });
    const newButton = reader.locator(tid('cal-new'));
    const usable = (await newButton.isVisible()) && !(await newButton.isDisabled());
    assert(!usable, 'el lector puede usar «Nuevo trabajo»');
    await reader.screenshot({ path: shot('calendario-lector.png') });

    // ---- administración: quitar un acceso desde el panel debe cortarlo de verdad ----
    // Regresión: un revisor creyó que «Guardar permisos» no hacía nada. Se prueba de punta a punta con el
    // login real del usuario afectado (el usuario `pulso` solo tiene pulso:editor; se le da y quita LANDUR).
    {
      const target = await login(f, 'pulso');
      const before = await (await api(f, target, 'GET', '/api/projects')).json();
      assert(!before.projects.some(p => p.id === 'landur'), 'pulso ya tenía LANDUR antes de la prueba');
      const grant = await api(f, adminSession, 'PUT', '/api/admin/project-access', { id: 'pulso', projects: { pulso: 'editor', landur: 'editor' } });
      assert(grant.status === 200, 'el administrador no pudo dar LANDUR (' + grant.status + ')');
      const withLandur = await login(f, 'pulso');
      assert((await (await api(f, withLandur, 'GET', '/api/projects')).json()).projects.some(p => p.id === 'landur'), 'pulso no ve LANDUR tras darlo');

      const revokeCtx = await newContext(browser, f, adminSession, 1440, 900);
      contexts.push(revokeCtx);
      const rp = await revokeCtx.newPage();
      trackErrors(rp, errors, 'permisos');
      await rp.goto(f.base + '/portal/administracion?tab=grants', { waitUntil: 'networkidle' });
      await rp.locator(tid('grant-user')).waitFor({ state: 'visible' });
      await rp.click(tid('grant-user'));
      await rp.locator('[role="option"]').filter({ hasText: 'Usuario Pulso' }).click();
      await rp.click(tid('grant-landur'));
      await rp.locator('[role="option"]').filter({ hasText: 'Sin acceso' }).click();
      const putSeen = rp.waitForRequest(r => r.url().includes('/api/admin/project-access') && r.method() === 'PUT', { timeout: 8000 });
      await rp.click(tid('grants-save'));
      await rp.locator(tid('grants-confirm-save')).click();
      await putSeen;
      await poll(async () => !(await (await api(f, adminSession, 'GET', '/api/admin/users')).json()).users.find(u => u.id === 'pulso').projects.landur,
        'tras «Guardar permisos» el usuario conserva LANDUR en la API');
      assert((await api(f, withLandur, 'GET', '/auth/me')).status === 401, 'la sesión vieja del usuario sigue abierta tras quitarle el acceso');
      const after = await login(f, 'pulso');
      assert(!(await (await api(f, after, 'GET', '/api/projects')).json()).projects.some(p => p.id === 'landur'), 'pulso sigue viendo LANDUR');
      assert((await api(f, after, 'GET', '/landur/api/state')).status === 403, 'pulso sigue entrando a LANDUR');
      await rp.screenshot({ path: shot('administracion-permisos-revocados.png') });
    }

    if (errors.length) throw new Error('Errores en el navegador:\n' + errors.join('\n'));
    console.log(JSON.stringify({ portal: 'passed', screenshots: SHOTS }));
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (f) await f.close().catch(() => {});
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
