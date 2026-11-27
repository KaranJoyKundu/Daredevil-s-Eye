import {mountLanguageSwitch} from './language.js?v=20261117-release5';
import {startRFIDListener} from './rfid-listener.js?v=20261126-bg2';

const groups = [
  ['USE', [['Action','/action/'],['Blind mode','/blind/']]],
  ['SAFETY', [['SOS Center','/sos/'],['Medicine','/medicine/']]],
  ['DEVICES', [['Device setup','/devices/']]],
  ['CONTROL CENTER', [['Admin / Settings','/admin/'],['Diagnostics','/diagnostics/']]],
  ['INFORMATION', [['About','/'],['Help','/help/'],['Documentation','/documentation/'],['Privacy','/privacy/'],['Terms','/terms/'],['Support','/support/'],['Contact','/contact/'],['Account & History','/account/']]]
];
const bar=document.createElement('div');
bar.className='site-nav';
bar.innerHTML='<details class="site-menu"><summary aria-label="Open site menu"><span aria-hidden="true">☰</span><span class="menu-label">Menu</span></summary><nav aria-label="Main navigation"></nav></details><a class="site-brand" href="/action/" aria-label="Daredevil’s Eye — return to home">Daredevil’s Eye</a>';
const menu=bar.querySelector('nav');
for(const [groupName,items] of groups){
  const group=document.createElement('div');
  group.className='site-menu-group';
  const heading=document.createElement('span');
  heading.className='site-menu-group-title';
  heading.textContent=groupName;
  group.append(heading);
  for(const [label,href] of items){
    const link=document.createElement('a');
    link.href=href;link.textContent=label;
    if(location.pathname.replace(/\/?$/,'/')===href)link.setAttribute('aria-current','page');
    group.append(link);
  }
  menu.append(group);
}eSwitch} from './language.js?v=20261117-release5';
import {startRFIDListener} from './rfid-listener.js?v=20261126-bg2';

const groups = [
  ['USE', [['Action','/action/'],['Blind mode','/blind/']]],
  ['SAFETY', [['SOS Center','/sos/'],['Medicine','/medicine/']]],
  ['DEVICES', [['Device setup','/devices/']]],
  ['CONTROL CENTER', [['Admin / Settings','/admin/'],['Diagnostics','/diagnostics/']]],
  ['INFORMATION', [['About','/'],['Help','/help/'],['Documentation','/documentation/'],['Privacy','/privacy/'],['Terms','/terms/'],['Support','/support/'],['Contact','/contact/'],['Account & History','/account/']]]
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

// Small, informational notice only. No checkbox or interaction is required.
const privacyNotice=document.createElement('aside');
privacyNotice.className='privacy-notice';
privacyNotice.setAttribute('role','note');
privacyNotice.innerHTML='<span><strong>Privacy:</strong> Photos and voice are processed by this app and Google Gemini when you use AI features. <a href="/privacy/">Details</a>.</span>';
document.body.insertBefore(privacyNotice,bar.nextSibling);
const details=bar.querySelector('details');
document.addEventListener('pointerdown',event=>{
  if(details?.open&&!bar.querySelector('.site-menu')?.contains(event.target))details.removeAttribute('open');
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')details?.removeAttribute('open');
});
bar.querySelectorAll('.site-menu nav a').forEach(link=>link.addEventListener('click',()=>details?.removeAttribute('open')));
