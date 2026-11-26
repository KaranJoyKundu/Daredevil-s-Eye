import test from 'node:test';
import assert from 'node:assert/strict';
import {RFIDDirectory} from '../worker/src/rfid-directory.js';
import {readFileSync} from 'node:fs';

function fixture(){
 const values=new Map();
 const state={storage:{
  get:async key=>values.get(key),
  put:async(key,value)=>values.set(key,structuredClone(value)),
  delete:async key=>values.delete(key)
 }};
 const directory=new RFIDDirectory(state);
 const post=(path,body,token='')=>directory.fetch(new Request('https://rfid.internal/'+path,{
  method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)
 }));
 return {directory,values,post};
}
const USER='d9b3f6e0-1d2a-4f2c-9a8a-7c5b6d4e3f21';
const medicine=(overrides={})=>({uid:'A1618C04',name:'Paracetamol',strength:'500 mg',expiryDate:'2027-12',instructions:'Your registered prescription says one tablet after food.',...overrides});

test('RFID pairing is single-use, account-bound, and returns a device token only once',async()=>{
 const {post}=fixture();
 const started=await (await post('pair/start',{userId:USER})).json();
 assert.equal(started.ok,true);assert.match(started.code,/^\d{6}$/);
 const claimed=await (await post('pair/claim',{code:started.code})).json();
 assert.equal(claimed.ok,true);assert.match(claimed.deviceToken,/^[a-f0-9]{64}$/);
 assert.match(claimed.deviceId,/^[a-f0-9]{32}$/);
 assert.equal((await post('pair/claim',{code:started.code})).status,401);
});

test('medicine cards are validated and isolated to the owning account',async()=>{
 const {post}=fixture();
 assert.equal((await post('medicines/save',{userId:USER,medicine:medicine()})).status,200);
 const other='d9b3f6e0-1d2a-4f2c-9a8a-7c5b6d4e3f22';
 const otherCards=(await (await post('medicines/list',{userId:other})).json()).medicines;
 assert.deepEqual(otherCards.map(item=>item.uid).sort(),['1474D505','A1618C04']);
 const listed=await (await post('medicines/list',{userId:USER})).json();
 assert.equal(listed.medicines.length,2);assert.equal(listed.medicines.find(item=>item.uid==='A1618C04').name,'Paracetamol');
 assert.equal((await post('medicines/save',{userId:USER,medicine:medicine({uid:'not-a-uid'})})).status,400);
});

test('every account receives editable Napa One and Monus 10 defaults exactly once',async()=>{
 const {post}=fixture();
 const first=(await (await post('medicines/list',{userId:USER})).json()).medicines;
 assert.deepEqual(first.map(item=>item.uid).sort(),['1474D505','A1618C04']);
 assert.equal(first.find(item=>item.uid==='A1618C04').name,'Napa One');
 assert.equal(first.find(item=>item.uid==='A1618C04').expiredText,'Warning! This medicine has expired.');
 assert.equal(first.find(item=>item.uid==='1474D505').expiredText,'Warning! This medicine has expired.');
 await post('medicines/save',{userId:USER,medicine:{uid:'A1618C04',originalUid:'A1618C04',name:'My Paracetamol',strength:'500 mg'}});
 const changed=(await (await post('medicines/list',{userId:USER})).json()).medicines;
 assert.equal(changed.find(item=>item.uid==='A1618C04').name,'My Paracetamol');
 assert.equal(changed.length,2);
});

test('medicine UID can be changed while editing without leaving the old UID behind',async()=>{
 const {post}=fixture();
 await post('medicines/list',{userId:USER});
 await post('medicines/save',{userId:USER,medicine:{uid:'0A0B0C0D',originalUid:'A1618C04',name:'Renamed medicine'}});
 const cards=(await (await post('medicines/list',{userId:USER})).json()).medicines;
 assert.equal(cards.some(item=>item.uid==='A1618C04'),false);
 assert.equal(cards.find(item=>item.uid==='0A0B0C0D').name,'Renamed medicine');
});

test('existing Napa One and Monus 10 cards continue to work until customized',async()=>{
 const {post}=fixture();
 const device=await (await post('devices/provision',{userId:USER})).json();
 const sent=await (await post('event/submit',{uid:'A1618C04'},device.deviceToken)).json();
 assert.equal(sent.accepted,true);
 const events=(await (await post('event/poll',{userId:USER})).json()).events;
 assert.equal(events[0].medicine,'Napa One');
 assert.equal(events[0].speechText,'Napa One');
});

test('direct device provisioning sends UID-only scans into personalized account announcements',async()=>{
 const {post}=fixture();
 const provisioned=await (await post('devices/provision',{userId:USER})).json();
 assert.equal(provisioned.ok,true);assert.match(provisioned.deviceToken,/^[a-f0-9]{64}$/);
 await post('medicines/save',{userId:USER,medicine:medicine()});
 const accepted=await (await post('event/submit',{uid:'A1 61 8C 04',eventId:'abcdef0123456789abcdef0123456789'},provisioned.deviceToken)).json();
 assert.equal(accepted.accepted,true);
 const pending=await (await post('event/poll',{userId:USER})).json();
 assert.equal(pending.events.length,1);
 assert.equal(pending.events[0].medicine,'Paracetamol');
 assert.match(pending.events[0].speechText,/500 mg/);
 assert.match(pending.events[0].speechText,/one tablet after food/);
});


test('normal medicine announcement follows the spoken name, expiry and prescription format',async()=>{
 const {post}=fixture();
 const device=await (await post('devices/provision',{userId:USER})).json();
 await post('medicines/save',{userId:USER,medicine:medicine({instructions:'one tablet after food.'})});
 await post('event/submit',{uid:'A1618C04'},device.deviceToken);
 const events=(await (await post('event/poll',{userId:USER})).json()).events;
 assert.equal(events[0].speechText,'Paracetamol 500 mg. Expiry date: December 2027. Your registered prescription says one tablet after food.');
});

test('blank expired warning is stored as the default warning and remains customizable',async()=>{
 const {post}=fixture();
 const saved=await (await post('medicines/save',{userId:USER,medicine:medicine({expiredText:''})})).json();
 assert.equal(saved.medicine.expiredText,'Warning! This medicine has expired.');
});

test('expired medicine speaks the warning instead of normal prescription instructions',async()=>{
 const {post}=fixture();
 const device=await (await post('devices/provision',{userId:USER})).json();
 await post('medicines/save',{userId:USER,medicine:medicine({expiryDate:'2000-01',expiredText:'Warning! This medicine has expired.'})});
 await post('event/submit',{uid:'A1618C04'},device.deviceToken);
 const events=(await (await post('event/poll',{userId:USER})).json()).events;
 assert.equal(events[0].expired,true);
 assert.equal(events[0].speechText,'Warning! This medicine has expired.');
 assert.doesNotMatch(events[0].speechText,/one tablet after food/);
});

test('custom spoken text overrides the generated medicine announcement',async()=>{
 const {post}=fixture();
 const device=await (await post('devices/provision',{userId:USER})).json();
 await post('medicines/save',{userId:USER,medicine:medicine({announcementText:'Take this only at bedtime.'})});
 await post('event/submit',{uid:'A1618C04'},device.deviceToken);
 const events=(await (await post('event/poll',{userId:USER})).json()).events;
 assert.equal(events[0].speechText,'Take this only at bedtime.');
});

test('RFID events are authenticated, account-scoped, deduplicated and acknowledged',async()=>{
 const {post}=fixture();
 const pair=await (await post('pair/start',{userId:USER})).json();
 const device=await (await post('pair/claim',{code:pair.code})).json();
 assert.equal((await post('event/submit',{uid:'A1618C04'})).status,401);
 await post('medicines/save',{userId:USER,medicine:medicine()});
 const id='0123456789abcdef0123456789abcdef';
 const sent=await (await post('event/submit',{uid:'A1618C04',eventId:id},device.deviceToken)).json();
 assert.equal(sent.accepted,true);
 const duplicate=await (await post('event/submit',{uid:'A1618C04',eventId:id},device.deviceToken)).json();
 assert.equal(duplicate.duplicate,true);
 assert.equal((await post('event/submit',{uid:'0A0B0C0D'},device.deviceToken)).status,404);
 const pending=await (await post('event/poll',{userId:USER})).json();
 assert.equal(pending.events.length,1);assert.equal(pending.events[0].medicine,'Paracetamol');
 assert.equal((await post('event/ack',{userId:USER,eventId:sent.eventId})).status,200);
 assert.equal((await (await post('event/poll',{userId:USER})).json()).events.length,0);
});


test('rapid duplicate reads with different event IDs are suppressed by device and UID',async()=>{
 const {post}=fixture();
 const device=await (await post('devices/provision',{userId:USER})).json();
 await post('medicines/save',{userId:USER,medicine:medicine()});
 const first=await (await post('event/submit',{uid:'A1618C04',eventId:'11111111111111111111111111111111'},device.deviceToken)).json();
 const second=await (await post('event/submit',{uid:'A1 61 8C 04',eventId:'22222222222222222222222222222222'},device.deviceToken)).json();
 assert.equal(first.accepted,true);assert.equal(second.accepted,true);assert.equal(second.duplicate,true);
 const events=(await (await post('event/poll',{userId:USER})).json()).events;
 assert.equal(events.length,1);
});

test('revoking an RFID reader invalidates its device token',async()=>{
 const {post}=fixture();
 const device=await (await post('devices/provision',{userId:USER})).json();
 assert.equal((await post('devices/revoke',{userId:USER,deviceId:device.deviceId})).status,200);
 assert.equal((await post('event/submit',{uid:'A1618C04'},device.deviceToken)).status,401);
});

test('medicine page exposes personal card management and shared listener speaks event text',()=>{
 const nav=readFileSync(new URL('../web/shared/site-nav.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../web/medicine/index.html',import.meta.url),'utf8');
 const pageScript=readFileSync(new URL('../web/medicine/rfid.js',import.meta.url),'utf8');
 const listener=readFileSync(new URL('../web/shared/rfid-listener.js',import.meta.url),'utf8');
 assert.match(nav,/startRFIDListener/);
 assert.match(page,/medicine-form/);assert.match(page,/medicine-uid/);assert.match(page,/medicine-expiry/);
 assert.match(pageScript,/api\/rfid\/medicines/);assert.match(page,/Custom spoken message/);
 assert.match(listener,/event\.speechText\|\|event\.medicine/);
 assert.ok(listener.includes("localStorage.getItem(ENABLED_KEY)!=='0'"));
 assert.ok(listener.includes("addEventListener('scroll',onUserActivity"));
 assert.ok(listener.includes("addEventListener('wheel',onUserActivity"));\n assert.ok(!listener.includes('||document.hidden'));\n assert.ok(listener.includes('setInterval(()=>poll(false),1000)'));
 assert.ok(listener.includes('completedEventId'));
 assert.ok(page.includes('id="listener-enabled" type="checkbox" checked'));
 assert.ok(pageScript.includes("field('uid').readOnly=false"));
 assert.ok(pageScript.includes('/api/rfid/devices/provision'));
});

test('ESP32 firmware sends arbitrary card UIDs and never contains a fixed medicine map',()=>{
 const firmware=readFileSync(new URL('../hardware/esp32-rfid/esp32-rfid.ino',import.meta.url),'utf8');
 assert.match(firmware,/sendMedicine\(const String &uid\)/);
 assert.match(firmware,/\\"uid\\":\\"/);
 assert.match(firmware,/useBuiltinCACertBundle/);
 assert.match(firmware,/MAX_PENDING_EVENTS = 5/);
 assert.match(firmware,/SAME_UID_COOLDOWN_MS = 6000/);
 assert.match(firmware,/DUPLICATE CARD READ SUPPRESSED/);
 assert.match(firmware,/savePendingQueue/);
 assert.match(firmware,/64-character device token/);
 assert.doesNotMatch(firmware,/MEDICINES\[\]/);
 assert.doesNotMatch(firmware,/UNKNOWN_CARD/);
 assert.doesNotMatch(firmware,/setInsecure\s*\(/);
});
