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
// Rutas de API que el portal debe servir. `tests/landur-assets.test.mjs` las compara con las
// del servidor autónomo y con los endpoint que llama `public/app.js`: una superficie que se
// queda atrás deja la aplicación rota en producción sin que ninguna prueba lo note.
export const portalApiRoutes=['GET /api/session','GET /api/state','GET /api/export.csv','GET /api/evidence/*',
  'POST /api/commands','POST /api/import/preview','POST /api/import/commit','POST /api/evidence'];
const actualPath=path=>existsSync(path)?realpathSync(path):resolve(actualPath(dirname(path)),basename(path));
const within=(parent,child)=>{const rel=relative(parent,child);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`));};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function createLandurPortal({dataDir,projectRoot=fileURLToPath(new URL('../projects/landur/',import.meta.url))}) {
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
  async function handler(req,user) {
    const access=projectAccess(user,'landur');
    if(!user)return json({error:'Iniciá sesión en RIVECT para continuar.'},401);
    if(!access)return json({error:'No tenés permiso para el proyecto LANDUR.'},403);
    const url=new URL(req.url),method=req.method;
    if(url.pathname==='/landur')return new Response(null,{status:303,headers:{Location:'/landur/'}});
    if(!url.pathname.startsWith('/landur/'))return json({error:'Ruta no encontrada.'},404);
    const path=url.pathname.slice('/landur'.length);
    if(!['GET','HEAD'].includes(method)){
      if(access!=='editor')return json({error:'Tu acceso a LANDUR es de solo lectura.'},403);
      if(req.headers.get('origin')!==url.origin||!user.csrf||req.headers.get('x-csrf-token')!==user.csrf)return json({error:'Origen o sesión no válidos.'},403);
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
