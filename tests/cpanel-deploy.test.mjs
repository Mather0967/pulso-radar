import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installRelease,managedPaths,mountedProjectDirs,verifyMountedProjects} from '../scripts/cpanel-deploy.mjs';
const repositoryRoot=fileURLToPath(new URL('..',import.meta.url));
const directories=['src','dist/server','projects/landur/server','projects/landur/public','projects/studio/public','projects/rivect-retail/public'];
const mounted=['projects/studio/public','projects/rivect-retail/public'];
// Repositorio de origen y destino mínimos. `server/main.mjs` es el real: de ahí salen los montajes.
function prepare(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pulso-deploy-')),repository=path.join(temp,'repo'),target=path.join(temp,'app'),state=path.join(temp,'state');
 const put=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)};
 for(const p of ['server/site.mjs','public/index.html','data/users.json','data/pulso/private.json','data/landur/landur.sqlite','public/portal.html','.env'])put(path.join(target,p),'preserve');
 for(const p of managedPaths){const directory=directories.includes(p);put(path.join(target,p,directory?'old.mjs':''),'old');const source=path.join(repository,p.startsWith('server/')||p.startsWith('public/')?'namecheap/'+p:p);put(path.join(source,directory?'new.mjs':''),'new')}
 fs.copyFileSync(path.join(repositoryRoot,'namecheap/server/main.mjs'),path.join(repository,'namecheap/server/main.mjs'));
 for(const dir of mounted){
  put(path.join(repository,dir,'index.html'),'<!doctype html><script type="module" src="/portal/assets/app.js"></script>');
  put(path.join(repository,dir,'assets/app.js'),'console.log(1)');
 }
 return {temp,repository,target,state,put};
}
test('deployment replaces only code, preserves portal and data, and records a recoverable backup',()=>{
 const {temp,repository,target,state}=prepare();
 try{
  const result=installRelease({repository,target,state,revision:'a'.repeat(40)});
  assert.equal(result.status,'deployed');assert.ok(fs.existsSync(path.join(target,'tmp/restart.txt')));
  for(const p of ['server/site.mjs','public/index.html','data/users.json','data/pulso/private.json','data/landur/landur.sqlite','public/portal.html','.env'])assert.equal(fs.readFileSync(path.join(target,p),'utf8'),'preserve');
  assert.equal(fs.readFileSync(path.join(target,'src/new.mjs'),'utf8'),'new');assert.ok(!fs.existsSync(path.join(target,'src/old.mjs')));assert.equal(fs.readFileSync(path.join(result.backup,'src/old.mjs'),'utf8'),'old');
  assert.equal(fs.readFileSync(path.join(target,'projects/rivect-retail/public/index.html'),'utf8'),fs.readFileSync(path.join(repository,'projects/rivect-retail/public/index.html'),'utf8'));
  assert.ok(fs.existsSync(path.join(target,'projects/rivect-retail/public/assets/app.js')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(state,'status.json'))).revision,'a'.repeat(40));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('cada proyecto montado en el portal viaja en el despliegue',()=>{
 // Regresión: /retail quedó montado sin sus estáticos y la web respondía 404 sin que el
 // despliegue lo detectara.
 const dirs=mountedProjectDirs(repositoryRoot);
 assert.ok(dirs.includes('projects/rivect-retail/public'));
 assert.ok(dirs.includes('projects/studio/public'));
 for(const dir of dirs)assert.ok(managedPaths.includes(dir),`${dir} no está en managedPaths`);
 assert.doesNotThrow(()=>verifyMountedProjects({repository:repositoryRoot}));
});
test('el despliegue falla si un proyecto montado no tiene su build estático',()=>{
 const {temp,repository,target}=prepare();
 try{
  fs.rmSync(path.join(repository,'projects/rivect-retail/public/index.html'));
  assert.throws(()=>installRelease({repository,target,state:path.join(temp,'state'),revision:'b'.repeat(40)}),/Mounted project has no static build: projects\/rivect-retail\/public\/index\.html/);
  assert.ok(!fs.existsSync(path.join(target,'src/new.mjs')),'no debe copiar nada antes de validar');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('el despliegue falla si un proyecto montado no está en managedPaths o le falta un recurso',()=>{
 const {temp,repository}=prepare();
 try{
  assert.throws(()=>verifyMountedProjects({repository,paths:managedPaths.filter(p=>p!=='projects/studio/public')}),/Mounted project missing from managedPaths: projects\/studio\/public/);
  fs.rmSync(path.join(repository,'projects/studio/public/assets/app.js'));
  assert.throws(()=>verifyMountedProjects({repository}),/Mounted project references a missing asset: projects\/studio\/public\/assets\/app\.js/);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
