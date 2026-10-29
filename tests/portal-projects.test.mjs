import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {availableProjects,mergeProjectGrants,projectAccess,renderProjectsPage} from '../namecheap/server/projects.mjs';
import {clientAddress} from '../namecheap/server/auth.mjs';
import {createLandurPortal} from '../namecheap/server/landur.mjs';
import {portalFixture} from './helpers/portal-fixture.mjs';

test('catálogo: permisos independientes y administradores ven ambos proyectos',()=>{
  assert.deepEqual(availableProjects({active:true,role:'admin'}).map(p=>p.id),['pulso','landur']);
  assert.deepEqual(availableProjects({active:true,role:'member',projects:{pulso:'editor'}}).map(p=>p.id),['pulso']);
  assert.equal(projectAccess({active:false,role:'admin'},'landur'),null);
  assert.equal(projectAccess({active:true,projects:{landur:'admin'}},'landur'),null);
  assert.deepEqual(mergeProjectGrants({pulso:'editor',landur:'viewer'},{access:'viewer'}),{pulso:'viewer',landur:'viewer'});
  assert.deepEqual(mergeProjectGrants({pulso:'editor',landur:'viewer'},{projects:{landur:null}}),{pulso:'editor'});
  assert.throws(()=>mergeProjectGrants({},{projects:{landur:'admin'}}));
  assert.throws(()=>mergeProjectGrants({},{projects:{other:'editor'}}));
  assert.match(renderProjectsPage({active:true,role:'admin',name:'<img src=x>'}),/&lt;img src=x&gt;/);
});
test('sin sesión no se exponen LANDUR ni exportaciones',async()=>{
  const f=await portalFixture();try{
    assert.equal((await f.request('/portal')).headers.get('location'),'/login');
    assert.equal((await f.request('/landur/')).headers.get('location'),'/login');
    for(const route of ['/landur/api/state','/landur/api/export.csv','/api/projects'])assert.equal((await f.request(route)).status,401);
    assert.equal(fs.existsSync(path.join(f.root,'data/landur/landur.sqlite')),false);
  }finally{await f.close();}
});
test('login del portal abre LANDUR sin otra contraseña; Pulso aislado',async()=>{
  const f=await portalFixture();try{
    const pulso=await f.login('pulso'),landur=await f.login('landur'),admin=await f.login('admin');
    assert.equal((await f.request('/pulso',pulso)).status,200);
    assert.equal((await f.request('/landur/api/state',pulso)).status,403);
    assert.equal((await f.request('/pulso',landur)).status,403);
    assert.equal((await f.request('/api/workspace',landur)).status,403);
    const portal=await(await f.request('/portal',admin)).text();assert.match(portal,/Abrir Pulso/);assert.match(portal,/Abrir LANDUR/);
    // Con un solo proyecto habilitado no hay selector: se entra directo y no se puede volver a elegir.
    const onlyLandur=await f.request('/portal',landur);assert.equal(onlyLandur.status,303);assert.equal(onlyLandur.headers.get('location'),'/landur/');
    const onlyPulso=await f.request('/portal',pulso);assert.equal(onlyPulso.status,303);assert.equal(onlyPulso.headers.get('location'),'/pulso');
    assert.doesNotMatch(await(await f.request('/portal',pulso)).text(),/Abrir LANDUR/);
    const boot=await(await f.request('/landur/api/session',landur)).json();assert.equal(boot.portal,true);assert.equal(boot.authenticated,true);assert.equal(boot.csrf,landur.csrf);
    const page=await(await f.request('/landur/',landur)).text();assert.match(page,/data-portal="true"/);assert.match(page,/src="\.\/app.js"/);
    assert.equal((await f.request('/landur',landur)).headers.get('location'),'/landur/');
    assert.equal((await f.request('/landur/api/login',{...landur,method:'POST',body:{password:'anything'}})).status,404);
    assert.equal((await f.request('/landur/api/demo',{...landur,method:'POST',body:{}})).status,404);
    for(const route of ['/landur/server/ledger.mjs','/landur/data/landur.sqlite','/landur/.env'])assert.equal((await f.request(route,landur)).status,404);
  }finally{await f.close();}
});
test('viewer lee pero no escribe; editor usa CSRF y actor real; logout invalida ambos',async()=>{
  const f=await portalFixture();try{
    const editor=await f.login('landur'),reader=await f.login('reader');
    const body={kind:'account',name:'Caja QA',accountKind:'cash',currency:'UYU',opening:'100',cutoff:'2026-10-24',verified:true,accessible:true};
    const headers={'Idempotency-Key':randomUUID()};
    assert.equal((await f.request('/landur/api/commands',{...reader,method:'POST',body,headers})).status,403);
    assert.equal((await f.request('/landur/api/commands',{...editor,csrf:'wrong',method:'POST',body,headers})).status,403);
    assert.equal((await f.request('/landur/api/commands',{...editor,origin:'https://evil.test',method:'POST',body,headers})).status,403);
    assert.equal((await f.request('/landur/api/commands',{...editor,method:'POST',body,headers})).status,200);
    const state=await(await f.request('/landur/api/state',reader)).json();assert.equal(state.access,'viewer');assert.equal(state.accounts.length,1);assert.equal(state.audit[0].actor,'landur');
    assert.equal((await f.request('/landur/api/export.csv',reader)).status,200);
    for(const route of ['/landur/api/import/preview','/landur/api/import/commit'])assert.equal((await f.request(route,{...reader,method:'POST',body:{csv:''}})).status,403);
    assert.equal((await f.request('/landur/api/logout',{...reader,method:'POST',body:{}})).status,200);
    assert.equal((await f.request('/auth/me',reader)).status,401);assert.equal((await f.request('/landur/api/state',reader)).status,401);
  }finally{await f.close();}
});
test('admin asigna/revoca LANDUR sin tocar Pulso; UI legacy conserva otros grants',async()=>{
  const f=await portalFixture();try{
    const admin=await f.login('admin'),user=await f.login('pulso');
    assert.equal((await f.request('/api/admin/project-access',{...user,method:'PUT',body:{id:'pulso',projects:{landur:'editor'}}})).status,403);
    const save=await f.request('/api/admin/project-access',{...admin,method:'PUT',body:{id:'pulso',projects:{landur:'viewer'}}});
    assert.deepEqual((await save.json()).projects,{pulso:'editor',landur:'viewer'});
    assert.equal((await f.request('/auth/me',user)).status,401);
    const refreshed=await f.login('pulso');assert.equal((await f.request('/landur/api/state',refreshed)).status,200);
    const legacy=await f.request('/api/admin/users',{...admin,method:'PUT',body:{id:'pulso',access:'viewer',active:true,role:'member'}});assert.equal(legacy.status,200);
    assert.deepEqual(await f.store.transact(db=>db.users.find(u=>u.id==='pulso').projects),{pulso:'viewer',landur:'viewer'});
    assert.equal((await f.request('/api/admin/project-access',{...admin,method:'PUT',body:{id:'pulso',projects:{landur:null}}})).status,200);
    const final=await f.login('pulso');assert.equal((await f.request('/landur/api/state',final)).status,403);assert.equal((await f.request('/pulso',final)).status,200);
  }finally{await f.close();}
});
test('PWA montada: scope limitado y recursos sin datos personales',async()=>{
  const f=await portalFixture();try{
    const auth=await f.login('landur');
    const manifest=await(await f.request('/landur/manifest.webmanifest',auth)).json();
    assert.equal(new URL(manifest.scope,'http://localhost:4180/landur/manifest.webmanifest').pathname,'/landur/');
    assert.equal(new URL(manifest.start_url,'http://localhost:4180/landur/manifest.webmanifest').pathname,'/landur/');
    const sw=await f.request('/landur/sw.js',auth);assert.equal(sw.headers.get('service-worker-allowed'),'/landur/');
    assert.match(await sw.text(),/!SHELL.includes/);
    const js=await(await f.request('/landur/app.js',auth)).text();assert.match(js,/new URL\('\.\/', import.meta.url\)/);assert.match(js,/X-CSRF-Token/);
    assert.equal(fs.existsSync(path.join(f.root,'data/landur/landur.sqlite')),false);
  }finally{await f.close();}
});
test('clave de cliente: X-Forwarded-For solo se confía detrás del proxy local',()=>{
  // El par loopback es el proxy de LiteSpeed/Passenger; ahí el último salto es real.
  assert.equal(clientAddress({peer:'127.0.0.1',forwarded:'203.0.113.10, 198.51.100.7'}),'198.51.100.7');
  assert.equal(clientAddress({peer:'::1',forwarded:'203.0.113.10'}),'203.0.113.10');
  assert.equal(clientAddress({peer:'::ffff:127.0.0.1',forwarded:'203.0.113.10'}),'203.0.113.10');
  // Un par público o de red privada no está detrás de ese proxy: la cabecera no se cree.
  assert.equal(clientAddress({peer:'203.0.113.77',forwarded:'198.51.100.7'}),'203.0.113.77');
  assert.equal(clientAddress({peer:'10.0.0.5',forwarded:'198.51.100.7'}),'10.0.0.5');
  assert.equal(clientAddress({peer:'198.51.100.7',forwarded:''}),'198.51.100.7');
  assert.equal(clientAddress({peer:undefined}),'unknown');
});
test('el límite de intentos es por cliente: diez fallos de una IP no bloquean a otra',async()=>{
  const f=await portalFixture();try{
    const wrong={method:'POST',body:{email:'admin@example.test',password:'contraseña-incorrecta-de-qa'},headers:{'X-Forwarded-For':'203.0.113.10'}};
    let blocked;
    for(let i=0;i<11;i++)blocked=await f.request('/auth/login',wrong);
    assert.equal(blocked.status,429,'la décima falla corta el intento de esa IP');
    const other=await f.request('/auth/login',{...wrong,headers:{'X-Forwarded-For':'198.51.100.7'}});
    assert.equal(other.status,401,'otra IP no hereda el bloqueo de la primera');
    const valid=await f.request('/auth/login',{...wrong,headers:{'X-Forwarded-For':'192.0.2.44'},body:{email:'admin@example.test',password:f.password}});
    assert.equal(valid.status,200,'una IP distinta entra con su contraseña correcta');
    const stillBlocked=await f.request('/auth/login',wrong);
    assert.equal(stillBlocked.status,429,'la IP bloqueada sigue cortada hasta que venza la ventana');
  }finally{await f.close();}
});
test('falla de runtime o ruta LANDUR no derriba el selector de proyectos',async()=>{
  const handler=createLandurPortal({dataDir:'/tmp/unused-landur-test',projectRoot:'/nonexistent-landur-fixture'});
  const user={id:'a',name:'QA',active:true,role:'admin',csrf:'test'};
  assert.equal((await handler(new Request('https://rivect.net/landur/api/state'),user)).status,503);
  assert.equal((await handler(new Request('https://rivect.net/landur/'),user)).status,503);
  assert.equal((await handler(new Request('https://rivect.net/landur/api/session'),user)).status,200);
  handler.close();
});
