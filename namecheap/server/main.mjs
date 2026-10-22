import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {AuthStore,digest,token,publicUser} from './auth.mjs';
import {diskBucket} from '../scripts/storage.mjs';
import worker from '../dist/server/index.js';
import {publicAPI,adminSiteAPI} from './site.mjs';
import {projectMethodAllowed} from './access.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.resolve(root,process.env.DATA_DIR||'data');
const store=new AuthStore(dataDir),env={GROQ_API_KEY:process.env.GROQ_API_KEY||'',GROQ_MODEL:process.env.GROQ_MODEL||'openai/gpt-oss-120b',BUCKET:diskBucket(path.join(dataDir,'pulso')),GEMINI_API_KEY:process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||'',GEMINI_MODEL:process.env.GEMINI_MODEL||'gemini-3.8-flash'};
const siteStore=new AuthStore(dataDir,'site-store.json');
const local=process.env.RIVECT_LOCAL==='1';
const origin=local?'http://localhost:4180':'https://rivect.net';
const html=async name=>new Response(await readFile(path.join(root,'public',name)),{headers:{'Content-Type':'text/html; charset=utf-8'}});
const json=(data,status=200)=>Response.json(data,{status});
const redirect=to=>new Response(null,{status:303,headers:{Location:to}});
function projectAccess(u){return u?.role==='admin'?'editor':u?.projects?.pulso||null}
async function route(req,ip){
 const url=new URL(req.url),p=url.pathname,method=req.method;
 if(!['GET','HEAD'].includes(method)&&req.headers.get('origin')!==origin)return json({error:'Origen no admitido.'},403);
 if(['/portal.css','/portal.mjs','/logo.svg','/symbol.svg','/landing.css','/landing.mjs','/manrope.woff2','/wordmark.svg'].includes(p)){if(method!=='GET')return json({error:'Método no admitido'},405);const type=p.endsWith('.woff2')?'font/woff2':p.endsWith('.css')?'text/css':p.endsWith('.mjs')?'text/javascript':'image/svg+xml';return new Response(await readFile(path.join(root,'public',p.slice(1))),{headers:{'Content-Type':type+(p.endsWith('.woff2')?'':'; charset=utf-8')}})}
 const u=await store.session(req.headers.get('cookie'));
 if(p.startsWith('/api/public/'))return publicAPI(req,{user:u,store:siteStore,ip});
 if(p==='/'&&method==='GET')return html('index.html');
 if(['/login','/activate'].includes(p)&&method==='GET')return html('account.html');
 if(p==='/auth/login'&&method==='POST'){const b=await req.json(),r=await store.login(b.email,b.password,ip);if(r.error)return json({error:r.error},r.status);return new Response(JSON.stringify({user:r.user,csrf:r.csrf}),{headers:{'Content-Type':'application/json','Set-Cookie':`rivect_session=${r.value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${local?'':'; Secure'}`}})}
 if(p==='/auth/activate'&&method==='POST'){const b=await req.json();try{const r=await store.redeem(b.token,b.name,b.password);return json(r,r.status||200)}catch(e){return json({error:e.message},400)}}
 if(!u){if(p.startsWith('/api/')||p.startsWith('/auth/'))return json({error:'Iniciá sesión para continuar.'},401);return redirect('/login')}
 if(!['GET','HEAD'].includes(method)&&req.headers.get('x-csrf-token')!==u.csrf)return json({error:'Sesión no válida. Volvé a iniciar sesión.'},403);
 if(p==='/auth/me'&&method==='GET')return json({user:publicUser(u),csrf:u.csrf});
 if(p==='/auth/logout'&&method==='POST'){await store.transact(db=>{db.sessions=db.sessions.filter(s=>s.csrf!==u.csrf)});return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':`rivect_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${local?'':'; Secure'}`}})}
 if(p==='/portal'&&method==='GET')return html('portal.html');
 if(p==='/index.html'&&method==='GET')return redirect('/pulso');
 if(p==='/admin'&&method==='GET')return u.role==='admin'?html('admin.html'):json({error:'Sólo administradores.'},403);
 if(p.startsWith('/api/admin/')){
  if(u.role!=='admin')return json({error:'Sólo administradores.'},403);
  if(['/api/admin/settings','/api/admin/inquiries'].includes(p))return adminSiteAPI(req,{store:siteStore});
  if(p==='/api/admin/users'&&method==='GET')return store.transact(db=>json({users:db.users.map(publicUser)}));
  if(p==='/api/admin/invite'&&method==='POST'){const b=await req.json(),email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:'Correo no válido.'},400);const access=['viewer','editor'].includes(b.access)?b.access:null;const value=token();return store.transact(db=>{if(db.users.some(x=>x.email===email))return json({error:'El correo ya existe. Editá sus permisos en la lista.'},409);db.invites=db.invites.filter(i=>i.expires>Date.now()&&!i.used&&i.email!==email);db.invites.push({hash:digest(value),email,role:b.role==='admin'?'admin':'member',createdBy:u.id,projects:access?{pulso:access}:{},expires:Date.now()+172800000});return json({url:origin+'/activate#'+value,expires:'48 horas'})})}
  if(p==='/api/admin/users'&&method==='PUT'){const b=await req.json();return store.transact(db=>{const target=db.users.find(x=>x.id===b.id);if(!target)return json({error:'Usuario no encontrado.'},404);if(b.role!==undefined&&!['admin','member'].includes(b.role))return json({error:'Rol no válido.'},400);const nextRole=b.role??target.role,nextActive=b.active===true;if(target.role==='admin'&&target.active&&(!nextActive||nextRole!=='admin')&&!db.users.some(x=>x.id!==target.id&&x.role==='admin'&&x.active))return json({error:'Debe quedar al menos un administrador activo.'},400);target.role=nextRole;target.active=nextActive;target.projects=['viewer','editor'].includes(b.access)?{pulso:b.access}:{};db.sessions=db.sessions.filter(s=>s.userId!==target.id);if(!target.active||target.role!=='admin')db.invites=db.invites.filter(i=>i.createdBy!==target.id||i.used);return json({saved:true,selfChanged:target.id===u.id})})}
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
export function createServer(){return http.createServer(async(req,res)=>{try{
 if(!local&&!['rivect.net','www.rivect.net'].includes((req.headers.host||'').split(':')[0])){res.writeHead(400);res.end('Host no admitido');return}
 if(!local&&req.headers['x-forwarded-proto']==='http'){res.writeHead(308,{Location:'https://rivect.net'+req.url});res.end();return}
 const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>3300000){res.writeHead(413);res.end('Solicitud demasiado grande');return}chunks.push(c)}
 const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
 const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
 const r=await route(request,req.socket.remoteAddress);
 const secure={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://generativelanguage.googleapis.com; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};if(!local)secure['Strict-Transport-Security']='max-age=31536000';
 res.writeHead(r.status,{...secure,...Object.fromEntries(r.headers)});res.end(req.method==='HEAD'?undefined:Buffer.from(await r.arrayBuffer()));
 }catch(e){console.error('Request failed:',e.message);res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'No se pudo completar la operación.'}))}})}
if(process.env.RIVECT_TEST!=='1')createServer().listen(process.env.PORT||4180,()=>console.log('RIVECT portal listo'));
