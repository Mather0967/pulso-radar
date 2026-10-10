import http from 'node:http';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {diskBucket} from './storage.mjs';
const root=path.resolve(import.meta.dirname,'..');
if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT no válido');
await import('./build.mjs');
const {default:worker}=await import('../dist/server/index.js');
const env={BUCKET:diskBucket(path.resolve(root,process.env.DATA_DIR||'data'))};
let mutation=Promise.resolve();
http.createServer(async(req,res)=>{
 try{
  const origin=`http://127.0.0.1:${port}`;
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);res.end('Host no admitido');return;}
  if(req.headers.origin&&![origin,`http://localhost:${port}`].includes(req.headers.origin)){res.writeHead(403);res.end('Origen no admitido');return;}
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>200000){res.writeHead(413);res.end('Petición demasiado grande');return;}chunks.push(chunk);}
  const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
  if(headers.has('origin'))headers.set('origin',origin);
  const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const handle=()=>worker.fetch(request,env,{waitUntil:p=>p.catch(console.error)});
  let response;if(req.method==='POST'){const pending=mutation.then(handle);mutation=pending.catch(()=>{});response=await pending;}else response=await handle();
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Error del servidor local'}));}
}).listen(port,'127.0.0.1',()=>console.log(`Pulso local: http://localhost:${port}`));

