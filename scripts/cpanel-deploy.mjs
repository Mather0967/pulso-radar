import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Only these code paths are managed. Portal content, data and environment stay on the host.
export const managedPaths=['src','dist/server','scripts/storage.mjs','server/main.mjs','server/auth.mjs','server/access.mjs','public/pulso-session.js','server/projects.mjs','server/landur.mjs','public/projects.css','public/projects.mjs','public/projects-brand.svg','public/landur-brand.png','projects/landur/server','projects/landur/public'];
export function installRelease({repository,target,state,revision}){
 if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Invalid deployment revision');
 for(const p of ['server/site.mjs','public/index.html','data'])if(!fs.existsSync(path.join(target,p)))throw Error('Existing portal required: '+p);
 const sources=p=>path.join(repository,p.startsWith('server/')||p.startsWith('public/')?'namecheap/'+p:p);
 for(const p of managedPaths)if(!fs.existsSync(sources(p)))throw Error('Missing release file: '+p);
 fs.mkdirSync(state,{recursive:true,mode:0o700});
 const backup=path.join(state,'backups',Date.now()+'-'+revision.slice(0,12));
 fs.mkdirSync(backup,{recursive:true,mode:0o700});
 const touched=[];
 try{
  for(const p of managedPaths){
   const destination=path.join(target,p),saved=path.join(backup,p),had=fs.existsSync(destination);
   fs.mkdirSync(path.dirname(saved),{recursive:true});
   if(had)fs.cpSync(destination,saved,{recursive:true});
   touched.push({p,had});
   // Replace directories as complete releases to avoid retaining obsolete executable modules.
   const staged=destination+'.deploy-next';
   if(fs.existsSync(staged))throw Error('A previous staged release needs review');
   fs.cpSync(sources(p),staged,{recursive:true});
   if(had)fs.renameSync(destination,destination+'.deploy-old');
   fs.renameSync(staged,destination);
   fs.rmSync(destination+'.deploy-old',{recursive:true,force:true});
  }
  fs.mkdirSync(path.join(target,'tmp'),{recursive:true});
  fs.writeFileSync(path.join(target,'tmp/restart.txt'),new Date().toISOString());
  const status={revision,deployedAt:new Date().toISOString(),backup,status:'deployed'};
  fs.writeFileSync(path.join(state,'status.json'),JSON.stringify(status,null,2),{mode:0o600});
  console.log(JSON.stringify(status));return status;
 }catch(error){
  for(const {p,had}of touched.reverse()){
   const destination=path.join(target,p);
   fs.rmSync(destination,{recursive:true,force:true});
   if(had)fs.cpSync(path.join(backup,p),destination,{recursive:true});
   fs.rmSync(destination+'.deploy-next',{recursive:true,force:true});
   fs.rmSync(destination+'.deploy-old',{recursive:true,force:true});
  }
  throw error;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const repository=path.resolve(import.meta.dirname,'..'),target=process.env.PULSO_DEPLOY_TARGET||path.join(os.homedir(),'rivect-portal'),state=process.env.PULSO_DEPLOY_STATE||path.join(os.homedir(),'pulso-deploy');
 const git=process.env.PULSO_GIT||'/usr/local/cpanel/3rdparty/bin/git';
 const revision=execFileSync(git,['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
 const branch=execFileSync(git,['branch','--show-current'],{cwd:repository,encoding:'utf8'}).trim();
 if(branch!=='main')throw Error('Production deployment only supports main');
 let previous;try{previous=JSON.parse(fs.readFileSync(path.join(state,'status.json'),'utf8'))}catch{}
 if(previous?.revision===revision){console.log('No deployment needed: '+revision);process.exit(0)}
 execFileSync(process.execPath,['scripts/build.mjs'],{cwd:repository,stdio:'inherit',timeout:60000});
 const tests=fs.readdirSync(path.join(repository,'tests')).filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x);
 execFileSync(process.execPath,['--disable-wasm-trap-handler','--test','--test-concurrency=1',...tests],{cwd:repository,stdio:'inherit',timeout:120000});
 const landurTests=fs.readdirSync(path.join(repository,'projects/landur/tests')).filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x);
 execFileSync(process.execPath,['--test',...landurTests],{cwd:path.join(repository,'projects/landur'),stdio:'inherit',timeout:120000});
 installRelease({repository,target,state,revision});
}
