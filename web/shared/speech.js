import { getSettings } from './settings.js?v=20261116-access2';
import { apiFetch } from './api.js?v=20261116-access2';

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

export function detectSpokenLanguage(text) {
  return /[\u0980-\u09ff]/u.test(String(text || '')) ? 'bn-BD' : 'en-US';
}

export function getAvailableVoices() {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}
export function selectVoiceForText(voices, { lang = 'en-US', voiceURI = '', text = '' } = {}) {
  const available = Array.isArray(voices) ? voices : [];
  const wantsBangla = /^bn(?:-|$)/i.test(lang) || detectSpokenLanguage(text) === 'bn-BD';
  if (wantsBangla) return available.find(v => v.voiceURI === voiceURI && /^bn(?:-|$)/i.test(v.lang || '')) ||
    available.find(v => /^bn-BD$/i.test(v.lang || '')) || available.find(v => /^bn(?:-|$)/i.test(v.lang || '')) || null;
  const languageMatches = voice => (voice.lang || '').toLowerCase() === String(lang).toLowerCase() ||
    (voice.lang || '').toLowerCase().startsWith(String(lang).slice(0,2).toLowerCase());
  return available.find(v => v.voiceURI === voiceURI && languageMatches(v)) ||
    available.find(languageMatches) || available.find(v => v.default && languageMatches(v)) || null;
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
    const requestedLang = detectSpokenLanguage(text) === 'bn-BD' ? 'bn-BD' : (options.lang || settings.speechLanguage);
    utterance.lang = requestedLang;
    utterance.rate = options.rate ?? settings.speechRate;
    utterance.pitch = options.pitch ?? settings.speechPitch;
    const voices = getAvailableVoices();
    const voiceURI = options.voiceURI ?? settings.speechVoiceURI;
    const selectedVoice = selectVoiceForText(voices, { lang: requestedLang, voiceURI, text: String(text) });
    if (selectedVoice) { utterance.voice = selectedVoice; utterance.lang = selectedVoice.lang || requestedLang; }
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

function blobToDataUrl(blob) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Could not prepare the voice recording.'));
    reader.readAsDataURL(blob);
  });
}

async function recordWithGemini({ onResult, onError, onFallback, onEnd, onStatus, onPermission, cancelled = () => false } = {}) {
  if (!('MediaRecorder' in window)) {
    onError?.('This browser cannot record audio for Gemini transcription. Type your question instead.');
    onEnd?.();
    return null;
  }
  let stream;
  try { stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false}); }
  catch (error) {
    onError?.(error.name==='NotAllowedError'?'Microphone permission was denied.':
      error.name==='NotFoundError'?'No microphone was found on this device.':
      error.name==='NotReadableError'?'The microphone is busy or unavailable.':
      error.message||'Could not open the microphone.');
    onEnd?.();
    return null;
  }
  onPermission?.();

  const mimeType = [
    'audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm','audio/mp4'
  ].find(type=>MediaRecorder.isTypeSupported?.(type)) || '';
  let recorder;
  try { recorder = mimeType ? new MediaRecorder(stream,{mimeType}) : new MediaRecorder(stream); }
  catch {
    stream.getTracks().forEach(track=>track.stop());
    onError?.('The browser audio recorder could not start. Type your question instead.');
    onEnd?.();
    return null;
  }
  const chunks=[];
  let audioContext=null, analyser=null, sampleBuffer=null, monitor=null, timeout=null;
  let startedAt=0,lastVoiceAt=0,voiceDetected=false,finished=false;

  const cleanup=()=>{
    if(monitor)clearInterval(monitor);
    if(timeout)clearTimeout(timeout);
    stream.getTracks().forEach(track=>track.stop());
    if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}
  };
  const finish=()=>{
    if(finished||recorder.state==='inactive')return;
    finished=true;
    try{recorder.stop();}catch{cleanup();}
  };
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
  recorder.onerror=()=>{
    cleanup();
    onError?.('The browser could not record microphone audio. Please type your question.');
    onEnd?.();
  };
  recorder.onstop=async()=>{
    cleanup();
    if(cancelled())return;
    const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
    if(blob.size<1200){
      onError?.('No clear speech was recorded. Please try again or type your question.');
      onEnd?.();
      return;
    }
    onStatus?.('Sending the short recording to Gemini for automatic language detection…');
    try{
      const audio=await blobToDataUrl(blob);
      const response=await apiFetch('/api/transcribe',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({audio,mimeType:blob.type})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Gemini could not transcribe the recording.');
      const transcript=String(data.transcript||'').trim();
      if(!transcript)throw new Error('Gemini returned an empty transcript. Try again or type your question.');
      onStatus?.('Voice question recognised with '+(data.model||'Gemini')+'.');
      onResult?.(transcript);
    }catch(error){onError?.(error.message||'Gemini transcription failed.');}
    finally{onEnd?.();}
  };

  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(AudioContextClass){
      audioContext=new AudioContextClass();
      await audioContext.resume().catch(()=>{});
      const source=audioContext.createMediaStreamSource(stream);
      analyser=audioContext.createAnalyser();analyser.fftSize=512;
      source.connect(analyser);sampleBuffer=new Float32Array(analyser.fftSize);
    }
  }catch{audioContext=null;analyser=null;}
  recorder.start(250);startedAt=Date.now();
  onStatus?.('Listening through the Gemini voice fallback. Speak now, then pause when finished.');
  if(analyser){
    monitor=setInterval(()=>{
      if(recorder.state!=='recording')return;
      analyser.getFloatTimeDomainData(sampleBuffer);
      let sum=0;for(const sample of sampleBuffer)sum+=sample*sample;
      const rms=Math.sqrt(sum/sampleBuffer.length);
      const now=Date.now();
      if(rms>0.018){voiceDetected=true;lastVoiceAt=now;}
      if(voiceDetected&&now-startedAt>1700&&now-lastVoiceAt>1250)finish();
    },150);
  }
  timeout=setTimeout(finish,12000);
  return {stop:finish};
}

/**
 * Use native speech recognition when its service is reachable. When the
 * service reports a network/service error, automatically record a short clip
 * and ask Gemini's low-cost model to transcribe and language-normalise it.
 */
export async function listenOnce({
  lang = getSettings().speechInputLanguage || 'bn-BD', preferGemini = true,
  onResult, onInterim, onError, onEnd, onPermission, onStart, onFallback, onStatus
} = {}) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    onError?.('Microphone access requires HTTPS or localhost. This HTTP LAN address is not a secure context.');
    return null;
  }
  let fallbackController = null, stopped = false;
  const stop = () => { stopped = true; fallbackController?.stop?.(); };
  if (preferGemini) {
    onFallback?.('Listening in multilingual mode. Bangla, English and mixed speech are supported.');
    fallbackController = await recordWithGemini({ onResult, onError, onEnd, onStatus, onPermission, cancelled: () => stopped });
    return { stop };
  }
  let permissionStream;
  try {
    permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    permissionStream.getTracks().forEach(track => track.stop());
    onPermission?.();
  } catch (error) {
    const reason = error.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow microphone access in browser site settings.' :
      error.name === 'NotFoundError' ? 'No microphone was found on this device.' :
      error.name === 'NotReadableError' ? 'The microphone is busy or unavailable in another app.' :
      error.message || 'Unknown microphone error.';
    onError?.(reason); return null;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let fallbackNeeded = false, fallbackStarted = false;
  const startFallback = async () => {
    if (fallbackStarted || stopped) return;
    fallbackStarted = true;
    onFallback?.('Browser recognition did not return speech. Switching to Gemini multilingual transcription.');
    fallbackController = await recordWithGemini({ onResult, onError, onEnd, onStatus, cancelled: () => stopped });
  };
  if (!Recognition) { await startFallback(); return { stop }; }
  try {
    const recognition = new Recognition();
    recognition.lang = lang; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
    let finalReceived = false;
    recognition.onresult = event => {
      let interim = '', finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i], transcript = result[0]?.transcript || '';
        if (result.isFinal) finalText += transcript; else interim += transcript;
      }
      if (interim) onInterim?.(interim);
      if (finalText) { finalReceived = true; onResult?.(finalText.trim()); }
    };
    recognition.onstart = () => onStart?.();
    recognition.onerror = event => {
      if (['network','service-not-allowed','language-not-supported','no-speech'].includes(event.error)) {
        fallbackNeeded = true; try { recognition.stop(); } catch {}
      } else {
        const reasons = { 'not-allowed':'Speech recognition permission was denied.','audio-capture':'The browser could not access the microphone.' };
        onError?.(reasons[event.error] || ('Speech input failed: '+(event.error || 'unknown error')+'.'));
      }
    };
    recognition.onend = () => {
      if (fallbackNeeded && !finalReceived) { startFallback(); return; }
      if (!finalReceived && !stopped) onEnd?.();
    };
    recognition.start(); return { stop, recognition };
  } catch { await startFallback(); return { stop }; }
}
export function vibrate(pattern = 80) { try { navigator.vibrate?.(pattern); } catch {} }
