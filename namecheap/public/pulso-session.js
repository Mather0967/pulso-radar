(()=>{
 const prefix='rivect:'+window.RIVECT.id+':';
 const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
 Storage.prototype.getItem=function(k){return get.call(this,this===localStorage?prefix+k:k)};
 Storage.prototype.setItem=function(k,v){return set.call(this,this===localStorage?prefix+k:k,v)};
 Storage.prototype.removeItem=function(k){return remove.call(this,this===localStorage?prefix+k:k)};
 const fetchOriginal=window.fetch.bind(window);
 window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.origin);if(url.origin===location.origin){const headers=new Headers(init.headers||{});headers.set('X-CSRF-Token',window.RIVECT.csrf);init={...init,headers};}const r=await fetchOriginal(input,init);if(url.origin===location.origin&&r.status===401)location.assign('/login');return r;};
 document.addEventListener('DOMContentLoaded',()=>{const bar=document.createElement('div');bar.style='padding:10px 20px;background:#11222c;color:white;display:flex;gap:20px;justify-content:space-between;align-items:center;font:14px system-ui';const a=document.createElement('a');a.href='/portal';a.textContent='← Mis proyectos';a.style='color:#ff762e';const label=document.createElement('span');label.textContent=window.RIVECT.access==='viewer'?'Pulso · Sólo lectura · Los cambios locales no se guardan en el servidor':'Pulso · Espacio compartido del proyecto';bar.append(a,label);document.body.prepend(bar)});
})();
