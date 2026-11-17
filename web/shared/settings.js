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
  menu: ['মেনু', 'Menu'],
  admin_heading: ['অ্যাডমিন / সেটিংস', 'Admin / Settings'],
  admin_subtitle: ['ক্যামেরা, ভাষা, চেহারা, এআই এবং কণ্ঠস্বরের সেটিংস নিয়ন্ত্রণ করুন।', 'Configure the camera, language, appearance, AI and speech behaviour.'],
  appearance_heading: ['চেহারা ও ছয়টি থিম', 'Appearance & six themes'],
  appearance_description: ['একটি নকশা বেছে নিন। কার্ডে চাপলে সাথে সাথে প্রিভিউ হবে।', 'Choose a design. Selecting a card previews it immediately.'],
  follow_system: ['ফোনের লাইট / ডার্ক সেটিং অনুসরণ করুন', 'Follow device light / dark setting'],
  text_size: ['অ্যাপের লেখার আকার', 'App text size'],
  text_small: ['ছোট', 'Small'],
  text_normal: ['স্বাভাবিক', 'Normal'],
  text_large: ['বড়', 'Large'],
  high_contrast: ['আরও বেশি কনট্রাস্ট', 'Extra high contrast'],
  reduce_motion: ['অ্যানিমেশন ও ট্রানজিশন কমান', 'Reduce motion and transitions'],
  theme_preview: ['বর্তমান থিমের প্রিভিউ এই পৃষ্ঠায় প্রয়োগ করা হয়েছে।', 'Current theme preview is applied to this page.'],
  language_heading: ['অ্যাপের ভাষা', 'App language'],
  language_mode_label: ['ভাষার মোড', 'Language mode'],
  mode_bn: ['বাংলা — অ্যাপের সব প্রধান অংশ বাংলায় রাখুন', 'Bangla — force the app into Bangla'],
  mode_en: ['English — force the app into English', 'English — force the app into English'],
  mode_custom: ['কাস্টম — প্রতিটি ভাষা নিজে বেছে নিন', 'Custom — choose each language yourself'],
  language_mode_description: ['বাংলা ও ইংরেজি মোড এআই উত্তর, কথ্য উত্তর এবং ভয়েস শনাক্তকরণের ভাষা নির্ধারণ করে। কাস্টম মোডে প্রতিটি সেটিং আলাদা বেছে নিন।', 'Bangla and English modes set the AI answer, spoken responses and recognition languages to match. Custom mode lets you choose each setting separately.'],
  interface_language: ['ইন্টারফেসের ভাষা', 'Interface language'],
  ai_response_language: ['এআই উত্তরের ভাষা', 'AI response language'],
  voice_input_mode: ['ভয়েস ইনপুট মোড', 'Voice input mode'],
  auto_multilingual: ['স্বয়ংক্রিয় বহু-ভাষা শনাক্তকরণ (Gemini)', 'Automatic multilingual detection (Gemini)'],
  browser_first: ['প্রথমে ব্রাউজারের ভয়েস শনাক্তকরণ', 'Browser speech recognition first'],
  browser_recognition_language: ['ব্রাউজার শনাক্তকরণের ভাষা', 'Browser recognition language'],
  sos_recognition_language: ['ভয়েস এসওএস শনাক্তকরণের ভাষা', 'Voice SOS recognition language'],
  language_help: ['স্বয়ংক্রিয় মোড বাংলা, ইংরেজি ও মিশ্র ভাষা Gemini দিয়ে শনাক্ত করে। ব্রাউজার মোড আগে নির্বাচিত ভাষা ব্যবহার করে।', 'Automatic mode uses Gemini for Bangla, English and mixed speech. Browser mode starts with the selected language and falls back when available.'],
  save_all: ['সব সেটিংস সংরক্ষণ করুন', 'Save all settings'],
  account_eyebrow: ['আপনার ব্যক্তিগত স্থান', 'YOUR PRIVATE SPACE'],
  account_heading: ['অ্যাকাউন্ট ও ইতিহাস', 'Account & History'],
  account_subtitle: ['আপনার সংরক্ষিত ছবি, এআই উত্তর ও Gemini সেটিংস।', 'Your saved photos, AI answers and Gemini account settings.'],
  guest_kicker: ['সাইন ইন প্রয়োজন নেই', 'NO SIGN-IN REQUIRED'],
  guest_title: ['অতিথি ছবির ইতিহাস', 'Guest photo history'],
  guest_description: ['সাইন আউট অবস্থায় পাঠানো ছবি এই ব্রাউজারে ব্যক্তিগতভাবে সংরক্ষিত হয়। ৩০ দিন পর স্বয়ংক্রিয়ভাবে মুছে যায়।', 'Photos submitted while signed out are saved privately in this browser and deleted automatically after 30 days.'],
  refresh: ['রিফ্রেশ', 'Refresh'],
  delete_guest: ['অতিথি ইতিহাস মুছুন', 'Delete guest history'],
  guest_footnote: ['অতিথি ইতিহাস এই ব্রাউজারের নিরাপদ কুকির সঙ্গে যুক্ত। ব্রাউজারের তথ্য মুছে ফেললে ৩০ দিনের আগেই রেকর্ডে প্রবেশের সুযোগ হারাতে পারেন।', 'Guest history is tied to a secure browser cookie. Clearing this browser’s site data may remove access before automatic deletion.'],
  welcome_back: ['আবার স্বাগতম', 'WELCOME BACK'],
  sign_in: ['সাইন ইন', 'Sign in'],
  sign_in_description: ['আপনার ব্যক্তিগত ইতিহাস ও সংরক্ষিত Gemini key ব্যবহার করুন।', 'Continue to your private account history and saved Gemini key.'],
  email_address: ['ইমেইল ঠিকানা', 'Email address'],
  password: ['পাসওয়ার্ড', 'Password'],
  sign_in_button: ['সাইন ইন করুন', 'Sign in'],
  keep_history: ['আপনার ইতিহাস সংরক্ষণ করুন', 'KEEP YOUR HISTORY'],
  create_account: ['অ্যাকাউন্ট তৈরি করুন', 'Create an account'],
  create_account_description: ['অন্য ডিভাইস থেকেও সংরক্ষিত ছবি ও উত্তর দেখুন।', 'Access your saved photos and answers on another device.'],
  password_hint: ['কমপক্ষে ১২ অক্ষর', '12+ characters'],
  create_account_button: ['অ্যাকাউন্ট তৈরি করুন', 'Create account'],
  signed_in: ['সাইন ইন করা হয়েছে', 'SIGNED IN'],
  your_account: ['আপনার অ্যাকাউন্ট', 'Your account'],
  sign_out: ['সাইন আউট', 'Sign out'],
  personal_api: ['ব্যক্তিগত API প্রবেশাধিকার', 'PERSONAL API ACCESS'],
  gemini_key: ['Gemini API key', 'Gemini API key'],
  gemini_key_description: ['সংরক্ষণের আগে Worker আপনার key এনক্রিপ্ট করে। মূল key আর দেখানো হবে না।', 'Your key is encrypted by the Worker before storage. The original key is never displayed again.'],
  add_replace_key: ['আপনার Gemini key যোগ বা পরিবর্তন করুন', 'Add or replace your Gemini key'],
  save_key: ['এনক্রিপ্ট করে সংরক্ষণ করুন', 'Encrypt & save key'],
  remove_key: ['সংরক্ষিত key মুছুন', 'Delete saved key'],
  private_records: ['আপনার ব্যক্তিগত রেকর্ড', 'YOUR PRIVATE RECORDS'],
  account_history: ['অ্যাকাউন্টের ছবির ইতিহাস', 'Account photo history'],
  account_history_description: ['সফল ও ব্যর্থ ছবি-অনুরোধ, ছবি এবং বিশ্লেষণের অবস্থা আপনি মুছে না দেওয়া পর্যন্ত এখানে থাকবে।', 'Successful and failed photo submissions stay here with their image and analysis status until you delete them.'],
  delete_all_account: ['অ্যাকাউন্টের সব ইতিহাস মুছুন', 'Delete all account history'],
  load_older: ['পুরোনো ছবি দেখুন', 'Load older photos'],
  last_90_days: ['গত ৯০ দিন', 'LAST 90 DAYS'],
  usage_summary: ['ব্যবহারের সারাংশ', 'Usage summary'],
  usage_description: ['এই অ্যাকাউন্টের সঙ্গে যুক্ত AI অনুরোধ ও token ব্যবহার।', 'AI requests and reported token usage associated with this account.'],
  refresh_usage: ['ব্যবহার রিফ্রেশ করুন', 'Refresh usage'],
  your_data_private: ['আপনার তথ্য ব্যক্তিগত', 'Your data stays private'],
  nav_home: ['হোম', 'Home'],
  nav_blind: ['ব্লাইন্ড মোড', 'Blind mode'],
  nav_admin: ['অ্যাডমিন / সেটিংস', 'Admin / Settings'],
  nav_diagnostics: ['ডায়াগনস্টিকস', 'Diagnostics'],
  nav_account: ['অ্যাকাউন্ট ও ইতিহাস', 'Account & History'],
  nav_help: ['সহায়তা', 'Help'],
  nav_receiver: ['এসওএস রিসিভার', 'SOS Receiver'],
  nav_contact: ['যোগাযোগ', 'Contact'],
  nav_support: ['সহায়তা কেন্দ্র', 'Support'],
  nav_terms: ['শর্তাবলি', 'Terms & Conditions'],
  nav_privacy: ['গোপনীয়তা', 'Privacy'],
  aria_describe: ['ক্যামেরার দৃশ্য বর্ণনা করুন', 'Describe the camera view'],
  aria_ask: ['কথা বলে একটি প্রশ্ন করুন', 'Ask a question by speaking'],
  aria_sos: ['এসওএস। পাঠানোর আগে নিশ্চিত করুন', 'SOS. Confirm before sending'],
  aria_help: ['ডেয়ারডেভিলস আই ব্যবহারের সহায়িকা শুনুন', "Hear how to use Daredevil's Eye"]
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
    const resolved = applyLanguageMode(merged);
    localStorage.setItem(KEY, JSON.stringify(resolved));
    return resolved;
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
