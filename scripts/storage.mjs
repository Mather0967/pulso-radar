import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function diskBucket(directory){
 const root=path.resolve(directory);
 function target(key){const file=path.resolve(root,key);if(!file.startsWith(root+path.sep))throw new Error('Clave de almacenamiento no válida');return file;}
 return {
  async get(key){try{const value=await readFile(target(key),'utf8');return {json:async()=>JSON.parse(value)}}catch(error){if(error.code==='ENOENT')return null;throw error}},
  async put(key,value){const file=target(key);await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,value,'utf8');await rename(temp,file)}
 };
}

