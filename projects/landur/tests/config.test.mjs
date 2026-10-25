import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { configuration } from '../server/config.mjs';
const base={NODE_ENV:'production',LANDUR_PASSWORD:'synthetic-long-test-secret',LANDUR_PUBLIC_ORIGIN:'https://landur.example.com',LANDUR_DATA_DIR:'/home/test-landur-private/data'};
test('configuración de cPanel requiere origen HTTPS y datos separados',()=>{
  const config=configuration(base,'/home/test-landur-app');assert.equal(config.production,true);assert.equal(config.insecureCookies,false);assert.equal(config.host,'0.0.0.0');
  assert.throws(()=>configuration({...base,LANDUR_PUBLIC_ORIGIN:''}),/PUBLIC_ORIGIN/);
  for(const origin of ['http://landur.example.com','https://landur.example.com/app','https://landur.example.com/','https://user:pass@landur.example.com'])
    assert.throws(()=>configuration({...base,LANDUR_PUBLIC_ORIGIN:origin}),/PUBLIC_ORIGIN/);
});
test('producción prohíbe demo, contraseña débil y cookies inseguras',()=>{
  assert.throws(()=>configuration({...base,LANDUR_DEMO:'1'}),/demo/);
  assert.throws(()=>configuration({...base,LANDUR_PASSWORD:'short'}),/PASSWORD/);
  assert.throws(()=>configuration({...base,LANDUR_INSECURE_LOCAL:'1'}),/inseguras/);
});
test('producción prohíbe rutas de datos públicas, relativas y dentro del código',()=>{
  for(const data of ['/home/user/public_html/data','/home/user/www/data','data','/home/test-landur-app/data'])
    assert.throws(()=>configuration({...base,LANDUR_DATA_DIR:data},'/home/test-landur-app'));
});
test('un enlace simbólico no permite almacenar datos dentro de public',t=>{
  const dir=mkdtempSync(join(tmpdir(),'landur-path-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  mkdirSync(join(dir,'app','public'),{recursive:true});symlinkSync(join(dir,'app','public'),join(dir,'private'));
  assert.throws(()=>configuration({...base,LANDUR_DATA_DIR:join(dir,'private','data')},join(dir,'app')),/públicas/);
});
test('demo local no requiere secretos y usa ruta estable independiente del cwd',()=>{
  const config=configuration({LANDUR_DEMO:'1'},'/home/test-landur-app');assert.equal(config.dataDir,'/home/test-landur-app/data');
  assert.throws(()=>configuration({LANDUR_DEMO:'1',PORT:'garbage'}),/PORT/);
});
