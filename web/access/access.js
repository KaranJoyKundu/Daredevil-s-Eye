import {saveAccessToken,getAccessToken} from '/shared/api.js?v=20261116-auth1';
const input=document.querySelector('#app-token'),button=document.querySelector('#unlock-button'),status=document.querySelector('#access-status');
const params=new URLSearchParams(location.search),requested=params.get('next')||'/action/';
const next=requested.startsWith('/')&&!requested.startsWith('//')?requested:'/action/';
if(getAccessToken())status.textContent='This tab already has an unlocked session. Enter a token again to replace it.';
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Checking token…';
 try{await saveAccessToken(input.value);status.textContent='Access verified. Opening the app…';location.replace(next);}
 catch(error){status.textContent=error.message;input.focus();}
 finally{button.disabled=false;}
});
input.addEventListener('keydown',event=>{if(event.key==='Enter')button.click();});
