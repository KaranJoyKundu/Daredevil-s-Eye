import { getSettings } from './settings.js?v=20261116-public1';
import { apiFetch } from './api.js?v=20261116-public1';

export const VOICE_PRESETS = Object.freeze({
  gentle: { label: 'Gentle · soft and slightly higher', rate: 0.94, pitch: 1.14 },
  warm: { label: 'Warm · relaxed and friendly', rate: 0.94, pitch: 1.03 },
  bright: { label: 'Bright · lively and upbeat', rate: 1.02, pitch: 1.18 },
  calm: { label: 'Calm · slower and lower', rate: 0.88, pitch: 0.94 },
  clear: { label: 'Clear · steady and neutral', rate: 1.0, pitch: 1.0 },
  custom: { label: 'Custom · use the sliders', rate: 1.0, pitch: 1.0 }
});
export const GEMINI_TTS_VOICES = Object.freeze([
  {id:'Achernar',gender:'Female',style:'Soft'},{id:'Achird',gender:'Male',style:'Friendly'},
  {id:'Algenib',gender:'Male',style:'Gravelly'},{id:'Algieba',gender:'Male',style:'Smooth'},
  {id:'Alnilam',gender:'Male',style:'Firm'},{id:'Aoede',gender:'Female',style:'Breezy'},
  {id:'Autonoe',gender:'Female',style:'Bright'},{id:'Callirrhoe',gender:'Female',style:'Easy-going'},
  {id:'Charon',gender:'Male',style:'Informative'},{id:'Despina',gender:'Female',style:'Smooth'},
  {id:'Enceladus',gender:'Male',style:'Breathy'},{id:'Erinome',gender:'Female',style:'Clear'},
  {id:'Fenrir',gender:'Male',style:'Excitable'},{id:'Gacrux',gender:'Female',style:'Mature'},
  {id:'Iapetus',gender:'Male',style:'Clear'},{id:'Kore',gender:'Female',style:'Firm'},
  {id:'Laomedeia',gender:'Female',style:'Upbeat'},{id:'Leda',gender:'Female',style:'Youthful'},
  {id:'Orus',gender:'Male',style:'Firm'},{id:'Pulcherrima',gender:'Female',style:'Forward'},
  {id:'Puck',gender:'Male',style:'Upbeat'},{id:'Rasalgethi',gender:'Male',style:'Informative'},
  {id:'Sadachbia',gender:'Male',style:'Lively'},{id:'Sadaltager',gender:'Male',style:'Knowledgeable'},
  {id:'Schedar',gender:'Male',style:'Even'},{id:'Sulafat',gender:'Female',style:'Warm'},
  {id:'Umbriel',gender:'Male',style:'Easy-going'},{id:'Vindemiatrix',gender:'Female',style:'Gentle'},
  {id:'Zephyr',gender:'Female',style:'Bright'},{id:'Zubenelgenubi',gender:'Male',style:'Casual'}
]);

let currentAudio=null,currentAudioUrl=null;

export function getAvailableVoices() {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function speak(text, options = {}) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    options.onError?.('Device speech synthesis is unavailable in this browser.');
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    if(currentAudio){currentAudio.pause();currentAudio=null;}
    if(currentAudioUrl){URL.revokeObjectURL(currentAudioUrl);currentAudioUrl=null;}
    const utterance = new SpeechSynthesisUtterance(String(text)), settings = getSettings();
    utterance.lang = options.lang || settings.speechLanguage;
    utterance.rate = options.rate ?? settings.speechRate;
    utterance.pitch = options.pitch ?? settings.speechPitch;
    const voices = getAvailableVoices();
    const voiceURI = options.voiceURI ?? settings.speechVoiceURI;
    if (voiceURI) utterance.voice = voices.find(voice => voice.voiceURI === voiceURI) || null;
    if (options.onEnd) utterance.onend = options.onEnd;
    if (options.onError) utterance.onerror = options.onError;
    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (error) {
    options.onError?.('Could not start device speech: ' + (error.message || 'unknown error'));
    return false;
  }
}

export async function speakResponse(text, options = {}) {
  const settings=getSettings(),engine=options.engine||settings.speechEngine;
  if(engine!=='gemini')return speak(text,options);
  stopSpeaking();
  try{
    const response=await apiFetch('/api/speech',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        text:String(text).slice(0,3500),
        voice:options.voice||settings.geminiTtsVoice,
        style:options.style||settings.geminiTtsStyle,
        language:options.lang||settings.speechLanguage
      })
    });
    if(!response.ok){
      const data=await response.json().catch(()=>({}));
      throw new Error(data.error||'Gemini voice request failed.');
    }
    const blob=await response.blob();
    currentAudioUrl=URL.createObjectURL(blob);
    currentAudio=new Audio(currentAudioUrl);
    currentAudio.onended=()=>{
      currentAudio=null;
      if(currentAudioUrl){URL.revokeObjectURL(currentAudioUrl);currentAudioUrl=null;}
      options.onEnd?.();
    };
    currentAudio.onerror=()=>{
      currentAudio=null;
      if(currentAudioUrl){URL.revokeObjectURL(currentAudioUrl);currentAudioUrl=null;}
      options.onError?.('Could not play the Gemini voice audio.');
    };
    await currentAudio.play();
    return currentAudio;
  }catch(error){
    currentAudio=null;
    if(currentAudioUrl){URL.revokeObjectURL(currentAudioUrl);currentAudioUrl=null;}
    if(options.fallback===false)throw error;
    options.onFallback?.(error);
    return speak(text,options);
  }
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
  if(currentAudio){currentAudio.pause();currentAudio=null;}
  if(currentAudioUrl){URL.revokeObjectURL(currentAudioUrl);currentAudioUrl=null;}
}

/**
 * Request microphone permission explicitly from a user gesture, immediately
 * release the temporary stream, then let SpeechRecognition acquire the mic.
 */
export async function listenOnce({ lang = getSettings().speechLanguage, onResult, onInterim, onError, onEnd, onPermission, onStart } = {}) {
  if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){
    onError?.('Microphone access requires HTTPS or localhost. This HTTP LAN address is not a secure context.');
    return null;
  }
  let stream;
  try {
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    stream.getTracks().forEach(track=>track.stop());
    stream=null;
    onPermission?.();
  } catch(error) {
    const reason=error.name==='NotAllowedError'?'Microphone permission was denied. Allow microphone access in browser site settings.':
      error.name==='NotFoundError'?'No microphone was found on this device.':
      error.name==='NotReadableError'?'The microphone is busy or unavailable in another app.':
      error.message||'Unknown microphone error.';
    onError?.(reason);
    return null;
  }

  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){
    onError?.('Microphone permission was granted, but this browser does not support speech recognition. Try a recent Chrome browser or type your question.');
    return null;
  }

  try {
    const recognition=new Recognition();
    recognition.lang=lang;
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;
    let finalReceived=false;
    recognition.onresult=event=>{
      let interim='',finalText='';
      for(let i=event.resultIndex;i<event.results.length;i+=1){
        const result=event.results[i],transcript=result[0]?.transcript||'';
        if(result.isFinal)finalText+=transcript;else interim+=transcript;
      }
      if(interim)onInterim?.(interim);
      if(finalText){finalReceived=true;onResult?.(finalText.trim());}
    };
    recognition.onstart=()=>onStart?.();
    recognition.onerror=event=>{
      const reasons={
        'not-allowed':'Speech recognition permission was denied.',
        'service-not-allowed':'The browser speech-recognition service is blocked.',
        'no-speech':'No speech was recognised. Speak clearly and try again.',
        'audio-capture':'The browser could not access the microphone.',
        'language-not-supported':'This browser speech service does not support '+lang+'.',
        'network':'The browser speech service could not connect to its recognition service.'
      };
      onError?.(reasons[event.error]||('Speech input failed: '+(event.error||'unknown error')+'.'));
    };
    recognition.onend=()=>{if(!finalReceived)onEnd?.();};
    recognition.start();
    return {stop:()=>{try{recognition.stop();}catch{}},recognition};
  } catch(error) {
    onError?.('Could not start speech recognition: '+(error.message||'unknown error'));
    return null;
  }
}

export function vibrate(pattern = 80) { try { navigator.vibrate?.(pattern); } catch {} }
