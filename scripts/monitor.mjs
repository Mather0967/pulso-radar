import {existsSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const port=process.env.PORT||4173;
const response=await fetch(`http://127.0.0.1:${port}/api/agent/run`,{method:'POST',signal:AbortSignal.timeout(60000)});
const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo revisar');
console.log(JSON.stringify({lastRun:result.lastRun,skipped:result.skipped||false,run:result.runs?.[0]},null,2));

