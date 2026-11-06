// QA de situaciones de uso cotidiano en un iPhone (390 px), halladas explorando la app:
//  - pasar del micrófono a escribir apaga el micrófono: una voz ajena no pisa lo escrito;
//  - un corte de red breve, o un fallo pasajero del servidor al volver a la app, no cierra
//    el formulario ni manda al ingreso; solo una sesión vencida (401) lo hace;
//  - el contador de Pendientes coincide con los pendientes reales;
//  - un concepto largo sin espacios no desborda la pantalla.
// La transcripción es lo único simulado: la lógica de la app, el guardado y el servidor son los reales.
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { Ledger } from '../server/ledger.mjs';
import { createApp } from '../server/app.mjs';

const ledger = new Ledger();
const server = createApp({ ledger, demo: true, insecureCookies: true });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || await chromiumBinary.executablePath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'], headless: true });
const errors = [];
async function fresh(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__reconocedores = [];
    class Simulado { constructor() { window.__reconocedores.push(this); } start() { this.onstart?.(); } stop() {} abort() {} }
    window.SpeechRecognition = Simulado; window.webkitSpeechRecognition = Simulado;
    window.__dictar = texto => window.__reconocedores.at(-1).onresult?.({ results: [{ 0: { transcript: texto } }] });
  });
  await page.goto(url);
  await page.getByRole('button', { name: /Entrar a la demo/ }).click();
  await page.locator(width >= 900 ? '.sidebar' : '.mobile-nav').waitFor();
  return { context, page };
}
const read = page => page.evaluate(async () => await (await fetch('/api/state')).json());
const passed = [];
try {
  // 1. Del micrófono a escribir: la voz ya no llega a la pantalla.
  {
    const { context, page } = await fresh();
    await page.locator('.mobile-nav [data-action=voice]').click();
    await page.locator('#modal.capture .cap-mic.on').waitFor();
    await page.locator('[data-cap=type]').click();
    await page.locator('[data-capfield=amount]').fill('250');
    await page.locator('[data-cap=done]').click();
    assert.equal(await page.locator('#modal .cap-voice.on').count(), 0, 'el micrófono sigue encendido tras pasar a escribir');
    await page.evaluate(() => window.__dictar('compré cosas por 999 pesos en comida'));
    await page.waitForTimeout(200);
    const importe = (await page.locator('#modal .rv-amount').innerText()).replace(/\D/g, '');
    assert.ok(importe.startsWith('250') && !importe.includes('999'), `una voz ajena pisó el importe escrito: ${importe}`);
    await context.close(); passed.push('escribir-apaga-el-microfono');
  }
  // 2. Corte de red breve con el formulario abierto: no se cierra ni se pierde lo escrito.
  {
    const { context, page } = await fresh();
    await page.locator('.mobile-nav [data-action=voice]').click();
    await page.locator('[data-cap=type]').click();
    await page.locator('[data-capfield=amount]').fill('1500');
    await context.setOffline(true); await page.waitForTimeout(600);
    assert.equal(await page.locator('#modal').evaluate(e => e.open), true, 'el corte de red cerró el formulario');
    assert.equal(await page.locator('[data-capfield=amount]').inputValue(), '1500', 'se perdió lo escrito');
    await context.setOffline(false); await page.waitForTimeout(600);
    assert.equal(await page.locator('#login-form').count(), 0, 'apareció el ingreso por un corte pasajero');
    await context.close(); passed.push('corte-de-red-no-cierra-el-formulario');
  }
  // 3. Un 503 pasajero al volver a la app no manda al ingreso; un 401 sí.
  {
    const { context, page } = await fresh();
    const volver = () => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.route('**/api/state', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"temporal"}' }));
    await volver(); await page.waitForTimeout(800);
    assert.equal(await page.locator('#login-form').count(), 0, 'un 503 pasajero mandó al ingreso');
    assert.ok(await page.locator('.mobile-nav').isVisible(), 'la pantalla principal desapareció');
    await page.unroute('**/api/state');
    await page.route('**/api/state', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Sesión inválida"}' }));
    await volver(); await page.locator('#login-form').waitFor({ timeout: 4000 });
    await context.close(); passed.push('503-no-bloquea-401-si');
  }
  // 4. El contador de Pendientes (escritorio) coincide con los pendientes reales.
  {
    const { context, page } = await fresh(1280);
    const s = await read(page);
    const reales = s.operations.filter(o => ['obligation', 'sale'].includes(o.kind) && o.amount > o.applied && !o.reversed_by).length;
    const unidad = (await page.locator('.sidebar .nav-count').innerText()).trim();
    assert.equal(Number(unidad), reales, `el contador muestra ${unidad} y hay ${reales} pendientes`);
    await context.close(); passed.push('contador-de-pendientes');
  }
  // 5. Un concepto largo sin espacios no desborda Inicio ni Actividad.
  {
    const { context, page } = await fresh();
    const largo = 'Compra-de-materiales-para-el-local-de-la-calle-Sarandi-numero-1234-esquina-Rivera'.repeat(2).slice(0, 170);
    await page.evaluate(async concept => {
      const st = await (await fetch('/api/state')).json();
      await fetch('/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Landur-Request': '1', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ kind: 'expense', concept, amount: '123.45', currency: 'UYU', date: new Date().toISOString().slice(0, 10), accountId: st.accounts.find(a => a.currency === 'UYU').id }) });
    }, largo);
    await page.reload(); await page.locator('.mobile-nav').waitFor();
    for (const name of ['Inicio', 'Actividad']) {
      await page.locator('.mobile-nav [data-view]').filter({ hasText: name }).click(); await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} desborda con un concepto largo`);
    }
    await context.close(); passed.push('concepto-largo-no-desborda');
  }
  // 6. En un iPhone SE antiguo (320 px) ninguna pantalla desborda.
  {
    const { context, page } = await fresh(320);
    for (const name of ['Inicio', 'Actividad', 'Pendientes']) {
      await page.locator('.mobile-nav [data-view]').filter({ hasText: name }).click(); await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} desborda a 320 px`);
    }
    await context.close(); passed.push('sin-desborde-a-320px');
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); ledger.close(); }
