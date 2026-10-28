import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { connect } from 'node:net';
import { Ledger } from '../server/ledger.mjs';
import { createApp, clientAddress } from '../server/app.mjs';
import { pngBytes } from './helpers/png.mjs';
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
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/Control financiero/);
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
// fetch no permite falsificar Host; para eso se habla HTTP a mano con el servidor.
function rawRequest(base, hostHeader, body) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port), hostname, () => socket.write([
      'POST /api/login HTTP/1.1',
      `Host: ${hostHeader}`,
      'Content-Type: application/json',
      'X-Landur-Request: 1',
      `Content-Length: ${Buffer.byteLength(body)}`,
      'Connection: close',
      '',
      body
    ].join('\r\n')));
    let data = '';
    socket.on('data', chunk => data += chunk);
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

test('límite de acceso por cliente: una tabla llena no bloquea a todos',async t=>{
  const {post}=await fixture(t,{trustProxy:true});
  for(let i=0;i<8;i++)assert.equal((await post('/api/login',{password:'wrong'},'',{'x-forwarded-for':'203.0.113.10'})).status,401);
  assert.equal((await post('/api/login',{password},'',{'x-forwarded-for':'203.0.113.10'})).status,429);
  assert.equal((await post('/api/login',{password},'',{'x-forwarded-for':'203.0.113.11'})).status,200);
});

test('detrás del proxy local el límite es por cliente reenviado, no por el proxy',async t=>{
  // fetch conecta desde 127.0.0.1: es el caso real de Passenger/Apache.
  const {post}=await fixture(t);
  for(let i=0;i<8;i++)assert.equal((await post('/api/login',{password:'wrong'},'',{'x-forwarded-for':'203.0.113.10'})).status,401);
  assert.equal((await post('/api/login',{password:'wrong'},'',{'x-forwarded-for':'203.0.113.10'})).status,429);
  // Otro cliente conserva su propio presupuesto: ocho fallos ajenos no bloquean la operación.
  assert.equal((await post('/api/login',{password},'',{'x-forwarded-for':'203.0.113.11'})).status,200);
});

test('la clave de cliente solo confía en X-Forwarded-For desde el proxy local',()=>{
  // Último salto: el que agrega el proxy inmediato.
  assert.equal(clientAddress({peer:'127.0.0.1',forwarded:'203.0.113.10, 198.51.100.7'}),'198.51.100.7');
  assert.equal(clientAddress({peer:'::1',forwarded:'203.0.113.10'}),'203.0.113.10');
  assert.equal(clientAddress({peer:'::ffff:127.0.0.1',forwarded:'203.0.113.10'}),'203.0.113.10');
  // Un cliente directo no puede suplantar su IP reenviándola.
  assert.equal(clientAddress({peer:'203.0.113.77',forwarded:'198.51.100.7'}),'203.0.113.77');
  assert.equal(clientAddress({peer:'10.0.0.5',forwarded:'198.51.100.7'}),'10.0.0.5');
  // Solo la confianza explícita cubre un proxy que no sea local.
  assert.equal(clientAddress({peer:'203.0.113.77',forwarded:'198.51.100.7',trustProxy:true}),'198.51.100.7');
  assert.equal(clientAddress({peer:'198.51.100.7',forwarded:''}),'198.51.100.7');
  assert.equal(clientAddress({peer:undefined}),'unknown');
});

test('escrituras con Host falsificado rechazadas',async t=>{
  const {base}=await fixture(t,{publicOrigin:'https://landur.example.com'});
  const payload=JSON.stringify({password});
  const forged = await rawRequest(base,'evil.example.com',payload);
  assert.ok(forged.startsWith('HTTP/1.1 403'), forged.slice(0, 40));
  const honest = await rawRequest(base,'landur.example.com',payload);
  assert.ok(honest.startsWith('HTTP/1.1 200'), honest.slice(0, 40));
});

test('la demo purga espacios sin sesión viva y conserva el espacio privado',async t=>{
  const {ledger,post}=await fixture(t,{demo:true});
  assert.equal((await post('/api/demo')).status,200);
  assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM workspaces WHERE demo=1').get().n,1);
  ledger.db.exec('UPDATE sessions SET expires=0');
  assert.equal((await post('/api/demo')).status,200);
  assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM workspaces WHERE demo=1').get().n,1);
  ledger.workspace('landur');ledger.db.exec('UPDATE sessions SET expires=0');await post('/api/demo');
  assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM workspaces WHERE id=?').get('landur').n,1);
});

test('cabecera de permisos habilita el micrófono solo para este origen',async t=>{
  const {base}=await fixture(t);
  const policy=(await fetch(base+'/')).headers.get('permissions-policy');
  assert.ok(policy.includes('microphone=(self)'), policy);
  assert.ok(!policy.includes('microphone=()'), policy);
});

test('la reversión por HTTP es idempotente y no se repite',async t=>{
  const {base,post,login}=await fixture(t);const cookie=await login();
  await post('/api/commands',{kind:'account',name:'Caja',accountKind:'cash',currency:'UYU',opening:'500',cutoff:'2026-10-01',verified:true,accessible:true},cookie,{'idempotency-key':randomUUID()});
  const account=(await(await fetch(base+'/api/state',{headers:{cookie}})).json()).accounts[0].id;
  const created=await post('/api/commands',{kind:'expense',concept:'Reversible',amount:'100',currency:'UYU',date:'2026-10-24',accountId:account},cookie,{'idempotency-key':randomUUID()});
  const operationId=(await created.json()).id;
  const body={kind:'reversal',operationId,date:'2026-10-25'},key=randomUUID();
  assert.equal((await post('/api/commands',body,cookie,{'idempotency-key':key})).status,200);
  const replay=await post('/api/commands',body,cookie,{'idempotency-key':key});
  assert.equal((await replay.json()).replayed,true,'reintentar la misma clave no crea otra reversión');
  assert.equal((await post('/api/commands',body,cookie,{'idempotency-key':randomUUID()})).status,409);
  assert.equal((await post('/api/commands',{kind:'reversal',operationId},cookie,{'idempotency-key':randomUUID()})).status,400);
  const state=await(await fetch(base+'/api/state',{headers:{cookie}})).json();
  assert.equal(state.operations.filter(o=>o.kind==='reversal').length,1);
  assert.equal(state.totals[0].expenses,0);
  assert.equal(state.totals[0].balance,50000);
});

const PNG=pngBytes().toString('base64');

test('comprobantes por HTTP: adjuntar, descargar y no salir del espacio',async t=>{
  const {base,post,login}=await fixture(t);const cookie=await login();
  const account=await(await post('/api/commands',{kind:'account',name:'Caja',accountKind:'cash',currency:'UYU',opening:'100',cutoff:'2026-10-24',verified:true,accessible:true},cookie,{'idempotency-key':randomUUID()})).json();
  const expense=await(await post('/api/commands',{kind:'expense',concept:'Embalajes',amount:'250',currency:'UYU',date:'2026-10-24',accountId:account.id},cookie,{'idempotency-key':randomUUID()})).json();
  const body={operationId:expense.id,name:'ticket.png',mime:'image/png',data:PNG};
  const key=randomUUID();
  const upload=await post('/api/evidence',body,cookie,{'idempotency-key':key});
  assert.equal(upload.status,200);
  const id=(await upload.json()).id;
  const replay=await post('/api/evidence',body,cookie,{'idempotency-key':key});
  assert.equal((await replay.json()).id,id,'el reintento con la misma clave no duplica');
  const file=await fetch(`${base}/api/evidence/${id}`,{headers:{cookie}});
  assert.equal(file.status,200);
  assert.equal(file.headers.get('content-type'),'image/png');
  assert.equal(file.headers.get('cache-control'),'no-store','un comprobante no se cachea');
  assert.match(file.headers.get('content-disposition'),/inline/);
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())],[...Buffer.from(PNG,'base64')]);
  assert.equal((await fetch(`${base}/api/evidence/${id}`)).status,401,'sin sesión no se descarga');
  assert.equal((await fetch(`${base}/api/evidence/${randomUUID()}`,{headers:{cookie}})).status,404);
  assert.equal((await post('/api/evidence',body)).status,401);
  assert.equal((await post('/api/evidence',{...body,data:'aGVsbG8='},cookie,{'idempotency-key':randomUUID()})).status,400,'los bytes deciden el tipo');
  const removed=await post('/api/commands',{kind:'evidence.remove',evidenceId:id},cookie,{'idempotency-key':randomUUID()});
  assert.equal(removed.status,200);
  assert.equal((await(await fetch(`${base}/api/state`,{headers:{cookie}})).json()).evidence.length,0);
  assert.equal((await fetch(`${base}/api/evidence/${id}`,{headers:{cookie}})).status,404);
  assert.equal((await post('/api/commands',{kind:'evidence.remove',evidenceId:randomUUID()},cookie,{'idempotency-key':randomUUID()})).status,404);
  assert.ok((await(await fetch(`${base}/api/state`,{headers:{cookie}})).json()).audit.some(a=>a.action==='evidence.removed'));
});

test('baja de cuentas por HTTP: cuentas, pagos e historial con trazabilidad',async t=>{
  const {base,post,login}=await fixture(t),cookie=await login();
  const create=async name=>(await post('/api/commands',{kind:'account',name,accountKind:'cash',currency:'UYU',opening:'100',cutoff:'2026-10-01',verified:true,accessible:true},cookie,{'idempotency-key':randomUUID()})).json();
  const empty=await create('Cuenta vacía');
  const key=randomUUID(),body={kind:'account.delete',accountId:empty.id};
  assert.equal((await post('/api/commands',body,cookie,{'idempotency-key':key})).status,200);
  assert.equal((await post('/api/commands',body,cookie,{'idempotency-key':key}).then(r=>r.json())).replayed,true);
  assert.equal((await(await fetch(base+'/api/state',{headers:{cookie}})).json()).accounts.length,0);
  const used=await create('Cuenta usada');
  const obligation=await(await post('/api/commands',{kind:'obligation',concept:'Factura por pagar',amount:'10',currency:'UYU',date:'2026-10-24',due:'2026-10-30'},cookie,{'idempotency-key':randomUUID()})).json();
  const payment=await(await post('/api/commands',{kind:'payment',concept:'Pago de prueba',amount:'10',currency:'UYU',date:'2026-10-24',accountId:used.id,targetId:obligation.id},cookie,{'idempotency-key':randomUUID()})).json();
  const rejectUsed=await post('/api/commands',{kind:'account.delete',accountId:used.id},cookie,{'idempotency-key':randomUUID()});
  assert.equal(rejectUsed.status,409,'no deja borrar una cuenta con movimientos activos');
  const stateWithPayment=await(await fetch(base+'/api/state',{headers:{cookie}})).json();
  assert.equal(stateWithPayment.accounts.length,1);
  assert.equal(stateWithPayment.totals[0].payable,0);
  const deletePayment={kind:'payment.delete',paymentId:payment.id},deleteKey=randomUUID();
  assert.equal((await post('/api/commands',deletePayment,cookie,{'idempotency-key':deleteKey})).status,200);
  assert.equal((await(await fetch(base+'/api/state',{headers:{cookie}})).json()).totals[0].payable,1000,'al quitar el pago la factura vuelve a pendiente');
  assert.equal((await post('/api/commands',deletePayment,cookie,{'idempotency-key':deleteKey}).then(r=>r.json())).replayed,true);
  const removeUsed=await post('/api/commands',{kind:'account.delete',accountId:used.id},cookie,{'idempotency-key':randomUUID()});
  assert.equal(removeUsed.status,200,'al limpiar el historial de pagos la cuenta puede eliminarse');
  assert.equal((await(await fetch(base+'/api/state',{headers:{cookie}})).json()).accounts.length,0);
  assert.equal((await post('/api/commands',{kind:'account.delete',accountId:randomUUID()},cookie,{'idempotency-key':randomUUID()})).status,404);
  assert.ok((await(await fetch(base+'/api/state',{headers:{cookie}})).json()).audit.some(a=>a.action==='account.deleted'));
});


test('la importación tiene límite por sesión y no bloquea a los demás',async t=>{
  const {post,login}=await fixture(t);const cookie=await login();
  const csv='kind,date,concept,amount,currency,account_id,due,source,external_id,category\r\nsale,2026-10-24,Prueba de límite,10.00,UYU,,,manual,QA-LIMITE-1,\r\n';
  let last;
  for(let i=0;i<31;i++)last=await post('/api/import/preview',{csv},cookie);
  assert.equal(last.status,429,'la 31ª llamada en el minuto se corta');
  // El tope es por sesión: otra sesión de la misma instancia sigue funcionando.
  const other=await login();
  assert.equal((await post('/api/import/preview',{csv},other)).status,200);
  // Y los comandos normales tampoco se ven afectados.
  assert.equal((await post('/api/commands',{kind:'account',name:'Caja',accountKind:'cash',currency:'UYU',opening:'100',cutoff:'2026-10-24',verified:true,accessible:true},cookie,{'idempotency-key':randomUUID()})).status,200);
});
