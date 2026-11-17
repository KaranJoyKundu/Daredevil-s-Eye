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
