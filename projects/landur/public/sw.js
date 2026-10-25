// Cache only this mount's public shell. Never intercept portal, Pulso, auth or API.
const BASE = new URL('./', self.location.href).pathname;
const PREFIX = `landur-shell-${encodeURIComponent(BASE)}-`;
const CACHE = PREFIX + 'v2';
const SHELL = ['','index.html','app.js','styles.css','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'].map(path=>BASE+path);
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const path of SHELL){
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error'});
    if(!response.ok)throw Error('No se pudo preparar la interfaz para este acceso.');
    await cache.put(path,response);
  }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if ((name.startsWith(PREFIX) || (BASE==='/' && name==='landur-shell-v1')) && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => { if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || !SHELL.includes(url.pathname)) return;
  event.respondWith(fetch(request).then(response => {
    // An expired portal session redirects to /login. Never cache that as a shell.
    if (response.ok && !response.redirected) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request,copy))); }
    return response;
  }).catch(() => caches.match(request)));
});
