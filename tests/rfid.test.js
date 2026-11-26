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

test('RFID pairing is single-use, account-bound, and returns a device token only once',async()=>{
 const {post}=fixture(),userId='d9b3f6e0-1d2a-4f2c-9a8a-7c5b6d4e3f21';
 const started=await (await post('pair/start',{userId})).json();
 assert.equal(started.ok,true);assert.match(started.code,/^\d{6}$/);
 const claimed=await (await post('pair/claim',{code:started.code})).json();
 assert.equal(claimed.ok,true);assert.match(claimed.deviceToken,/^[a-f0-9]{64}$/);
 assert.match(claimed.deviceId,/^[a-f0-9]{32}$/);
 assert.equal((await post('pair/claim',{code:started.code})).status,401);
});

test('RFID events are authenticated, account-scoped, deduplicated and acknowledged',async()=>{
 const {post}=fixture(),userId='d9b3f6e0-1d2a-4f2c-9a8a-7c5b6d4e3f21';
 const pair=await (await post('pair/start',{userId})).json();
 const device=await (await post('pair/claim',{code:pair.code})).json();
 assert.equal((await post('event/submit',{uid:'A1618C04',medicine:'Napa One',eventId:'0123456789abcdef0123456789abcdef'})).status,401);
 const sent=await (await post('event/submit',{uid:'A1618C04',medicine:'Napa One',eventId:'0123456789abcdef0123456789abcdef'},device.deviceToken)).json();
 assert.equal(sent.accepted,true);
 const duplicate=await (await post('event/submit',{uid:'A1618C04',medicine:'Napa One',eventId:'0123456789abcdef0123456789abcdef'},device.deviceToken)).json();
 assert.equal(duplicate.duplicate,true);
 const forged=await post('event/submit',{uid:'A1618C04',medicine:'Fake Medicine'},device.deviceToken);
 assert.equal(forged.status,400);
 const pending=await (await post('event/poll',{userId})).json();
 assert.equal(pending.events.length,1);assert.equal(pending.events[0].medicine,'Napa One');
 assert.equal((await post('event/ack',{userId,eventId:sent.eventId})).status,200);
 const afterAck=await (await post('event/poll',{userId})).json();
 assert.equal(afterAck.events.length,0);
});

test('revoking an RFID reader invalidates its device token',async()=>{
 const {post}=fixture(),userId='d9b3f6e0-1d2a-4f2c-9a8a-7c5b6d4e3f21';
 const pair=await (await post('pair/start',{userId})).json();
 const device=await (await post('pair/claim',{code:pair.code})).json();
 assert.equal((await post('devices/revoke',{userId,deviceId:device.deviceId})).status,200);
 assert.equal((await post('event/submit',{uid:'1474D505',medicine:'Monus 10'},device.deviceToken)).status,401);
});

test('medicine page is a separate nav destination and global listener is loaded from shared navigation',()=>{
 const nav=readFileSync(new URL('../web/shared/site-nav.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../web/medicine/index.html',import.meta.url),'utf8');
 const pageScript=readFileSync(new URL('../web/medicine/rfid.js',import.meta.url),'utf8');
 assert.match(nav,/\['Medicine RFID','\/medicine\/']/);
 assert.match(nav,/startRFIDListener/);
 const app=readFileSync(new URL('../web/shared/app.js',import.meta.url),'utf8');
 assert.match(app,/startRFIDListener/);
 assert.match(page,/generate-code/);
 assert.match(page,/listener-enabled/);
 assert.match(pageScript,/visual-only Vercel preview/i);
 assert.match(pageScript,/generate-code.*disabled/s);
});

test('ESP32 firmware refuses unverified TLS and contains both registered UID mappings',()=>{
 const firmware=readFileSync(new URL('../hardware/esp32-rfid/esp32-rfid.ino',import.meta.url),'utf8');
 assert.match(firmware,/A1618C04.*Napa One/);
 assert.match(firmware,/1474D505.*Monus 10/);
 assert.match(firmware,/useBuiltinCACertBundle/);
 assert.match(firmware,/MAX_PENDING_EVENTS = 5/);
 assert.match(firmware,/savePendingQueue/);
 assert.match(firmware,/DEVICE_AUTH_FAILED/);
 assert.match(firmware,/preferences.remove\("token"\)/);
 assert.doesNotMatch(firmware,/setInsecure\s*\(/);
});
