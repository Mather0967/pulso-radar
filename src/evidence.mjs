// Pure V1 rules. No inferred commercial score and no network or provider calls.
export const SECTORS=['Contable','Jurídico','Escribanía'];
const text=(v,max=12000)=>String(v??'').trim().slice(0,max);
export function sourceUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
export function createAIHypothesis(original,suggestion){
 if(!original||suggestion.recordId!==original.id||typeof suggestion.quote!=='string'||!suggestion.quote||!original.body.includes(suggestion.quote))throw new Error('La sugerencia no corresponde al original.');
 const body=`${text(suggestion.summary,2000)}\n\nFragmento original:\n${suggestion.quote}`;
 return {...validateRecord({...original,title:suggestion.title,body,type:'hipótesis',reviewed:false},original.kind==='case'?'case':'evidence'),id:crypto.randomUUID(),originId:original.id,originalBody:original.body,ai:{provider:'gemini',model:'gemini-3.8-flash',generatedAt:new Date().toISOString()},createdAt:new Date().toISOString()};
}
export function validateRecord(input,kind='evidence'){
 const title=text(input.title,180),body=text(input.body),source=text(input.source,500),date=text(input.date,10);
 if(!title||!body||!source)throw new Error('Completá título, contenido original y fuente o referencia.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10))throw new Error('Ingresá una fecha válida que no sea futura.');
 const type=['hecho','hipótesis'].includes(input.type)?input.type:'hipótesis';
 if(kind==='evidence'&&!text(input.companyId,120))throw new Error('Seleccioná una empresa real.');
 if(kind==='case'&&(!sourceUrl(source)||!text(input.conditions)))throw new Error('El caso necesita un enlace consultable y condiciones o límites.');
 return {title,body,source,date,type,companyId:text(input.companyId,120),sector:SECTORS.includes(input.sector)?input.sector:SECTORS[0],reviewed:input.reviewed===true,conditions:text(input.conditions,2000),format:['nota','voz transcripta','archivo de texto','formulario'].includes(input.format)?input.format:'nota'};
}
export function searchEvidence(records,query){
 const terms=text(query,300).toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu,'').match(/[\p{L}\p{N}]+/gu)||[];
 const ignored=new Set(['que','qué','de','del','la','las','los','el','en','para','con','una','un','hay','sobre','tenemos']);
 const words=terms.filter(t=>!ignored.has(t));
 return records.filter(r=>{const content=[r.title,r.body,r.source,r.sector].join(' ').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');return words.every(w=>content.includes(w))});
}
export function alertsFor(records,now=new Date()){
 return records.flatMap(r=>{const days=Math.floor((now-Date.parse(r.date))/86400000);const reasons=[];if(!r.reviewed)reasons.push('Pendiente de revisión humana');if(days>90)reasons.push(`Fuente con ${days} días: verificar vigencia`);return reasons.map(reason=>({id:r.id,title:r.title,reason,source:r.source,date:r.date}))});
}
export function makeReport({company,evidence,cases,analysis,pilot},now=new Date()){
 const local=evidence.filter(e=>e.companyId===company.id);
 const facts=local.filter(e=>e.type==='hecho'&&e.reviewed),hypotheses=local.filter(e=>e.type==='hipótesis'||!e.reviewed);
 const related=cases.filter(c=>(analysis.caseIds||[]).includes(c.id));
 const missing=[];if(!facts.length)missing.push('No hay hechos locales revisados.');if(!related.length)missing.push('Faltan casos internacionales vinculados.');
 for(const [key,label]of [['problem','problema'],['similarities','similitudes'],['differences','diferencias'],['hypothesis','hipótesis'],['alternatives','alternativas'],['missing','preguntas y datos faltantes (o declarar que no se identificaron)'],['next','siguiente prueba']])if(!analysis[key]?.trim())missing.push(`Completar ${label}.`);
 if(related.some(c=>!c.reviewed))missing.push('Revisar las fuentes de los casos vinculados.');
 if(alertsFor([...local,...related],now).some(a=>a.reason.includes('vigencia')))missing.push('Actualizar las fuentes con más de 90 días.');
 return structuredClone({id:crypto.randomUUID(),companyId:company.id,companyName:company.name,createdAt:now.toISOString(),facts,hypotheses,cases:related,analysis:{...analysis,caseIds:analysis.caseIds||[]},missing,pilot:pilot||null,ready:missing.length===0});
}
export function reportIsCurrent(report,context){
 if(!report)return false;
 const next=makeReport(context);
 return next.ready&&['companyName','facts','hypotheses','cases','analysis'].every(key=>JSON.stringify(report[key])===JSON.stringify(next[key]));
}
export function pilotStatus(pilot,report){
 const before=Number(pilot?.before),after=Number(pilot?.after);
 const valid=pilot?.before!==''&&pilot?.after!==''&&Number.isFinite(before)&&Number.isFinite(after)&&before>0&&after>=0;
 const saved=valid?before-after:null;
 const checks=[['Oportunidad real y referencia del piloto',!!pilot?.reference?.trim()],['Comparación documentada de la misma tarea',valid&&!!pilot?.measurement?.trim()],['Ahorro de tiempo medido',saved>0],['Informe vigente con evidencia y casos revisados',!!report?.ready],['Validación humana del resultado',pilot?.validated===true]];
 return {checks,saved,closed:checks.every(([,ok])=>ok)};
}
export function validateBackup(data){
 if(data?.version!==1||!Array.isArray(data.evidence)||!Array.isArray(data.cases)||!data.analyses||Array.isArray(data.analyses)||!Array.isArray(data.reports)||!data.pilots||Array.isArray(data.pilots)||!Array.isArray(data.companies))throw new Error('Respaldo V1 no válido.');
 if(data.evidence.length+data.cases.length>2000||data.reports.length>500)throw new Error('El respaldo excede los límites.');
 const safeId=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,149}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
 const ids=new Set();for(const c of data.companies){if(!safeId(c.id)||typeof c.name!=='string'||ids.has(c.id))throw new Error('Empresas no válidas.');ids.add(c.id)}
 const recordIds=new Set();for(const [kind,list]of [['evidence',data.evidence],['case',data.cases]])for(const r of list){if(!safeId(r.id)||recordIds.has(r.id))throw new Error('Identificadores de registros no válidos.');recordIds.add(r.id);validateRecord(r,kind);if(kind==='evidence'&&!ids.has(r.companyId))throw new Error('Evidencia sin empresa en el respaldo.');}
 const checkAnalysis=a=>{if(!a||typeof a!=='object'||Array.isArray(a)||!Array.isArray(a.caseIds)||!a.caseIds.every(safeId)||Object.entries(a).some(([k,v])=>k!=='caseIds'&&(typeof v!=='string'||v.length>12000)))throw new Error('Análisis no válidos.');};
 for(const [id,a]of Object.entries(data.analyses)){if(!safeId(id))throw new Error('Expediente no válido.');checkAnalysis(a);}
 for(const p of Object.values(data.pilots))if(!p||typeof p!=='object'||Array.isArray(p)||Object.entries(p).some(([k,v])=>k==='validated'?typeof v!=='boolean':typeof v!=='string'))throw new Error('Piloto no válido.');
 for(const r of data.reports){if(!safeId(r.id)||!safeId(r.companyId)||typeof r.companyName!=='string'||!Number.isFinite(Date.parse(r.createdAt))||typeof r.ready!=='boolean'||!Array.isArray(r.missing)||!r.missing.every(v=>typeof v==='string'))throw new Error('Informe no válido.');checkAnalysis(r.analysis);for(const key of ['facts','hypotheses','cases']){if(!Array.isArray(r[key]))throw new Error('Fuentes de informe no válidas.');for(const item of r[key])validateRecord(item,key==='cases'?'case':'evidence');}}
 return data;
}

