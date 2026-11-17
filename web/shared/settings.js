const KEY = 'daredevils-eye.device-settings.v1';

function createDeviceId() {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random number generation is unavailable in this browser.');
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

const DEFAULTS = Object.freeze({
  cameraBaseUrl: 'http://192.168.0.104', captureCount: 3, requirePhotoConfirmation: true,
  savePhotoHistory: true, languageMode: 'bn',
  customInterfaceLanguage: 'en', customSpeechLanguage: 'bn-BD',
  customSpeechInputMode: 'auto', customSpeechInputLanguage: 'bn-BD', customSosVoiceLanguage: 'bn-BD',
  speechLanguage: 'bn-BD', speechInputMode: 'auto', speechInputLanguage: 'bn-BD',
  sosShakeEnabled: false, sosVoiceEnabled: false, sosVoiceLanguage: 'bn-BD',
  speechRate: 0.96, speechPitch: 1.08, speechPreset: 'gentle', speechVoiceURI: '', speechEngine: 'device',
  geminiTtsVoice: 'Kore', geminiTtsStyle: 'Warm, calm, gentle, clear and friendly.',
  deviceId: '', emergencyName: '', emergencyPhone: '', customPrompt: '',
  aiModel: 'gemini-3.8-flash', waitSeconds: 120, responseStyle: 'concise',
  theme: 'refined', followSystemTheme: true, textSize: 'normal', highContrast: false, reducedMotion: false,
  consentAccepted: false
});

const UI_COPY = Object.freeze({
  app_subtitle: ['আপনার অডিওভিত্তিক দৃশ্য সহকারী', 'Your audio-first visual assistant'],
  status_ready: ['প্রস্তুত। একটি কাজ বেছে নিন।', 'Ready. Choose an action.'],
  main_actions: ['প্রধান কাজগুলো', 'Main actions'],
  describe: ['বর্ণনা করুন', 'DESCRIBE'],
  describe_question: ['আমার আশেপাশে কী আছে?', "What's around me?"],
  ask_ai: ['এআই-কে জিজ্ঞাসা', 'ASK AI'],
  ask_question: ['একটি প্রশ্ন করুন', 'Ask a question'],
  contact_person: ['বিশ্বস্ত ব্যক্তিকে যোগাযোগ করুন', 'Contact trusted person'],
  help: ['সহায়তা', 'HELP'],
  help_subtitle: ['নির্দেশনা ও সহায়তা', 'Instructions and support'],
  call_contact: ['বিশ্বস্ত ব্যক্তিকে কল করুন', 'Call trusted contact'],
  phone_photo: ['ফোনের ছবি ব্যবহার করুন', 'Use a phone photo'],
  use_camera: ['ফোনের ক্যামেরা ব্যবহার করুন', 'Use phone camera'],
  upload_photo: ['ছবি আপলোড করুন', 'Upload a photo'],
  photo_hint: ['পাঠানোর আগে এই ডিভাইসেই বড় ছবি ছোট করা হয়। Admin-এ নিশ্চিতকরণ চালু থাকলে আগে ছবির প্রিভিউ দেখানো হবে।', 'Large photos are compressed on this device before sending. A preview appears first when the confirmation option is enabled in Admin.'],
  no_photo: ['কোনো ছবি নির্বাচন করা হয়নি।', 'No photo selected.'],
  question_optional: ['এআই-এর জন্য প্রশ্ন (ঐচ্ছিক)', 'Question for the AI (optional)'],
  ask_photo: ['এই ছবি সম্পর্কে এআই-কে জিজ্ঞাসা করুন', 'Ask AI about this photo'],
  remove_photo: ['ছবি সরিয়ে ফেলুন', 'Remove photo'],
  response: ['উত্তর', 'Response'],
  response_placeholder: ['আপনার উত্তর এখানে দেখা যাবে এবং জোরে পড়ে শোনানো হবে।', 'Your response will appear here and be spoken aloud.'],
  welcome: ['স্বাগতম', 'WELCOME'],
  before_begin: ['শুরু করার আগে', 'Before you begin'],
  consent_intro: ['ছবি ও ভয়েস অনুরোধ এই অ্যাপ, Cloudflare এবং Google Gemini দ্বারা প্রক্রিয়াকৃত হতে পারে। সম্মতি দেওয়ার পর এআই বিশ্লেষণের জন্য পাঠানো প্রতিটি ছবি স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে: সাইন-ইন করা ব্যবহারকারীর ব্যক্তিগত অ্যাকাউন্ট ইতিহাসে এবং অতিথির ছবি এই ব্রাউজারে ৩০ দিনের জন্য। Admin থেকে ছবি সংরক্ষণ বন্ধ করা যায়।', 'Photos and voice requests may be processed by this app, Cloudflare and Google Gemini. After you accept, each photo you submit for AI analysis is saved automatically: signed-in users get private account history, while guests get private history tied to this browser for 30 days. You can turn photo saving off in Admin.'],
  consent_details: ['সম্পূর্ণ নিরাপত্তা ও তথ্য-সংক্রান্ত বিবরণ Terms & Conditions এবং Privacy পৃষ্ঠায় দেওয়া আছে।', 'The Terms & Conditions and Privacy pages contain the complete safety and data details.'],
  consent_check: ['আমি Terms & Conditions এবং Privacy notice পড়েছি এবং সম্মত হয়েছি।', 'I have read and agree to the Terms & Conditions and Privacy notice.'],
  consent_accept: ['সম্মত হয়ে চালিয়ে যান', 'Accept & continue'],
  consent_reject: ['প্রত্যাখ্যান করুন', 'Reject'],
  repeat: ['আবার শুনুন', 'REPEAT'],
  repeat_subtitle: ['শেষ উত্তরটি আবার শুনুন', 'Hear the last answer again'],
  ask_voice: ['ভয়েসে প্রশ্ন করুন', 'Ask by voice'],
  sos_twice: ['নিশ্চিত করতে দুবার চাপুন', 'Tap twice to confirm'],
  spoken_help: ['🔊 কথ্য সহায়তা', '🔊 SPOKEN HELP'],
  cancel_sos: ['এসওএস কাউন্টডাউন বাতিল করুন', 'Cancel SOS countdown'],
  four_actions: ['চারটি প্রধান কাজ', 'Four main actions'],
  additional_controls: ['অতিরিক্ত নিয়ন্ত্রণ', 'Additional controls'],
  type_question: ['প্রশ্ন লিখুন', 'Type a question'],
  menu: ['মেনু', 'Menu']
});

function applyLanguageMode(settings) {
  const mode = ['bn', 'en', 'custom'].includes(settings.languageMode) ? settings.languageMode : 'bn';
  settings.languageMode = mode;
  if (mode === 'bn') {
    settings.interfaceLanguage = 'bn';
    settings.speechLanguage = 'bn-BD';
    settings.speechInputMode = 'auto';
    settings.speechInputLanguage = 'bn-BD';
    settings.sosVoiceLanguage = 'bn-BD';
  } else if (mode === 'en') {
    settings.interfaceLanguage = 'en';
    settings.speechLanguage = 'en-US';
    settings.speechInputMode = 'auto';
    settings.speechInputLanguage = 'en-US';
    settings.sosVoiceLanguage = 'en-US';
  } else {
    settings.interfaceLanguage = settings.customInterfaceLanguage === 'bn' ? 'bn' : 'en';
    settings.speechLanguage = settings.customSpeechLanguage || 'bn-BD';
    settings.speechInputMode = settings.customSpeechInputMode || 'auto';
    settings.speechInputLanguage = settings.customSpeechInputLanguage || 'bn-BD';
    settings.sosVoiceLanguage = settings.customSosVoiceLanguage || 'bn-BD';
  }
  return settings;
}

export function normalizeCameraAddress(value) {
  let address = String(value || '').trim();
  if (!address) address = DEFAULTS.cameraBaseUrl;
  if (!/^https?:\/\//i.test(address)) address = 'http://' + address;
  return address.replace(/\/+$/, '');
}

export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const merged = { ...DEFAULTS, ...saved };
    if (merged.aiModel === 'gemini-3.6-flash') merged.aiModel = 'gemini-3.8-flash';
    if (!merged.deviceId) merged.deviceId = createDeviceId();
    if (!merged.cameraBaseUrl || merged.cameraBaseUrl === 'http://192.168.4.1' || merged.cameraBaseUrl === '192.168.0.104') merged.cameraBaseUrl = DEFAULTS.cameraBaseUrl;
    merged.cameraBaseUrl = normalizeCameraAddress(merged.cameraBaseUrl);
    merged.theme = ['refined', 'swiss', 'material', 'clinical', 'tactile', 'night'].includes(merged.theme) ? merged.theme : 'refined';
    return applyLanguageMode(merged);
  } catch {
    return applyLanguageMode({ ...DEFAULTS, cameraBaseUrl: DEFAULTS.cameraBaseUrl });
  }
}

export function saveSettings(patch) {
  const current = getSettings();
  const next = { ...current, ...patch };
  if ('speechLanguage' in patch && !('customSpeechLanguage' in patch)) next.customSpeechLanguage = patch.speechLanguage;
  if ('speechInputMode' in patch && !('customSpeechInputMode' in patch)) next.customSpeechInputMode = patch.speechInputMode;
  if ('speechInputLanguage' in patch && !('customSpeechInputLanguage' in patch)) next.customSpeechInputLanguage = patch.speechInputLanguage;
  if ('sosVoiceLanguage' in patch && !('customSosVoiceLanguage' in patch)) next.customSosVoiceLanguage = patch.sosVoiceLanguage;
  if ('cameraBaseUrl' in patch) next.cameraBaseUrl = normalizeCameraAddress(patch.cameraBaseUrl);
  const resolved = applyLanguageMode(next);
  localStorage.setItem(KEY, JSON.stringify(resolved));
  return resolved;
}

export function applyDisplaySettings(settings = getSettings()) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme || 'refined';
  root.dataset.followSystem = settings.followSystemTheme ? 'true' : 'false';
  root.dataset.textSize = settings.textSize || 'normal';
  root.dataset.highContrast = settings.highContrast ? 'true' : 'false';
  root.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
}

export function applyInterfaceLanguage(settings = getSettings(), scope = document) {
  const isBangla = settings.interfaceLanguage === 'bn';
  const languageIndex = isBangla ? 0 : 1;
  document.documentElement.lang = isBangla ? 'bn' : 'en';
  for (const element of scope.querySelectorAll('[data-i18n]')) {
    const entry = UI_COPY[element.dataset.i18n];
    if (entry) element.textContent = entry[languageIndex];
  }
  for (const element of scope.querySelectorAll('[data-i18n-placeholder]')) {
    const entry = UI_COPY[element.dataset.i18nPlaceholder];
    if (entry) element.setAttribute('placeholder', entry[languageIndex]);
  }
  for (const element of scope.querySelectorAll('[data-i18n-aria]')) {
    const entry = UI_COPY[element.dataset.i18nAria];
    if (entry) element.setAttribute('aria-label', entry[languageIndex]);
  }
  return isBangla ? 'bn' : 'en';
}

export function clearSettings() {
  localStorage.removeItem(KEY);
}

export { DEFAULTS };
