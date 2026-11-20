// A working fetch handler makes the app installable (Add to Home screen); pages stay network-first.
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><p style="font:20px/1.5 system-ui;padding:24px">আপনি অফলাইনে আছেন। Daredevil\'s Eye ব্যবহারে ইন্টারনেট লাগে।<br>You are offline. Daredevil\'s Eye needs the internet.</p>',{headers:{'content-type':'text/html; charset=utf-8'}})));
});
self.addEventListener('push',event=>{
 const message=event.data?event.data.text():'An SOS alert has been received.';
 const title='DAREDEVIL’S EYE · SOS';
 const options={
  body:message||'A trusted person may need help. Open the receiver to review the alert.',
  tag:'daredevils-eye-sos',
  renotify:true,
  requireInteraction:true,
  vibrate:[500,180,500,180,900],
  data:{url:'/sos-receiver/?push=1'}
 };
 event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL(event.notification.data?.url||'/sos-receiver/?push=1',self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   if(new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname.startsWith('/sos-receiver/')){
    await client.focus();
    client.postMessage({type:'DAREDEVILS_EYE_SOS_PUSH'});
    return;
   }
  }
  await self.clients.openWindow(url);
 })());
});
