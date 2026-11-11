// QA de Conexiones (Shopify, Meta Ads y Google Sheets) en un iPhone: lista, hoja del servicio, estados de la
// sincronía y alta por pasos. Corre contra la demo local con un navegador real; el token es
// ficticio y la sincronía se simula en la red, así que nunca llama a Shopify ni a Meta.
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
  await page.goto(url);
  await page.getByRole('button', { name: /Entrar a la demo/ }).click();
  await page.locator('.mobile-nav').waitFor();
  const { accounts } = await page.evaluate(async () => await (await fetch('/api/state')).json());
  // Conexiones: lista, hoja del servicio, estados de la sincronía y alta por pasos. El token es
  // ficticio y la sincronía se simula en la red: esta prueba nunca llama a Shopify ni a Meta.
  await page.evaluate(async accountId=>{
    const res=await fetch('/api/connections',{method:'POST',headers:{'Content-Type':'application/json','X-Landur-Request':'1'},
      body:JSON.stringify({kind:'shopify',domain:'tienda-demo.myshopify.com',currency:'UYU',commission:'3.5',accountId,accessToken:'shpat_'+'0123456789abcdef'.repeat(2)})});
    if(!res.ok)throw new Error(await res.text());
  },accounts.find(a=>a.currency==='UYU').id);
  await page.evaluate(()=>document.querySelector('[data-view="settings"]').click());
  await page.locator('[data-action="connections"]').getByText('Shopify conectado · Meta Ads sin conectar').waitFor();
  await page.locator('[data-action="connections"]').click();
  await page.locator('[data-connection-open="meta"]').getByText('Sin conectar',{exact:true}).waitFor();
  await page.locator('[data-connection-open="shopify"]').click();
  assert.equal(await page.locator('#connections-body').getByText('Todavía no sincronizaste',{exact:false}).count(),1);
  const sync=page.locator('[data-connection-sync="shopify"]');
  const reply=body=>page.route('**/api/sync/shopify',route=>route.fulfill({status:body.error?400:200,contentType:'application/json',body:JSON.stringify(body)}));
  await reply({created:[...Array(7).fill({kind:'sale'}),...Array(7).fill({kind:'collection'})],skipped:{duplicadas:3,prueba:1,sinCobro:2},errors:[{id:'#1042',message:'La moneda EUR no está admitida'}],since:'2026-10-03',until:'2026-11-02'});
  await sync.click();
  await page.locator('.cx-result .big',{hasText:'14 registros nuevos'}).waitFor();
  assert.ok(await page.locator('.cx-result .sub',{hasText:'7 ventas · 7 cobros'}).count());
  assert.ok(await page.locator('.cx-warn',{hasText:'#1042'}).count());
  await page.unroute('**/api/sync/shopify');
  await reply({created:[],skipped:{duplicadas:4},errors:[],since:'2026-10-01',until:'2026-11-01'});
  await page.locator('[data-connection-sync="shopify"]').click();
  await page.locator('.cx-status h4',{hasText:'Nada nuevo · 4 ya estaban'}).waitFor();
  await page.unroute('**/api/sync/shopify');
  await reply({error:'Shopify: el token no es válido o perdió el permiso. Actualizalo desde Configuración.'});
  await page.locator('[data-connection-sync="shopify"]').click();
  await page.locator('[data-connection-edit]').waitFor();
  await page.locator('[data-connection-edit]').click();
  assert.equal(await page.locator('[data-connection-details]').evaluate(d=>d.open),true);
  await page.unroute('**/api/sync/shopify');
  // Alta de Meta por pasos: el token solo se pide al final y el envío es el de siempre.
  await page.locator('[data-connection-back]').click();
  await page.locator('[data-connection-open="meta"]').click();
  await page.locator('form[data-wizard] [name=adAccountId]').fill('1234567890');
  await page.locator('form[data-wizard] [type=submit]').click();
  await page.locator('form[data-wizard] [name=accountId]').waitFor();
  await page.locator('[data-connection-prev]').click();
  assert.equal(await page.locator('form[data-wizard] [name=adAccountId]').inputValue(),'1234567890');
  await page.locator('form[data-wizard] [type=submit]').click();
  await page.locator('form[data-wizard] [type=submit]').click();
  assert.ok(await page.locator('form[data-wizard] [name=accessToken]').count());
  assert.equal(await page.locator('#modal').evaluate(e=>e.scrollWidth>e.clientWidth),false,'la hoja de conexiones desborda');
  await page.locator('[data-action=close]').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['conexiones-lista', 'conexiones-sincronia-parcial', 'conexiones-nada-nuevo', 'conexiones-error-token', 'conexiones-alta-por-pasos', 'conexiones-sin-desborde'] }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); ledger.close(); }
