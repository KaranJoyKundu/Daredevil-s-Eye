import { getSettings } from './settings.js';
export function speak(text, options = {}) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text)), settings = getSettings();
  utterance.lang = options.lang || settings.speechLanguage; utterance.rate = options.rate || settings.speechRate;
  if (options.onEnd) utterance.onend = options.onEnd; if (options.onError) utterance.onerror = options.onError;
  window.speechSynthesis.speak(utterance); return utterance;
}
export function stopSpeaking() { window.speechSynthesis?.cancel(); }
export function listenOnce({ lang = getSettings().speechLanguage, onResult, onError } = {}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { onError?.('Speech recognition is not available. Type your question instead.'); return null; }
  const recognition = new Recognition(); recognition.lang = lang; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onresult = event => onResult?.(event.results?.[0]?.[0]?.transcript || '');
  recognition.onerror = event => onError?.('Speech input failed: ' + (event.error || 'unknown error') + '. Type your question instead.');
  recognition.start(); return recognition;
}
export function vibrate(pattern = 80) { try { navigator.vibrate?.(pattern); } catch {} }