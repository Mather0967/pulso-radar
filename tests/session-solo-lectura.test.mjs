import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {portalFixture} from './helpers/portal-fixture.mjs';

// Cada petición del portal consulta la sesión. Si esa consulta reescribe identity.json (con su
// candado), las ~16 de una carga se encolan y en un disco lento LANDUR parece colgado.
test('leer la sesión no toma el candado ni reescribe identity.json',async()=>{
  const portal=await portalFixture();
  try{
    const {cookie}=await portal.login('landur');
    const file=path.join(portal.root,'data/identity.json');
    const before=fs.readFileSync(file,'utf8'),mtime=fs.statSync(file).mtimeMs;
    for(let i=0;i<5;i++)assert.equal((await portal.store.session(cookie)).id,'landur');
    assert.equal(fs.readFileSync(file,'utf8'),before);
    assert.equal(fs.statSync(file).mtimeMs,mtime);
    assert.equal(fs.existsSync(file+'.lock'),false);
    assert.equal(await portal.store.session('rivect_session=inventada'),null);
  }finally{await portal.close();}
});
