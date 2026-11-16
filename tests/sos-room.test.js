import test from 'node:test';
import assert from 'node:assert/strict';
import {SOSRoom} from '../worker/src/sos-room.js';

class MemoryStorage {
  values = new Map();
  async get(key){return this.values.get(key);}
  async put(key,value){this.values.set(key,value);}
  async delete(key){this.values.delete(key);}
}
function state(){return {storage:new MemoryStorage()};}
function post(path,body){
 return new Request('https://sos.test/'+path.replace(/^\\/+/,''),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
}
const code='A1B2C3D4E5F6G7H8';

test('SOS room pairs first receiver and confirms same code on later pair',async()=>{
 const room=new SOSRoom(state());
 const first=await room.fetch(post('/pair',{code}));
 const second=await room.fetch(post('/pair',{code}));
 assert.equal(first.status,200);
 assert.equal(second.status,200);
 assert.equal((await second.json()).paired,true);
});
test('SOS room rejects a different pairing code',async()=>{
 const room=new SOSRoom(state());
 await room.fetch(post('/pair',{code}));
 const response=await room.fetch(post('/poll',{code:'WRONGCODE123456'}));
 assert.equal(response.status,403);
});
test('SOS alert can be triggered, polled and acknowledged',async()=>{
 const room=new SOSRoom(state());
 await room.fetch(post('/pair',{code}));
 const trigger=await room.fetch(post('/trigger',{code}));
 const sent=await trigger.json();
 assert.equal(sent.sent,true);
 const poll=await room.fetch(post('/poll',{code}));
 const active=await poll.json();
 assert.equal(active.active,true);
 assert.equal(active.event.id,sent.eventId);
 const ack=await room.fetch(post('/ack',{code,eventId:sent.eventId}));
 assert.equal((await ack.json()).acknowledged,true);
 const after=await room.fetch(post('/poll',{code}));
 assert.equal((await after.json()).active,false);
});
test('SOS pairing code can be rotated and invalidates active event',async()=>{
 const room=new SOSRoom(state());
 await room.fetch(post('/pair',{code}));
 await room.fetch(post('/trigger',{code}));
 const next='ZZ9911YY8833XX77';
 const reset=await room.fetch(post('/reset',{code,newCode:next}));
 assert.equal((await reset.json()).reset,true);
 const oldPoll=await room.fetch(post('/poll',{code}));
 assert.equal(oldPoll.status,403);
 const newPoll=await room.fetch(post('/poll',{code:next}));
 assert.equal((await newPoll.json()).active,false);
});
