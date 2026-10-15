import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export function diskBucket(directory){
 const root=path.resolve(directory);
 let queue=Promise.resolve();
 const hash=value=>createHash('sha256').update(value).digest('hex');
 function target(key){const file=path.resolve(root,key);if(!file.startsWith(root+path.sep))throw new Error('Clave de almacenamiento no válida');return file;}
 return {
  async get(key){try{const file=target(key),value=await readFile(file,'utf8');return {json:async()=>JSON.parse(value),etag:hash(value),uploaded:(await stat(file)).mtime}}catch(error){if(error.code==='ENOENT')return null;throw error}},
  async put(key,value,options={}){const operation=queue.then(async()=>{const file=target(key);let previous=null;try{previous=await readFile(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}const condition=options.onlyIf;if(condition?.etagMatches&&(!previous||hash(previous)!==condition.etagMatches))return null;if(condition?.etagDoesNotMatch==='*'&&previous!==null)return null;await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,value,'utf8');await rename(temp,file);return {etag:hash(value),uploaded:new Date()}});queue=operation.catch(()=>{});return operation}
 };
}


