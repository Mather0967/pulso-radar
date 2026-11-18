import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {portalFixture} from './helpers/portal-fixture.mjs';

const job=(over={})=>({title:'Llamar al cliente',date:'2026-03-10',allDay:true,start:'',end:'',project:'pulso',kind:'contacto',assignee:'',status:'pendiente',notes:'',...over});
const create=(f,user,body)=>f.request('/api/calendar/jobs',{...user,method:'POST',body});
const list=(f,user,query='')=>f.request('/api/calendar/jobs'+query,{...user});
const jobsFile=f=>path.join(f.root,'data/calendar/jobs.json');

test('sin sesión: la API responde 401 en JSON y la página redirige a /login',async()=>{
  const f=await portalFixture();try{
    const api=await f.request('/api/calendar/jobs');
    assert.equal(api.status,401);
    assert.match(api.headers.get('content-type')||'',/application\/json/);
    assert.equal(typeof (await api.json()).error,'string');
    const page=await f.request('/calendario');
    assert.equal(page.status,303);
    assert.equal(page.headers.get('location'),'/login');
  }finally{await f.close();}
});

test('usuario sin proyectos no ve el calendario: 403 con mensaje de permiso',async()=>{
  const f=await portalFixture();try{
    const none=await f.login('none');
    const res=await list(f,none);
    assert.equal(res.status,403);
    assert.equal((await res.json()).error,'No tenés permiso para el calendario.');
  }finally{await f.close();}
});

test('lector (viewer) puede listar pero crear da 403 «solo lectura»',async()=>{
  const f=await portalFixture();try{
    const reader=await f.login('reader');
    const res=await list(f,reader);
    assert.equal(res.status,200);
    const body=await res.json();
    assert.equal(body.me.write,false);
    assert.ok(Array.isArray(body.jobs));
    const denied=await create(f,reader,job({project:'landur'}));
    assert.equal(denied.status,403);
    assert.equal((await denied.json()).error,'Tu acceso al calendario es de solo lectura.');
    assert.equal(fs.existsSync(jobsFile(f)),false,'el lector no deja nada escrito');
  }finally{await f.close();}
});

test('editor y administrador crean y listan; el servidor fija createdBy, version e id',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso'),admin=await f.login('admin');
    const forged={id:'fijado-por-cliente',createdBy:'admin',updatedBy:'admin',version:99,createdAt:'2000-01-01T00:00:00.000Z',updatedAt:'2000-01-01T00:00:00.000Z'};
    const made=await create(f,pulso,{...job({title:'Entrega de informe'}),...forged});
    assert.equal(made.status,201);
    const {job:saved}=await made.json();
    assert.equal(typeof saved.id,'string');
    assert.notEqual(saved.id,'fijado-por-cliente','el id lo pone el servidor');
    assert.equal(saved.createdBy,'pulso');
    assert.equal(saved.updatedBy,'pulso');
    assert.equal(saved.version,1);
    assert.notEqual(saved.createdAt,'2000-01-01T00:00:00.000Z');
    assert.equal(saved.title,'Entrega de informe');

    const madeByAdmin=await create(f,admin,job({title:'Revisión admin',project:'retail'}));
    assert.equal(madeByAdmin.status,201);
    assert.equal((await madeByAdmin.json()).job.createdBy,'admin');

    const pulsoList=await(await list(f,pulso)).json();
    assert.equal(pulsoList.me.write,true);
    assert.equal(pulsoList.me.admin,false);
    assert.equal(pulsoList.jobs.length,2);
    const adminList=await(await list(f,admin)).json();
    assert.equal(adminList.me.admin,true);
    assert.equal(adminList.jobs.length,2);
  }finally{await f.close();}
});

test('validación: fechas, títulos, listas cerradas, horas, notas y responsable devuelven 400',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const valid=await create(f,pulso,job());
    assert.equal(valid.status,201,'el trabajo base es válido: los casos siguientes fallan por su motivo');
    const cases={
      'fecha inexistente 2026-02-31':job({date:'2026-02-31'}),
      'título vacío':job({title:''}),
      'título de 121 caracteres':job({title:'a'.repeat(121)}),
      'proyecto fuera de lista':job({project:'otro'}),
      'tipo fuera de lista':job({kind:'reunion'}),
      'estado fuera de lista':job({status:'cancelado'}),
      'hora mal formada':job({allDay:false,start:'8:00 am'}),
      'hora fuera de rango':job({allDay:false,start:'25:00'}),
      'allDay=false sin start':job({allDay:false,start:''}),
      'end anterior a start':job({allDay:false,start:'10:00',end:'09:00'}),
      'notas de 2001 caracteres':job({notes:'a'.repeat(2001)}),
      'responsable inexistente':job({assignee:'nadie-de-verdad'}),
    };
    for(const [label,body] of Object.entries(cases)){
      const res=await create(f,pulso,body);
      assert.equal(res.status,400,label);
      assert.equal(typeof (await res.json()).error,'string',label+' explica el motivo');
    }
  }finally{await f.close();}
});

test('texto con HTML se guarda tal cual, vuelve como JSON y no aparece en la página',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const title='<script>alert(1)</script>',notes='<img onerror=x>';
    const res=await create(f,pulso,job({title,notes}));
    assert.equal(res.status,201);
    const {job:saved}=await res.json();
    assert.equal(saved.title,title);
    assert.equal(saved.notes,notes);
    const listed=(await(await list(f,pulso)).json()).jobs.find(j=>j.id===saved.id);
    assert.equal(listed.title,title);
    assert.equal(listed.notes,notes);
    const page=await f.request('/calendario',pulso);
    assert.equal(page.status,200);
    const html=await page.text();
    assert.equal(html.includes(title),false,'la página no trae el título');
    assert.equal(html.includes(notes),false,'la página no trae las notas');
  }finally{await f.close();}
});

test('concurrencia: versión vieja da 409 con el trabajo actual; versión correcta suma uno',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const {job:made}=await(await create(f,pulso,job({title:'Original'}))).json();
    assert.equal(made.version,1);
    const first=await f.request('/api/calendar/jobs/'+made.id,{...pulso,method:'PUT',body:{...job({title:'Nuevo'}),version:1}});
    assert.equal(first.status,200);
    const updated=(await first.json()).job;
    assert.equal(updated.version,2);
    assert.equal(updated.title,'Nuevo');
    const stale=await f.request('/api/calendar/jobs/'+made.id,{...pulso,method:'PUT',body:{...job({title:'Viejo'}),version:1}});
    assert.equal(stale.status,409);
    const conflict=await stale.json();
    assert.equal(conflict.error,'Otra persona modificó este trabajo. Se cargó la versión actual.');
    assert.equal(conflict.job.version,2);
    assert.equal(conflict.job.title,'Nuevo');
    const again=await f.request('/api/calendar/jobs/'+made.id,{...pulso,method:'PUT',body:{...job({title:'Tercero'}),version:2}});
    assert.equal(again.status,200);
    assert.equal((await again.json()).job.version,3);
    const missing=await f.request('/api/calendar/jobs/no-existe',{...pulso,method:'PUT',body:{...job(),version:1}});
    assert.equal(missing.status,404);
  }finally{await f.close();}
});

test('borrar: el editor que no creó el trabajo recibe 403; el creador y el admin borran y luego da 404',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso'),landur=await f.login('landur'),admin=await f.login('admin');
    const mine=(await(await create(f,pulso,job({title:'Mío'}))).json()).job;
    const other=await f.request('/api/calendar/jobs/'+mine.id,{...landur,method:'DELETE'});
    assert.equal(other.status,403,'otro editor no borra lo ajeno');
    assert.equal((await f.request('/api/calendar/jobs/'+mine.id,{...pulso,method:'DELETE'})).status,200);
    assert.equal((await f.request('/api/calendar/jobs/'+mine.id,{...pulso,method:'DELETE'})).status,404);

    const theirs=(await(await create(f,pulso,job({title:'Para admin'}))).json()).job;
    assert.equal((await f.request('/api/calendar/jobs/'+theirs.id,{...admin,method:'DELETE'})).status,200,'el admin borra cualquiera');
    assert.equal((await f.request('/api/calendar/jobs/'+theirs.id,{...admin,method:'DELETE'})).status,404);
  }finally{await f.close();}
});

test('filtro from/to devuelve solo el rango pedido, ordenado por fecha y hora',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const seeds=[
      job({title:'C',date:'2026-03-05',allDay:false,start:'10:00'}),
      job({title:'Fuera antes',date:'2026-02-28',allDay:false,start:'09:00'}),
      job({title:'B',date:'2026-03-05',allDay:false,start:'09:00'}),
      job({title:'A',date:'2026-03-01',allDay:false,start:'18:30'}),
      job({title:'Fuera después',date:'2026-03-20',allDay:false,start:'08:00'}),
      job({title:'D',date:'2026-03-10',allDay:false,start:'07:15'}),
    ];
    for(const seed of seeds)assert.equal((await create(f,pulso,seed)).status,201);
    const res=await list(f,pulso,'?from=2026-03-01&to=2026-03-10');
    assert.equal(res.status,200);
    const got=(await res.json()).jobs.map(j=>[j.date,j.start,j.title]);
    assert.deepEqual(got,[
      ['2026-03-01','18:30','A'],
      ['2026-03-05','09:00','B'],
      ['2026-03-05','10:00','C'],
      ['2026-03-10','07:15','D'],
    ]);
  }finally{await f.close();}
});

test('tope: con 2000 trabajos guardados, crear uno más da 400 «máximo de 2000»',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const stamp='2026-01-01T00:00:00.000Z';
    const jobs=Array.from({length:2000},(_,i)=>({id:randomUUID(),title:'Trabajo '+i,date:'2026-03-10',allDay:true,start:'',end:'',project:'pulso',kind:'otro',assignee:'',status:'pendiente',notes:'',createdBy:'pulso',updatedBy:'pulso',createdAt:stamp,updatedAt:stamp,version:1}));
    fs.mkdirSync(path.dirname(jobsFile(f)),{recursive:true});
    fs.writeFileSync(jobsFile(f),JSON.stringify({version:1,jobs}));
    const res=await create(f,pulso,job({title:'Número 2001'}));
    assert.equal(res.status,400);
    assert.match((await res.json()).error,/máximo de 2000/);
  }finally{await f.close();}
});

test('cuerpo de más de 16384 bytes da 413',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const raw=JSON.stringify(job({notes:'a'.repeat(16500)}));
    assert.ok(Buffer.byteLength(raw)>16384);
    const res=await f.request('/api/calendar/jobs',{...pulso,method:'POST',raw});
    assert.equal(res.status,413);
    assert.equal(fs.existsSync(jobsFile(f)),false,'nada se guarda');
  }finally{await f.close();}
});

test('escritura sin x-csrf-token o con Origin ajeno da 403',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const noCsrf=await f.request('/api/calendar/jobs',{...pulso,csrf:'',method:'POST',body:job()});
    assert.equal(noCsrf.status,403,'sin token CSRF no se escribe');
    const evil=await f.request('/api/calendar/jobs',{...pulso,origin:'https://evil.test',method:'POST',body:job()});
    assert.equal(evil.status,403,'un origen ajeno no escribe');
    assert.equal(fs.existsSync(jobsFile(f)),false,'ninguno de los dos dejó datos');
    assert.equal((await create(f,pulso,job())).status,201,'con token y origen propios sí');
  }finally{await f.close();}
});

test('GET /api/calendar/people devuelve solo id y nombre de usuarios activos',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso');
    const res=await f.request('/api/calendar/people',{...pulso});
    assert.equal(res.status,200);
    const text=await res.text();
    const {people}=JSON.parse(text);
    assert.deepEqual(people.map(p=>Object.keys(p).sort()),people.map(()=>['id','name']));
    assert.deepEqual(people.map(p=>p.id).sort(),['admin','landur','none','pulso','reader']);
    assert.doesNotMatch(text,/example\.test|email|password|hash/i,'sin correo ni hash');
    await f.store.transact(db=>{db.users.find(u=>u.id==='reader').active=false;});
    const after=await(await f.request('/api/calendar/people',{...pulso})).json();
    assert.equal(after.people.some(p=>p.id==='reader'),false,'un usuario desactivado no aparece');
  }finally{await f.close();}
});
