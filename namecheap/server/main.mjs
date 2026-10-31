import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {AuthStore,digest,token,publicUser,clientAddress,sessionCookie} from './auth.mjs';
import {diskBucket} from '../scripts/storage.mjs';
import worker from '../dist/server/index.js';
import {publicAPI,adminSiteAPI} from './site.mjs';
import {projectMethodAllowed} from './access.mjs';
import {projectAccess,availableProjects,mergeProjectGrants,renderProjectsPage} from './projects.mjs';
import {createLandurPortal} from './landur.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.resolve(root,process.env.DATA_DIR||'data');
const store=new AuthStore(dataDir),env={NVIDIA_API_KEY:process.env.NVIDIA_API_KEY||'',NVIDIA_MODEL:process.env.NVIDIA_MODEL||'deepseek-ai/deepseek-v4.1-flash',TAVILY_API_KEY:process.env.TAVILY_API_KEY||'',GROQ_API_KEY:process.env.GROQ_API_KEY||'',GROQ_MODEL:process.env.GROQ_MODEL||'openai/gpt-oss-120b',BUCKET:diskBucket(path.join(dataDir,'pulso')),GEMINI_API_KEY:process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||'',GEMINI_MODEL:process.env.GEMINI_MODEL||'gemini-3.8-flash'};
const siteStore=new AuthStore(dataDir,'site-store.json');
const local=process.env.RIVECT_LOCAL==='1';
const origin=local?'http://localhost:4180':'https://rivect.net';
const html=async name=>new Response(await readFile(path.join(root,'public',name)),{headers:{'Content-Type':'text/html; charset=utf-8'}});
const json=(data,status=200)=>Response.json(data,{status});
const redirect=to=>new Response(null,{status:303,headers:{Location:to}});
// LANDUR comparte el almacén de identidad del portal (las mismas credenciales), pero no la
// sesión del ecosistema: su pantalla de acceso escribe y revoca la misma galleta.
const landur=createLandurPortal({dataDir:path.join(dataDir,'landur'),session:{
 login:(email,password,ip)=>store.login(email,password,ip),
 cookie:value=>sessionCookie(value,{secure:!local}),
 cleared:()=>sessionCookie('',{secure:!local,maxAge:0}),
 reauth:(id,password)=>store.reauth(id,password),
 logout:csrf=>store.transact(db=>{db.sessions=db.sessions.filter(s=>s.csrf!==csrf)})
}});
async function route(req,ip){
 const url=new URL(req.url),p=url.pathname,method=req.method;
 if(!['GET','HEAD'].includes(method)&&req.headers.get('origin')!==origin)return json({error:'Origen no admitido.'},403);
 if(['/projects.css','/projects.mjs','/projects-brand.svg','/landur-brand.png','/portal.css','/portal.mjs','/logo.svg','/symbol.svg','/landing.css','/landing.mjs','/manrope.woff2','/wordmark.svg'].includes(p)){if(method!=='GET')return json({error:'Método no admitido'},405);const type=p.endsWith('.woff2')?'font/woff2':p.endsWith('.css')?'text/css':p.endsWith('.mjs')?'text/javascript':p.endsWith('.png')?'image/png':'image/svg+xml';return new Response(await readFile(path.join(root,'public',p.slice(1))),{headers:{'Content-Type':type+(p.endsWith('.woff2')?'':'; charset=utf-8')}})}
 const u=await store.session(req.headers.get('cookie'));
 if(p.startsWith('/api/public/'))return publicAPI(req,{user:u,store:siteStore,ip});
 if(p==='/'&&method==='GET')return html('index.html');
 if(['/login','/activate'].includes(p)&&method==='GET')return html('account.html');
 if(p==='/auth/login'&&method==='POST'){const b=await req.json(),r=await store.login(b.email,b.password,ip);if(r.error)return json({error:r.error},r.status);return new Response(JSON.stringify({user:r.user,csrf:r.csrf}),{headers:{'Content-Type':'application/json','Set-Cookie':sessionCookie(r.value,{secure:!local})}})}
 if(p==='/auth/activate'&&method==='POST'){const b=await req.json();try{const r=await store.redeem(b.token,b.name,b.password);return json(r,r.status||200)}catch(e){return json({error:e.message},400)}}
 // LANDUR atiende su propio montaje antes del portón de sesión: quien llega a /landur sin
 // cuenta ve el acceso del proyecto, no el login ni el selector de RIVECT.
 if(p==='/landur'||p.startsWith('/landur/'))return landur(req,u,ip);
 if(!u){if(p.startsWith('/api/')||p.startsWith('/auth/'))return json({error:'Iniciá sesión para continuar.'},401);return redirect('/login')}
 if(!['GET','HEAD'].includes(method)&&req.headers.get('x-csrf-token')!==u.csrf)return json({error:'Sesión no válida. Volvé a iniciar sesión.'},403);
 if(p==='/auth/me'&&method==='GET')return json({user:publicUser(u),csrf:u.csrf});
 if(p==='/auth/logout'&&method==='POST'){await store.transact(db=>{db.sessions=db.sessions.filter(s=>s.csrf!==u.csrf)});return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':sessionCookie('',{secure:!local,maxAge:0})}})}
 if(p==='/portal'&&method==='GET'){
  // Con un solo proyecto habilitado no hay nada que elegir: se entra directo y no se ofrece
  // un selector que solo llevaría a un único destino.
  const available=availableProjects(u);
  if(available.length===1)return redirect(available[0].url);
  return new Response(renderProjectsPage(u),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 if(p==='/api/projects'&&method==='GET')return json({projects:availableProjects(u)});
 if(p==='/index.html'&&method==='GET')return redirect('/portal');
 if(p==='/admin'&&method==='GET')return u.role==='admin'?html('admin.html'):json({error:'Sólo administradores.'},403);
 if(p.startsWith('/api/admin/')){
  if(u.role!=='admin')return json({error:'Sólo administradores.'},403);
  if(['/api/admin/settings','/api/admin/inquiries'].includes(p))return adminSiteAPI(req,{store:siteStore});
  if(p==='/api/admin/project-access'&&method==='PUT'){
   const b=await req.json();
   return store.transact(db=>{
    const target=db.users.find(x=>x.id===b.id);if(!target)return json({error:'Usuario no encontrado.'},404);
    if(target.role==='admin')return json({error:'Los administradores tienen acceso a todos los proyectos. Cambiá su rol desde Administración si corresponde.'},400);
    if(!Object.hasOwn(b,'projects'))return json({error:'Indicá los permisos del proyecto.'},400);
    let projects;try{projects=mergeProjectGrants(target.projects,{projects:b.projects})}catch(e){return json({error:e.message},400)}
    target.projects=projects;db.sessions=db.sessions.filter(s=>s.userId!==target.id);
    return json({saved:true,projects});
   });
  }
  if(p==='/api/admin/users'&&method==='GET')return store.transact(db=>json({users:db.users.map(publicUser)}));
  if(p==='/api/admin/invite'&&method==='POST'){const b=await req.json(),email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:'Correo no válido.'},400);let projects;try{projects=mergeProjectGrants({},b)}catch(e){return json({error:e.message},400)}const value=token();return store.transact(db=>{if(db.users.some(x=>x.email===email))return json({error:'El correo ya existe. Editá sus permisos en la lista.'},409);db.invites=db.invites.filter(i=>i.expires>Date.now()&&!i.used&&i.email!==email);db.invites.push({hash:digest(value),email,role:b.role==='admin'?'admin':'member',createdBy:u.id,projects,expires:Date.now()+172800000});return json({url:origin+'/activate#'+value,expires:'48 horas'})})}
  if(p==='/api/admin/users'&&method==='PUT'){const b=await req.json();return store.transact(db=>{const target=db.users.find(x=>x.id===b.id);if(!target)return json({error:'Usuario no encontrado.'},404);if(b.role!==undefined&&!['admin','member'].includes(b.role))return json({error:'Rol no válido.'},400);if(b.active!==undefined&&typeof b.active!=='boolean')return json({error:'Estado no válido.'},400);let projects;try{projects=mergeProjectGrants(target.projects,b)}catch(e){return json({error:e.message},400)}const nextRole=b.role??target.role,nextActive=b.active??target.active;if(target.role==='admin'&&target.active&&(!nextActive||nextRole!=='admin')&&!db.users.some(x=>x.id!==target.id&&x.role==='admin'&&x.active))return json({error:'Debe quedar al menos un administrador activo.'},400);target.role=nextRole;target.active=nextActive;target.projects=projects;db.sessions=db.sessions.filter(s=>s.userId!==target.id);if(!target.active||target.role!=='admin')db.invites=db.invites.filter(i=>i.createdBy!==target.id||i.used);return json({saved:true,selfChanged:target.id===u.id})})}
  return json({error:'Ruta no encontrada.'},404)
 }
 const access=projectAccess(u);if(!access)return json({error:'No tenés permiso para este proyecto.'},403);
 if(!projectMethodAllowed(access,p,method))return json({error:'Tu acceso a Pulso es de sólo lectura.'},403);
 if(p==='/pulso'&&method==='GET'){
  let page=await readFile(path.join(root,'src/index.html'),'utf8');
  page=page.replace('<head>','<head><script src="/auth/pulso-session.js"></script>');
  return new Response(page,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'self'; script-src 'self' 'nonce-${u.csrf}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://generativelanguage.googleapis.com; frame-src 'self' blob: data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`}})
 }
 if(p==='/auth/pulso-session.js'&&method==='GET')return new Response('window.RIVECT='+JSON.stringify({id:u.id,csrf:u.csrf,access})+';\n'+await readFile(path.join(root,'public/pulso-session.js'),'utf8'),{headers:{'Content-Type':'text/javascript'}});
 // Only explicit Worker assets and routes are served; source, configuration and data never become static files.
 const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');headers.set('oai-authenticated-user-id','project-pulso');
 return worker.fetch(new Request(req.url,{method,headers,...(!['GET','HEAD'].includes(method)?{body:await req.arrayBuffer()}:{})}),env,{waitUntil:p=>p.catch(()=>{})});
}
// Lee el cuerpo con un tope. Al pasarse del límite se sigue drenando hasta un techo en vez
// de cortar el socket: si se responde 413 en mitad de la subida, el cliente no llega a leer
// la respuesta y el error se ve como «fetch failed» (Node 22 lo hace; Node 24 lo tapaba).
const BODY_LIMIT=3300000,BODY_DRAIN=16000000;
export async function readBody(req){
 const chunks=[];let size=0,over=false;
 try{
  for await(const chunk of req){
   size+=chunk.length;
   if(size>BODY_LIMIT){over=true;if(size>BODY_DRAIN){req.destroy();return {aborted:true,over:true}}continue}
   chunks.push(chunk);
  }
 }catch{return {aborted:true,over:size>BODY_LIMIT}}
 return over?{over:true}:{body:Buffer.concat(chunks)};
}
export function createServer(){return http.createServer(async(req,res)=>{try{
 if(!local&&!['rivect.net','www.rivect.net'].includes((req.headers.host||'').split(':')[0])){res.writeHead(400);res.end('Host no admitido');return}
 if(!local&&req.headers['x-forwarded-proto']==='http'){res.writeHead(308,{Location:'https://rivect.net'+req.url});res.end();return}
 const read=await readBody(req);
 if(read.aborted){if(!res.destroyed&&!res.writableEnded){res.writeHead(400,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'La solicitud se interrumpió antes de completarse.'}))}return}
 if(read.over){res.writeHead(413,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});res.end(JSON.stringify({error:'La solicitud supera el tamaño permitido.'}));return}
 const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
 const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:read.body}:{})});  const r=await route(request,clientAddress({peer:req.socket.remoteAddress,forwarded:req.headers['x-forwarded-for']}));
 const secure={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://generativelanguage.googleapis.com; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};if(!local)secure['Strict-Transport-Security']='max-age=31536000';
 res.writeHead(r.status,{...secure,...Object.fromEntries(r.headers)});res.end(req.method==='HEAD'?undefined:Buffer.from(await r.arrayBuffer()));
 }catch(e){console.error('Request failed:',e.message);res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'No se pudo completar la operación.'}))}}).on('close',()=>landur.close())}
if(process.env.RIVECT_TEST!=='1')createServer().listen(process.env.PORT||4180,()=>console.log('RIVECT portal listo'));
