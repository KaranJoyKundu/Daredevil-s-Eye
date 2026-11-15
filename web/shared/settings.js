const KEY = 'daredevils-eye.device-settings.v1';
const DEFAULTS = Object.freeze({ cameraBaseUrl: 'http://192.168.0.104', captureCount: 3, speechLanguage: 'en-US', speechRate: 1, emergencyName: '', emergencyPhone: '', customPrompt: '', consentAccepted: false });
export function normalizeCameraAddress(value) {
 let address=String(value||'').trim();
 if(!address)address=DEFAULTS.cameraBaseUrl;
 if(!/^https?:\/\//i.test(address))address='http://'+address;
 return address.replace(/\/+$/,'');
}
export function getSettings() {
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
  let cameraBaseUrl=saved.cameraBaseUrl;
  if(!cameraBaseUrl||cameraBaseUrl==='http://192.168.4.1'||cameraBaseUrl==='192.168.0.104')cameraBaseUrl=DEFAULTS.cameraBaseUrl;
  return {...DEFAULTS,...saved,cameraBaseUrl:normalizeCameraAddress(cameraBaseUrl)};
 }catch{return {...DEFAULTS};}
}
export function saveSettings(patch) {
 const next={...getSettings(),...patch};
 if('cameraBaseUrl' in patch)next.cameraBaseUrl=normalizeCameraAddress(patch.cameraBaseUrl);
 localStorage.setItem(KEY,JSON.stringify(next));
 return next;
}
export function clearSettings(){localStorage.removeItem(KEY);}
export {DEFAULTS};