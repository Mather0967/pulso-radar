import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),src=path.join(root,'src'),dist=path.join(root,'dist/server');
fs.mkdirSync(dist,{recursive:true});
const files={'/analysis-client.mjs':'text/javascript; charset=utf-8','/analysis-core.mjs':'text/javascript; charset=utf-8','/analysis.css':'text/css; charset=utf-8','/index.html':'text/html; charset=utf-8','/styles.css':'text/css; charset=utf-8','/app.mjs':'text/javascript; charset=utf-8','/core.mjs':'text/javascript; charset=utf-8','/workspace.mjs':'text/javascript; charset=utf-8','/evidence.mjs':'text/javascript; charset=utf-8','/evidence-assistant.mjs':'text/javascript; charset=utf-8','/snapshot.json':'application/json; charset=utf-8','/lab.mjs':'text/javascript; charset=utf-8','/operations.mjs':'text/javascript; charset=utf-8','/sync.mjs':'text/javascript; charset=utf-8','/brand-mark.svg':'image/svg+xml','/product.css':'text/css; charset=utf-8','/rivect-logo.svg':'image/svg+xml'};
const assets={};for(const [name,type] of Object.entries(files)) assets[name]={type,body:fs.readFileSync(path.join(src,name.slice(1)),'utf8')};
fs.writeFileSync(path.join(dist,'assets.mjs'),'export const assets='+JSON.stringify(assets)+';\n');
for(const file of ['research.mjs','analysis-core.mjs','groq.mjs','providers.mjs','monitor.mjs','evidence.mjs','gemini-evidence.mjs','cloud.mjs','lab.mjs']) fs.copyFileSync(path.join(src,file),path.join(dist,file));
fs.copyFileSync(path.join(src,'worker.mjs'),path.join(dist,'index.js'));
console.log('Pulso: interfaz y API compiladas para desarrollo local.');



