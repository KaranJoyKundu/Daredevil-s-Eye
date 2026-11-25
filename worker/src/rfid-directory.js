const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const encoder=new TextEncoder();
const randomHex=(bytes=32)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};

/**
 * One account-scoped directory for paired RFID readers and their pending medicine events.
 * Device credentials are stored as SHA-256 digests; raw tokens are returned only once.
 */
export class RFIDDirectory {
  constructor(state){this.state=state;this.storage=state.storage;}
  async fetch(request){
    const url=new URL(request.url),action=url.pathname.replace(/^\\//,'');
    if(request.method!=='POST')return json({ok:false,error:'Method not allowed.'},405);
    let body;try{body=await request.json();}catch{return json({ok:false,error:'Invalid RFID request.'},400);}
    if(action==='pair/start')return this.startPairing(body);
    if(action==='pair/claim')return this.claimPairing(body);
    if(action==='event/submit')return this.submitEvent(request,body);
    if(action==='event/poll')return this.pollEvents(body);
    if(action==='event/ack')return this.ackEvent(body);
    if(action==='devices/list')return this.listDevices(body);
    if(action==='devices/revoke')return this.revokeDevice(body);
    return json({ok:false,error:'RFID action not found.'},404);
  }
  async startPairing({userId}){
    if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    const record={codeHash:await digest(code),userId,expiresAt:Date.now()+10*60*1000};
    await this.storage.put('pairing',record);
    return json({ok:true,code,expiresInSeconds:600});
  }
  async claimPairing({code}){
    const value=String(code||'').trim();
    if(!/^\\d{6}$/.test(value))return json({ok:false,error:'Enter the six-digit pairing code.'},400);
    const pairing=await this.storage.get('pairing');
    if(!pairing||pairing.expiresAt<Date.now()||!same(await digest(value),pairing.codeHash)){
      return json({ok:false,error:'Pairing code is invalid or expired.'},401);
    }
    const token=randomHex(32),deviceId=randomHex(16),devices=await this.storage.get('devices')||[];
    devices.push({deviceId,userId:pairing.userId,tokenHash:await digest(token),createdAt:new Date().toISOString(),lastSeenAt:null});
    await this.storage.put('devices',devices);
    await this.storage.delete('pairing');
    return json({ok:true,deviceId,deviceToken:token});
  }
  async submitEvent(request,{uid,medicine,eventId}){
    const auth=String(request.headers.get('authorization')||'');
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(!/^[a-f0-9]{64}$/i.test(token))return json({ok:false,error:'Device authentication required.'},401);
    const tokenHash=await digest(token),devices=await this.storage.get('devices')||[];
    const device=devices.find(item=>same(item.tokenHash,tokenHash));
    if(!device)return json({ok:false,error:'Device token is invalid or revoked.'},401);
    if(typeof uid!=='string'||!/^([a-f0-9]{8}|[a-f0-9]{14}|[a-f0-9]{20})$/i.test(uid))return json({ok:false,error:'Invalid RFID UID.'},400);
    if(typeof medicine!=='string'||!medicine.trim()||medicine.length>100)return json({ok:false,error:'Invalid medicine name.'},400);
    const id=/^[a-f0-9-]{16,64}$/i.test(String(eventId||''))?String(eventId):randomHex(16);
    const events=await this.storage.get('events')||[];
    if(events.some(item=>item.id===id))return json({ok:true,accepted:true,duplicate:true,eventId:id});
    const event={id,deviceId:device.deviceId,userId:device.userId,uid:uid.toUpperCase(),medicine:medicine.trim(),createdAt:new Date().toISOString()};
    events.push(event);
    await this.storage.put('events',events.slice(-100));
    device.lastSeenAt=event.createdAt;
    await this.storage.put('devices',devices);
    return json({ok:true,accepted:true,eventId:id});
  }
  async pollEvents({userId}){
    if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const events=await this.storage.get('events')||[];
    return json({ok:true,events:events.filter(item=>item.userId===userId).slice(0,20).map(({userId,...item})=>item)});
  }
  async ackEvent({userId,eventId}){
    if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId)||typeof eventId!=='string')return json({ok:false,error:'Invalid event acknowledgement.'},400);
    const events=await this.storage.get('events')||[];
    const event=events.find(item=>item.id===eventId&&item.userId===userId);
    if(!event)return json({ok:false,error:'Event not found.'},404);
    await this.storage.put('events',events.filter(item=>item.id!==eventId));
    return json({ok:true,acknowledged:true});
  }
  async listDevices({userId}){
    if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const devices=await this.storage.get('devices')||[];
    return json({ok:true,devices:devices.filter(item=>item.userId===userId).map(({tokenHash,userId,...item})=>item)});
  }
  async revokeDevice({userId,deviceId}){
    if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId)||!/^[a-f0-9]{32}$/i.test(String(deviceId||'')))return json({ok:false,error:'Invalid device request.'},400);
    const devices=await this.storage.get('devices')||[];
    const exists=devices.some(item=>item.userId===userId&&item.deviceId===deviceId);
    if(!exists)return json({ok:false,error:'Device not found.'},404);
    await this.storage.put('devices',devices.filter(item=>item.deviceId!==deviceId));
    return json({ok:true,revoked:true});
  }
}
