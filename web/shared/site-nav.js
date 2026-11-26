import {saveSettings,getSettings} from './settings.js?v=20261117-release5';
import {mountLanguageSwitch} from './language.js?v=20261117-release5';
import {startRFIDListener} from './rfid-listener.js?v=20261126-bg2';

const links = [
  ['Home','/action/'],['Medicine RFID','/medicine/'],['Blind mode','/blind/'],['Admin / Settings','/admin/'],
  ['Diagnostics','/diagnostics/'],['Account & History','/account/'],['Help','/help/'],['SOS Receiver','/sos-receiver/'],
  ['Contact','/contact/'],['Support','/support/'],['Terms & Conditions','/terms/'],['Privacy','/privacy/']
];
const bar=document.createElement('div');
bar.className='site-nav';
bar.innerHTML='<details class="site-menu"><summary aria-label="Open site menu"><span aria-hidden="true">☰</span><span class="menu-label">Menu</span></summary><nav aria-label="Main navigation"></nav></details><a class="site-brand" href="/action/" aria-label="Daredevil’s Eye — return to home">Daredevil’s Eye</a>';
const menu=bar.querySelector('nav');
for(const [label,href] of links){
  const link=document.createElement('a');
  link.href=href;link.textContent=label;
  if(location.pathname.replace(/\/?$/,'/')===href)link.setAttribute('aria-current','page');
  menu.append(link);
}
document.body.prepend(bar);
mountLanguageSwitch(bar);
startRFIDListener();

// Always-visible privacy notice. AI processing is required for Describe/Ask; history storage is optional.
const privacyNotice=document.createElement('aside');
privacyNotice.className='privacy-notice';
privacyNotice.setAttribute('role','note');
privacyNotice.innerHTML='<strong>Privacy notice</strong><span>Photos and voice requests are sent to this app’s service and Google Gemini when you use AI features. Photo history is optional and can be turned off at any time. <a href="/privacy/">Read the full privacy notice</a>.</span><label><input id="privacy-history-toggle" type="checkbox"> Save my submitted photos to history</label>';
document.body.insertBefore(privacyNotice,bar.nextSibling);
const historyToggle=privacyNotice.querySelector('#privacy-history-toggle');
historyToggle.checked=getSettings().savePhotoHistory===true;
historyToggle.addEventListener('change',()=>saveSettings({savePhotoHistory:historyToggle.checked}));
const details=bar.querySelector('details');
document.addEventListener('pointerdown',event=>{
  if(details?.open&&!bar.querySelector('.site-menu')?.contains(event.target))details.removeAttribute('open');
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')details?.removeAttribute('open');
});
bar.querySelectorAll('.site-menu nav a').forEach(link=>link.addEventListener('click',()=>details?.removeAttribute('open')));
