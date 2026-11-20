import { getSettings } from './settings.js?v=20261117-release1';

let shutterAudioContext=null,shutterSound=null;
// Real recorded shutter (AOSP camera_click.ogg, Apache-2.0), decoded once; synthetic click is the fallback.
function loadShutterSound(){
 if(!shutterSound)shutterSound=fetch('/shared/shutter.mp3').then(r=>r.ok?r.arrayBuffer():Promise.reject(new Error('shutter'))).then(b=>shutterAudioContext.decodeAudioData(b)).catch(()=>{shutterSound=null;return null;});
 return shutterSound;
}
export function primeShutterAudio(){
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return false;
  if(!shutterAudioContext)shutterAudioContext=new AudioContextClass();
  if(shutterAudioContext.state==='suspended')void shutterAudioContext.resume().catch(()=>{});
  void loadShutterSound();
  return true;
 }catch{return false;}
}
export async function playShutterClick(){
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return false;
  if(!shutterAudioContext)shutterAudioContext=new AudioContextClass();
  if(shutterAudioContext.state==='suspended')await shutterAudioContext.resume();
  const recorded=await loadShutterSound();
  if(recorded){const source=shutterAudioContext.createBufferSource();source.buffer=recorded;source.connect(shutterAudioContext.destination);source.start();return true;}
  const length=Math.max(1,Math.floor(shutterAudioContext.sampleRate*.045));
  const buffer=shutterAudioContext.createBuffer(1,length,shutterAudioContext.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const source=shutterAudioContext.createBufferSource();source.buffer=buffer;
  const filter=shutterAudioContext.createBiquadFilter();filter.type='highpass';filter.frequency.value=1200;
  const gain=shutterAudioContext.createGain();gain.gain.setValueAtTime(.18,shutterAudioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,shutterAudioContext.currentTime+.045);
  source.connect(filter);filter.connect(gain);gain.connect(shutterAudioContext.destination);source.start();
  return true;
 }catch{return false;}
}

const canvasBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The browser could not compress this photo.')) ,type,quality));

/** Re-encode every selected image locally so EXIF/location metadata is dropped. */
export async function compressImageToJpeg(input,{maxBytes=3_800_000,maxLongEdge=1920}={}){
 if(!(input instanceof Blob)||!input.size)throw new Error('Choose a valid photo first.');
 if(typeof createImageBitmap!=='function')throw new Error('This browser cannot resize photos. Open the app in Chrome for Android and try again.');
 let bitmap;
 try{bitmap=await createImageBitmap(input);}catch{
  throw new Error('This photo format cannot be opened by this browser. Choose a JPEG, PNG or WebP image, or convert the HEIC photo to JPEG first.');
 }
 try{
  const canvas=document.createElement('canvas');
  const initialScale=Math.min(1,maxLongEdge/Math.max(bitmap.width,bitmap.height));
  let scale=initialScale;
  for(let sizeAttempt=0;sizeAttempt<8;sizeAttempt++){
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d',{alpha:false});
   if(!context)throw new Error('Photo compression is unavailable in this browser.');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.78,.7,.62,.54]){
    const blob=await canvasBlob(canvas,'image/jpeg',quality);
    if(blob.size<maxBytes)return new File([blob],'daredevils-eye-photo.jpg',{type:'image/jpeg',lastModified:Date.now()});
   }
   scale*=.78;
  }
  throw new Error('This photo is too large to compress below 4 MB. Choose a smaller photo.');
 }finally{bitmap.close?.();}
}
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
 void playShutterClick(); // one click per capture, not per burst frame
 for(let i=0;i<count;i++){
  const frame=await getFrame();last=frame;const score=await sharpnessScore(frame);
  if(score!==null&&score>=bestScore){best=frame;bestScore=score;}
  if(i===count-1&&best===null)best=last;
  if(i<count-1)await delay(250);
 }
 return best||last;
}
export async function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not prepare image.'));reader.readAsDataURL(blob);});}
