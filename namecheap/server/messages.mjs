// Mensajes internos entre administradores. Quien llega acá ya pasó el control de rol admin
// y de CSRF en main.mjs. Los textos se guardan tal cual y el cliente los pinta con textContent.
import {randomUUID} from 'node:crypto';

const MAX_BODY=2000, KEEP=500, LIST=100, PER_MINUTE=20;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const visibleTo=(m,userId)=>m.to==='all'||m.to===userId||m.from===userId;

function present(m,userId,names){
  return {
    id:m.id,
    from:m.from,
    fromName:names.get(m.from)??'Administrador eliminado',
    to:m.to,
    toName:m.to==='all'?'Todos los administradores':(names.get(m.to)??'Administrador eliminado'),
    body:m.body,
    createdAt:m.createdAt,
    mine:m.from===userId,
    read:m.from===userId||m.readBy.includes(userId),
  };
}

async function readJson(req){
  try{const body=await req.json();return body&&typeof body==='object'&&!Array.isArray(body)?body:null;}
  catch{return null;}
}

export async function adminMessagesAPI(req,{store,user,path,method}){
  if(path==='/api/admin/messages'&&method==='GET'){
    return store.transact(db=>{
      const names=new Map(db.users.map(u=>[u.id,u.name]));
      const mine=(db.messages||[]).filter(m=>visibleTo(m,user.id));
      const messages=mine.slice(-LIST).reverse().map(m=>present(m,user.id,names));
      const admins=db.users.filter(u=>u.role==='admin'&&u.active&&u.id!==user.id).map(u=>({id:u.id,name:u.name}));
      return json({messages,unread:mine.filter(m=>!(m.from===user.id||m.readBy.includes(user.id))).length,admins});
    });
  }
  if(path==='/api/admin/messages'&&method==='POST'){
    const b=await readJson(req);
    if(!b)return json({error:'Solicitud no válida.'},400);
    const body=String(b.body??'').trim();
    if(!body)return json({error:'Escribí un mensaje.'},400);
    if(body.length>MAX_BODY)return json({error:`El mensaje supera los ${MAX_BODY} caracteres.`},400);
    const to=String(b.to??'');
    return store.transact(db=>{
      if(to!=='all'){
        const target=db.users.find(u=>u.id===to);
        if(!target||target.role!=='admin'||!target.active||target.id===user.id)return json({error:'Elegí un administrador activo como destinatario.'},400);
      }
      db.messages||=[];
      const now=Date.now();
      if(db.messages.filter(m=>m.from===user.id&&now-m.createdAt<60000).length>=PER_MINUTE)
        return json({error:'Enviaste muchos mensajes seguidos. Esperá un minuto.'},429);
      const message={id:randomUUID(),from:user.id,to,body,createdAt:now,readBy:[]};
      db.messages.push(message);
      if(db.messages.length>KEEP)db.messages=db.messages.slice(-KEEP);
      const names=new Map(db.users.map(u=>[u.id,u.name]));
      return json({message:present(message,user.id,names)},201);
    });
  }
  if(path==='/api/admin/messages/read'&&method==='POST'){
    const b=await readJson(req);
    if(!b)return json({error:'Solicitud no válida.'},400);
    const ids=b.all===true?null:Array.isArray(b.ids)?new Set(b.ids.slice(0,LIST).map(String)):undefined;
    if(ids===undefined)return json({error:'Indicá qué mensajes marcar.'},400);
    return store.transact(db=>{
      let marked=0;
      for(const m of db.messages||[]){
        if(!visibleTo(m,user.id)||m.from===user.id||m.readBy.includes(user.id))continue;
        if(ids&&!ids.has(m.id))continue;
        m.readBy.push(user.id);marked++;
      }
      return json({marked});
    });
  }
  return null;
}
