import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installRelease,managedPaths} from '../scripts/cpanel-deploy.mjs';
test('deployment replaces only code, preserves portal and data, and records a recoverable backup',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pulso-deploy-')),repository=path.join(temp,'repo'),target=path.join(temp,'app'),state=path.join(temp,'state');
 const put=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)};
 try{
  for(const p of ['server/site.mjs','public/index.html','data/users.json','data/pulso/private.json','data/landur/landur.sqlite','public/portal.html','.env'])put(path.join(target,p),'preserve');
  for(const p of managedPaths){const directory=['src','dist/server','projects/landur/server','projects/landur/public'].includes(p);put(path.join(target,p,directory?'old.mjs':''),'old');const source=path.join(repository,p.startsWith('server/')||p.startsWith('public/')?'namecheap/'+p:p);put(path.join(source,directory?'new.mjs':''),'new')}
  const result=installRelease({repository,target,state,revision:'a'.repeat(40)});
  assert.equal(result.status,'deployed');assert.ok(fs.existsSync(path.join(target,'tmp/restart.txt')));
  for(const p of ['server/site.mjs','public/index.html','data/users.json','data/pulso/private.json','data/landur/landur.sqlite','public/portal.html','.env'])assert.equal(fs.readFileSync(path.join(target,p),'utf8'),'preserve');
  assert.equal(fs.readFileSync(path.join(target,'src/new.mjs'),'utf8'),'new');assert.ok(!fs.existsSync(path.join(target,'src/old.mjs')));assert.equal(fs.readFileSync(path.join(result.backup,'src/old.mjs'),'utf8'),'old');
  assert.equal(JSON.parse(fs.readFileSync(path.join(state,'status.json'))).revision,'a'.repeat(40));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
