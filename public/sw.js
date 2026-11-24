const CACHE_NAME="sac-shell-v4";
const APP_SHELL=["/","/manifest.webmanifest","/brand/sac-icon-192.png","/brand/sac-icon-512.png","/brand/sac-icon-maskable-512.png","/brand/sac-logo.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("sac-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();void caches.open(CACHE_NAME).then(cache=>cache.put("/",copy));}
      return response;
    }).catch(async()=>(await caches.match("/"))||Response.error()));
    return;
  }
  if(url.pathname.startsWith("/assets/"))event.respondWith(caches.match(request).then(cached=>{
    if(cached)return cached;
    return fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();void caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
      return response;
    });
  }));
});

function ordinaryPushKind(kind){
  return kind==="ordinary_reminder"||kind==="family_event"||kind==="clinic_reminder";
}

function safeTarget(value){
  return typeof value==="string"&&value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\")?value:"/";
}

function ordinaryTitle(kind){
  if(kind==="family_event")return "Événement familial SAC";
  if(kind==="clinic_reminder")return "Rappel de suivi SAC";
  return "Rappel SAC";
}

self.addEventListener("push",event=>{
  let payload={};
  try{payload=event.data?event.data.json():{};}catch{payload={};}

  if(ordinaryPushKind(payload.kind)){
    const target=safeTarget(payload.targetPath);
    const options={
      body:"Un rappel vous attend. Ouvrez SAC pour le consulter.",
      tag:"sac-ordinary-"+(payload.kind||"reminder")+"-"+(payload.notificationId||"unknown"),
      renotify:false,
      data:{url:target},
      requireInteraction:false
    };
    event.waitUntil(self.registration.showNotification(ordinaryTitle(payload.kind),options));
    return;
  }

  const title="Alerte privée SAC";
  const options={
    body:"Une alerte privée vous attend. Ouvrez SAC pour la consulter.",
    tag:"sac-private-alert",
    renotify:false,
    data:{url:"/"},
    requireInteraction:true
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL(safeTarget(event.notification.data&&event.notification.data.url),self.location.origin).href;
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      if("focus" in client){
        await client.focus();
        if("navigate" in client)await client.navigate(target);
        return;
      }
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
