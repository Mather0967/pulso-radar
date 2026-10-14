import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),src=path.join(root,'src'),dist=path.join(root,'dist/server');
fs.mkdirSync(dist,{recursive:true});
const files={'/index.html':'text/html; charset=utf-8','/styles.css':'text/css; charset=utf-8','/app.mjs':'text/javascript; charset=utf-8','/core.mjs':'text/javascript; charset=utf-8','/workspace.mjs':'text/javascript; charset=utf-8','/evidence.mjs':'text/javascript; charset=utf-8','/snapshot.json':'application/json; charset=utf-8'};
const assets={};for(const [name,type] of Object.entries(files)) assets[name]={type,body:fs.readFileSync(path.join(src,name.slice(1)),'utf8')};
fs.writeFileSync(path.join(dist,'assets.mjs'),'export const assets='+JSON.stringify(assets)+';\n');
for(const file of ['providers.mjs','monitor.mjs']) fs.copyFileSync(path.join(src,file),path.join(dist,file));
fs.copyFileSync(path.join(src,'worker.mjs'),path.join(dist,'index.js'));
console.log('Pulso: interfaz y API compiladas para desarrollo local.');


