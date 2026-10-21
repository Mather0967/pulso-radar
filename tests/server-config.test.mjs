import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
import {handleGeminiEvidence} from '../src/gemini-evidence.mjs';

test('bootstrap autenticado agrega CSRF antes de guardar sin depender de un archivo estático', async()=>{
 const source=await readFile('namecheap/server/main.mjs','utf8');
 assert.match(source, /src="\/auth\/pulso-session\.js"/);
 assert.match(source, /p==='\/auth\/pulso-session\.js'/);
 const script=await readFile('namecheap/public/pulso-session.js','utf8');
 let sent;
 class Storage {getItem(){} setItem(){} removeItem(){}}
 const sandbox={Storage,localStorage:new Storage(),Headers,URL,location:{origin:'https://rivect.net'},document:{addEventListener(){}},window:{RIVECT:{id:'test-user',csrf:'test-csrf'},fetch:async(input,init)=>{sent=init;return new Response('{}')}}};
 vm.runInNewContext(script,sandbox);
 await sandbox.window.fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(sent.headers.get('X-CSRF-Token'),'test-csrf');
 assert.equal(sent.headers.get('Content-Type'),'application/json');
});

test('estado anuncia conexión compartida sin revelar la clave del servidor',async()=>{
 const secret='fake-server-key-for-tests-only';
 const r=await worker.fetch(new Request('https://rivect.net/api/ai/status'),{GEMINI_API_KEY:secret,GEMINI_MODEL:'configured-model'});
 const data=await r.json();assert.equal(data.configured,true);assert.equal(data.provider,'gemini');assert.equal(data.model,'configured-model');assert.ok(!JSON.stringify(data).includes(secret));
});

test('evidencia admite clave del servidor sin clave en el navegador y conserva validación de citas',async()=>{
 const key='fake-server-key-for-tests-only';
 const body={mode:'query',query:'¿Cómo registran?',records:[{id:'e1',companyId:'c1',title:'Entrevista',body:'Registran citas en una planilla.',source:'Entrevista',date:'2026-01-01',sector:'Panadería / Gastronomía',type:'hecho',reviewed:true,kind:'evidence'}]};
 const req=new Request('https://rivect.net/api/ai/evidence',{method:'POST',headers:{Origin:'https://rivect.net','Content-Type':'application/json'},body:JSON.stringify(body)});
 const r=await handleGeminiEvidence(req,async(url,options)=>{assert.equal(options.headers['x-goog-api-key'],key);assert.ok(!options.body.includes(key));return Response.json({output_text:JSON.stringify({answer:'Usan una planilla.',citations:[{recordId:'e1',quote:'citas en una planilla'}],missing:[]})})},{GEMINI_API_KEY:key});
 assert.equal(r.status,200);assert.ok(!(await r.text()).includes(key));
});

test('radar usa una segunda fuente si falla la primera y rechaza regiones antes de consultar',async()=>{
 const {fetchBusinesses,OVERPASS_FALLBACK}=await import('../src/providers.mjs');let calls=0;
 const data=await fetchBusinesses('frontera',async(url)=>{calls++;if(calls===1)return new Response('Unavailable',{status:503});assert.equal(url,OVERPASS_FALLBACK);return Response.json({elements:[],osm3s:{timestamp_osm_base:'2026-10-21T00:00:00Z'}})});
 assert.equal(calls,2);assert.deepEqual(data.elements,[]);
 await assert.rejects(fetchBusinesses('invalid',async()=>{throw Error('should not fetch')}),/Región no admitida/);
});
