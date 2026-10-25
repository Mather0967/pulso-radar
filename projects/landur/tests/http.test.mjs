import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Ledger } from '../server/ledger.mjs';
import { createApp } from '../server/app.mjs';
const password='synthetic-test-secret-only';
async function fixture(t, options={}) {
  const ledger=new Ledger();const server=createApp({ledger,password,insecureCookies:true,...options});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));ledger.close();});
  const post=(path,input={},cookie='',extra={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1',origin:base,cookie,...extra},body:JSON.stringify(input)});
  const login=async()=>{const r=await post('/api/login',{password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  return {ledger,base,post,login};
}
test('acceso privado sin sesión rechazado; login/logout y no-store',async t=>{
  const {base,post,login}=await fixture(t);
  assert.equal((await fetch(base+'/api/state')).status,401);
  const cookie=await login();const state=await fetch(base+'/api/state',{headers:{cookie}});
  assert.equal(state.status,200);assert.equal(state.headers.get('cache-control'),'no-store');
  assert.equal((await state.json()).accounts.length,0);
  await post('/api/logout',{},cookie);
  assert.equal((await fetch(base+'/api/state',{headers:{cookie}})).status,401);
});
test('cookies seguras y alcance único del host en despliegue',async t=>{
  const {post}=await fixture(t,{insecureCookies:false,publicOrigin:'https://landur.example.com'});
  const r=await post('/api/login',{password},'',{origin:'https://landur.example.com'});
  const cookie=r.headers.get('set-cookie');assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.doesNotMatch(cookie,/Domain=/);
});
test('rechazo de CSRF y límite de intentos',async t=>{
  const {post}=await fixture(t);
  assert.equal((await post('/api/login',{password},'',{origin:'https://attacker.example'})).status,403);
  assert.equal((await post('/api/login',{password},'',{'x-landur-request':''})).status,415);
  for(let i=0;i<8;i++)assert.equal((await post('/api/login',{password:'wrong'})).status,401);
  assert.equal((await post('/api/login',{password})).status,429);
});
test('JSON nulo y tamaño excesivo rechazados',async t=>{
  const {post}=await fixture(t);
  assert.equal((await post('/api/login',null)).status,400);
  assert.equal((await post('/api/login',{password:'x'.repeat(17000)})).status,413);
});
test('sesión caducada rechazada',async t=>{
  const {base,ledger,login}=await fixture(t);const cookie=await login();ledger.db.exec('UPDATE sessions SET expires=0');
  assert.equal((await fetch(base+'/api/state',{headers:{cookie}})).status,401);
});
test('demo deshabilitada en instancia privada y datos nunca estáticos',async t=>{
  const {base,post}=await fixture(t);
  assert.equal((await post('/api/demo')).status,404);
  for(const path of ['/data/landur.sqlite','/.env','/server/ledger.mjs','/../package.json'])assert.equal((await fetch(base+path)).status,404);
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/Tu negocio, en claro/);
});
test('comandos HTTP persistentes e idempotentes',async t=>{
  const {base,post,login}=await fixture(t);const cookie=await login();const key=randomUUID();
  const input={kind:'account',name:'Caja de prueba',accountKind:'cash',currency:'UYU',opening:'100',cutoff:'2026-10-24',verified:false,accessible:true};
  const headers={'idempotency-key':key};
  assert.equal((await post('/api/commands',input,cookie,headers)).status,200);
  const repeated=await post('/api/commands',input,cookie,headers);assert.equal((await repeated.json()).replayed,true);
  const state=await(await fetch(base+'/api/state',{headers:{cookie}})).json();assert.equal(state.accounts.length,1);assert.equal(state.totals[0].verifiedAccessible,0);
});
test('visitantes demo tienen espacios separados',async t=>{
  const {base,post}=await fixture(t,{demo:true});
  const a=(await post('/api/demo')).headers.get('set-cookie').split(';')[0];
  const b=(await post('/api/demo')).headers.get('set-cookie').split(';')[0];
  const first=await(await fetch(base+'/api/state',{headers:{cookie:a}})).json();
  const second=await(await fetch(base+'/api/state',{headers:{cookie:b}})).json();
  assert.equal(first.demo,true);assert.notEqual(first.accounts[0].id,second.accounts[0].id);
  const response=await post('/api/commands',{kind:'expense',concept:'Prueba',amount:'10',currency:'UYU',date:'2026-10-24',accountId:first.accounts[0].id},b,{'idempotency-key':randomUUID()});
  assert.equal(response.status,404);
});

test('recursos PWA públicos sin datos y exportación protegida',async t=>{
  const {base,login}=await fixture(t);
  for(const path of ['/app.js','/styles.css','/manifest.webmanifest','/sw.js','/apple-touch-icon.png'])assert.equal((await fetch(base+path)).status,200);
  const manifest=await(await fetch(base+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');
  assert.equal((await fetch(base+'/api/export.csv')).status,401);
  const cookie=await login();const response=await fetch(base+'/api/export.csv',{headers:{cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('vista previa e importación HTTP conservan el aislamiento',async t=>{
  const {base,post,login}=await fixture(t);const cookie=await login();
  const csv='kind,date,concept,amount,currency,account_id,due,source,external_id,category\nsale,2026-10-24,Prueba,100,UYU,,,hoja,x-1,Ventas';
  assert.equal((await post('/api/import/preview',{csv})).status,401);
  assert.equal((await post('/api/import/preview',{csv},cookie)).status,200);
  let state=await(await fetch(base+'/api/state',{headers:{cookie}})).json();assert.equal(state.operations.length,0);
  assert.equal((await post('/api/import/commit',{csv},cookie,{'idempotency-key':randomUUID()})).status,200);
  state=await(await fetch(base+'/api/state',{headers:{cookie}})).json();assert.equal(state.operations.length,1);
});

test('demo embebida funciona sin cookies; token aislado e invalidado al salir',async t=>{
  const {base,post}=await fixture(t,{demo:true});
  const a=await(await post('/api/demo')).json();const b=await(await post('/api/demo')).json();
  assert.match(a.demoToken,/^[a-f0-9]{64}$/);assert.notEqual(a.demoToken,b.demoToken);
  const headers={'X-Landur-Demo-Session':a.demoToken};
  const first=await(await fetch(base+'/api/state',{headers})).json();
  const second=await(await fetch(base+'/api/state',{headers:{'X-Landur-Demo-Session':b.demoToken}})).json();
  assert.notEqual(first.accounts[0].id,second.accounts[0].id);
  assert.equal((await fetch(base+'/api/export.csv',{headers})).status,200);
  assert.equal((await post('/api/logout',{},'',headers)).status,200);
  assert.equal((await fetch(base+'/api/state',{headers})).status,401);
  assert.equal((await fetch(base+'/api/state',{headers:{'X-Landur-Demo-Session':b.demoToken}})).status,200);
});
test('modo privado ignora credenciales por encabezado de demo',async t=>{
  const {base,login}=await fixture(t);const cookie=await login();
  const actualPrivateToken=cookie.slice('landur_session='.length);
  assert.equal((await fetch(base+'/api/state',{headers:{'X-Landur-Demo-Session':actualPrivateToken}})).status,401);
  assert.equal((await fetch(base+'/api/state',{headers:{cookie}})).status,200);
});
test('solo la demo HTTPS usa cookie particionada para el visor embebido',async t=>{
  const {post}=await fixture(t,{demo:true,insecureCookies:false,publicOrigin:'https://preview.example'});
  const response=await post('/api/demo',{},'',{origin:'https://preview.example'});
  const cookie=response.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=None/);assert.match(cookie,/Partitioned/);
});
