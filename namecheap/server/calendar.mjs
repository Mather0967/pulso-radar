// Calendario de trabajos del portal. Todo vive en un único documento `calendar/jobs.json` (escrituras
// condicionadas por etag, con reintentos). Ver y escribir depende de los proyectos del usuario; borrar,
// de ser admin o autor del trabajo. Los datos del cliente se validan y nunca se copian en bruto.
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {diskBucket} from '../scripts/storage.mjs';

const KEY='jobs.json';
const MAX_JOBS=2000;
const MAX_BODY=16384;
const PROJECTS=['pulso','landur','studio','retail','general'];
const KINDS=['contacto','entrevista','entrega','vencimiento','otro'];
const STATUSES=['pendiente','en_curso','hecho'];
const FIELDS=['id','title','date','allDay','start','end','project','kind','assignee','status','notes',
  'createdBy','updatedBy','createdAt','updatedAt','version'];
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

class Fail extends Error{
  constructor(status,body){super(typeof body==='string'?body:body.error);this.status=status;this.body=typeof body==='string'?{error:body}:body;}
}

const realDate=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number);
  const t=new Date(0);t.setUTCFullYear(y,m-1,d);
  return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;
};
const minutesOf=value=>{
  if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return null;
  const [h,min]=value.split(':').map(Number);
  return h*60+min;
};
const access=user=>{
  const levels=Object.values(user?.projects??{});
  const admin=user?.role==='admin';
  const view=Boolean(user?.active)&&(admin||levels.some(v=>v==='viewer'||v==='editor'));
  const write=view&&(admin||levels.includes('editor'));
  return {view,write,admin};
};
const publicJob=job=>Object.fromEntries(FIELDS.map(key=>[key,job[key]]));
const compareJobs=(a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.title.localeCompare(b.title,'es');

// Valida los campos editables. Ignora a propósito id, createdBy, updatedBy, createdAt, updatedAt y version.
async function validFields(body,listUsers){
  const title=typeof body.title==='string'?body.title.trim():'';
  if(title.length<1||title.length>120)throw new Fail(400,'El título debe tener entre 1 y 120 caracteres.');
  if(!realDate(body.date))throw new Fail(400,'La fecha no es válida.');
  if(body.allDay!==undefined&&typeof body.allDay!=='boolean')throw new Fail(400,'Indicá si el trabajo es de día completo.');
  const allDay=body.allDay===true;
  let start='',end='';
  if(!allDay){
    const startMin=minutesOf(body.start);
    if(startMin===null)throw new Fail(400,'La hora de inicio no es válida (HH:MM).');
    start=body.start;
    if(body.end!==undefined&&body.end!==null&&body.end!==''){
      const endMin=minutesOf(body.end);
      if(endMin===null)throw new Fail(400,'La hora de fin no es válida (HH:MM).');
      if(endMin<startMin)throw new Fail(400,'La hora de fin no puede ser anterior al inicio.');
      end=body.end;
    }
  }
  if(!PROJECTS.includes(body.project))throw new Fail(400,'El proyecto no es válido.');
  if(!KINDS.includes(body.kind))throw new Fail(400,'El tipo de trabajo no es válido.');
  if(!STATUSES.includes(body.status))throw new Fail(400,'El estado no es válido.');
  let assignee='';
  if(body.assignee!==undefined&&body.assignee!==null&&body.assignee!==''){
    if(typeof body.assignee!=='string')throw new Fail(400,'El responsable no es válido.');
    const people=await listUsers();
    if(!people.some(u=>u?.active!==false&&String(u.id)===body.assignee))throw new Fail(400,'El responsable no es un usuario activo.');
    assignee=body.assignee;
  }
  let notes='';
  if(body.notes!==undefined&&body.notes!==null){
    if(typeof body.notes!=='string')throw new Fail(400,'Las notas no son válidas.');
    if(body.notes.length>2000)throw new Fail(400,'Las notas pueden tener hasta 2000 caracteres.');
    notes=body.notes;
  }
  return {title,date:body.date,allDay,start,end,project:body.project,kind:body.kind,assignee,status:body.status,notes};
}

async function readBody(req){
  const declared=Number(req.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>MAX_BODY)throw new Fail(413,'La solicitud supera el tamaño permitido.');
  const text=await req.text();
  if(new TextEncoder().encode(text).byteLength>MAX_BODY)throw new Fail(413,'La solicitud supera el tamaño permitido.');
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Fail(400,'JSON inválido.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Fail(400,'Se requiere un objeto JSON.');
  return parsed;
}

export function createCalendar({dataDir,listUsers}){
  const store=diskBucket(path.join(dataDir,'calendar'));

  // Un archivo ausente equivale a un calendario vacío.
  async function load(){
    const found=await store.get(KEY);
    if(!found)return {doc:{version:1,jobs:[]},etag:null};
    const doc=await found.json();
    if(!doc||!Array.isArray(doc.jobs))throw new Error('El documento del calendario no tiene la forma esperada.');
    return {doc,etag:found.etag};
  }
  // Las escrituras de este proceso se encadenan (si no, ráfagas paralelas agotan los reintentos).
  // Dentro de cada una, la escritura condicionada reintenta hasta 5 veces si otro proceso llegó primero.
  let writes=Promise.resolve();
  function mutate(change){
    const run=writes.then(async()=>{
      for(let attempt=0;attempt<5;attempt++){
        const {doc,etag}=await load();
        const result=change(doc);
        const written=await store.put(KEY,JSON.stringify({version:1,jobs:doc.jobs}),
          {onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'}});
        if(written)return result;
      }
      throw new Fail(409,'Otro cambio se guardó al mismo tiempo. Volvé a intentar.');
    });
    writes=run.catch(()=>{});
    return run;
  }

  async function route(req,user){
    const url=new URL(req.url),method=req.method;
    const prefix='/api/calendar/';
    if(!url.pathname.startsWith(prefix))throw new Fail(404,'Ruta no encontrada.');
    const parts=url.pathname.slice(prefix.length).split('/');
    let target;
    if(parts[0]==='jobs'&&parts.length===1)target='collection';
    else if(parts[0]==='jobs'&&parts.length===2&&/^[A-Za-z0-9-]{1,64}$/.test(parts[1]))target='item';
    else if(parts[0]==='people'&&parts.length===1)target='people';
    else throw new Fail(404,'Ruta no encontrada.');

    const allowed={collection:['GET','POST'],item:['PUT','DELETE'],people:['GET']}[target];
    if(!allowed.includes(method))throw new Fail(405,'Método no admitido.');

    const perms=access(user);
    if(!perms.view)throw new Fail(403,'No tenés permiso para el calendario.');
    if(method!=='GET'&&!perms.write)throw new Fail(403,'Tu acceso al calendario es de solo lectura.');

    if(target==='people'){
      const people=(await listUsers()).filter(u=>u?.active!==false).map(u=>({id:String(u.id),name:String(u.name||u.email||'')}));
      return json({people});
    }

    if(target==='collection'&&method==='GET'){
      const from=url.searchParams.get('from')||'';
      const to=url.searchParams.get('to')||'';
      if(from&&!realDate(from))throw new Fail(400,'La fecha desde no es válida.');
      if(to&&!realDate(to))throw new Fail(400,'La fecha hasta no es válida.');
      if(from&&to&&from>to)throw new Fail(400,'El rango de fechas no es válido.');
      const {doc}=await load();
      const jobs=doc.jobs
        .filter(j=>(!from||j.date>=from)&&(!to||j.date<=to))
        .sort(compareJobs)
        .map(publicJob);
      return json({jobs,me:{id:user.id,write:perms.write,admin:perms.admin}});
    }

    if(target==='collection'){
      const body=await readBody(req);
      const fields=await validFields(body,listUsers);
      const now=new Date().toISOString();
      const id=randomUUID();
      const job=await mutate(doc=>{
        if(doc.jobs.length>=MAX_JOBS)throw new Fail(400,'Se alcanzó el máximo de 2000 trabajos.');
        const created={...fields,id,createdBy:user.id,updatedBy:user.id,createdAt:now,updatedAt:now,version:1};
        doc.jobs.push(created);
        return created;
      });
      return json({job:publicJob(job)},201);
    }

    const id=parts[1];
    if(method==='PUT'){
      const body=await readBody(req);
      const version=body.version;
      if(!Number.isInteger(version)||version<1)throw new Fail(400,'Falta la versión del trabajo.');
      const fields=await validFields(body,listUsers);
      const now=new Date().toISOString();
      const job=await mutate(doc=>{
        const index=doc.jobs.findIndex(j=>j.id===id);
        if(index===-1)throw new Fail(404,'No se encontró el trabajo.');
        const current=doc.jobs[index];
        if(current.version!==version)throw new Fail(409,{error:'Otra persona modificó este trabajo. Se cargó la versión actual.',job:publicJob(current)});
        const updated={...fields,id:current.id,createdBy:current.createdBy,createdAt:current.createdAt,
          updatedBy:user.id,updatedAt:now,version:current.version+1};
        doc.jobs[index]=updated;
        return updated;
      });
      return json({job:publicJob(job)});
    }

    // DELETE
    await mutate(doc=>{
      const index=doc.jobs.findIndex(j=>j.id===id);
      if(index===-1)throw new Fail(404,'No se encontró el trabajo.');
      const current=doc.jobs[index];
      if(!(perms.admin||(perms.write&&current.createdBy===user.id)))
        throw new Fail(403,'Solo un administrador o quien creó el trabajo puede borrarlo.');
      doc.jobs.splice(index,1);
      return true;
    });
    return json({deleted:true});
  }

  return async function calendar(req,user){
    try{return await route(req,user);}
    catch(error){
      if(error instanceof Fail)return json(error.body,error.status);
      console.error('Calendario:',String(error?.message??'error desconocido'));
      return json({error:'No se pudo completar la operación.'},500);
    }
  };
}
