// Regression for Arena's embedded preview: no cookies can be stored or sent.
import {chromium} from 'playwright-core';
import chromiumBinary,{inflate} from '@sparticuz/chromium';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {Ledger} from '../server/ledger.mjs';
import {createApp} from '../server/app.mjs';
const ledger=new Ledger();
const app=createApp({ledger,demo:true,insecureCookies:true});
app.listen(0,'127.0.0.1');await once(app,'listening');
const child=`http://127.0.0.1:${app.address().port}`;
const parent=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<iframe id="preview" src="${child}" width="1200" height="900"></iframe>`);});
parent.listen(0,'127.0.0.1');await once(parent,'listening');
let browser;
try{
 const libs=!process.env.BROWSER_EXECUTABLE&&process.platform==='linux'?await inflate(fileURLToPath(new URL('../node_modules/@sparticuz/chromium/bin/al2023.tar.br',import.meta.url))):null;
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||await chromiumBinary.executablePath(),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--no-zygote','--use-gl=angle','--use-angle=swiftshader'],env:{...process.env,...(libs?{LD_LIBRARY_PATH:`${libs}/lib:${process.env.LD_LIBRARY_PATH||''}`}:{})},headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 let demoToken;
 await context.route(child+'/api/**',async route=>{
   const headers={...route.request().headers()};delete headers.cookie;
   if(headers['x-landur-demo-session'])demoToken=headers['x-landur-demo-session'];
   // Node fetch does not share Playwright's cookie jar (route.fetch does).
   const req=route.request();
   const response=await fetch(req.url(),{method:req.method(),headers,...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})});
   const outgoing=Object.fromEntries(response.headers);delete outgoing['set-cookie'];
   await route.fulfill({status:response.status,headers:outgoing,body:Buffer.from(await response.arrayBuffer())});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
 await page.goto(`http://localhost:${parent.address().port}`);
 const frame=page.frameLocator('#preview');
 await frame.getByRole('heading',{name:'Tu negocio, en claro.'}).waitFor({timeout:10000});
 assert.ok(demoToken);assert.equal((await context.cookies()).length,0);
 await frame.getByRole('button',{name:'Registrar operación',exact:true}).click();
 await frame.locator('[name=concept]').fill('Gasto sintético sin cookies');await frame.locator('[name=amount]').fill('15');
 await frame.locator('[name=accountId]').selectOption({label:'Santander · UYU'});
 const [saved]=await Promise.all([
   page.waitForResponse(r=>r.url()===child+'/api/state',{timeout:10000}),
   frame.locator('#operation-form').evaluate(f=>f.requestSubmit())
 ]);
 await frame.locator('#modal').waitFor({state:'hidden'});
 assert.equal((await saved.json()).operations.filter(o=>o.concept==='Gasto sintético sin cookies').length,1);
 await frame.locator('.sidebar [data-view=moves]').click();
 const download=page.waitForEvent('download');await frame.getByRole('button',{name:'CSV',exact:true}).click();assert.equal((await download).suggestedFilename(),'landur-operaciones.csv');
 const oldToken=demoToken;
 await frame.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await frame.getByRole('button',{name:'Explorar demostración'}).waitFor();
 assert.equal((await fetch(child+'/api/state',{headers:{'X-Landur-Demo-Session':oldToken}})).status,401);
 await frame.locator('#login-form').evaluate(f=>f.requestSubmit());await frame.getByRole('heading',{name:'Tu negocio, en claro.'}).waitFor({timeout:10000});
 assert.notEqual(demoToken,oldToken);
 assert.deepEqual(errors,[]);
 console.log('OK: iframe cross-site SIN cookies: explorar, registrar, exportar, cerrar sesión y volver a explorar. Token solo en memoria; controles privados intactos.');
}finally{await browser?.close();await new Promise(resolve=>parent.close(resolve));await new Promise(resolve=>app.close(resolve));ledger.close();}
