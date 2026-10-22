import {publicUrl} from './analysis-core.mjs';
const text=(v,n)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
// The only outbound search destination is the official API. No arbitrary URL fetching or redirects.
export async function fetchWebEvidence(company,env,fetcher=fetch){
 if(!env.TAVILY_API_KEY)throw Error('Tavily: falta TAVILY_API_KEY para investigar internet con NVIDIA. Podés analizar los datos aportados sin búsqueda.');
 const queries=[`"${text(company.name,120)}" ${text(company.city,120)} sitio oficial Instagram Facebook LinkedIn`,`${text(company.sector,100)} ${text(company.process,120)} automation multinational company official customer case study implementation challenges`];
 const sources=[],seen=new Set();let credits=0;
 for(const query of queries){
  let response;try{response=await fetcher('https://api.tavily.com/search',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${env.TAVILY_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({query,search_depth:'basic',max_results:4,topic:'general',include_answer:false,include_raw_content:false,include_images:false,include_usage:true,auto_parameters:false}),signal:AbortSignal.timeout(20000)})}catch{throw Error('Tavily no pudo conectarse; no se consumió una consulta de NVIDIA.');}
  if(!response.ok){if([429,432,433].includes(response.status))throw Error('Tavily alcanzó su límite de búsqueda. No se llamó a NVIDIA; el informe anterior se conserva.');if([401,403].includes(response.status))throw Error('Tavily rechazó la clave o sus permisos.');throw Error(`Tavily no pudo buscar (HTTP ${response.status}).`);}
  const raw=await response.text();if(raw.length>300000)throw Error('Tavily devolvió demasiada información.');
  let data;try{data=JSON.parse(raw)}catch{throw Error('Tavily devolvió una respuesta no válida.');}if(!Array.isArray(data.results))throw Error('Tavily devolvió resultados no válidos.');
  credits+=Number.isFinite(data.usage?.credits)?data.usage.credits:1;
  for(const r of data.results.slice(0,4)){const url=publicUrl(r.url),excerpt=text(r.content,1200);if(!url||!excerpt||seen.has(url))continue;seen.add(url);sources.push({id:'s'+(sources.length+1),url,title:text(r.title,250)||new URL(url).hostname,publisher:new URL(url).hostname,excerpt,date:typeof r.published_date==='string'?text(r.published_date,80):null});}
 }
 return {sources,queries,credits,provider:'tavily',scope:'search_excerpts',warning:'Se consultaron extractos devueltos por Tavily. Revisá las páginas originales y la identidad antes de presentarlos.'};
}
