import { getSettings } from './settings.js';
export const VOICE_PRESETS = Object.freeze({
  gentle: { label: 'Gentle · soft and slightly higher', rate: 0.94, pitch: 1.14 },
  warm: { label: 'Warm · relaxed and friendly', rate: 0.94, pitch: 1.03 },
  bright: { label: 'Bright · lively and upbeat', rate: 1.02, pitch: 1.18 },
  calm: { label: 'Calm · slower and lower', rate: 0.88, pitch: 0.94 },
  clear: { label: 'Clear · steady and neutral', rate: 1.0, pitch: 1.0 },
  custom: { label: 'Custom · use the sliders', rate: 1.0, pitch: 1.0 }
});
export function getAvailableVoices() {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}
export function speak(text, options = {}) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  const settings = getSettings();
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
}
export function stopSpeaking() { window.speechSynthesis?.cancel(); }
export function listenOnce({ lang = getSettings().speechLanguage, onResult, onInterim, onError, onEnd } = {}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { onError?.('Speech recognition is not available in this browser. Try Chrome or type your question.'); return null; }
  try {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) onInterim?.(interim);
      if (finalText) onResult?.(finalText.trim());
    };
    recognition.onerror = event => onError?.('Speech input failed: ' + (event.error || 'unknown error') + '.');
    recognition.onend = () => onEnd?.();
    recognition.start();
    return recognition;
  } catch (error) {
    onError?.('Could not start microphone recognition: ' + (error.message || 'unknown error'));
    return null;
  }
}
export function vibrate(pattern = 80) { try { navigator.vibrate?.(pattern); } catch {} }
