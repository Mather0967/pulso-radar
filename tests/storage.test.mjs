import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {diskBucket} from '../scripts/storage.mjs';
test('persistencia entre instancias y bloqueo de rutas fuera del directorio',async()=>{
 const base=path.resolve(import.meta.dirname,'../data/tests');await mkdir(base,{recursive:true});const dir=await mkdtemp(path.join(base,'pulso-'));
 try{const bucket=diskBucket(dir);assert.equal(await bucket.get('missing.json'),null);await bucket.put('market/latest.json',JSON.stringify({runs:[1]}));assert.deepEqual(await(await diskBucket(dir).get('market/latest.json')).json(),{runs:[1]});await assert.rejects(bucket.put('../outside.json','{}'),/no válida/);}finally{await rm(dir,{recursive:true,force:true});}
});


