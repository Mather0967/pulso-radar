const keys={portfolio:'pulso-intelligence',evidence:'pulso-evidence-v1'};
export function localWorkspace(){const defaults={portfolio:{companies:[],demos:[],labs:[],tasks:[]},evidence:{version:1,evidence:[],cases:[],analyses:{},reports:[],pilots:{}}};return Object.fromEntries(Object.entries(keys).map(([k,key])=>{try{return [k,JSON.parse(localStorage.getItem(key)||'null')||defaults[k]]}catch{return [k,defaults[k]]}}))}
export function initSync({onReload,toast}){
 let revision=null,ready=false,pending=false,busy=false,paused=false,timer,known='';
 const chip=document.createElement('button');chip.className='sync-chip';chip.type='button';chip.textContent='Conectando…';document.querySelector('.header-actions').prepend(chip);
 const panel=document.createElement('dialog');panel.className='sync-dialog';panel.innerHTML='<button class="dialog-close" aria-label="Cerrar">×</button><p class="eyebrow">TU ESPACIO</p><h2>Guardado y recuperación</h2><p data-sync-description></p><div class="sync-actions"><button class="primary" data-sync-retry>Reintentar guardado</button><button class="secondary" data-sync-download>Descargar respaldo local</button><button class="secondary" data-sync-pull>Cargar versión del servidor</button></div><p class="small">Los datos se vinculan a tu cuenta de ChatGPT. Las claves de IA permanecen sólo en memoria.</p>';document.body.append(panel);
 const status=(text,detail='',kind='')=>{chip.textContent=text;chip.dataset.state=kind;panel.querySelector('[data-sync-description]').textContent=detail||text};
 chip.onclick=()=>panel.showModal();panel.querySelector('.dialog-close').onclick=()=>panel.close();
 panel.querySelector('[data-sync-download]').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({format:'pulso-workspace',version:2,...localWorkspace()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='pulso-respaldo-completo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const hasData=d=>!!(d?.portfolio?.companies?.length||d?.portfolio?.labs?.length||d?.evidence?.evidence?.length||d?.evidence?.cases?.length);
 async function push(){
  if(!ready||busy||paused||!pending)return;busy=true;const snapshot=JSON.stringify(localWorkspace());status('Guardando…');
  try{const r=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,data:JSON.parse(snapshot)})});const d=await r.json();if(!r.ok){if(r.status===409){paused=true;status('Revisar conflicto',d.error,'error');return}throw Error(d.error||'Guardado no disponible.')}revision=d.revision;known=snapshot;pending=JSON.stringify(localWorkspace())!==snapshot;status('Guardado en tu cuenta','Último guardado: '+new Date(d.updatedAt).toLocaleString('es-UY'),'saved')}
  catch(e){pending=true;status('Copia local pendiente',e.message,'error')}finally{busy=false;if(pending&&!paused&&navigator.onLine)timer=setTimeout(push,8000)}
 }
 async function load(force=false){
  try{const r=await fetch('/api/workspace');const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo conectar.');revision=d.revision;const local=localWorkspace();
   if(d.exists){if(force||!hasData(local)){for(const [name,key]of Object.entries(keys))localStorage.setItem(key,JSON.stringify(d.data[name]));known=JSON.stringify(d.data);ready=true;paused=false;pending=false;onReload();status('Guardado en tu cuenta','','saved')}
    else if(JSON.stringify(local)===JSON.stringify(d.data)){known=JSON.stringify(local);ready=true;status('Guardado en tu cuenta','','saved')}
    else {ready=true;paused=true;status('Revisar dos versiones','Hay una copia local y otra en tu cuenta. Descargá el respaldo local y elegí cargar el servidor o conservar la copia local.','error');}}
   else{ready=true;known=JSON.stringify(local);pending=hasData(local);if(pending)push();else status('Cuenta conectada','Los nuevos registros se guardarán en tu cuenta.','saved')}
  }catch(e){ready=false;status('Modo local',e.message,'error')}
 }
 panel.querySelector('[data-sync-retry]').onclick=async()=>{if(paused&&!confirm('¿Guardar esta copia local sobre la versión del servidor? Descargá antes el respaldo si querés conservar ambas.'))return;if(!ready){await load();if(!ready)return}paused=false;pending=true;await push()};
 panel.querySelector('[data-sync-pull]').onclick=()=>{if(confirm('¿Cargar la copia del servidor? Los cambios locales sin guardar se reemplazarán. Podés descargar un respaldo primero.'))load(true)};
 document.addEventListener('pulso:changed',()=>{pending=true;clearTimeout(timer);if(!paused)timer=setTimeout(push,1800);if(!ready)status('Copia local pendiente','Guardado local disponible. Reconectá para sincronizar.','error')});
 window.addEventListener('online',()=>ready?push():load());
 window.addEventListener('storage',e=>{if(Object.values(keys).includes(e.key)){paused=true;status('Cambios en otra pestaña','Recargá o elegí una versión antes de guardar para evitar sobrescrituras.','error')}});
 window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue=''}});
 load();return {flush:push};
}
