import {validateBackup} from './evidence.mjs';
import {validateLab} from './lab.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function validateWorkspace(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!input.portfolio||typeof input.portfolio!=='object')throw new Error('Espacio de trabajo no válido.');
 const p=input.portfolio;
 if(!Array.isArray(p.companies)||p.companies.length>1000||!Array.isArray(p.demos)||p.demos.length>200)throw new Error('Cartera fuera de límites.');
 const evidence=input.evidence||{version:1,evidence:[],cases:[],analyses:{},reports:[],pilots:{}};
 validateBackup({...evidence,companies:p.companies});
 if(p.labs&&(!Array.isArray(p.labs)||p.labs.length>100))throw new Error('Laboratorios fuera de límites.');
 if(p.tasks&&(!Array.isArray(p.tasks)||p.tasks.length>2000))throw new Error('Tareas fuera de límites.');
 for(const t of p.tasks||[])if(typeof t.id!=='string'||typeof t.title!=='string'||!t.title.trim()||t.title.length>300||!['pending','done'].includes(t.status))throw new Error('Tarea no válida.');
 for(const lab of p.labs||[])validateLab(lab);
 const raw=JSON.stringify({portfolio:p,evidence});
 if(raw.length>3000000)throw new Error('El espacio supera 3 MB. Exportá un respaldo y archivá registros antiguos.');
 if(/"(?:__proto__|prototype|constructor)"\s*:/.test(raw))throw new Error('El respaldo contiene claves no admitidas.');
 if(/"(?:geminiKey|apiKey|OPENAI_API_KEY|GEMINI_API_KEY)"\s*:/i.test(raw))throw new Error('No se admiten claves de API en el respaldo.');
 return JSON.parse(raw);
}
export async function workspaceAPI(request,env){
 const user=request.headers.get('oai-authenticated-user-id');
 if(!user)return json({error:'Iniciá sesión con ChatGPT para guardar tu espacio.'},401);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origen no admitido.'},403);
 if(!env?.BUCKET)return json({error:'El almacenamiento todavía no está disponible.'},503);
 const key='workspaces/'+encodeURIComponent(user)+'/current.json';
 try{
  if(request.method==='GET'){
   const object=await env.BUCKET.get(key);
   if(!object)return json({exists:false,revision:null,data:null});
   return json({exists:true,revision:object.etag,data:await object.json(),updatedAt:object.uploaded?.toISOString?.()||null});
  }
  if(request.method!=='PUT')return json({error:'Método no admitido.'},405);
  const raw=await request.text();if(raw.length>3200000)return json({error:'El respaldo es demasiado grande.'},413);
  let body,data;try{body=JSON.parse(raw);data=validateWorkspace(body.data)}catch(e){return json({error:e instanceof SyntaxError?'JSON no válido.':e.message},400)}
  if(body.revision!==null&&(typeof body.revision!=='string'||body.revision.length>200))return json({error:'Falta la revisión para guardar.'},400);
  const onlyIf=body.revision?{etagMatches:body.revision}:{etagDoesNotMatch:'*'};
  const saved=await env.BUCKET.put(key,JSON.stringify(data),{onlyIf,httpMetadata:{contentType:'application/json'}});
  if(!saved)return json({error:'Otro dispositivo guardó cambios. Revisá la versión del servidor antes de reemplazarla.',conflict:true},409);
  return json({saved:true,revision:saved.etag,updatedAt:saved.uploaded?.toISOString?.()||new Date().toISOString()});
 }catch{return json({error:'No se pudo guardar en el servidor. Conservamos la copia local para reintentar.'},503)}
}
