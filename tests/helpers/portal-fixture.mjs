// TEST ONLY. The production site.mjs and account/landing pages are not in this repo.
// Fixtures preserve their route contract without pretending to reproduce the host.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {AuthStore,passwordHash} from '../../namecheap/server/auth.mjs';
const repository=fileURLToPath(new URL('../../',import.meta.url));
export async function portalFixture({port=0}={}) {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rivect-projects-'));
  const root=path.join(temp,'portal');fs.mkdirSync(root,{recursive:true});
  const put=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
  put(path.join(root,'package.json'),'{"type":"module"}');
  for(const folder of ['namecheap/server','namecheap/public','dist/server']){
    const dest=folder.startsWith('namecheap/')?folder.slice('namecheap/'.length):folder;
    fs.cpSync(path.join(repository,folder),path.join(root,dest),{recursive:true});
  }
  fs.mkdirSync(path.join(root,'scripts'),{recursive:true});fs.copyFileSync(path.join(repository,'scripts/storage.mjs'),path.join(root,'scripts/storage.mjs'));
  for(const dir of ['server','public'])fs.cpSync(path.join(repository,'projects/landur',dir),path.join(root,'projects/landur',dir),{recursive:true});
  put(path.join(root,'server/site.mjs'),"export const publicAPI=async()=>Response.json({fixture:true}); export const adminSiteAPI=async()=>Response.json({fixture:true});");
  for(const file of ['index.html','account.html','portal.html','admin.html'])put(path.join(root,'public',file),`<!doctype html><html><body>Fixture: ${file}</body></html>`);
  fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.copyFileSync(path.join(repository,'src/index.html'),path.join(root,'src/index.html'));
  const saved={RIVECT_LOCAL:process.env.RIVECT_LOCAL,RIVECT_TEST:process.env.RIVECT_TEST,DATA_DIR:process.env.DATA_DIR};
  process.env.RIVECT_LOCAL='1';process.env.RIVECT_TEST='1';process.env.DATA_DIR=path.join(root,'data');
  let module;try{module=await import(pathToFileURL(path.join(root,'server/main.mjs')));}finally{
    for(const [key,value] of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
  const store=new AuthStore(path.join(root,'data'));
  const password='synthetic-fixture-password';const hash=await passwordHash(password);
  const users=[
    {id:'admin',name:'Administrador de prueba',role:'admin',projects:{}},
    {id:'pulso',name:'Usuario Pulso',role:'member',projects:{pulso:'editor'}},
    {id:'landur',name:'Usuario LANDUR',role:'member',projects:{landur:'editor'}},
    {id:'reader',name:'Lectura LANDUR',role:'member',projects:{landur:'viewer'}},
    {id:'none',name:'Sin proyectos',role:'member',projects:{}}
  ].map(u=>({...u,active:true,email:`${u.id}@example.test`,password:hash}));
  await store.transact(db=>{db.users=users;});
  const server=module.createServer();server.listen(port,'127.0.0.1');await once(server,'listening');
  const base=`http://localhost:${server.address().port}`;
  const request=(url,{method='GET',cookie='',csrf='',body,raw,origin='http://localhost:4180',headers={}}={})=>fetch(base+url,{method,redirect:'manual',headers:{cookie,origin,'Content-Type':'application/json','X-CSRF-Token':csrf,'X-Landur-Request':'1',...headers},...((raw!==undefined)?{body:raw}:(body===undefined?{}:{body:JSON.stringify(body)}))});
  const login=async id=>{
    const response=await request('/auth/login',{method:'POST',body:{email:`${id}@example.test`,password}});
    if(response.status!==200)throw Error('Fixture login failed');
    const data=await response.json();return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:data.csrf};
  };
  return {root,store,server,base,request,login,password,async close(){await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}};
}
