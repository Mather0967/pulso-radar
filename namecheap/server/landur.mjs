import { readFile, mkdir, chmod } from 'node:fs/promises';
import { resolve, relative, sep, isAbsolute, dirname, basename } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projectAccess } from './projects.mjs';

const publicAssets = new Map([
  ['/', ['index.html','text/html; charset=utf-8']], ['/index.html',['index.html','text/html; charset=utf-8']],
  ['/app.js',['app.js','text/javascript; charset=utf-8']], ['/voice.mjs',['voice.mjs','text/javascript; charset=utf-8']],
  ['/styles.css',['styles.css','text/css; charset=utf-8']],
  ['/sw.js',['sw.js','text/javascript; charset=utf-8']], ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json']],
  ['/wordmark.png',['wordmark.png','image/png']],
  ['/icon-192.png',['icon-192.png','image/png']], ['/icon-512.png',['icon-512.png','image/png']],
  ['/icon-maskable-512.png',['icon-maskable-512.png','image/png']], ['/apple-touch-icon.png',['apple-touch-icon.png','image/png']]
]);
// Recursos que la pantalla de acceso necesita antes de tener sesión. Son la marca, no datos:
// sin ellos el ingreso mostraría un logo roto.
const publicBrand = new Set(['/wordmark.png','/icon-192.png','/icon-512.png','/apple-touch-icon.png']);
// Rutas de API que el portal debe servir. `tests/landur-assets.test.mjs` las compara con las
// del servidor autónomo y con los endpoint que llama `public/app.js`: una superficie que se
// queda atrás deja la aplicación rota en producción sin que ninguna prueba lo note.
// El acceso (`/landur/login`, `/landur/api/login`, `/landur/api/logout`) es propio de este
// módulo y no se comparte con el servidor autónomo, que usa una contraseña única local.
export const portalApiRoutes=['GET /api/session','GET /api/state','GET /api/export.csv','GET /api/evidence/*',
  'POST /api/commands','POST /api/import/preview','POST /api/import/commit','POST /api/evidence'];
export const landurLoginPath='/landur/login';
const actualPath=path=>existsSync(path)?realpathSync(path):resolve(actualPath(dirname(path)),basename(path));
const within=(parent,child)=>{const rel=relative(parent,child);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`));};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const redirect=(to,headers={})=>new Response(null,{status:303,headers:{Location:to,...headers}});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Pantalla de acceso. Se sirve desde el propio LANDUR para que quien entra por /landur no
// vea el selector de proyectos ni el ecosistema RIVECT: mismas credenciales, otro lugar.
// Sin JavaScript a propósito: es un formulario HTML normal, y la política de contenidos del
// portal no permite scripts en línea.
const authStyles=`
:root{font-family:ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",Roboto,sans-serif;color:#1b2a25;background:#f5f7f6;font-synthesis:none}
*{box-sizing:border-box}body{margin:0;-webkit-font-smoothing:antialiased}
.acceso{min-height:100dvh;display:grid;grid-template-columns:1fr 1fr}
.marca{padding:54px 50px;background:#242253;color:#e6efda;display:flex;flex-direction:column;justify-content:space-between;gap:44px}
.marca .logo{display:block;width:min(320px,100%);height:auto}
.marca h1{font-size:clamp(32px,3.2vw,50px);font-weight:600;letter-spacing:-.03em;line-height:1.08;margin:0;text-wrap:balance}
.marca p{max-width:36ch;color:#b9ccc4;font-size:14px;line-height:1.75;margin:20px 0 0}
.marca footer{font-size:11px;letter-spacing:.14em;color:#93aaa1;text-transform:uppercase}
.panel{display:flex;align-items:center;justify-content:center;padding:36px 28px}
.tarjeta{width:100%;max-width:384px}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;color:#7d8b84;margin:0 0 14px;text-transform:uppercase}
h2{font-size:27px;font-weight:600;letter-spacing:-.02em;margin:0 0 10px}
.bajada{font-size:13px;line-height:1.7;color:#56655f;margin:0 0 24px}
.campo{display:flex;flex-direction:column;gap:8px;font-size:12px;font-weight:600;margin-bottom:16px}
.campo input{width:100%;min-height:48px;padding:12px 14px;font:inherit;font-size:16px;font-weight:400;color:#1b2a25;background:#fff;border:1px solid #dbe2de;border-radius:12px}
.campo input:focus{border-color:#2b8a6b;box-shadow:0 0 0 3px #e3f5ee;outline:none}
button{width:100%;min-height:48px;border:0;border-radius:12px;background:#242253;color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px}
button:hover{background:#2c2a61}
button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #5fd9ae;outline-offset:3px}
.error{margin:0 0 18px;padding:11px 13px;border-radius:10px;background:#fbeceb;color:#94382d;font-size:12px;line-height:1.6}
.aviso{margin:0 0 20px;padding:12px 14px;border-radius:10px;background:#eef4f1;color:#3c5a4e;font-size:12px;line-height:1.7}
.nota{margin:20px 0 0;font-size:11px;line-height:1.65;color:#7d8b84}
.texto{background:none;color:#47685a;font-size:12px;font-weight:600;text-decoration:underline;text-underline-offset:3px;margin-top:18px;padding:8px 0;min-height:36px}
@media(max-width:820px){.acceso{grid-template-columns:1fr}.marca{padding:32px 24px 26px;gap:18px}.marca h1{font-size:29px;margin-top:14px}.marca p{display:none}.marca footer{display:none}.panel{padding:28px 22px 44px;align-items:flex-start}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
function shell(title,body){
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#242253"><meta name="robots" content="noindex,nofollow"><title>${escape(title)}</title><link rel="icon" href="/landur/icon-192.png" sizes="192x192" type="image/png"><link rel="apple-touch-icon" href="/landur/apple-touch-icon.png"><style>${authStyles}</style></head><body><div class="acceso"><section class="marca"><img class="logo" src="/landur/wordmark.png" alt="landur®" width="320" height="90"><div><h1>Control financiero<br>del negocio.</h1><p>Saldos, cobros y compromisos en un solo registro. Cada cifra conserva su origen y su fecha.</p></div><footer>Acceso privado</footer></section><main class="panel" id="main">${body}</main></div></body></html>`;
}
const loginErrors={credenciales:'El correo o la contraseña no son correctos.',limite:'Demasiados intentos seguidos. Esperá 15 minutos y volvé a probar.'};
function loginPage(error){
  const message=loginErrors[error];
  return shell('Acceso · LANDUR',`<form class="tarjeta" method="post" action="${landurLoginPath.replace(/\/login$/,'/api/login')}"><p class="eyebrow">Acceso privado</p><h2>Ingresá a LANDUR</h2><p class="bajada">Usá el correo y la contraseña de tu cuenta.</p>${message?`<p class="error" role="alert">${escape(message)}</p>`:''}<label class="campo">Correo<input type="email" name="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required maxlength="254"></label><label class="campo">Contraseña<input type="password" name="password" autocomplete="current-password" required maxlength="200"></label><button type="submit">Ingresar</button><p class="nota">Conexión necesaria para consultar y guardar. No se guarda una copia financiera offline en el navegador.</p></form>`);
}
function deniedPage(user){
  const name=escape((user?.name||'').trim()||user?.email||'');
  return shell('Sin acceso · LANDUR',`<div class="tarjeta"><p class="eyebrow">Acceso privado</p><h2>LANDUR no está habilitado</h2><p class="aviso">La cuenta${name?` de ${name}`:''} está activa, pero no tiene permiso sobre LANDUR. Pedile a un administrador que habilite el acceso al proyecto.</p><form method="post" action="/landur/api/logout"><input type="hidden" name="csrf" value="${escape(user?.csrf||'')}"><button type="submit">Cerrar sesión</button></form></div>`);
}
async function readPayload(req,{form,limit}){
  if(!form&&!(req.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return {error:json({error:'La solicitud debe ser un formulario o JSON.'},415)};
  const bytes=new Uint8Array(await req.arrayBuffer());
  if(bytes.length>limit)return {error:json({error:'La solicitud supera el tamaño permitido.'},413)};
  const text=new TextDecoder().decode(bytes);
  if(form)return {form:new URLSearchParams(text)};
  try{return {json:JSON.parse(text)};}
  catch{return {error:json({error:'JSON inválido.'},400)};}
}
export function createLandurPortal({dataDir,projectRoot=fileURLToPath(new URL('../projects/landur/',import.meta.url)),session}) {
  let initialized,ledger;
  const root=resolve(projectRoot);
  async function engine() {
    if(!initialized)initialized=(async()=>{
      const directory=actualPath(resolve(dataDir));
      const portalPublic=actualPath(resolve(root,'../../public'));
      if(directory.split(sep).some(part=>['public_html','www'].includes(part))||within(actualPath(resolve(root,'public')),directory)||within(portalPublic,directory))
        throw Error('LANDUR requiere almacenamiento privado.');
      // Lazy loading isolates Pulso from SQLite compatibility failures in LANDUR.
      const {Ledger}=await import(pathToFileURL(resolve(root,'server/ledger.mjs')));
      const {exportOperations}=await import(pathToFileURL(resolve(root,'server/csv.mjs')));
      const {createRateLimiter}=await import(pathToFileURL(resolve(root,'server/limits.mjs')));
      await mkdir(directory,{recursive:true,mode:0o700});
      const filename=resolve(directory,'landur.sqlite');
      ledger=new Ledger(filename);await chmod(filename,0o600);ledger.workspace('landur');
      return {ledger,exportOperations,limiter:createRateLimiter({limit:30,windowMs:60*1000})};
    })().catch(error=>{ledger?.close();ledger=undefined;initialized=undefined;throw error;});
    return initialized;
  }
  async function handler(req,user,ip) {
    const url=new URL(req.url),method=req.method;
    // Ninguna escritura sin el origen correcto, ni siquiera el ingreso: un formulario de otro
    // sitio no debe poder iniciar sesión en nombre de un visitante.
    if(!['GET','HEAD'].includes(method)&&req.headers.get('origin')!==url.origin)return json({error:'Origen no admitido.'},403);
    if(url.pathname==='/landur')return redirect('/landur/');
    if(!url.pathname.startsWith('/landur/'))return json({error:'Ruta no encontrada.'},404);
    const path=url.pathname.slice('/landur'.length);
    const access=user?projectAccess(user,'landur'):null;
    const wantsHtml=['/','/index.html'].includes(path);

    // Acceso propio: la portada y su formulario funcionan sin sesión.
    if(path==='/login'||path==='/login/'){
      if(method!=='GET'&&method!=='HEAD')return json({error:'Método no admitido.'},405);
      if(access)return redirect('/landur/');
      if(user)return new Response(deniedPage(user),{status:403,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      return new Response(loginPage(url.searchParams.get('e')),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    }
    if(['GET','HEAD'].includes(method)&&publicBrand.has(path)){
      const [file,type]=publicAssets.get(path);
      try{
        const bytes=await readFile(resolve(root,'public',file));
        return new Response(method==='HEAD'?null:bytes,{headers:{'Content-Type':type,'Cache-Control':'no-store'}});
      }catch{return json({error:'Los recursos de LANDUR no están instalados. Revisá el despliegue.'},503);}
    }
    if(path==='/api/login'&&method==='POST'){
      if(access)return redirect('/landur/');
      if(!session)return json({error:'El acceso a LANDUR no está configurado en este servidor.'},503);
      const form=(req.headers.get('content-type')||'').toLowerCase().startsWith('application/x-www-form-urlencoded');
      const payload=await readPayload(req,{form,limit:4096});
      if(payload.error)return payload.error;
      const email=form?payload.form.get('email'):payload.json?.email;
      const password=form?payload.form.get('password'):payload.json?.password;
      const valid=typeof email==='string'&&typeof password==='string'&&email.trim()&&password.length>0&&email.length<=254&&password.length<=200;
      // La respuesta no distingue correo inexistente de contraseña mala, y el límite de
      // intentos es el mismo del portal porque comparten el almacén de identidad.
      const result=valid?await session.login(email,password,ip):{error:'Correo o contraseña incorrectos.',status:401};
      if(result.error){
        if(!form)return json({error:result.error},result.status);
        return redirect(`${landurLoginPath}?e=${result.status===429?'limite':'credenciales'}`);
      }
      const cookie=session.cookie(result.value);
      if(!form)return new Response(JSON.stringify({ok:true,user:result.user}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie}});
      return redirect('/landur/',{'Set-Cookie':cookie});
    }
    if(path==='/api/logout'&&method==='POST'){
      if(!user)return json({error:'No hay una sesión activa.'},401);
      const form=(req.headers.get('content-type')||'').toLowerCase().startsWith('application/x-www-form-urlencoded');
      const payload=await readPayload(req,{form,limit:4096});
      if(payload.error)return payload.error;
      const token=req.headers.get('x-csrf-token')||(form?payload.form.get('csrf'):payload.json?.csrf)||'';
      if(!user.csrf||token!==user.csrf)return json({error:'Sesión no válida. Volvé a iniciar sesión.'},403);
      if(session)await session.logout(user.csrf);
      const cleared=session?{'Set-Cookie':session.cleared()}:{};
      if(form)return redirect(landurLoginPath,cleared);
      return new Response('{}',{headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cleared}});
    }

    // Todo lo demás exige sesión. Sin ella se va a la pantalla de acceso del propio LANDUR,
    // nunca al login ni al selector de proyectos del ecosistema.
    if(!user){
      if(['GET','HEAD'].includes(method)&&wantsHtml)return redirect(landurLoginPath);
      return json({error:'Iniciá sesión para continuar.'},401);
    }
    if(!access){
      if(['GET','HEAD'].includes(method)&&wantsHtml)return new Response(deniedPage(user),{status:403,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      return json({error:'No tenés permiso para el proyecto LANDUR.'},403);
    }
    if(!['GET','HEAD'].includes(method)){
      if(access!=='editor')return json({error:'Tu acceso a LANDUR es de solo lectura.'},403);
      if(!user.csrf||req.headers.get('x-csrf-token')!==user.csrf)return json({error:'Origen o sesión no válidos.'},403);
    }
    if(method==='GET'&&path==='/api/session')return json({authenticated:true,demo:false,portal:true,actor:user.name,access,csrf:user.csrf});
    const asset=publicAssets.get(path);
    if(asset&&['GET','HEAD'].includes(method)){
      try{
        let bytes=await readFile(resolve(root,'public',asset[0]));
        if(asset[0]==='index.html')bytes=Buffer.from(bytes.toString().replace('<html lang="es">','<html lang="es" data-portal="true">'));
        return new Response(method==='HEAD'?null:bytes,{headers:{'Content-Type':asset[1],'Cache-Control':'no-store',...(path==='/sw.js'?{'Service-Worker-Allowed':'/landur/'}:{})}});
      }catch{return json({error:'Los recursos de LANDUR no están instalados. Revisá el despliegue.'},503);}
    }
    // El identificador del comprobante tiene que tener forma de UUID: nada de rutas armadas por el cliente.
    const evidenceId=/^\/api\/evidence\/[A-Za-z0-9-]{1,64}$/.test(path)?path.slice('/api/evidence/'.length):null;
    if(evidenceId===null&&!['/api/state','/api/export.csv','/api/commands','/api/import/preview','/api/import/commit','/api/evidence'].includes(path))return json({error:'Ruta no encontrada.'},404);
    try{
      if(method==='GET'&&(evidenceId!==null||['/api/state','/api/export.csv'].includes(path))){
        const {ledger,exportOperations}=await engine();const snapshot=ledger.snapshot('landur');
        if(evidenceId!==null){
          const file=ledger.evidenceFile('landur',evidenceId);
          return new Response(file.content,{headers:{'Content-Type':file.mime,'Cache-Control':'no-store','Content-Length':String(file.content.length),'Content-Disposition':`${file.mime==='application/pdf'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`}});
        }
        if(path==='/api/export.csv')return new Response(exportOperations(snapshot),{headers:{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store','Content-Disposition':'attachment; filename="landur-operaciones.csv"'}});
        return json({...snapshot,demo:false,portal:true,actor:user.name,access});
      }
      if(method==='POST'&&['/api/commands','/api/import/preview','/api/import/commit','/api/evidence'].includes(path)){
        if(!req.headers.get('content-type')?.startsWith('application/json')||req.headers.get('x-landur-request')!=='1')return json({error:'Se requiere una solicitud JSON de la aplicación.'},415);
        const bytes=new Uint8Array(await req.arrayBuffer());
        const limit=path==='/api/commands'?16384:path==='/api/evidence'?2400000:131072;
        if(bytes.length>limit)return json({error:'La solicitud supera el tamaño permitido.'},413);
        let input;try{input=JSON.parse(new TextDecoder().decode(bytes))}catch{return json({error:'JSON inválido.'},400);}
        if(!input||typeof input!=='object'||Array.isArray(input))return json({error:'Se requiere un objeto JSON.'},400);
        const {ledger,limiter}=await engine();
        // Mismo tope por sesión que el servidor autónomo: la clave es el usuario del portal.
        if(['/api/import/preview','/api/import/commit','/api/evidence'].includes(path))limiter.check(user.id);
        if(path==='/api/import/preview')return json(ledger.previewImport('landur',user.id,input.csv));
        if(path==='/api/evidence')return json(ledger.attachEvidence('landur',user.id,req.headers.get('idempotency-key'),input));
        if(path==='/api/commands'&&input.kind==='import')return json({error:'Usá la importación con vista previa.'},400);
        return json(ledger.command('landur',user.id,req.headers.get('idempotency-key'),path==='/api/import/commit'?{kind:'import',csv:input.csv}:input));
      }
      return json({error:'Método no admitido.'},405);
    }catch(error){
      if(error.status)return json({error:error.message},error.status);
      console.error('LANDUR portal:',error.code||error.name);
      return json({error:'LANDUR no pudo completar la solicitud. Revisá el runtime y la instalación; Pulso no se modificó.'},503);
    }
  }
  handler.close=()=>{ledger?.close();ledger=undefined;initialized=undefined;};
  return handler;
}
