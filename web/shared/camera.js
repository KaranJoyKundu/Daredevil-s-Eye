import { getSettings } from './settings.js';
function normalizeAddress(value) {
 let address=String(value||'').trim();
 if(address && !/^https?:\/\//i.test(address)) address='http://'+address;
 return address.replace(/\/+$/,'');
}
async function getFrame() {
 const base=normalizeAddress(getSettings().cameraBaseUrl);
 let parsed;try{parsed=new URL(base);}catch{throw new Error('Camera address is invalid. Enter an IP such as 192.168.0.104 or a full http:// URL in Admin.');}
 if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname) throw new Error('Camera address is invalid. Enter an IP or full URL in Admin.');
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),5000);
 try { const r=await fetch(base+'/capture?t='+Date.now(),{cache:'no-store',signal:controller.signal}); if(!r.ok) throw new Error('Camera HTTP '+r.status); const type=r.headers.get('content-type')||''; if(!type.includes('image/')) throw new Error('Camera did not return an image.'); const blob=await r.blob(); if(!blob.size) throw new Error('Camera image was empty.'); return blob; }
 catch(e){if(e.name==='AbortError') throw new Error('Camera timed out. Check power and Wi-Fi.'); if(e instanceof TypeError) throw new Error('Browser cannot reach the camera. Check IP, network, CORS and mixed-content restrictions.'); throw e;} finally{clearTimeout(timer);}
}
export async function captureImage(){return getFrame();}
export async function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not prepare image.'));r.readAsDataURL(blob);});}