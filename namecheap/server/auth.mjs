import {scrypt as scryptCallback,randomBytes,randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename,rm,stat} from 'node:fs/promises';
import path from 'node:path';
const scrypt=promisify(scryptCallback);
export const digest=v=>createHash('sha256').update(v).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>200)throw Error('Usá una contraseña de entre 12 y 200 caracteres.');const salt=randomBytes(16).toString('hex');return salt+':'+Buffer.from(await scrypt(password,salt,64)).toString('hex')}
export async function verify(password,hash){if(typeof password!=='string'||password.length>200)return false;const [salt,key]=hash.split(':');const actual=Buffer.from(await scrypt(password,salt,64)),expected=Buffer.from(key,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected)}
export const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,projects:u.projects,active:u.active});
// Una sola forma de emitir la galleta de sesión: el portal y el acceso propio de LANDUR
// tienen que escribir exactamente los mismos atributos o el navegador guarda dos sesiones.
// `maxAge: 0` la borra en el cliente, además de revocarla en el servidor.
// `__Host-` ata la galleta al origen exacto: el navegador exige Secure y Path=/, y no admite
// Domain. Así un subdominio no puede sobrescribirla. En local se usa el nombre simple porque
// el navegador solo acepta `__Host-` con Secure, y el servidor lee los dos: las sesiones
// abiertas antes del cambio siguen sirviendo hasta vencer.
export const SESSION_COOKIES=['__Host-rivect_session','rivect_session'];
export const sessionCookie=(value,{secure=true,maxAge=28800}={})=>(secure?SESSION_COOKIES[0]:SESSION_COOKIES[1])+'='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+maxAge+(secure?'; Secure':'')+';';
// Detrás de LiteSpeed/Passenger el par del socket es el proxy local: la IP del socket es la
// misma para todos los visitantes, así que con esa clave diez contraseñas mal de cualquiera
// bloqueaban el acceso de todos durante 15 minutos. Si el par es de loopback se confía en
// X-Forwarded-For y se toma el último salto, que es el que agrega el proxy inmediato; un
// cliente directo nunca llega desde loopback y no puede falsear la cabecera.
const loopback = /^(::1|::ffff:127\.0\.0\.1|127(?:\.\d{1,3}){3})$/;
export function clientAddress({ peer, forwarded, trustProxy = false } = {}) {
  const hops = String(forwarded ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (hops.length && (trustProxy || (typeof peer === 'string' && loopback.test(peer.replace(/^\[|\]$/g, ''))))) return hops[hops.length - 1];
  return typeof peer === 'string' && peer ? peer : 'unknown';
}
export class AuthStore{
 constructor(directory,filename='identity.json'){this.directory=directory;this.file=path.join(directory,filename);}
 async transact(fn){await mkdir(this.directory,{recursive:true,mode:0o700});const lock=this.file+'.lock';let acquired=false;for(let n=0;n<100;n++){try{await mkdir(lock);acquired=true;break}catch(e){if(e.code!=='EEXIST')throw e;try{if(Date.now()-(await stat(lock)).mtimeMs>120000)await rm(lock,{recursive:true,force:true})}catch{}await new Promise(r=>setTimeout(r,40))}}if(!acquired)throw Error('Servidor ocupado. Intentá otra vez.');try{let db;try{db=JSON.parse(await readFile(this.file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={users:[],sessions:[],invites:[],attempts:{}}}const result=await fn(db);const temp=this.file+'.'+randomUUID();await writeFile(temp,JSON.stringify(db),{mode:0o600});await rename(temp,this.file);return result}finally{await rm(lock,{recursive:true,force:true})}}
 async session(cookie){const tokens=[];for(const part of String(cookie||'').split(';')){const at=part.indexOf('=');if(at<0)continue;const name=part.slice(0,at).trim(),value=part.slice(at+1).trim();if(value&&SESSION_COOKIES.includes(name))tokens.push(value)}if(!tokens.length)return null;return this.transact(db=>{const now=Date.now();db.sessions=db.sessions.filter(s=>s.expires>now);
  // Se prueban todas: una galleta duplicada o vieja no debe anular la sesión válida.
  for(const token of tokens.slice(0,8)){const s=db.sessions.find(x=>x.hash===digest(token));const u=s&&db.users.find(u=>u.id===s.userId&&u.active);if(u)return {...publicUser(u),csrf:s.csrf}}
  return null})}
 // Dos contadores: por cliente y por cuenta. El de la cuenta no depende de
 // `X-Forwarded-For`, así que rotar la cabecera no multiplica los intentos permitidos. El
 // costo es que un tercero puede bloquear a un usuario durante 15 minutos; con 20 intentos
 // por cuenta el techo queda acotado y avisado en la auditoría.
 async login(email,password,ip){return this.transact(async db=>{const now=Date.now();
  const account=String(email??'').trim().toLowerCase();
  const ipKey='ip:'+digest(ip||'unknown'),accountKey='cuenta:'+digest(account);
  for(const [k,v]of Object.entries(db.attempts))if(v.until<now)delete db.attempts[k];
  for(const [id,limit]of [[ipKey,10],[accountKey,20]]){
   const entry=db.attempts[id]||{count:0,until:now+900000};
   if(entry.count>=limit)return {error:'Demasiados intentos. Esperá 15 minutos.',status:429};
   entry.count++;db.attempts[id]=entry;
  }
  const u=db.users.find(u=>u.email===account&&u.active);const valid=await verify(password,u?.password||'00000000000000000000000000000000:'+('00'.repeat(64)));if(!u||!valid)return {error:'Correo o contraseña incorrectos.',status:401};delete db.attempts[ipKey];delete db.attempts[accountKey];const value=token(),csrf=token();db.sessions=db.sessions.filter(s=>s.expires>now);db.sessions.push({hash:digest(value),csrf,userId:u.id,expires:now+28800000});return {value,user:publicUser(u),csrf}})}
 // Reconfirmar la contraseña antes de una acción destructiva (borrado con historial).
 async reauth(userId,password){if(typeof password!=='string'||!password||password.length>200)return false;const user=await this.transact(db=>{const u=db.users.find(u=>u.id===userId&&u.active);return u?{...u}:null});return !!user&&verify(password,user.password)}
 async redeem(invitation,name,password){return this.transact(async db=>{const i=db.invites.find(i=>i.hash===digest(String(invitation||''))&&i.expires>Date.now()&&!i.used);if(!i)return {error:'El enlace no es válido o ya venció.',status:400};if(i.role==='admin'&&!i.createdBy&&db.users.some(u=>u.role==='admin'))return {error:'El administrador inicial ya existe.',status:409};const hash=await passwordHash(password);if(db.users.some(u=>u.email===i.email))return {error:'Ese correo ya tiene una cuenta.',status:409};const u={id:randomUUID(),name:String(name||'').trim().slice(0,100)||i.email,email:i.email,password:hash,role:i.role,projects:i.projects,active:true};db.users.push(u);i.used=true;return {created:true}})}
}
