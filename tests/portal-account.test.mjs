import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture} from './helpers/portal-fixture.mjs';
import {browserLabel} from '../namecheap/server/auth.mjs';

// Cuenta propia: cambio de contraseña y sesiones del usuario (contrato «Cambiar contraseña» y «Sesiones» de portal-spec.md).
const NEXT='nueva-clave-sintetica-2026';
const UA_CHROME_MAC='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_SAFARI_IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const UA_FIREFOX_WIN='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';

const change=(f,user,body)=>f.request('/auth/password',{...user,method:'POST',body});
const sessionsOf=async(f,user)=>{const res=await f.request('/auth/sessions',user);assert.equal(res.status,200);return res.json();};
const revoke=(f,user,id)=>f.request('/auth/sessions/revoke',{...user,method:'POST',body:{id}});
const revokeOthers=(f,user)=>f.request('/auth/sessions/revoke-others',{...user,method:'POST',body:{}});
const meStatus=async(f,user)=>(await f.request('/auth/me',user)).status;
const loginStatus=async(f,id,password)=>(await f.request('/auth/login',{method:'POST',body:{email:`${id}@example.test`,password}})).status;

// Inicia sesión con cabeceras propias (por ejemplo, un User-Agent) y devuelve la sesión como la guarda el navegador.
async function sessionAs(f,id,headers={}){
  const res=await f.request('/auth/login',{method:'POST',body:{email:`${id}@example.test`,password:f.password},headers});
  assert.equal(res.status,200,'login de '+id);
  const data=await res.json();
  return {cookie:res.headers.get('set-cookie').split(';')[0],csrf:data.csrf};
}

test('cambiar contraseña: la actual debe ser correcta, y un fallo no cambia nada',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const res=await change(f,pulso,{current:'clave-equivocada-larga',next:NEXT});
    assert.equal(res.status,403);
    assert.equal((await res.json()).error,'La contraseña actual no es correcta.');
    assert.equal(await loginStatus(f,'pulso',f.password),200,'la clave vieja sigue valiendo');
    assert.equal(await loginStatus(f,'pulso',NEXT),401,'la nueva no se guardó');
  }finally{await f.close();}
});

test('cambiar contraseña: política de 12 a 200 caracteres y la nueva debe ser distinta',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const cases={
      'corta de 5 caracteres':'corta',
      'de 11 caracteres':'a'.repeat(11),
      'de 201 caracteres':'a'.repeat(201),
    };
    for(const [label,next] of Object.entries(cases)){
      const res=await change(f,pulso,{current:f.password,next});
      assert.equal(res.status,400,label);
      assert.equal(typeof (await res.json()).error,'string',label+' explica el motivo');
    }
    const same=await change(f,pulso,{current:f.password,next:f.password});
    assert.equal(same.status,400);
    assert.equal((await same.json()).error,'La nueva contraseña debe ser distinta.');
    assert.equal(await loginStatus(f,'pulso',f.password),200,'ningún intento inválido cambió la clave');
  }finally{await f.close();}
});

test('cambiar contraseña: éxito responde changed y revoked; la clave vieja deja de entrar y la nueva sí',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const res=await change(f,pulso,{current:f.password,next:NEXT});
    assert.equal(res.status,200);
    assert.deepEqual(await res.json(),{changed:true,revoked:0},'una sola sesión: no se cerró ninguna otra');
    assert.equal(await loginStatus(f,'pulso',f.password),401,'la clave vieja ya no entra');
    assert.equal(await loginStatus(f,'pulso',NEXT),200,'la nueva entra');
    assert.equal(await meStatus(f,pulso),200,'la sesión que cambió la clave sigue abierta');
  }finally{await f.close();}
});

test('cambiar contraseña: cierra las otras sesiones del mismo usuario, no las de otros',async()=>{
  const f=await portalFixture();try{
    const a=await f.login('pulso'),b=await sessionAs(f,'pulso');
    const admin=await f.login('admin');
    const res=await change(f,a,{current:f.password,next:NEXT});
    assert.equal(res.status,200);
    assert.equal((await res.json()).revoked,1,'la sesión B del mismo usuario se cuenta');
    assert.equal(await meStatus(f,b),401,'la sesión B ya no sirve');
    assert.equal(await meStatus(f,a),200,'la sesión A, la que cambió la clave, sigue válida');
    assert.equal(await meStatus(f,admin),200,'la sesión de otro usuario no se toca');
  }finally{await f.close();}
});

test('cambiar contraseña: cinco fallos bloquean el cambio, incluso con la clave correcta',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    for(let i=0;i<5;i++)assert.equal((await change(f,pulso,{current:'clave-equivocada-'+i,next:NEXT})).status,403,'intento '+(i+1));
    const locked=await change(f,pulso,{current:f.password,next:NEXT});
    assert.equal(locked.status,429,'con la clave correcta también se corta, como en el acceso');
    assert.equal(await loginStatus(f,'pulso',f.password),200,'el bloqueo no cambió la clave');
  }finally{await f.close();}
});

test('cambiar contraseña: sin token CSRF da 403 y sin sesión da 401',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const noCsrf=await f.request('/auth/password',{...pulso,csrf:'',method:'POST',body:{current:f.password,next:NEXT}});
    assert.equal(noCsrf.status,403);
    const anonymous=await f.request('/auth/password',{method:'POST',body:{current:f.password,next:NEXT}});
    assert.equal(anonymous.status,401);
    assert.equal(await loginStatus(f,'pulso',f.password),200,'ninguno de los dos cambió la clave');
  }finally{await f.close();}
});

test('sesiones: solo las propias, una sola marcada como actual, sin secretos ni User-Agent crudo',async()=>{
  const f=await portalFixture();try{
    const a=await f.login('pulso'),b=await sessionAs(f,'pulso',{'User-Agent':UA_CHROME_MAC});
    const admin=await f.login('admin');
    const res=await f.request('/auth/sessions',a);
    assert.equal(res.status,200);
    const text=await res.text();
    const {sessions}=JSON.parse(text);
    assert.equal(sessions.length,2,'solo las dos sesiones de pulso');
    const adminIds=(await sessionsOf(f,admin)).sessions.map(s=>s.id);
    assert.equal(sessions.some(s=>adminIds.includes(s.id)),false,'ninguna sesión del administrador aparece');
    assert.equal(sessions.filter(s=>s.current===true).length,1,'exactamente una actual');
    assert.equal(sessions.some(s=>typeof s.current!=='boolean'),false);
    for(const s of sessions){
      assert.match(s.id,/^[0-9a-f]{16}$/,'id opaco de 16 hex');
      assert.equal(typeof s.expiresAt,'number');
      assert.ok(s.createdAt===null||typeof s.createdAt==='number');
      assert.ok(s.browser===null||typeof s.browser==='string');
    }
    for(let i=0;i+1<sessions.length;i++)if(sessions[i].createdAt!=null&&sessions[i+1].createdAt!=null)assert.ok(sessions[i].createdAt>=sessions[i+1].createdAt,'más nuevas primero');
    assert.doesNotMatch(text,/"(hash|csrf|token)"/,'ningún campo secreto');
    assert.equal(text.includes(a.csrf),false,'no aparece el csrf de la sesión A');
    assert.equal(text.includes(b.csrf),false,'no aparece el csrf de la sesión B');
    assert.equal(text.includes(a.cookie.slice(a.cookie.indexOf('=')+1)),false,'no aparece el token de la galleta');
    assert.equal(text.includes(UA_CHROME_MAC),false,'la etiqueta no trae el User-Agent crudo');
    const fromB=(await sessionsOf(f,b)).sessions;
    const currentFromA=sessions.find(s=>s.current).id,currentFromB=fromB.find(s=>s.current).id;
    assert.notEqual(currentFromA,currentFromB,'la actual se reconoce por el csrf de cada sesión');
    assert.match(fromB.find(s=>s.id===currentFromB).browser||'',/Chrome/,'la etiqueta resume el navegador');
  }finally{await f.close();}
});

test('sesiones: revocar otra sesión propia da 200 y esa sesión deja de entrar',async()=>{
  const f=await portalFixture();try{
    const a=await f.login('pulso'),b=await sessionAs(f,'pulso');
    const other=(await sessionsOf(f,a)).sessions.find(s=>!s.current);
    const res=await revoke(f,a,other.id);
    assert.equal(res.status,200);
    assert.deepEqual(await res.json(),{revoked:true});
    assert.equal(await meStatus(f,b),401);
    assert.equal(await meStatus(f,a),200);
  }finally{await f.close();}
});

test('sesiones: revocar la actual da 400, un id ajeno o inexistente da 404',async()=>{
  const f=await portalFixture();try{
    const a=await f.login('pulso'),admin=await f.login('admin');
    const mine=(await sessionsOf(f,a)).sessions;
    const current=mine.find(s=>s.current);
    const self=await revoke(f,a,current.id);
    assert.equal(self.status,400);
    assert.match((await self.json()).error,/Cerrar sesión/);
    assert.equal(await meStatus(f,a),200,'la actual sigue abierta');
    const adminId=(await sessionsOf(f,admin)).sessions[0].id;
    assert.equal((await revoke(f,a,adminId)).status,404,'la sesión del administrador no se revela ni se cierra');
    assert.equal(await meStatus(f,admin),200);
    assert.equal((await revoke(f,a,'ffffffffffffffff')).status,404,'un id inexistente');
  }finally{await f.close();}
});

test('sesiones: cerrar las demás deja la actual, responde cuántas cerró y exige CSRF',async()=>{
  const f=await portalFixture();try{
    const a=await f.login('pulso'),b=await sessionAs(f,'pulso'),c=await sessionAs(f,'pulso');
    const admin=await f.login('admin');
    const noCsrf=await f.request('/auth/sessions/revoke-others',{...a,csrf:'',method:'POST',body:{}});
    assert.equal(noCsrf.status,403);
    assert.equal(await meStatus(f,b),200,'sin CSRF no se cerró nada');
    const res=await revokeOthers(f,a);
    assert.equal(res.status,200);
    assert.deepEqual(await res.json(),{revoked:2});
    assert.equal(await meStatus(f,b),401);
    assert.equal(await meStatus(f,c),401);
    assert.equal(await meStatus(f,a),200,'la actual se conserva');
    assert.equal(await meStatus(f,admin),200,'otros usuarios no se tocan');
  }finally{await f.close();}
});

test('etiqueta del navegador: Chrome en macOS, Safari en iPhone y Firefox en Windows',()=>{
  const chrome=browserLabel(UA_CHROME_MAC);
  assert.equal(typeof chrome,'string');assert.match(chrome,/Chrome/);assert.match(chrome,/mac/i);
  assert.doesNotMatch(chrome,/Safari/,'Chrome también dice Safari en su UA: no se confunde');
  const safari=browserLabel(UA_SAFARI_IPHONE);
  assert.match(safari,/Safari/);assert.match(safari,/iPhone/i);
  assert.doesNotMatch(safari,/Chrome/);
  const firefox=browserLabel(UA_FIREFOX_WIN);
  assert.match(firefox,/Firefox/);assert.match(firefox,/Windows/i);
  for(const label of [chrome,safari,firefox])assert.ok(label.length<=60);
});

test('etiqueta del navegador: basura, vacío y textos enormes no pasan de 60 caracteres ni devuelven el UA',()=>{
  const garbage='asdf ;;; 1234 <b>x</b>';
  const fromGarbage=browserLabel(garbage);
  assert.ok(fromGarbage===null||(typeof fromGarbage==='string'&&fromGarbage.length<=60),'basura: null o texto corto');
  assert.equal(String(fromGarbage??'').includes('<b>'),false,'nunca se refleja el texto crudo');
  assert.equal(browserLabel(''),null,'sin User-Agent, sin etiqueta');
  assert.equal(browserLabel(undefined),null,'sin cabecera, sin etiqueta');
  const huge='x'.repeat(5000);
  const fromHuge=browserLabel(huge);
  assert.ok(fromHuge===null||(typeof fromHuge==='string'&&fromHuge.length<=60),'5000 caracteres: null o máximo 60');
  assert.equal(String(fromHuge??'').includes('xxxxx'),false);
  const longChrome='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124.0.0.0 '+'y'.repeat(5000);
  const fromLong=browserLabel(longChrome);
  assert.match(fromLong,/Chrome/);assert.ok(fromLong.length<=60);
  assert.equal(fromLong.includes('yyyyy'),false);
});
