import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {workspaceAPI,validateWorkspace} from '../src/cloud.mjs';import {diskBucket} from '../scripts/storage.mjs';import {labDocument,validateLab,labCSV,sampleRows,LAB_TYPES} from '../src/lab.mjs';
const workspace=()=>({portfolio:{companies:[{id:'c1',name:'Estudio'}],demos:[],labs:[],tasks:[]},evidence:{version:1,evidence:[],cases:[],reports:[],analyses:{},pilots:{}}});
const request=(method='GET',body,user='user1',origin='http://localhost')=>new Request('http://localhost/api/workspace',{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('datos por usuario, versiones y guardado condicional sin pérdida de actualizaciones',async()=>{
 await mkdir('data',{recursive:true});const dir=await mkdtemp(path.join(process.cwd(),'data','qa-'));const env={BUCKET:diskBucket(dir)};
 try{
  assert.equal((await workspaceAPI(request('GET',null,''),env)).status,401);
  assert.equal((await workspaceAPI(request('GET',null,'user1','https://evil.example'),env)).status,403);
  assert.equal((await (await workspaceAPI(request(),env)).json()).exists,false);
  const saved=await (await workspaceAPI(request('PUT',{revision:null,data:workspace()}),env)).json();assert.ok(saved.revision,JSON.stringify(saved));
  assert.equal((await workspaceAPI(request('PUT',{revision:null,data:workspace()}),env)).status,409);
  assert.equal((await (await workspaceAPI(request('GET',null,'user2'),env)).json()).exists,false);
  const a=workspace();a.portfolio.companies[0].name='Versión A';const b=workspace();b.portfolio.companies[0].name='Versión B';
  const results=await Promise.all([workspaceAPI(request('PUT',{revision:saved.revision,data:a}),env),workspaceAPI(request('PUT',{revision:saved.revision,data:b}),env)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const persisted=await (await workspaceAPI(request(),{BUCKET:diskBucket(dir)})).json();assert.equal(persisted.data.portfolio.companies[0].name,'Versión A');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('rechaza respaldos dañados, claves y datos fuera de límites',async()=>{
 assert.throws(()=>validateWorkspace({portfolio:{companies:[],demos:'no'}}));
 assert.throws(()=>validateWorkspace({...workspace(),portfolio:{...workspace().portfolio,geminiKey:'forbidden'}}));
 const malformed=workspace();malformed.portfolio.companies[0].id='bad" onclick="x';assert.throws(()=>validateWorkspace(malformed));
 const oversized=workspace();oversized.portfolio.tasks=[{id:'t',title:'x'.repeat(301),status:'pending'}];assert.throws(()=>validateWorkspace(oversized));
 assert.equal((await workspaceAPI(request(),{})).status,503);
});
test('todos los flujos generan apps autónomas con formulario, persistencia y canales aislados',()=>{
 for(const type of Object.keys(LAB_TYPES)){
  const lab={id:'lab1',title:'Mi lab',type,rows:sampleRows(type),sample:true};assert.equal(validateLab(lab),lab);
  const html=labDocument(lab);assert.match(html,/form id="entry"/);assert.match(html,/localStorage/);assert.match(html,/postMessage/);assert.match(html,/connect-src 'none'/);assert.match(html,/Exportar datos JSON/);
  const script=html.match(/<script(?: nonce="[^"]*")?>([\s\S]*)<\/script>/)[1];assert.doesNotThrow(()=>new Function(script));
 }
});
test('los laboratorios escapan datos y CSV, conservan valores y rechazan inventario inválido',()=>{
 const lab={id:'lab1',title:'</script><script>alert(1)</script>',type:'inventory',rows:[{id:'r1',title:'=SUM(A1)',quantity:2,amount:20}]};
 const html=labDocument(lab);assert.equal((html.match(/<script(?: nonce="[^"]*")?>/g)||[]).length,1);assert.doesNotThrow(()=>new Function(html.match(/<script(?: nonce="[^"]*")?>([\s\S]*)<\/script>/)[1]));assert.match(labCSV(lab),/'=SUM/);
 assert.throws(()=>validateLab({...lab,rows:[{id:'x',title:'Producto',quantity:-1}]}));assert.throws(()=>validateLab({...lab,rows:[...lab.rows,...lab.rows]}));
});
