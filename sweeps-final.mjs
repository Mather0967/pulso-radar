import { once } from 'node:events';
import { createApp } from './projects/landur/server/app.mjs';
import { Ledger } from './projects/landur/server/ledger.mjs';

const ledger = new Ledger();
const app = createApp({ ledger, demo:true, insecureCookies:true });
app.listen(0,'127.0.0.1');
await once(app,'listening');
const base='http://127.0.0.1:'+app.address().port;
let r;

async function login(password){
  const res=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1'},body:JSON.stringify({password})});
  const setCookie=res.headers.get('set-cookie');
  return {res,cookie:setCookie?.split(';')[0],status:res.status};
}

async function suite(){
  r=await fetch(base+'/api/state');console.log('1 api state sin sesion => '+(r.status===401?'OK':'FALLA')+(' '+r.status));
  r=await fetch(base+'/api/export.csv');console.log('2 export sin sesion => '+(r.status===401?'OK':'FALLA')+(' '+r.status));

  async function fallo(idx){
    const f=await login('wrong');console.log('fallo '+idx+' => '+(f.status===401?'OK':'FALLA')+(' '+f.status));
  }
  for(let i=0;i<8;i++)await fallo(i);
  const limit=await login('wrong');console.log('limite 9 intentos => '+(limit.status===429?'OK':'FALLA')+(' '+limit.status));

  const cross=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','origin':'https://evil.example'},body:'{"password":"x"}'});console.log('csrf origen cruzado => '+(cross.status===403?'OK':'FALLA')+(' '+cross.status));
  const noH=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});console.log('sin x-landur-request => '+(noH.status===415?'OK':'FALLA')+(' '+noH.status));

  const loginDto=await login('synthetic-test-secret-only');console.log('login OK => '+(loginDto.status===200?'OK':'FALLA')+(' cookie='+(loginDto.cookie?.startsWith('landur_session=')?'OK':'FALLA')));
  const cookie=loginDto.cookie;

  const st=await fetch(base+'/api/state',{headers:{'cookie':cookie}});const s=await st.json();console.log('estado OK cc no-store => '+(st.status===200&&st.headers.get('cache-control')==='no-store'?'OK':'FALLA')+(' cc='+st.headers.get('cache-control')));

  const cuentaRes=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'account',name:'Caja barrido',accountKind:'cash',currency:'UYU',opening:'100',cutoff:'2026-10-24',verified:false,accessible:true})});const cuenta=(cuentaRes.ok)?await cuentaRes.json():null;console.log('crear cuenta => '+(cuentaRes.status===200?'OK':'FALLA')+(' id='+(cuenta?.id)));
  const gastoRes=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'expense',concept:'Prueba borrar',amount:'1250',currency:'UYU',date:'2026-10-24',accountId:cuenta?.id})});const gasto=(gastoRes.ok)?await gastoRes.json():null;console.log('crear gasto => '+(gastoRes.status===200?'OK':'FALLA')+(' id='+(gasto?.id)));

  const pngTrama=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.alloc(128)]);
  const pngBad=await fetch(base+'/api/evidence',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({operationId:gasto?.id,name:'t.png',mime:'image/png',data:pngTrama.toString('base64')})});console.log('png truncado => '+(pngBad.status===400?'OK':'FALLA')+(' '+pngBad.status));
  const upRes=await fetch(base+'/api/evidence',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({operationId:gasto?.id,name:'ticket.png',mime:'image/png',data:Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]).toString('base64')})});const up=(upRes.ok)?await upRes.json():null;console.log('adjunto valido => '+(upRes.status===200?'OK':'FALLA')+(' id='+(up?.id)));

  const evOk=await fetch(base+'/api/evidence/'+(up?.id),{headers:{'cookie':cookie}});console.log('descargar propio => '+(evOk.status===200?'OK':'FALLA')+(' cc='+(evOk.headers.get('cache-control')=== 'no-store'?'OK':'FALLA'))+' inline='+(/inline/.test(evOk.headers.get('content-disposition')||'')?'OK':'FALLA'));
  const evSin=await fetch(base+'/api/evidence/'+(up?.id));console.log('evidencia sin cookie => '+(evSin.status===401?'OK':'FALLA')+(' '+evSin.status));
  const evNix=await fetch(base+'/api/evidence/'+crypto.randomUUID(),{headers:{'cookie':cookie}});console.log('evidencia inexistente => '+(evNix.status===404?'OK':'FALLA')+(' '+evNix.status));

  const rmRes=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'evidence.remove',evidenceId:up?.id})});const rm=(rmRes.ok)?await rmRes.json():null;console.log('borrar propio => '+(rmRes.status===200?'OK':'FALLA')+(' id='+(rm?.id)));
  const evAfter=await fetch(base+'/api/evidence/'+(up?.id),{headers:{'cookie':cookie}});console.log('despues de borrar => '+(evAfter.status===404?'OK':'FALLA')+(' '+evAfter.status));

  const htmlUp=await fetch(base+'/api/evidence',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({operationId:gasto?.id,name:'x.html',mime:'image/png',data:Buffer.from('<script>','utf8').toString('base64')})});console.log('bytes no imagen => '+(htmlUp.status===400?'OK':'FALLA')+(' '+htmlUp.status));

  const vRes=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'account',name:'Borrable',accountKind:'cash',currency:'UYU',opening:'0',cutoff:'2026-10-24',verified:true,accessible:true})});const v=(vRes.ok)?await vRes.json():null;console.log('crear cuenta vacia => '+(vRes.status===200?'OK':'FALLA')+(' id='+(v?.id)));
  const uRes=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'account',name:'Con movimiento',accountKind:'cash',currency:'UYU',opening:'100',cutoff:'2026-10-24',verified:true,accessible:true})});const u=(uRes.ok)?await uRes.json():null;console.log('crear cuenta usada => '+(uRes.status===200?'OK':'FALLA')+(' id='+(u?.id)));
  const g2Res=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'expense',concept:'Q',amount:'100',currency:'UYU',date:'2026-10-24',accountId:u?.id})});const g2=(g2Res.ok)?await g2Res.json():null;console.log('gasto usada => '+(g2Res.status===200?'OK':'FALLA')+(' id='+(g2?.id)));

  const dvRes=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'account.delete',accountId:v?.id})});const dv=(dvRes.ok)?await dvRes.json():null;console.log('baja vacia => '+(dvRes.status===200?'OK':'FALLA')+(' id='+(dv?.id)));
  const duRes=await fetch(base+'/api/commands',{method:'POST',headers:{'content-type':'application/json','x-landur-request':'1','cookie':cookie,'idempotency-key':crypto.randomUUID()},body:JSON.stringify({kind:'account.delete',accountId:u?.id})});console.log('baja usada => '+(duRes.status===409?'OK':'FALLA')+(' '+duRes.status));

  const st2=await fetch(base+'/api/state',{headers:{'cookie':cookie}});const s2=await st2.json();
  const vGone=!s2.accounts?.some?.(a=>a.id===v?.id);
  const uStay=s2.accounts?.some?.(a=>a.id===u?.id);
  const aDel=s2.audit?.some?.(a=>a.action==='account.deleted');
  const aRem=s2.audit?.some?.(a=>a.action==='evidence.removed');
  console.log('vGone => '+(vGone?'OK':'FALLA'));
  console.log('uStay => '+(uStay?'OK':'FALLA'));
  console.log('audit account.deleted => '+(aDel?'OK':'FALLA'));
  console.log('audit evidence.removed => '+(aRem?'OK':'FALLA'));

  await app.close();
}

try{
  await suite();
  console.log('END OK');
}catch(err){
  console.log('END ERROR: '+(err.status?err.status+' '+err.message:err.message));
  try{await app.close();console.log('END CLOSE OK');}catch{}
}
