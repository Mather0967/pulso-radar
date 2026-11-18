// QA del calendario del portal (/calendario). Uso: node scripts/qa-calendario.cjs
// Requiere Playwright y, opcionalmente, BROWSER_EXECUTABLE con un Chromium instalado.
// Levanta el portal de prueba (tests/helpers/portal-fixture.mjs), prueba como admin y como reader.
const fs = require('node:fs');
const { chromium } = require('playwright');

const SHOTS = '/tmp/claude-0/-home-user-pulso-radar/5ba4fad5-ad69-59ed-bb36-18139de18fe2/scratchpad/shots-cal';
const shot = name => `${SHOTS}/${name}`;
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const assert = (cond, msg) => { if (!cond) throw new Error('QA calendario: ' + msg); };

async function poll(check, msg, timeout = 8000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await check()) return;
    if (Date.now() > end) throw new Error('QA calendario: ' + msg);
    await new Promise(r => setTimeout(r, 200));
  }
}

// Inicia sesión por la API y devuelve la cookie de sesión tal como la envía el servidor.
async function login(f, id) {
  const res = await fetch(f.base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: f.base },
    body: JSON.stringify({ email: `${id}@example.test`, password: f.password }),
    redirect: 'manual',
  });
  assert(res.status === 200, `login de ${id} respondió ${res.status}`);
  const raw = res.headers.get('set-cookie');
  assert(raw, `login de ${id} sin set-cookie`);
  const pair = raw.split(';')[0];
  const eq = pair.indexOf('=');
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
}

async function listJobs(f, cookie) {
  const res = await f.request('/api/calendar/jobs', { cookie: `${cookie.name}=${cookie.value}` });
  assert(res.status === 200, `GET /api/calendar/jobs respondió ${res.status}`);
  return (await res.json()).jobs;
}

function trackErrors(page, errors, label) {
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
}

async function main() {
  const { portalFixture } = await import('../tests/helpers/portal-fixture.mjs');
  fs.mkdirSync(SHOTS, { recursive: true });
  const errors = [];
  let f = null;
  let browser = null;
  try {
    f = await portalFixture();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
      ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
    });

    // ---- admin: escritorio ----
    const adminCookie = await login(f, 'admin');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies([{ ...adminCookie, url: f.base }]);
    const page = await context.newPage();
    trackErrors(page, errors, 'admin');

    await page.goto(f.base + '/calendario', { waitUntil: 'networkidle' });
    await page.locator('#cal-grid').waitFor({ state: 'visible' });
    assert((await page.textContent('#cal-title')).trim() !== '', '#cal-title vacío');
    assert(await page.locator('[data-date]').count() > 0, 'la cuadrícula no tiene celdas de día');

    const today = new Date();
    const alt = new Date(today);
    alt.setDate(today.getDate() + (today.getDate() < 28 ? 1 : -1)); // siempre dentro del mismo mes
    const todayIso = iso(today);
    const altIso = iso(alt);

    // Crear
    await page.click('#cal-new');
    await page.locator('#job-dialog[open]').waitFor({ state: 'visible' });
    await page.fill('#job-form [name=title]', 'Entrevista QA');
    await page.fill('#job-form [name=date]', todayIso);
    await page.uncheck('#job-form [name=allDay]'); // por defecto un trabajo nuevo es de todo el día
    await page.fill('#job-form [name=start]', '10:00');
    await page.fill('#job-form [name=end]', '11:00');
    await page.selectOption('#job-form [name=project]', 'pulso');
    await page.selectOption('#job-form [name=kind]', 'entrevista');
    await page.selectOption('#job-form [name=status]', 'pendiente');
    await page.fill('#job-form [name=notes]', 'Trabajo creado por la prueba automática.');
    await page.screenshot({ path: shot('dialog.png') });
    await page.click('#job-save');

    const createdChip = page.locator('[data-job-id]').filter({ hasText: 'Entrevista QA' }).first();
    await createdChip.waitFor({ state: 'visible' });
    const jobId = await createdChip.getAttribute('data-job-id');
    assert(jobId, 'el chip no tiene data-job-id');
    let job = (await listJobs(f, adminCookie)).find(j => j.id === jobId);
    assert(job && job.date === todayIso && job.title === 'Entrevista QA', 'el trabajo creado no coincide con la API');
    await page.screenshot({ path: shot('month.png') });

    // Editar título
    await page.locator(`[data-job-id="${jobId}"]`).first().click();
    await page.locator('#job-dialog[open]').waitFor({ state: 'visible' });
    await page.fill('#job-form [name=title]', 'Entrevista QA editada');
    await page.click('#job-save');
    await page.locator(`[data-job-id="${jobId}"]`).filter({ hasText: 'Entrevista QA editada' }).first().waitFor({ state: 'visible' });
    await poll(async () => (await listJobs(f, adminCookie)).find(j => j.id === jobId)?.title === 'Entrevista QA editada',
      'el título editado no llegó a la API');

    // Arrastrar a otro día
    // dragAndDrop de Playwright no dispara dragstart en chips <button draggable>: se usa el mouse real.
    const from = await page.locator(`[data-job-id="${jobId}"]`).first().boundingBox();
    const to = await page.locator(`[data-date="${altIso}"]`).first().boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + from.width / 2 + ((to.x + to.width / 2 - from.x - from.width / 2) * i) / 10, from.y + from.height / 2 + ((to.y + to.height / 2 - from.y - from.height / 2) * i) / 10);
    await page.mouse.up();
    await poll(async () => (await listJobs(f, adminCookie)).find(j => j.id === jobId)?.date === altIso,
      'la fecha no cambió en la API tras arrastrar');

    // Cambiar de vista
    for (const view of ['week', 'agenda', 'month']) {
      await page.click(`button[data-view="${view}"]`);
      await poll(async () => (await page.getAttribute(`button[data-view="${view}"]`, 'aria-pressed')) === 'true',
        `la vista ${view} no quedó marcada`, 3000);
      await page.screenshot({ path: shot(`${view}.png`) });
    }

    // Borrar con dos clics
    await page.locator(`[data-job-id="${jobId}"]`).first().click();
    await page.locator('#job-dialog[open]').waitFor({ state: 'visible' });
    await page.click('#job-delete');
    await page.click('#job-delete');
    await poll(async () => !(await listJobs(f, adminCookie)).some(j => j.id === jobId),
      'el trabajo no se borró en la API');
    await page.locator(`[data-job-id="${jobId}"]`).waitFor({ state: 'detached' });

    // Móvil: la vista agenda se fuerza
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#cal-grid').waitFor({ state: 'visible' });
    assert(await page.getAttribute('button[data-view="agenda"]', 'aria-pressed') === 'true',
      'en 390 px no se fuerza la vista agenda');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    assert(!overflow, 'hay desborde horizontal en 390 px');
    await page.screenshot({ path: shot('mobile.png') });
    await context.close();

    // ---- reader: solo lectura ----
    const readerCookie = await login(f, 'reader');
    const readerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await readerContext.addCookies([{ ...readerCookie, url: f.base }]);
    const reader = await readerContext.newPage();
    trackErrors(reader, errors, 'reader');
    await reader.goto(f.base + '/calendario', { waitUntil: 'networkidle' });
    await reader.locator('#cal-readonly').waitFor({ state: 'visible' });
    const newBtn = reader.locator('#cal-new');
    const newUsable = (await newBtn.isVisible()) && !(await newBtn.isDisabled());
    assert(!newUsable, 'reader puede usar «Nuevo trabajo»');
    await reader.screenshot({ path: shot('readonly.png') });
    await readerContext.close();

    if (errors.length) throw new Error('Errores en el navegador:\n' + errors.join('\n'));
    console.log(JSON.stringify({ calendario: 'passed', screenshots: SHOTS }));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (f) await f.close().catch(() => {});
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
