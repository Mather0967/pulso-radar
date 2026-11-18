import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture} from './helpers/portal-fixture.mjs';

// Mensajes internos entre administradores: solo admins, con CSRF, validados y privados por destinatario.
async function fixtureWithAdmins(){
  const f=await portalFixture();
  await f.store.transact(db=>{
    const base=db.users.find(u=>u.id==='admin');
    db.users.push({...base,id:'admin2',name:'Segunda Admin',email:'admin2@example.test'});
    db.users.push({...base,id:'admin3',name:'Tercer Admin',email:'admin3@example.test'});
  });
  return f;
}
const send=(f,auth,body)=>f.request('/api/admin/messages',{...auth,method:'POST',body});
const inbox=async(f,auth)=>(await f.request('/api/admin/messages',auth)).json();

test('mensajes: un miembro no puede leer ni enviar',async()=>{
  const f=await fixtureWithAdmins();
  try{
    const member=await f.login('pulso');
    assert.equal((await f.request('/api/admin/messages',member)).status,403);
    assert.equal((await send(f,member,{to:'all',body:'hola'})).status,403);
    assert.equal((await f.request('/api/admin/messages')).status,401);
  }finally{await f.close();}
});

test('mensajes: a todos los admins, con no leídos y marcado como leído',async()=>{
  const f=await fixtureWithAdmins();
  try{
    const a=await f.login('admin'),b=await f.login('admin2');
    const sent=await send(f,a,{to:'all',body:'  Reunión el lunes  '});
    assert.equal(sent.status,201);
    const {message}=await sent.json();
    assert.equal(message.body,'Reunión el lunes');
    let box=await inbox(f,b);
    assert.equal(box.unread,1);
    assert.equal(box.messages[0].fromName,'Administrador de prueba');
    assert.equal(box.messages[0].read,false);
    assert.equal((await f.request('/api/admin/messages/read',{...b,method:'POST',body:{ids:[message.id]}})).status,200);
    box=await inbox(f,b);
    assert.equal(box.unread,0);
    assert.equal(box.messages[0].read,true);
    assert.equal((await inbox(f,a)).unread,0,'lo propio cuenta como leído');
  }finally{await f.close();}
});

test('mensajes: un mensaje directo solo lo ven el remitente y el destinatario',async()=>{
  const f=await fixtureWithAdmins();
  try{
    const a=await f.login('admin'),b=await f.login('admin2'),c=await f.login('admin3');
    assert.equal((await send(f,a,{to:'admin2',body:'Solo para vos'})).status,201);
    assert.equal((await inbox(f,b)).messages.length,1);
    assert.equal((await inbox(f,a)).messages.length,1);
    assert.equal((await inbox(f,c)).messages.length,0);
    // Marcar como leído un id ajeno no lo expone ni falla.
    const id=(await inbox(f,a)).messages[0].id;
    await f.request('/api/admin/messages/read',{...c,method:'POST',body:{ids:[id]}});
    assert.equal((await inbox(f,c)).messages.length,0);
  }finally{await f.close();}
});

test('mensajes: validación del cuerpo y del destinatario, y CSRF',async()=>{
  const f=await fixtureWithAdmins();
  try{
    const a=await f.login('admin');
    assert.equal((await send(f,a,{to:'all',body:'   '})).status,400);
    assert.equal((await send(f,a,{to:'all',body:'x'.repeat(2001)})).status,400);
    assert.equal((await send(f,a,{to:'pulso',body:'hola'})).status,400,'un miembro no es destinatario válido');
    assert.equal((await send(f,a,{to:'no-existe',body:'hola'})).status,400);
    assert.equal((await send(f,a,{to:'admin',body:'hola'})).status,400,'no se envía a uno mismo');
    assert.equal((await send(f,{cookie:a.cookie},{to:'all',body:'sin token'})).status,403);
    const html='<img src=x onerror=alert(1)>';
    await send(f,a,{to:'all',body:html});
    assert.equal((await inbox(f,a)).messages[0].body,html,'se guarda como texto, sin transformar');
  }finally{await f.close();}
});

test('mensajes: límite de envíos por minuto',async()=>{
  const f=await fixtureWithAdmins();
  try{
    const a=await f.login('admin');
    let last;
    for(let i=0;i<21;i++)last=await send(f,a,{to:'all',body:'m'+i});
    assert.equal(last.status,429);
  }finally{await f.close();}
});
