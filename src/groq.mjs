export const GROQ_MODEL='openai/gpt-oss-120b';
export async function groqCompletion({prompt,schema,env,fetcher=fetch,search=false,jsonMode=false,maxTokens=2200}){
 const key=env.GROQ_API_KEY;
 if(!key)throw Error('Groq no está configurado en el servidor.');
 // Keep room under the free plan's per-minute token quota; do not truncate evidence silently.
 if(search&&schema)throw Error('Groq no admite búsqueda y esquema estricto en la misma consulta.');
 if(prompt.length>10000)throw Error('La consulta supera el tamaño previsto para la cuota gratuita. Elegí menos registros o textos más breves.');
 const response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({model:env.GROQ_MODEL||GROQ_MODEL,messages:[{role:'user',content:prompt}],max_completion_tokens:maxTokens,reasoning_effort:'low',stream:false,
   ...(search?{tools:[{type:'browser_search'}],tool_choice:'required'}:{}),
   ...(jsonMode&&!search&&!schema?{response_format:{type:'json_object'}}:{}),
   ...(schema?{response_format:{type:'json_schema',json_schema:{name:'pulso_evidence',strict:true,schema}}}:{})}),signal:AbortSignal.timeout(search?95000:55000)
 });
 if(!response.ok){
  if(response.status===429)throw Error('Groq alcanzó el límite de uso. Esperá un minuto; si continúa, revisá la cuota diaria.');
  if([401,403].includes(response.status))throw Error('Groq rechazó la clave o sus permisos.');
  throw Error(`Groq no pudo procesar la consulta (HTTP ${response.status}).`);
 }
 const data=await response.json();const choice=data.choices?.[0];
 if(choice?.finish_reason!=='stop'||!choice.message?.content?.trim())throw Error('Groq devolvió una respuesta incompleta. Probá una consulta más breve.');
 const executed=choice.message.executed_tools||data.executed_tools||[];
 const toolUrls=[];const walk=v=>{if(typeof v==='string'){for(const match of v.matchAll(/https?:\/\/[^\s\"<>\\]+/g))toolUrls.push(match[0].replace(/[),.;]+$/,''));}else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk)};walk(executed);
 return {text:choice.message.content,model:data.model||env.GROQ_MODEL||GROQ_MODEL,searchConfirmed:Array.isArray(executed)&&executed.length>0,toolUrls:[...new Set(toolUrls)]};
}
