import { getSettings } from './settings.js?v=20261116-urlfix4';
function normalizeAddress(value) {
 let address=String(value||'').trim();
 if(!address) address='192.168.0.104';
 if(!/^https?:\/\//i.test(address)) address='http://'+address;
 return address.replace(/\/+$/,'');
}
export function captureUrl() {
 const saved=getSettings().cameraBaseUrl;
 const base=normalizeAddress(saved);
 let parsed;
 try{parsed=new URL(base);}catch{throw new Error('Camera address is invalid. Enter 192.168.0.104 or http://192.168.0.104 in Admin.');}
 if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname) throw new Error('Camera address is invalid. Enter 192.168.0.104 or http://192.168.0.104 in Admin.');
 return base+'/capture?t='+Date.now();
}
async function getFrame() {
 const url=captureUrl();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error('Camera /capture returned HTTP '+response.status+'.');
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.toLowerCase().includes('image/'))throw new Error('Camera /capture returned '+(contentType||'an unknown content type')+', not an image.');
  const blob=await response.blob();
  if(!blob.size)throw new Error('Camera /capture returned an empty image.');
  return blob;
 }catch(error){
  if(error.name==='AbortError')throw new Error('Camera /capture timed out after 20 seconds. Test http://192.168.0.104/capture directly.');
  if(error instanceof TypeError)throw new Error('Browser could not fetch camera /capture. This is usually CORS or network isolation; a visible live stream does not guarantee JavaScript can fetch still photos.');
  throw error;
 }finally{clearTimeout(timer);}
}
export async function captureImage(){return getFrame();}
export async function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not prepare image.'));reader.readAsDataURL(blob);});}