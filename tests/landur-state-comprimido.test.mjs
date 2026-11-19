import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {gunzipSync} from 'node:zlib';
import {portalFixture} from './helpers/portal-fixture.mjs';

// /landur/api/state manda todo el historial: sin comprimir superaba el tope de espera de la app.
// Se usa `http` crudo: `fetch` descomprime solo y no deja ver el encabezado.
const get=(url,headers)=>new Promise((resolve,reject)=>http.get(url,{headers},res=>{const parts=[];res.on('data',c=>parts.push(c));res.on('end',()=>resolve({res,body:Buffer.concat(parts)}));}).on('error',reject));

test('el estado de LANDUR viaja comprimido si el cliente lo acepta, y sin comprimir si no',async()=>{
  const portal=await portalFixture();
  try{
    const {cookie}=await portal.login('landur');
    const zipped=await get(portal.base+'/landur/api/state',{cookie,'accept-encoding':'gzip'});
    assert.equal(zipped.res.headers['content-encoding'],'gzip');
    assert.ok(Array.isArray(JSON.parse(gunzipSync(zipped.body)).accounts));
    const plain=await get(portal.base+'/landur/api/state',{cookie,'accept-encoding':'identity'});
    assert.equal(plain.res.headers['content-encoding'],undefined);
    assert.ok(Array.isArray(JSON.parse(plain.body).accounts));
  }finally{await portal.close();}
});
