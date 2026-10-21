// Fixed public sources: never fetch arbitrary user-provided URLs.
export const REGIONS={frontera:{label:'Rivera + Livramento',bbox:'-30.94,-55.59,-30.86,-55.49'},rivera:{label:'Rivera · área central',bbox:'-30.94,-55.59,-30.9,-55.49'},livramento:{label:'Livramento · área central',bbox:'-30.9,-55.59,-30.86,-55.49'}};
export const OVERPASS='https://overpass.private.coffee/api/interpreter';
export function queryFor(region){const r=REGIONS[region];if(!r)throw new Error('Región no admitida');return `[out:json][timeout:12];nwr["name"]["shop"](${r.bbox});out center tags 100;`;}
export const OVERPASS_FALLBACK='https://overpass-api.de/api/interpreter';
export async function fetchBusinesses(region,fetcher=fetch){
 const query=queryFor(region);let lastError;
 for(const endpoint of [OVERPASS,OVERPASS_FALLBACK]){
  try{
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'PulsoRiveraPrototype/0.3'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(14000)});
   if(!response.ok)throw new Error(`OpenStreetMap no respondió (HTTP ${response.status})`);
   const data=await response.json();
   if(!Array.isArray(data.elements)||data.remark)throw new Error('La fuente devolvió una consulta incompleta');
   return {source:'OpenStreetMap via Overpass',region,fetchedAt:new Date().toISOString(),osmBase:data.osm3s?.timestamp_osm_base,elements:data.elements};
  }catch(error){lastError=error;}
 }
 throw lastError;
}
export async function fetchSignals(query='software',fetcher=fetch){const url=new URL('https://hn.algolia.com/api/v1/search_by_date');url.search=new URLSearchParams({tags:'ask_hn',query:query.slice(0,70),hitsPerPage:'15'});const response=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Hacker News no respondió (HTTP ${response.status})`);const data=await response.json();if(!Array.isArray(data.hits))throw new Error('Respuesta no válida');return {source:'Hacker News via Algolia',fetchedAt:new Date().toISOString(),query,hits:data.hits};}
