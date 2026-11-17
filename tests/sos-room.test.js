import test from 'node:test';
import assert from 'node:assert/strict';
import {SOSRoom} from '../worker/src/sos-room.js';
import {SOSDirectory} from '../worker/src/sos-directory.js';

class MemoryStorage {
  values=new Map();
  alarm=null;
  async get(key){return this.values.get(key);}
  async put(key,value){this.values.set(key,value);}
  async delete(key){return this.values.delete(key);}
  async list({prefix='' }={}){return new Map([...this.values.entries()].filter(([key])=>key.startsWith(prefix)));}
  async setAlarm(value){this.alarm=value;}
}
function makeRoomState(){return {storage:new MemoryStorage()};}
function post(path,body,headers={}) {
 return new Request('https://sos.test/'+(path.startsWith('/')?path.slice(1):path),{
  method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)
 });
}
function makeDirectory(){
 const rooms=new Map();
 const env={SOS_ROOM:{
  idFromName:id=>id,
  get:id=>{
   if(!rooms.has(id))rooms.set(id,new SOSRoom(makeRoomState()));
   return {fetch:request=>rooms.get(id).fetch(request)};
  }
 }};
 const directory=new SOSDirectory({storage:new MemoryStorage()},env);
 return {directory,rooms};
}
const deviceA='a'.repeat(32),deviceB='b'.repeat(32);

test('SOS room issues a high-entropy receiver token and accepts sender trigger',async()=>{
 const room=new SOSRoom(makeRoomState());
 const pair=await room.fetch(post('/pair',{}));
 const data=await pair.json();
 assert.equal(data.paired,true);
 assert.equal(data.receiverToken.length,64);
 const trigger=await room.fetch(post('/trigger',{}));
 const event=await trigger.json();
 assert.equal(event.queued,true);
 assert.equal(event.notificationAttempted,false);
 assert.match(event.message,/no push notification was accepted/i);
 const poll=await room.fetch(post('/poll',{receiverToken:data.receiverToken}));
 const active=await poll.json();
 assert.equal(active.active,true);
 assert.equal(active.event.id,event.eventId);
 const ack=await room.fetch(post('/ack',{receiverToken:data.receiverToken,eventId:event.eventId}));
 assert.equal((await ack.json()).acknowledged,true);
});
test('re-pairing invalidates the previous receiver token',async()=>{
 const room=new SOSRoom(makeRoomState());
 const first=await (await room.fetch(post('/pair',{}))).json();
 const second=await (await room.fetch(post('/pair',{}))).json();
 assert.notEqual(first.receiverToken,second.receiverToken);
 const oldPoll=await room.fetch(post('/poll',{receiverToken:first.receiverToken}));
 assert.equal(oldPoll.status,403);
 const newPoll=await room.fetch(post('/poll',{receiverToken:second.receiverToken}));
 assert.equal(newPoll.status,200);
});
test('revoking receiver session invalidates old token and active event',async()=>{
 const room=new SOSRoom(makeRoomState());
 const paired=await (await room.fetch(post('/pair',{}))).json();
 await room.fetch(post('/trigger',{}));
 await room.fetch(post('/revoke',{}));
 const response=await room.fetch(post('/poll',{receiverToken:paired.receiverToken}));
 assert.equal(response.status,403);
});
test('new six-character invitation invalidates an old receiver and replaces old invitation',async()=>{
 const {directory,rooms}=makeDirectory();
 const first=await (await directory.fetch(post('/invite',{deviceId:deviceA}))).json();
 assert.match(first.code,/^[A-Z0-9]{6}$/);
 assert.equal(first.expiresInSeconds,600);
 const paired=await (await directory.fetch(post('/pair',{code:first.code}))).json();
 assert.equal(paired.paired,true);
 const second=await (await directory.fetch(post('/invite',{deviceId:deviceA}))).json();
 assert.match(second.code,/^[A-Z0-9]{6}$/);
 assert.notEqual(second.code,first.code);
 const oldPoll=await rooms.get(deviceA).fetch(post('/poll',{receiverToken:paired.receiverToken}));
 assert.equal(oldPoll.status,403);
 const reused=await directory.fetch(post('/pair',{code:first.code}));
 assert.equal(reused.status,404);
});
test('SOS invitations and rooms are isolated per sender device',async()=>{
 const {directory,rooms}=makeDirectory();
 const first=await (await directory.fetch(post('/invite',{deviceId:deviceA}))).json();
 const second=await (await directory.fetch(post('/invite',{deviceId:deviceB}))).json();
 const pairedA=await (await directory.fetch(post('/pair',{code:first.code}))).json();
 const pairedB=await (await directory.fetch(post('/pair',{code:second.code}))).json();
 assert.equal(pairedA.deviceId,deviceA);
 assert.equal(pairedB.deviceId,deviceB);
 assert.notEqual(rooms.get(deviceA),rooms.get(deviceB));
});
test('SOS pairing directory rate limits guesses by IP',async()=>{
 const {directory}=makeDirectory();
 await directory.fetch(post('/invite',{deviceId:deviceA}));
 let last;
 for(let i=0;i<8;i++)last=await directory.fetch(post('/pair',{code:'XXXXXX'},{'cf-connecting-ip':'203.0.113.5'}));
 const blocked=await directory.fetch(post('/pair',{code:'YYYYYY'},{'cf-connecting-ip':'203.0.113.5'}));
 assert.equal(blocked.status,429);
});
