import {mkdir,readFile,writeFile,rename,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export function diskBucket(directory){
 const root=path.resolve(directory);
 let queue=Promise.resolve();
 const hash=value=>createHash('sha256').update(value).digest('hex');
 async function lock(){await mkdir(root,{recursive:true,mode:0o700});const name=path.join(root,'.write-lock');for(let n=0;n<150;n++){try{await mkdir(name);return ()=>rm(name,{recursive:true,force:true})}catch(e){if(e.code!=='EEXIST')throw e;try{if(Date.now()-(await stat(name)).mtimeMs>120000)await rm(name,{recursive:true,force:true})}catch{}await new Promise(r=>setTimeout(r,30))}}throw Error('Almacenamiento ocupado')}
 function target(key){const file=path.resolve(root,key);if(!file.startsWith(root+path.sep))throw new Error('Clave de almacenamiento no válida');return file;}
 return {
  async get(key){try{const file=target(key),value=await readFile(file,'utf8');return {json:async()=>JSON.parse(value),etag:hash(value),uploaded:(await stat(file)).mtime}}catch(error){if(error.code==='ENOENT')return null;throw error}},
  async put(key,value,options={}){const operation=queue.then(async()=>{const unlock=await lock();try{const file=target(key);let previous=null;try{previous=await readFile(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}const condition=options.onlyIf;if(condition?.etagMatches&&(!previous||hash(previous)!==condition.etagMatches))return null;if(condition?.etagDoesNotMatch==='*'&&previous!==null)return null;await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,value,{encoding:'utf8',mode:0o600});await rename(temp,file);return {etag:hash(value),uploaded:new Date()}}finally{await unlock()}});queue=operation.catch(()=>{});return operation}
 };
}


