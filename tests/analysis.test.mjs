import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateScenarios,initialInputs,validateResearchReport,parseResearchJSON,scenarioCSV} from '../src/analysis-core.mjs';
import {researchAPI,researchCompanyReport} from '../src/research.mjs';
import {projectMethodAllowed} from '../namecheap/server/access.mjs';
const input={hours:100,hourCost:10,missed:20,ticket:50,margin:40,conversion:50,cashShare:0,recurring:50,setup:300,currentProfit:1000};
const fixture=()=>({summary:'Empresa local por validar.',identity:{status:'likely',reason:'Coinciden nombre y ciudad.',sourceIds:['s1']},facts:[{text:'Comercio de ejemplo.',sourceIds:['s1']}],channels:[{platform:'Sitio',url:'https://example.com/local',reason:'Candidato.',sourceIds:['s1']}],automation:{process:'Pedidos',proposal:'Piloto de captura.',validation:'Medir pedidos.'},benchmarks:[{company:'Empresa global de ejemplo',automation:'Pedidos',evidence:'Caso publicado.',sourceIds:['s2'],transferable:'Captura estructurada.',limits:'Mayor escala.'}],risks:[{title:'Datos duplicados',kind:'anticipated',description:'Pueden duplicarse pedidos.',prevention:'Idempotencia.',pilotCheck:'Reenviar evento sin duplicar.',sourceIds:[]}],missing:['Medir horas.'],sources:[{id:'s1',url:'https://example.com/local',title:'Local',publisher:'Ejemplo',excerpt:'Comercio.',date:null},{id:'s2',url:'https://example.org/case',title:'Caso',publisher:'Ejemplo global',excerpt:'Pedidos.',date:null}]});
test('separa capacidad de ahorro efectivo, usa margen y costos, conserva pérdidas y recuperación',()=>{
 const f=calculateScenarios(input),s=f.scenarios[1];assert.equal(s.hoursSaved,40);assert.equal(s.capacityValue,400);assert.equal(s.cashSavings,0);assert.equal(s.contribution,50);assert.equal(s.monthlyDelta,0);assert.equal(s.profitAfter,1000);assert.equal(s.paybackMonths,null);assert.equal(s.cumulative[12].value,-300);
 const paid=calculateScenarios({...input,cashShare:50}).scenarios[1];assert.equal(paid.monthlyDelta,200);assert.equal(paid.profitAfter,1200);assert.equal(paid.paybackMonths,1.5);assert.equal(paid.cumulative[0].value,-300);assert.equal(paid.cumulative[12].value,2100);
 assert.equal(f.scenarios[0].monthlyDelta,-30);assert.equal(f.scenarios[0].paybackMonths,null);
});
test('datos desconocidos no se convierten en cero y no permite porcentajes o cifras inválidas',()=>{
 const f=calculateScenarios(initialInputs({economics:{hours:40,cost:8,leads:10,ticket:35,margin:35}}));assert.equal(f.scenarios[1].hoursSaved,16);assert.equal(f.scenarios[1].cashSavings,0);assert.equal(f.scenarios[1].monthlyDelta,null);assert.equal(f.scenarios[1].profitAfter,null);assert.ok(f.scenarios[1].cumulative.every(p=>p.value===null));
 assert.throws(()=>calculateScenarios({...input,margin:101}));assert.throws(()=>calculateScenarios({...input,hours:-1}));assert.throws(()=>calculateScenarios({...input,recurring:Infinity}));
 assert.equal(calculateScenarios({...input,currentProfit:-50}).scenarios[1].profitAfter,-50);
 const csv=scenarioCSV(f);assert.match(csv,/supuestos_no_validados/);assert.match(csv,/"Pendiente"|"",/);assert.ok(!csv.includes('NaN'));
});
test('el informe exige referencias válidas, rechaza enlaces ejecutables y separa identidad de coincidencia',()=>{
 const report=validateResearchReport(fixture(),{searchConfirmed:true,toolUrls:['https://example.com/local']});assert.equal(report.identity.status,'likely');assert.equal(report.sources[0].trace,'tool_result');assert.equal(report.sources[1].reviewed,false);
 assert.equal(validateResearchReport(fixture()).identity.status,'ambiguous');
 const bad=fixture();bad.facts[0].sourceIds=['inventada'];assert.throws(()=>validateResearchReport(bad),/fuente inexistente/);
 const injected=fixture();injected.sources[0].url='javascript:alert(1)';assert.throws(()=>validateResearchReport(injected),/fuente no válida/);
 const social=fixture();social.channels[0].url='https://wrong.example/profile';assert.throws(()=>validateResearchReport(social),/canal sin fuente/);
 const risk=fixture();risk.risks[0].kind='documented';assert.equal(validateResearchReport(risk).risks[0].kind,'anticipated');
 assert.deepEqual(parseResearchJSON('```json\n'+JSON.stringify(fixture())+'\n```'),fixture());assert.throws(()=>parseResearchJSON('no es JSON'));
});
test('investigación exige herramienta web, no envía finanzas a Groq y valida la respuesta',async()=>{
 const env={GROQ_API_KEY:'test-only-secret'};
 const report=await researchCompanyReport({name:'Local',city:'Rivera'},env,async(url,options)=>{const body=JSON.parse(options.body);assert.deepEqual(body.tools,[{type:'browser_search'}]);assert.equal(body.tool_choice,'required');assert.ok(!body.response_format);assert.ok(!body.messages[0].content.includes('currentProfit'));assert.ok(!options.body.includes(env.GROQ_API_KEY));return Response.json({model:'openai/gpt-oss-120b',choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture()),executed_tools:[{type:'browser_search',results:[{url:'https://example.com/local'}]}]}}]})});
 assert.equal(report.search.confirmed,true);assert.equal(report.identity.status,'likely');
});
test('los trabajos persisten fuera de la solicitud y están aislados por proyecto y sesión',async()=>{
 const mem=new Map(),BUCKET={get:async k=>mem.has(k)?{json:async()=>JSON.parse(mem.get(k))}:null,put:async(k,v)=>{mem.set(k,v)}};
 const env={BUCKET,GROQ_API_KEY:'test-only-secret'},tasks=[];let release;const gate=new Promise(r=>release=r);
 const fetcher=async()=>{await gate;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture()),executed_tools:[{type:'browser_search'}]}}]})};
 const req=user=>new Request('https://rivect.net/api/ai/research',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://rivect.net',...(user?{'oai-authenticated-user-id':user}:{})},body:JSON.stringify({company:{id:'c1',name:'Local',city:'Rivera'},inputs:input})});
 assert.equal((await researchAPI(req(null),env,{},fetcher)).status,401);
 const started=await researchAPI(req('p1'),env,{waitUntil:p=>tasks.push(p)},fetcher);assert.equal(started.status,202);const {jobId}=await started.json();
 assert.equal((await researchAPI(req('p1'),env,{},fetcher)).status,409);
 const get=user=>new Request('https://rivect.net/api/ai/research/'+jobId,{headers:{'oai-authenticated-user-id':user}});
 assert.equal((await researchAPI(get('p2'),env)).status,404);assert.equal((await (await researchAPI(get('p1'),env)).json()).status,'running');
 release();await Promise.all(tasks);const done=await (await researchAPI(get('p1'),env)).json();assert.equal(done.status,'complete');assert.equal(done.report.finance.scenarios[1].monthlyDelta,0);assert.ok(!JSON.stringify(done).includes(env.GROQ_API_KEY));
 assert.equal(projectMethodAllowed('viewer','/api/ai/research','POST'),true);assert.equal(projectMethodAllowed('viewer','/api/workspace','PUT'),false);
});
test('normaliza una respuesta web en prosa sin repetir búsquedas ni perder procedencia',async()=>{
 let calls=0;const report=await researchCompanyReport({name:'Local',city:'Rivera'},{GROQ_API_KEY:'test'},async(url,options)=>{
  const body=JSON.parse(options.body);calls++;
  if(calls===1)return Response.json({choices:[{finish_reason:'stop',message:{content:'Evidencia pública en prosa.',executed_tools:[{type:'browser_search',results:[{url:'https://example.com/local'}]}]}}]});
  assert.equal(calls,2);assert.ok(!body.tools);assert.deepEqual(body.response_format,{type:'json_object'});assert.match(body.messages[0].content,/Evidencia pública en prosa/);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture())}}]});
 });assert.equal(report.search.confirmed,true);assert.equal(report.sources[0].trace,'tool_result');
});
test('omite un perfil sin fuente exacta y conserva el informe con un faltante explícito',async()=>{
 const data=fixture();data.channels[0].url='https://wrong.example/profile';
 const report=await researchCompanyReport({name:'Local'},{GROQ_API_KEY:'test'},async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(data),executed_tools:[{type:'browser_search'}]}}]}));
 assert.equal(report.channels.length,0);assert.match(report.missing.join(' '),/perfiles sin una fuente/);assert.equal(report.facts.length,1);
});
