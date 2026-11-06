// QA del registro por voz en un iPhone, con un reconocedor simulado que NUNCA emite «end»
// (el comportamiento de iOS/WebKit que dejaba el micrófono tomado). Se comprueba que:
//  - un segundo dictado, después de guardar el primero, se interpreta y no queda «Escuchando…»;
//  - «80 mil» se guarda como 80.000 y no como 80;
//  - si el reconocedor no responde, la pantalla sale de «Escuchando…» sola y avisa.
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
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__reconocedores = [];
    class Simulado { constructor() { window.__reconocedores.push(this); } start() { this.onstart?.(); } stop() {} abort() {} }
    window.SpeechRecognition = Simulado; window.webkitSpeechRecognition = Simulado;
    window.__dictar = texto => window.__reconocedores.at(-1).onresult({ results: [{ 0: { transcript: texto } }] });
  });
  await page.goto(url);
  await page.getByRole('button', { name: /Entrar a la demo/ }).click();
  await page.locator('.mobile-nav').waitFor();
  const read = () => page.evaluate(async () => await (await fetch('/api/state')).json());
  const dictarYGuardar = async (texto, importeVisible) => {
    await page.locator('.mobile-nav [data-action=voice]').click();
    await page.locator('#modal.capture .cap-mic.on').waitFor();
    await page.evaluate(t => window.__dictar(t), texto);
    await page.locator('#modal .rv-amount', { hasText: importeVisible }).waitFor();
    await page.locator('#modal [data-cap=next]:not([disabled])').click();
    await page.locator('#modal [data-cap=save]').click();
    await page.locator('#modal').waitFor({ state: 'hidden' });
  };
  const previas = new Set((await read()).operations.map(o => o.id));
  await dictarYGuardar('80 mil pesos en comida con Santander', '80.000');
  // El segundo dictado es el que antes quedaba grabando para siempre.
  await dictarYGuardar('pagué 2 mil 500 de nafta con Santander', '2.500');
  const nuevas = (await read()).operations.filter(o => !previas.has(o.id));
  assert.equal(nuevas.length, 2, 'cada dictado debe guardar una sola operación');
  // El servidor guarda centavos: 80.000,00 son 8.000.000 y 2.500,00 son 250.000.
  assert.deepEqual(nuevas.map(o => Number(o.amount)).sort((x, y) => x - y), [250000, 8000000], 'los importes dictados no se guardaron completos');
  // Sin respuesta del reconocedor: la pantalla no puede quedarse «Escuchando…» para siempre.
  await page.locator('.mobile-nav [data-action=voice]').click();
  await page.locator('#modal.capture .cap-hint', { hasText: 'Escuchando' }).waitFor();
  await page.locator('#modal .cap-err', { hasText: /\S/ }).waitFor({ timeout: 25000 });
  assert.equal(await page.locator('#modal .cap-hint', { hasText: 'Escuchando' }).count(), 0, 'sigue «Escuchando…» sin que nadie hable');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['dos-dictados-seguidos', 'ochenta-mil-guarda-80000', 'sin-respuesta-sale-de-escuchando'] }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); ledger.close(); }
