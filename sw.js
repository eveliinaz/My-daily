const CACHE='my-daily-static-v3';
const ASSETS=['./','./index.html','./style.css','./app.js','./push-config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return res;}).catch(()=>caches.match(e.request)));});
self.addEventListener('push',e=>{let data={title:'My Daily',body:'You have a task due.'};try{data=e.data?.json()||data;}catch{}e.waitUntil(self.registration.showNotification(String(data.title||'My Daily'),{body:String(data.body||''),tag:String(data.tag||'daily'),icon:'./icon-192.png',data:{url:'./'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>clients.length?clients[0].focus():self.clients.openWindow('./')));});
