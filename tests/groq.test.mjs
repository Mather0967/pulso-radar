import test from 'node:test';
import assert from 'node:assert/strict';
import {groqCompletion} from '../src/groq.mjs';
import {handleGeminiEvidence} from '../src/gemini-evidence.mjs';
import worker from '../dist/server/index.js';
const env={GROQ_API_KEY:'test-secret-never-real',GEMINI_API_KEY:'unused-key'};
const input={mode:'query',query:'¿Cómo registran?',records:[{id:'e1',companyId:'c1',title:'Entrevista',body:'Registran citas en una planilla.',source:'Entrevista',date:'2026-01-01',sector:'Servicios',type:'hecho',reviewed:true,kind:'evidence'}]};
function request(){return new Request('https://rivect.net/api/ai/evidence',{method:'POST',headers:{Origin:'https://rivect.net','Content-Type':'application/json'},body:JSON.stringify(input)})}
test('Groq recibe clave sólo en encabezado y valida citas del JSON estructurado',async()=>{
 const r=await handleGeminiEvidence(request(),async(url,options)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(options.headers.Authorization,`Bearer ${env.GROQ_API_KEY}`);
  const body=JSON.parse(options.body);assert.equal(body.model,'openai/gpt-oss-120b');assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.max_completion_tokens,2200);assert.ok(!options.body.includes(env.GROQ_API_KEY));
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:'Usan una planilla.',citations:[{recordId:'e1',quote:'citas en una planilla'}],missing:[]})}}]});
 },env);
 assert.equal(r.status,200);const result=await r.json();assert.equal(result.provider,'groq');assert.equal(result.result.citations[0].recordId,'e1');assert.ok(!JSON.stringify(result).includes(env.GROQ_API_KEY));
});
test('Groq rechaza citas inventadas, respuestas truncadas y textos sobre el presupuesto gratuito',async()=>{
 const bad=await handleGeminiEvidence(request(),async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:'Texto',citations:[{recordId:'e1',quote:'No está en el original'}],missing:[]})}}]}),env);assert.equal(bad.status,502);
 await assert.rejects(groqCompletion({env,prompt:'x',fetcher:async()=>Response.json({choices:[{finish_reason:'length',message:{content:'cortado'}}]})}),/incompleta/);
 await assert.rejects(groqCompletion({env,prompt:'x'.repeat(10001),fetcher:()=>{throw Error('No debe llamar')}}),/cuota gratuita/);
 await assert.rejects(groqCompletion({env,prompt:'x',fetcher:async()=>new Response(env.GROQ_API_KEY,{status:429})}),/límite de uso/);
});
test('estado prefiere Groq y no expone ninguna credencial',async()=>{
 const r=await worker.fetch(new Request('https://rivect.net/api/ai/status'),env);const d=await r.json();assert.equal(d.provider,'groq');assert.equal(d.model,'openai/gpt-oss-120b');assert.ok(!JSON.stringify(d).includes(env.GROQ_API_KEY));
});
