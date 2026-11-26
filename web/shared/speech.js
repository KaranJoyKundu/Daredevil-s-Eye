import { getSettings } from './settings.js?v=20261117-release5';
import { apiFetch } from './api.js?v=20261117-release5';

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
let speechRun=0;

export function detectSpokenLanguage(text) {
  return /[\u0980-\u09ff]/u.test(String(text || '')) ? 'bn-BD' : 'en-US';
}

export function resolveSpeechLanguage(text, requestedLanguage = 'en-US') {
  // Full Bangla mode applies to all app speech, including prompts and errors.
  if (requestedLanguage === 'bn-BD') return 'bn-BD';
  return detectSpokenLanguage(text) === 'bn-BD' ? 'bn-BD' : requestedLanguage;
}

export function cleanTextForSpeech(value) {
  return String(value ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~#>|]/g, ' ')
    .replace(/^[\s•\-–—]+/gm, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitSpeechText(value, maxLength = 420) {
  const text = cleanTextForSpeech(value);
  if (!text) return [];
  const limit = Math.max(80, Math.min(900, Number(maxLength) || 420));
  const sentences = text.split(/(?<=[.!?।॥])\s+/u).filter(Boolean);
  const chunks = [];
  let current = '';
  const push = part => { if (part.trim()) chunks.push(part.trim()); };
  for (const sentence of sentences) {
    if (sentence.length <= limit) {
      if (!current) current = sentence;
      else if ((current + ' ' + sentence).length <= limit) current += ' ' + sentence;
      else { push(current); current = sentence; }
      continue;
    }
    if (current) { push(current); current = ''; }
    const clauses = sentence.split(/(?<=[,;:])\s+/u);
    for (const clause of clauses) {
      if (clause.length <= limit) {
        if (!current) current = clause;
        else if ((current + ' ' + clause).length <= limit) current += ' ' + clause;
        else { push(current); current = clause; }
      } else {
        if (current) { push(current); current = ''; }
        const words = clause.split(/\s+/u);
        for (const word of words) {
          if (!current) current = word;
          else if ((current + ' ' + word).length <= limit) current += ' ' + word;
          else { push(current); current = word; }
        }
      }
    }
  }
  if (current) push(current);
  return chunks;
}

export function getAvailableVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try { return window.speechSynthesis.getVoices() || []; } catch { return []; }
}

export function isBengaliVoice(voice) {
  const lang = String(voice?.lang || '').replace(/_/g, '-');
  const label = String(voice?.name || '') + ' ' + String(voice?.voiceURI || '');
  return /^bn(?:-|$)/i.test(lang) || /bengali|bangla|বাংলা/i.test(label);
}

export function refreshAvailableVoices(timeoutMs = 5000) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const first = getAvailableVoices();
  if (first.some(isBengaliVoice)) return Promise.resolve(first);
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.('voiceschanged', onVoicesChanged);
      resolve(getAvailableVoices());
    };
    const onVoicesChanged = () => {
      if (getAvailableVoices().some(isBengaliVoice)) finish();
    };
    synth.addEventListener?.('voiceschanged', onVoicesChanged);
    for (const delay of [120, 400, 900, 1800, 3200]) {
      setTimeout(() => {
        if (!settled && getAvailableVoices().some(isBengaliVoice)) finish();
      }, delay);
    }
    setTimeout(finish, Math.max(700, timeoutMs));
  });
}

export function selectVoiceForText(voices, { lang = 'en-US', voiceURI = '', text = '' } = {}) {
  const available = Array.isArray(voices) ? voices : [];
  const wantsBangla = /^bn(?:-|$)/i.test(lang) || detectSpokenLanguage(text) === 'bn-BD';
  if (wantsBangla) return available.find(v => v.voiceURI === voiceURI && isBengaliVoice(v)) ||
    available.find(isBengaliVoice) || null;
  const languageMatches = voice => (voice.lang || '').toLowerCase() === String(lang).toLowerCase() ||
    (voice.lang || '').toLowerCase().startsWith(String(lang).slice(0,2).toLowerCase());
  return available.find(v => v.voiceURI === voiceURI && languageMatches(v)) ||
    available.find(languageMatches) || available.find(v => v.default && languageMatches(v)) || null;
}

function stopDeviceSpeech() {
  speechRun += 1;
  try { window.speechSynthesis?.cancel(); } catch {}
}

function runSpeechQueue(chunks, options, settings, runId, voices) {
  let index = 0;
  let firstStarted = false;
  let banglaFallbackNoticeSent = false;
  const requestedLanguage = options.lang || settings.speechLanguage || 'en-US';
  const voiceURI = options.voiceURI ?? settings.speechVoiceURI;
  const fail = message => {
    if (runId !== speechRun) return;
    options.onError?.(message);
  };
  const next = () => {
    if (runId !== speechRun) return;
    if (index >= chunks.length) { options.onEnd?.(); return; }
    const chunk = chunks[index++];
    const lang = resolveSpeechLanguage(chunk, requestedLanguage);
    const selectedVoice = selectVoiceForText(voices, { lang, voiceURI, text: chunk });
    if (/^bn(?:-|$)/i.test(lang) && !selectedVoice && !banglaFallbackNoticeSent) {
      banglaFallbackNoticeSent = true;
      options.onVoiceFallback?.('Chrome did not expose a Bengali voice name. Trying Android text-to-speech directly with the bn-BD language.');
    }
    try {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = selectedVoice?.lang || lang;
      utterance.rate = options.rate ?? settings.speechRate ?? 1;
      utterance.pitch = options.pitch ?? settings.speechPitch ?? 1;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onstart = () => {
        if (!firstStarted) { firstStarted = true; options.onStart?.(); }
      };
      utterance.onend = () => {
        if (runId !== speechRun) return;
        if (index < chunks.length) setTimeout(next, 70);
        else options.onEnd?.();
      };
      utterance.onerror = event => {
        if (runId !== speechRun) return;
        fail('Device speech stopped: ' + (event.error || 'unknown speech error') + '.');
      };
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      fail('Could not start device speech: ' + (error.message || 'unknown error'));
    }
  };
  // Cancelling and speaking in the same browser task can drop the new utterance.
  setTimeout(next, 40);
  return { queued: true, cancel: stopDeviceSpeech };
}

export function speak(text, options = {}) {
  const nativeTts=window.DaredevilVolumeControls;
  if(window.Capacitor?.isNativePlatform?.()&&nativeTts?.speakText){
    const settings=getSettings(),language=options.lang||settings.speechLanguage||'en-US',chunks=splitSpeechText(text);
    if(!chunks.length){options.onEnd?.();return {queued:false};}
    stopSpeaking();let cancelled=false,index=0;
    const next=async()=>{if(cancelled)return;if(index>=chunks.length){options.onEnd?.();return;}
      try{await nativeTts.speakText({text:chunks[index],language:resolveSpeechLanguage(chunks[index],language),rate:options.rate??settings.speechRate??1,pitch:options.pitch??settings.speechPitch??1});index++;if(index===1)options.onStart?.();if(!cancelled)setTimeout(next,100);}
      catch(error){if(!cancelled)options.onError?.('Android text-to-speech failed: '+(error?.message||'check installed speech engine and language data')+'.');}};
    next();return {queued:true,cancel:()=>{cancelled=true;nativeTts.stopSpeech?.();}};
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    options.onError?.('Device speech synthesis is unavailable in this browser.');
    return false;
  }
  const settings = getSettings();
  const chunks = splitSpeechText(text);
  if (!chunks.length) { options.onEnd?.(); return { queued: false }; }
  try {
    stopDeviceSpeech();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = null; }
    const runId = speechRun;
    let voices = getAvailableVoices();
    const requestedLanguage = options.lang || settings.speechLanguage || 'en-US';
    // Windows/desktop Chrome has no Bengali system voice; Android resolves bn-BD itself, so only desktop goes to the cloud voice.
    const needsCloud = list => !options.noCloud && !/Android/i.test(navigator.userAgent || '') && !list.some(isBengaliVoice) &&
      (/^bn(?:-|$)/i.test(requestedLanguage) || detectSpokenLanguage(text) === 'bn-BD');
    const start = list => needsCloud(list) ? speakResponse(text, { ...options, engine: 'gemini' }) : runSpeechQueue(chunks, options, settings, runId, list);
    if (voices.length) return start(voices);

    let settled = false;
    let timer = null;
    const finish = list => {
      if (settled || runId !== speechRun) return;
      settled = true;
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener?.('voiceschanged', onVoices);
      const ready = Array.isArray(list) ? list : [];
      // Let Android resolve a requested locale even when Chrome exposes no voices.
      start(ready);
    };
    const onVoices = () => {
      const list = getAvailableVoices();
      if (list.length) finish(list);
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoices);
    timer = setTimeout(() => finish(getAvailableVoices()), 2600);
    return { queued: true, cancel: stopDeviceSpeech };
  } catch (error) {
    options.onError?.('Could not start device speech: ' + (error.message || 'unknown error'));
    return false;
  }
}

export async function speakResponse(text, options = {}) {
  const settings=getSettings(),engine=options.engine||settings.speechEngine;
  if(engine!=='gemini')return speak(text,options);
  stopSpeaking();
  const run=speechRun;
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
    if(run!==speechRun)return null; // a newer speak() started while this audio was downloading
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
    return speak(text,{...options,noCloud:true});
  }
}

export function stopSpeaking() {
  try { if (window.Capacitor?.isNativePlatform?.()) window.DaredevilVolumeControls?.stopSpeech?.(); } catch {}
  stopDeviceSpeech();
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

async function recordWithGemini({ onResult, onError, onFallback, onEnd, onStatus, onPermission, outputLanguage = 'en-US', saveToHistory = false, cancelled = () => false } = {}) {
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
        body:JSON.stringify({audio,mimeType:blob.type,responseLanguage:outputLanguage,saveToHistory})
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
  onResult, onInterim, onError, onEnd, onPermission, onStart, onFallback, onStatus,
  outputLanguage = getSettings().speechLanguage || 'en-US',
  saveToHistory = getSettings().savePhotoHistory === true
} = {}) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    onError?.('Microphone access requires HTTPS or localhost. This HTTP LAN address is not a secure context.');
    return null;
  }
  let fallbackController = null, stopped = false;
  const stop = () => { stopped = true; fallbackController?.stop?.(); };
  if (preferGemini) {
    onFallback?.('Listening in multilingual mode. Bangla, English and mixed speech are supported.');
    fallbackController = await recordWithGemini({ onResult, onError, onEnd, onStatus, onPermission, outputLanguage, saveToHistory, cancelled: () => stopped });
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
    fallbackController = await recordWithGemini({ onResult, onError, onEnd, onStatus, outputLanguage, saveToHistory, cancelled: () => stopped });
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
