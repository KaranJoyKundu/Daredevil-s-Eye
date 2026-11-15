import { getSettings } from './settings.js';
function normalizeAddress(value) {
 let address=String(value||'').trim();
 if(address && !/^https?:\/\//i.test(address)) address='http://'+address;
 return address.replace(/\/+$/,'');
}
export function captureUrl() {
 const base=normalizeAddress(getSettings().cameraBaseUrl);
 let parsed;try{parsed=new URL(base);}catch{throw new Error('Camera address is invalid. Enter an IP such as 192.168.0.104 or a full http:// URL in Admin.');}
 if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname) throw new Error('Camera address is invalid. Enter an IP or full URL in Admin.');
 return base+'/capture?t='+Date.now();
}
async function getFrame() {
 const url=captureUrl();
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),20000);
 try {
  const r=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(!r.ok) throw new Error('Camera /capture returned HTTP '+r.status+'.');
  const type=r.headers.get('content-type')||'';
  if(!type.includes('image/')) throw new Error('Camera /capture did not return an image. It returned '+(type||'an unknown content type')+'.');
  const blob=await r.blob();
  if(!blob.size) throw new Error('Camera /capture returned an empty image.');
  return blob;
 } catch(e) {
  if(e.name==='AbortError') throw new Error('The ESP32-CAM /capture request took over 20 seconds. Open http://192.168.0.104/capture directly to test the still-photo endpoint; the live stream uses a separate endpoint.');
  if(e instanceof TypeError) throw new Error('The browser could not read the camera /capture response. Check the camera IP and CORS headers; a live stream can display even when JavaScript fetch is blocked.');
  throw e;
 } finally { clearTimeout(timer); }
}
export async function captureImage(){return getFrame();}
export async function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not prepare image.'));r.readAsDataURL(blob);});}