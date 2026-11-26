const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const encoder=new TextEncoder();
const DEFAULT_MEDICINES=Object.freeze([{uid:'A1618C04',name:'Napa One',strength:'1000 mg',expiryDate:'2025-07',instructions:'once per night before meal'},{uid:'1474D505',name:'Monus 10',strength:'10 mg',expiryDate:'2029-07',instructions:'once per night before meal'}]);
const LEGACY_MEDICINES=Object.freeze(Object.fromEntries(DEFAULT_MEDICINES.map(item=>[item.uid,item.name])));
const randomHex=(bytes=32)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
const validUser=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
const normalizeUid=value=>String(value||'').replace(/[\s:-]/g,'').toUpperCase();
const validUid=value=>/^(?:[A-F0-9]{8}|[A-F0-9]{14}|[A-F0-9]{20})$/.test(value);
const validDate=value=>!value||/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value);
const clean=(value,max)=>String(value||'').trim().slice(0,max);
const dateLabel=value=>{if(!value)return '';const [year,month,day]=value.split('-').map(Number);const date=new Date(Date.UTC(year,month-1,day||1));return date.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});};

/** Account-scoped medicine cards, reader credentials and pending speech events. */
export class RFIDDirectory {
  constructor(state){this.state=state;this.storage=state.storage;}
  async fetch(request){
    const url=new URL(request.url),action=url.pathname.slice(1);
    if(request.method!=='POST')return json({ok:false,error:'Method not allowed.'},405);
    let body;try{body=await request.json();}catch{return json({ok:false,error:'Invalid RFID request.'},400);}
    if(action==='pair/start')return this.startPairing(body);
    if(action==='devices/provision')return this.provisionDevice(body);
    if(action==='pair/claim')return this.claimPairing(body);
    if(action==='medicines/list')return this.listMedicines(body);
    if(action==='medicines/save')return this.saveMedicine(body);
    if(action==='medicines/delete')return this.deleteMedicine(body);
    if(action==='event/submit')return this.submitEvent(request,body);
    if(action==='event/poll')return this.pollEvents(body);
    if(action==='event/ack')return this.ackEvent(body);
    if(action==='devices/list')return this.listDevices(body);
    if(action==='devices/revoke')return this.revokeDevice(body);
    return json({ok:false,error:'RFID action not found.'},404);
  }
  async startPairing({userId}){
    if(!validUser(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    await this.storage.put('pairing',{codeHash:await digest(code),userId,expiresAt:Date.now()+600000,attempts:0});
    return json({ok:true,code,expiresInSeconds:600});
  }
  async provisionDevice({userId}){
    if(!validUser(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const token=randomHex(32),deviceId=randomHex(16),devices=await this.storage.get('devices')||[];
    devices.push({deviceId,userId,tokenHash:await digest(token),createdAt:new Date().toISOString(),lastSeenAt:null});
    await this.storage.put('devices',devices);
    return json({ok:true,deviceId,deviceToken:token});
  }
  async claimPairing({code}){
    const value=String(code||'').trim();
    if(!/^\d{6}$/.test(value))return json({ok:false,error:'Enter the six-digit pairing code.'},400);
    const pairing=await this.storage.get('pairing');
    if(!pairing||pairing.expiresAt<Date.now()){await this.storage.delete('pairing');return json({ok:false,error:'Pairing code is invalid or expired.'},401);}
    if(pairing.attempts>=10){await this.storage.delete('pairing');return json({ok:false,error:'Pairing attempt limit reached. Generate a new code.'},429);}
    if(!same(await digest(value),pairing.codeHash)){pairing.attempts++;await this.storage.put('pairing',pairing);return json({ok:false,error:'Pairing code is invalid or expired.'},401);}
    const token=randomHex(32),deviceId=randomHex(16),devices=await this.storage.get('devices')||[];
    devices.push({deviceId,userId:pairing.userId,tokenHash:await digest(token),createdAt:new Date().toISOString(),lastSeenAt:null});
    await this.storage.put('devices',devices);await this.storage.delete('pairing');
    return json({ok:true,deviceId,deviceToken:token});
  }
  async listMedicines({userId}){
    if(!validUser(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const seededKey='medicine-defaults-seeded:'+userId;
    const defaultsAlreadySeeded=Boolean(await this.storage.get(seededKey));
    const medicines=await this.storage.get('medicines')||[];
    let changed=false;
    for(const item of DEFAULT_MEDICINES){
      const existing=medicines.find(card=>card.userId===userId&&card.uid===item.uid);
      if(!existing){
        // Seed starter cards once per account. If a user later changes or deletes
        // a starter UID, do not silently recreate the old card on the next list.
        if(!defaultsAlreadySeeded){
          medicines.push({...item,announcementText:'',expiredText:'Warning! This medicine has expired.',userId,defaultCard:true,updatedAt:new Date().toISOString()});
          changed=true;
        }
        continue;
      }
      // Upgrade untouched legacy starter cards, including accounts seeded by an older release.
      // Only fill blank fields and never replace a user's existing card details or custom message.
      if(existing.name===item.name){
        for(const field of ['strength','expiryDate','instructions']){
          if(!String(existing[field]||'').trim()&&item[field]){
            existing[field]=item[field];
            changed=true;
          }
        }
        if(!String(existing.expiredText||'').trim()){
          existing.expiredText='Warning! This medicine has expired.';
          changed=true;
        }
        if(existing.defaultCard!==true){existing.defaultCard=true;changed=true;}
      }
    }
    if(changed)await this.storage.put('medicines',medicines);
    if(!await this.storage.get(seededKey))await this.storage.put(seededKey,true);
    return json({ok:true,medicines:medicines.filter(item=>item.userId===userId).map(({userId,...item})=>item).sort((a,b)=>a.name.localeCompare(b.name))});
  }
  async saveMedicine({userId,medicine}){
    if(!validUser(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    if(!medicine||typeof medicine!=='object')return json({ok:false,error:'Medicine details are required.'},400);
    const uid=normalizeUid(medicine.uid),name=clean(medicine.name,100),strength=clean(medicine.strength,60);
    const expiryDate=clean(medicine.expiryDate,10),instructions=clean(medicine.instructions,500);
    const announcementText=clean(medicine.announcementText,1000),expiredText=clean(medicine.expiredText,300)||'Warning! This medicine has expired.';
    const originalUid=normalizeUid(medicine.originalUid||'');
    if(!validUid(uid))return json({ok:false,error:'Enter a valid RFID UID (4, 7, or 10 bytes in hexadecimal).'},400);
    if(!name)return json({ok:false,error:'Medicine name is required.'},400);
    if(!validDate(expiryDate))return json({ok:false,error:'Expiry month must use YYYY-MM.'},400);
    const medicines=await this.storage.get('medicines')||[];
    if(originalUid&&originalUid!==uid&&medicines.some(item=>item.userId===userId&&item.uid===uid))return json({ok:false,error:'That RFID UID is already assigned to another medicine card.'},409);
    const record={uid,name,strength,expiryDate,instructions,announcementText,expiredText,updatedAt:new Date().toISOString(),userId};
    // Replace the edited card by its original UID, and also prevent a duplicate
    // if the destination UID already exists for this account.
    const nextMedicines=medicines.filter(item=>!(
      item.userId===userId&&(item.uid===uid||(originalUid&&item.uid===originalUid))
    ));
    nextMedicines.push(record);
    await this.storage.put('medicines',nextMedicines);
    const {userId:ignored,...safe}=record;
    return json({ok:true,medicine:safe});
  }
  async deleteMedicine({userId,uid}){
    if(!validUser(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const normalized=normalizeUid(uid),medicines=await this.storage.get('medicines')||[];
    const next=medicines.filter(item=>!(item.userId===userId&&item.uid===normalized));
    if(next.length===medicines.length)return json({ok:false,error:'Medicine UID not found.'},404);
    await this.storage.put('medicines',next);
    return json({ok:true,deleted:true});
  }
  async submitEvent(request,{uid,eventId}){
    const auth=String(request.headers.get('authorization')||''),token=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(!/^[a-f0-9]{64}$/i.test(token))return json({ok:false,error:'Device authentication required.'},401);
    const tokenHash=await digest(token),devices=await this.storage.get('devices')||[];
    const device=devices.find(item=>same(item.tokenHash,tokenHash));
    if(!device)return json({ok:false,error:'Device token is invalid or revoked.'},401);
    const normalized=normalizeUid(uid);
    if(!validUid(normalized))return json({ok:false,error:'Invalid RFID UID.'},400);
    const medicines=await this.storage.get('medicines')||[];
    const medicine=medicines.find(item=>item.userId===device.userId&&item.uid===normalized)|| (LEGACY_MEDICINES[normalized]?{uid:normalized,name:LEGACY_MEDICINES[normalized],strength:'',expiryDate:'',instructions:'',announcementText:'',expiredText:''}:null);
    if(!medicine)return json({ok:false,error:'This RFID UID is not registered to your account. Add it on the Medicine RFID page.'},404);
    const id=/^[a-f0-9-]{16,64}$/i.test(String(eventId||''))?String(eventId):randomHex(16);
    const now=Date.now();
    const events=(await this.storage.get('events')||[]).filter(item=>now-Date.parse(item.createdAt)<86400000);
    if(events.some(item=>item.id===id))return json({ok:true,accepted:true,duplicate:true,eventId:id});
    // ESP32 can report the same physical card twice with different random event IDs.
    // Deduplicate by reader + UID as well, including after the first event was acknowledged.
    const recentScans=(await this.storage.get('recentScans')||[]).filter(item=>now-item.scannedAt<60000);
    const recentDuplicate=recentScans.find(item=>item.deviceId===device.deviceId&&item.uid===normalized&&now-item.scannedAt<6000);
    if(recentDuplicate)return json({ok:true,accepted:true,duplicate:true,eventId:recentDuplicate.eventId});
    const today=new Date().toISOString().slice(0,10),expired=Boolean(medicine.expiryDate&&medicine.expiryDate<today.slice(0,7));
    const medicineName=[medicine.name,medicine.strength].filter(Boolean).join(' ');
    const instruction=String(medicine.instructions||'').trim();
    const prescription=instruction?( /^your registered prescription says\b/i.test(instruction)?instruction:'Your registered prescription says '+instruction):'';
    const generated=[medicineName,medicine.expiryDate?'Expiry date: '+dateLabel(medicine.expiryDate):'',prescription].filter(Boolean).join('. ');
    const speechText=expired?(medicine.expiredText||'Warning! This medicine has expired.'):(medicine.announcementText||generated||medicine.name);
    const event={id,deviceId:device.deviceId,userId:device.userId,uid:normalized,medicine:medicine.name,speechText,expired,createdAt:new Date().toISOString()};
    events.push(event);await this.storage.put('events',events.slice(-100));
    recentScans.push({deviceId:device.deviceId,uid:normalized,eventId:id,scannedAt:now});
    await this.storage.put('recentScans',recentScans.slice(-100));
    device.lastSeenAt=event.createdAt;await this.storage.put('devices',devices);
    return json({ok:true,accepted:true,eventId:id});
  }
  async pollEvents({userId}){
    if(!validUser(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const now=Date.now(),activeKey='active-speech:'+userId;
    let events=(await this.storage.get('events')||[]).filter(item=>now-Date.parse(item.createdAt)<30000);
    const active=await this.storage.get(activeKey);
    if(active&&active.leaseUntil>now){
      await this.storage.put('events',events);
      return json({ok:true,events:[]});
    }
    if(active)await this.storage.delete(activeKey);
    const pending=events.filter(item=>item.userId===userId).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
    const selected=pending[0]||null;
    if(selected){
      // Keep only the newest pending scan for this account. Older scans are
      // stale context, not a playback queue to read aloud after recovery.
      const discarded=new Set(pending.slice(1).map(item=>item.id));
      events=events.filter(item=>!discarded.has(item.id));
      await this.storage.put(activeKey,{eventId:selected.id,leaseUntil:now+45000});
    }
    await this.storage.put('events',events);
    return json({ok:true,events:selected?[(({userId:ignored,...item})=>item)(selected)]:[]});
  }
  async ackEvent({userId,eventId}){
    if(!validUser(userId)||typeof eventId!=='string')return json({ok:false,error:'Invalid event acknowledgement.'},400);
    const events=await this.storage.get('events')||[],event=events.find(item=>item.id===eventId&&item.userId===userId);
    if(!event)return json({ok:false,error:'Event not found.'},404);
    await this.storage.put('events',events.filter(item=>item.id!==eventId));\n    const activeKey='active-speech:'+userId,active=await this.storage.get(activeKey);\n    if(active?.eventId===eventId)await this.storage.delete(activeKey);\n    return json({ok:true,acknowledged:true});
  }
  async listDevices({userId}){
    if(!validUser(userId))return json({ok:false,error:'A signed-in account is required.'},401);
    const devices=await this.storage.get('devices')||[];
    return json({ok:true,devices:devices.filter(item=>item.userId===userId).map(({tokenHash,userId,...item})=>item)});
  }
  async revokeDevice({userId,deviceId}){
    if(!validUser(userId)||!/^[a-f0-9]{32}$/i.test(String(deviceId||'')))return json({ok:false,error:'Invalid device request.'},400);
    const devices=await this.storage.get('devices')||[];
    if(!devices.some(item=>item.userId===userId&&item.deviceId===deviceId))return json({ok:false,error:'Device not found.'},404);
    await this.storage.put('devices',devices.filter(item=>item.deviceId!==deviceId));return json({ok:true,revoked:true});
  }
}
