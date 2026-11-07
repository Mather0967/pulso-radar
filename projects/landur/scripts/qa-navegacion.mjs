// QA de la navegación: cambiar muchas veces entre las pestañas no debe acumular escuchas de clic
// ni volver lenta la pantalla. Antes, cada pintado de la app agregaba escuchas nuevas al contenedor
// y cada clic de pestaña las duplicaba: tras unas doce pulsaciones la página se congelaba.
// Corre contra la demo local en un navegador real, a tamaño de iPhone.
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
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  // Reconocedor simulado y mudo (como el de iOS, que a veces no emite «end»): aquí solo importa que abrir y cerrar no deje nada.
  await page.addInitScript(() => { class Mudo { start() {} stop() {} abort() {} } window.SpeechRecognition = Mudo; window.webkitSpeechRecognition = Mudo; });
  await page.goto(url);
  await page.getByRole('button', { name: /Entrar a la demo/ }).click();
  await page.locator('.mobile-nav').waitFor();
  // Escuchas de clic que tiene el contenedor de la app en este momento (las ve el depurador, no la página).
  const cdp = await context.newCDPSession(page);
  const clickListeners = async () => {
    const { result } = await cdp.send('Runtime.evaluate', { expression: "document.querySelector('#app')" });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    return listeners.filter(l => l.type === 'click').length;
  };
  const baseline = await clickListeners();
  assert.ok(baseline > 0 && baseline < 10, `escuchas iniciales inesperadas: ${baseline}`);
  const tabs = ['Actividad', 'Inicio', 'Pendientes'];
  let slowest = 0;
  // Falla rápido y con un mensaje claro si cada pestaña deja escuchas: antes de seguir, tres cambios.
  for (let i = 0; i < 3; i++) {
    await page.locator('.mobile-nav [data-view]').filter({ hasText: tabs[i] }).click();
    assert.equal(await clickListeners(), baseline, `tras ${i + 1} cambio(s) de pestaña el contenedor tiene ${await clickListeners()} escuchas de clic en vez de ${baseline}`);
  }
  for (let i = 0; i < 40; i++) {
    const t = Date.now();
    await page.locator('.mobile-nav [data-view]').filter({ hasText: tabs[i % tabs.length] }).click();
    slowest = Math.max(slowest, Date.now() - t);
  }
  assert.equal(await clickListeners(), baseline, 'cada cambio de pestaña dejó escuchas de clic nuevas');
  assert.ok(slowest < 1500, `un cambio de pestaña tardó ${slowest} ms`);
  // Un toque sobre un movimiento abre un solo detalle, no uno por cada escucha acumulada.
  await page.locator('.mobile-nav [data-view]').filter({ hasText: 'Actividad' }).click();
  await page.locator('[data-operation]').first().click();
  await page.locator('#modal[open]').waitFor();
  assert.equal(await page.locator('#modal [data-action="close"]').count(), 1);
  await page.keyboard.press('Escape'); await page.locator('#modal[open]').waitFor({ state: 'detached' }).catch(() => {});
  // Abrir y cerrar el registro varias veces tampoco debe dejar escuchas en el diálogo ni en el documento.
  const total = async selector => {
    const { result } = await cdp.send('Runtime.evaluate', { expression: selector });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    return listeners.length;
  };
  const dialogBefore = await total("document.querySelector('#modal')"), docBefore = await total('document');
  for (let i = 0; i < 8; i++) {
    await page.locator('.mobile-nav [data-action=voice]').click();
    await page.locator('#modal.capture[open]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#modal.capture').waitFor({ state: 'detached' }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('#modal').open);
  }
  assert.equal(await total("document.querySelector('#modal')"), dialogBefore, 'el diálogo acumula escuchas al abrir y cerrar el registro');
  assert.equal(await total('document'), docBefore, 'el documento acumula escuchas');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['escuchas-estables-tras-40-cambios', 'cambio-de-pestana-rapido', 'un-toque-un-detalle', 'registro-abre-y-cierra-sin-acumular'], baseline, slowestMs: slowest }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); ledger.close(); }
