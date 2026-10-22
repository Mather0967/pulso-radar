import test from 'node:test';
import assert from 'node:assert/strict';
import {nvidiaCompletion,NVIDIA_MODEL} from '../src/nvidia.mjs';
import {fetchWebEvidence} from '../src/web-evidence.mjs';
import {researchAPI,researchCompanyReport} from '../src/research.mjs';
import worker from '../dist/server/index.js';
const env={NVIDIA_API_KEY:'nvapi-test-secret',TAVILY_API_KEY:'tvly-test-secret',GROQ_API_KEY:'groq-unused'};
const sample=()=>({summary:'Datos por validar.',identity:{status:'ambiguous',reason:'Confirmar coincidencia.',sourceIds:[]},facts:[],channels:[],automation:{process:'Pedidos',proposal:'Probar captura de pedidos.',validation:'Medir tiempos.'},benchmarks:[],risks:[],missing:['Validar datos.'],sources:[]});
const completion=data=>Response.json({model:NVIDIA_MODEL,usage:{prompt_tokens:100,completion_tokens:150,total_tokens:250},choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]});
test('NVIDIA usa el endpoint y presupuesto propios; claves sólo en encabezados y sin herramientas de Groq',async()=>{
 const reply=await nvidiaCompletion({prompt:'Devolvé JSON.',env,fetcher:async(url,options)=>{
  assert.equal(url,'https://integrate.api.nvidia.com/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer '+env.NVIDIA_API_KEY);
  const body=JSON.parse(options.body);assert.equal(body.model,NVIDIA_MODEL);assert.equal(body.max_tokens,24576);assert.equal(body.stream,false);assert.ok(!body.tools);assert.ok(!body.response_format);assert.ok(!options.body.includes(env.NVIDIA_API_KEY));return completion(sample());
 }});assert.equal(reply.usage.totalTokens,250);
});
test('NVIDIA rechaza truncamientos y fallos sin filtrar credenciales ni reintentar',async()=>{
 for(const status of [401,402,429,500]){let calls=0;await assert.rejects(()=>nvidiaCompletion({prompt:'x',env,fetcher:async()=>{calls++;return new Response(env.NVIDIA_API_KEY,{status})}}),e=>e.message.startsWith('NVIDIA')&&!e.message.includes(env.NVIDIA_API_KEY));assert.equal(calls,1)}
 await assert.rejects(()=>nvidiaCompletion({prompt:'x',env,fetcher:async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{truncated'}}]})}),/incompleta/);
});
test('Tavily consulta sólo búsquedas fijas, usa basic, limita resultados y descarta URLs no públicas',async()=>{
 let calls=0;const evidence=await fetchWebEvidence({name:'Local',city:'Rivera',sector:'Panadería',economics:{currentProfit:123456789}},env,async(url,options)=>{
  calls++;assert.equal(url,'https://api.tavily.com/search');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+env.TAVILY_API_KEY);assert.ok(!options.body.includes('123456789'));assert.ok(!options.body.includes(env.TAVILY_API_KEY));const body=JSON.parse(options.body);assert.equal(body.search_depth,'basic');assert.equal(body.auto_parameters,false);
  return Response.json({usage:{credits:1},results:[{url:'http://127.0.0.1/private',content:'no'},{url:'https://example.com/local',title:'Local',content:'Fuente pública consultada.'}]});
 });assert.equal(calls,2);assert.equal(evidence.credits,2);assert.equal(evidence.sources.length,1);
});
test('NVIDIA investiga con fuentes recuperadas; no envía finanzas ni acepta fuentes inventadas',async()=>{
 let searches=0,inferences=0;const fetcher=async(url,options)=>{
  if(url.includes('tavily')){searches++;return Response.json({results:[{url:'https://example.com/local',title:'Local',content:'Fuente pública consultada.'}]})}
  inferences++;assert.ok(!options.body.includes('123456789'));const data=sample();data.sources=[{id:'s1',url:'https://example.com/local'}];data.facts=[{text:'Dato documentado.',sourceIds:['s1']}];return completion(data);
 };
 const report=await researchCompanyReport({name:'Local',economics:{currentProfit:123456789}},env,fetcher);assert.equal(searches,2);assert.equal(inferences,1);assert.equal(report.provider,'nvidia');assert.equal(report.search.provider,'tavily');assert.equal(report.sources[0].excerpt,'Fuente pública consultada.');
 await assert.rejects(()=>researchCompanyReport({name:'Local'},env,async(url)=>url.includes('tavily')?Response.json({results:[]}):completion({...sample(),sources:[{id:'fake',url:'https://invented.example/'}]})),/no fue consultada/);
});
test('sin búsqueda no requiere Tavily y no permite disfrazar hipótesis como hechos públicos',async()=>{
 let calls=0;const report=await researchCompanyReport({name:'Local'},{NVIDIA_API_KEY:env.NVIDIA_API_KEY},async(url)=>{calls++;assert.ok(url.includes('nvidia'));return completion(sample())},{web:false});assert.equal(calls,1);assert.equal(report.search.requested,false);assert.equal(report.search.confirmed,false);
 await assert.rejects(()=>researchCompanyReport({name:'Local'},{NVIDIA_API_KEY:env.NVIDIA_API_KEY},async()=>completion({...sample(),facts:[{text:'Inventado',sourceIds:[]}]}),{web:false}),/sin búsqueda/);
});
test('estado prioriza NVIDIA y declara búsqueda pendiente sin exponer claves; investigación falla antes de gastar',async()=>{
 const state=await(await worker.fetch(new Request('https://pulso.test/api/ai/status'),{NVIDIA_API_KEY:env.NVIDIA_API_KEY,GROQ_API_KEY:env.GROQ_API_KEY})).json();assert.equal(state.provider,'nvidia');assert.equal(state.webResearchReady,false);assert.ok(!JSON.stringify(state).includes(env.NVIDIA_API_KEY));
 let calls=0;const r=await researchAPI(new Request('https://pulso.test/api/ai/research',{method:'POST',headers:{'oai-authenticated-user-id':'p1'},body:JSON.stringify({company:{name:'Local'}})}),{NVIDIA_API_KEY:env.NVIDIA_API_KEY,BUCKET:{}},{},async()=>{calls++;return completion(sample())});assert.equal(r.status,400);assert.match((await r.json()).error,/TAVILY_API_KEY/);assert.equal(calls,0);
});
test('las consultas de evidencia priorizan NVIDIA y siguen rechazando citas inventadas',async()=>{
 const {handleGeminiEvidence}=await import('../src/gemini-evidence.mjs');
 const input={mode:'query',query:'¿Cómo registran?',records:[{id:'e1',companyId:'c1',title:'Entrevista',body:'Registran citas en una planilla.',source:'Entrevista',date:'2026-01-01',sector:'Servicios',type:'hecho',reviewed:true,kind:'evidence'}]};
 const request=()=>new Request('https://pulso.test/api/ai/evidence',{method:'POST',body:JSON.stringify(input)});
 const fetcher=quote=>async(url,options)=>{assert.ok(url.includes('nvidia'));assert.match(JSON.parse(options.body).messages[1].content,/esquema/);return completion({answer:'Usan una planilla.',citations:[{recordId:'e1',quote}],missing:[]})};
 const good=await handleGeminiEvidence(request(),fetcher('citas en una planilla'),env);assert.equal(good.status,200);assert.equal((await good.json()).provider,'nvidia');
 assert.equal((await handleGeminiEvidence(request(),fetcher('No está en el original'),env)).status,502);
});
