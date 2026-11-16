import { getSettings } from './settings.js?v=20261116-access2';
function normalizeAddress(value) {
 let address=String(value||'').trim();
 if(!address) address='192.168.0.104';
 if(!/^https?:\/\//i.test(address)) address='http://'+address;
 return address.replace(/\/+$/,'');
}
export function captureUrl() {
 const base=normalizeAddress(getSettings().cameraBaseUrl);
 let parsed;
 try{parsed=new URL(base);}catch{throw new Error('Camera address is invalid. Enter 192.168.0.104 or http://192.168.0.104 in Admin.');}
 if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname) throw new Error('Camera address is invalid. Enter 192.168.0.104 or http://192.168.0.104 in Admin.');
 return base+'/capture?t='+Date.now();
}
async function getFrame() {
 const url=captureUrl(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error('Camera /capture returned HTTP '+response.status+'.');
  const type=response.headers.get('content-type')||'';
  if(!type.toLowerCase().includes('image/'))throw new Error('Camera /capture returned '+(type||'an unknown content type')+', not an image.');
  const blob=await response.blob();if(!blob.size)throw new Error('Camera /capture returned an empty image.');return blob;
 }catch(error){
  if(error.name==='AbortError')throw new Error('Camera /capture timed out after 20 seconds. Test http://192.168.0.104/capture directly.');
  if(error instanceof TypeError)throw new Error('Browser could not fetch camera /capture. This is usually CORS or network isolation; a visible live stream does not guarantee JavaScript can fetch still photos.');
  throw error;
 }finally{clearTimeout(timer);}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function sharpnessScore(blob) {
 if(typeof createImageBitmap!=='function')return null;
 let bitmap;
 try{
  bitmap=await createImageBitmap(blob);
  const width=160,height=Math.max(1,Math.round(width*bitmap.height/bitmap.width));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;
  context.drawImage(bitmap,0,0,width,height);
  const pixels=context.getImageData(0,0,width,height).data,gray=new Float32Array(width*height);
  for(let i=0,p=0;i<pixels.length;i+=4,p++)gray[p]=.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];
  let sum=0,sumSquares=0,count=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
   const i=y*width+x,lap=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-width]-gray[i+width];
   sum+=lap;sumSquares+=lap*lap;count++;
  }
  if(!count)return null;const mean=sum/count;return Math.max(0,sumSquares/count-mean*mean);
 }catch{return null;}finally{bitmap?.close?.();}
}
export async function captureImage() {
 const count=Math.max(1,Math.min(3,Math.round(Number(getSettings().captureCount)||3)));
 let best=null,bestScore=-Infinity,last=null;
 for(let i=0;i<count;i++){
  const frame=await getFrame();last=frame;const score=await sharpnessScore(frame);
  if(score!==null&&score>=bestScore){best=frame;bestScore=score;}
  if(i===count-1&&best===null)best=last;
  if(i<count-1)await delay(250);
 }
 return best||last;
}
export async function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not prepare image.'));reader.readAsDataURL(blob);});}
