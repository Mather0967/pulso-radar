import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAIInput,validateAIOutput,handleGeminiEvidence} from '../src/gemini-evidence.mjs';
import worker from '../dist/server/index.js';
import {createAIHypothesis,validateBackup} from '../src/evidence.mjs';
const record={id:'e1',companyId:'c1',title:'Entrevista',body:'El equipo registra las citas en una planilla.',source:'Entrevista E-01',date:'2026-01-01',sector:'Contable',type:'hecho',reviewed:true,kind:'evidence'};
const caseRecord={...record,id:'case1',kind:'case',source:'https://example.org/caso',conditions:'Otra escala'};
const input=mode=>({mode,query:mode==='query'?'¿Cómo registran las citas?':'',records:[record]});
const citation={recordId:'e1',quote:'registra las citas en una planilla'};
const request=(body=input('query'),headers={})=>new Request('http://localhost/api/ai/evidence',{method:'POST',headers:{'Content-Type':'application/json','X-Pulso-Gemini-Key':'test-key-not-real-1234567890',...headers},body:JSON.stringify(body)});
const answer={answer:'Usan una planilla.',citations:[citation],missing:[]};
test('valida consulta, tamaño y selección sin inferir fuentes',()=>{
 assert.equal(validateAIInput(input('query')).records[0].body,record.body);
 for(const body of [{...input('query'),query:''},{...input('query'),records:[]},{...input('extract'),records:[record,caseRecord]},{...input('query'),records:[record,record]},{...input('query'),records:[{...record,date:''}]},{mode:'constructor',records:[record]}])assert.throws(()=>validateAIInput(body));
});
test('rechaza citas inventadas, IDs ajenos y relaciones sin respaldo local',()=>{
 for(const c of [{recordId:'inventado',quote:'citas'},{recordId:'e1',quote:'usa un CRM'}])assert.throws(()=>validateAIOutput({...answer,citations:[c]},input('query')));
 const relation={problem:'Agenda',similarities:'Misma tarea',differences:'Otra escala',hypothesis:'Validar',missing:'Tiempo',alternatives:'Planilla',next:'Medir',caseIds:['case1'],citations:[citation]};
 const context={mode:'relate',records:[record,caseRecord]};
 assert.throws(()=>validateAIOutput(relation,context));
 assert.doesNotThrow(()=>validateAIOutput({...relation,citations:[citation,{recordId:'case1',quote:'registra las citas en una planilla'}]},context));
 assert.throws(()=>validateAIOutput({...relation,caseIds:['e1']},context));
});
test('sin citas no convierte la respuesta generada en una afirmación',()=>{
 const r=validateAIOutput({...answer,answer:'Usan un CRM confirmado.',citations:[]},input('query'));
 assert.match(r.answer,/No hay evidencia suficiente/);
});
test('extracción devuelve sugerencias y citas, nunca revisa o modifica originales',()=>{
 const original=structuredClone(record),data={suggestions:[{title:'Agenda',summary:'Hipótesis de coordinación manual',...citation}],missing:['Tiempo dedicado']};
 const out=validateAIOutput(data,input('extract'));
 assert.equal(out.suggestions[0].quote,citation.quote);assert.deepEqual(record,original);assert.equal(out.suggestions[0].reviewed,undefined);
});
test('al aceptar se crea una hipótesis separada, conserva original y sobrevive al respaldo',()=>{
 const before=structuredClone(record);
 const saved=createAIHypothesis(record,{...citation,title:'Agenda manual',summary:'Proceso para validar'});
 assert.deepEqual(record,before);assert.notEqual(saved.id,record.id);assert.equal(saved.reviewed,false);assert.equal(saved.type,'hipótesis');assert.equal(saved.originalBody,record.body);assert.equal(saved.originId,record.id);
 const backup=JSON.parse(JSON.stringify({version:1,companies:[{id:'c1',name:'Estudio'}],evidence:[record,saved],cases:[],analyses:{},pilots:{},reports:[]}));
 assert.equal(validateBackup(backup).evidence[1].originalBody,record.body);
 assert.throws(()=>createAIHypothesis(record,{...citation,recordId:'otra',title:'X',summary:'X'}));
});
test('Gemini recibe esquema JSON y store false; clave sólo en encabezado',async()=>{
 let calls=0;
 const r=await handleGeminiEvidence(request(),async(url,options)=>{
  calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');
  const payload=JSON.parse(options.body);assert.equal(payload.store,false);assert.equal(payload.response_format.mime_type,'application/json');assert.ok(payload.response_format.schema.properties.citations);assert.equal(payload.input.includes('test-key-not-real'),false);
  return Response.json({output_text:JSON.stringify(answer)});
 });
 assert.equal(r.status,200);const data=await r.json();assert.equal(data.reviewed,false);assert.equal(data.result.answer,answer.answer);assert.equal(JSON.stringify(data).includes('test-key-not-real'),false);assert.equal(calls,1);
});
test('rechaza origen, clave y entradas inválidas antes de llamar al proveedor',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw new Error('No debe llamarse')};
 assert.equal((await handleGeminiEvidence(request(undefined,{Origin:'https://evil.example'}),fetcher)).status,403);
 assert.equal((await handleGeminiEvidence(request(undefined,{'X-Pulso-Gemini-Key':''}),fetcher)).status,400);
 assert.equal((await handleGeminiEvidence(request({...input('query'),records:[]}),fetcher)).status,400);
 assert.equal((await handleGeminiEvidence(request({...input('query'),query:'x'.repeat(180001)}),fetcher)).status,413);
 assert.equal(calls,0);
});
test('fallos, límites y respuesta incompleta conservan errores seguros',async()=>{
 for(const fake of [async()=>new Response('secret upstream',{status:429}),async()=>Response.json({output_text:'not JSON'}),async()=>Response.json({output_text:JSON.stringify({...answer,citations:[{recordId:'e1',quote:'cita inventada'}]})}),async()=>{throw new Error('sensitive upstream error')}]){
  const r=await handleGeminiEvidence(request(),fake);assert.equal(r.status,502);const body=await r.text();assert.doesNotMatch(body,/secret upstream|sensitive upstream|test-key-not-real/);
 }
 const r=await handleGeminiEvidence(request(),async()=>Response.json({steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(answer)}]}]}));assert.equal(r.status,200);
});
test('build sirve el módulo del asistente y enruta la API sin clave',async()=>{
 assert.equal((await worker.fetch(new Request('http://localhost/evidence-assistant.mjs'))).status,200);
 assert.equal((await worker.fetch(request(undefined,{'X-Pulso-Gemini-Key':''}))).status,400);
});
