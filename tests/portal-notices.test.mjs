import test from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture} from './helpers/portal-fixture.mjs';

// Avisos de la portada (GET /api/notices): trabajos próximos según permisos y mensajes sin leer entre administradores.
const TZ='America/Montevideo';
const todayIso=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const job=(over={})=>({title:'Trabajo',date:todayIso,allDay:true,start:'',end:'',project:'pulso',kind:'contacto',assignee:'',status:'pendiente',notes:'',...over});
const create=(f,user,body)=>f.request('/api/calendar/jobs',{...user,method:'POST',body});
const noticesOf=async(f,user)=>{const res=await f.request('/api/notices',{...user});assert.equal(res.status,200);return res.json();};
const titlesOf=data=>data.upcoming.map(j=>j.title);

// Mismo esquema que tests/portal-messages.test.mjs: dos administradores extra para probar mensajes entre admins.
async function fixtureWithAdmins(){
  const f=await portalFixture();
  await f.store.transact(db=>{
    const base=db.users.find(u=>u.id==='admin');
    db.users.push({...base,id:'admin2',name:'Segunda Admin',email:'admin2@example.test'});
    db.users.push({...base,id:'admin3',name:'Tercer Admin',email:'admin3@example.test'});
  });
  return f;
}

test('avisos: sin sesión responden 401',async()=>{
  const f=await portalFixture();try{
    assert.equal((await f.request('/api/notices')).status,401);
  }finally{await f.close();}
});

test('avisos: el administrador ve trabajos de todos los proyectos entre hoy y +7 días, nada fuera de la ventana',async()=>{
  const f=await portalFixture();try{
    const admin=await f.login('admin');
    const seeds=[
      ['Ayer',-1,'pulso'],
      ['Hoy',0,'pulso'],
      ['Mañana',1,'landur'],
      ['Dentro de tres',3,'studio'],
      ['Dentro de siete',7,'retail'],
      ['Dentro de ocho',8,'general'],
    ];
    for(const [title,offset,project] of seeds)assert.equal((await create(f,admin,job({title,project,date:addDays(todayIso,offset)}))).status,201,title);
    const data=await noticesOf(f,admin);
    assert.deepEqual(titlesOf(data),['Hoy','Mañana','Dentro de tres','Dentro de siete'],'en orden de fecha, sin los de fuera');
    assert.deepEqual(data.upcoming.map(j=>j.project),['pulso','landur','studio','retail']);
    assert.ok(data.upcoming.every(j=>j.date>=todayIso&&j.date<=addDays(todayIso,7)));
    assert.equal(data.unreadMessages,0);
    assert.equal(typeof data.generatedAt,'string');
    assert.ok(!Number.isNaN(Date.parse(data.generatedAt)),'generatedAt es ISO');
  }finally{await f.close();}
});

test('avisos: como máximo 20 trabajos, en orden de fecha y hora',async()=>{
  const f=await portalFixture();try{
    const admin=await f.login('admin');
    for(let i=0;i<25;i++)assert.equal((await create(f,admin,job({title:'Muchos '+String(i).padStart(2,'0'),project:'general',date:addDays(todayIso,2)}))).status,201);
    const data=await noticesOf(f,admin);
    assert.equal(data.upcoming.length,20);
    assert.deepEqual(titlesOf(data),Array.from({length:20},(_,i)=>'Muchos '+String(i).padStart(2,'0')));
  }finally{await f.close();}
});

test('avisos: un editor de landur no ve trabajos de pulso, aunque estén en la ventana',async()=>{
  const f=await portalFixture();try{
    const admin=await f.login('admin'),landur=await f.login('landur');
    await create(f,admin,job({title:'De Pulso secreto',project:'pulso',date:addDays(todayIso,1)}));
    await create(f,admin,job({title:'De Landur',project:'landur',date:addDays(todayIso,1)}));
    const data=await noticesOf(f,landur);
    assert.deepEqual(titlesOf(data),['De Landur']);
    assert.doesNotMatch(JSON.stringify(data),/De Pulso secreto/);
  }finally{await f.close();}
});

test('avisos: quien no tiene proyectos recibe una lista vacía',async()=>{
  const f=await portalFixture();try{
    const admin=await f.login('admin'),none=await f.login('none');
    await create(f,admin,job({title:'General',project:'general',date:addDays(todayIso,1)}));
    await create(f,admin,job({title:'Landur',project:'landur',date:addDays(todayIso,1)}));
    const data=await noticesOf(f,none);
    assert.deepEqual(data.upcoming,[]);
    assert.equal(data.unreadMessages,0);
  }finally{await f.close();}
});

test('avisos: un lector de landur ve landur y general, nunca pulso, studio ni retail',async()=>{
  const f=await portalFixture();try{
    const admin=await f.login('admin'),reader=await f.login('reader');
    for(const project of ['pulso','landur','general','studio','retail'])
      assert.equal((await create(f,admin,job({title:'Trabajo '+project,project,date:addDays(todayIso,2)}))).status,201,project);
    const data=await noticesOf(f,reader);
    assert.deepEqual(titlesOf(data).sort(),['Trabajo general','Trabajo landur']);
    assert.equal(data.unreadMessages,0);
  }finally{await f.close();}
});

test('avisos: mensajes sin leer solo cuentan para administradores, y lo propio no cuenta',async()=>{
  const f=await fixtureWithAdmins();try{
    const a=await f.login('admin'),b=await f.login('admin2'),pulso=await f.login('pulso');
    assert.equal((await noticesOf(f,b)).unreadMessages,0,'sin mensajes, cero');
    assert.equal((await f.request('/api/admin/messages',{...a,method:'POST',body:{to:'all',body:'Reunión el lunes'}})).status,201);
    assert.equal((await noticesOf(f,b)).unreadMessages,1,'otro administrador lo cuenta');
    assert.equal((await noticesOf(f,a)).unreadMessages,0,'lo que yo envié no cuenta');
    assert.equal((await noticesOf(f,pulso)).unreadMessages,0,'un miembro siempre ve cero');
    assert.equal((await f.request('/api/admin/messages',{...b,method:'POST',body:{to:'admin',body:'Dale'}})).status,201);
    assert.equal((await noticesOf(f,a)).unreadMessages,1,'el mensaje directo también cuenta');
    assert.equal((await f.request('/api/admin/messages/read',{...b,method:'POST',body:{all:true}})).status,200);
    assert.equal((await noticesOf(f,b)).unreadMessages,0,'al marcar todo como leído baja a cero');
  }finally{await f.close();}
});

test('avisos: solo se admite GET; un POST da 405',async()=>{
  const f=await portalFixture();try{
    const admin=await f.login('admin');
    assert.equal((await f.request('/api/notices',{...admin,method:'POST',body:{}})).status,405);
  }finally{await f.close();}
});
