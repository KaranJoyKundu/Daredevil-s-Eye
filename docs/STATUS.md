# Implementation status

Updated for main after PR #5 merge (commit 38c4b36). Items described as implemented are source changes; they are not proof of physical-device usability.

## Production baseline on main

- Public Cloudflare Worker site and Gemini image-analysis API.
- ESP32-CAM /capture and phone image upload fallback.
- Standard home page, Admin, Diagnostics, consent and paired SOS receiver.
- Blind-mode foundation, Gemini audio transcription fallback, model selection/fallback and session-only personal API key.
- Current public URL: https://daredevils-eye.karanjoykundu.workers.dev/

## Added in this feature branch

- Blind mode now has four main controls: DESCRIBE, ASK AI, SOS and REPEAT. SPOKEN HELP is separate and reads instructions aloud.
- Microphone Automatic mode uses Gemini audio transcription to identify Bangla, English and mixed speech. Browser recognition remains available as an option; no-speech and service/language failures switch to Gemini.
- Admin separates AI response language from browser recognition language and input mode.
- Speech synthesis prefers an installed Bengali voice for Bengali-script answers and reports whether a Bengali voice is installed.
- Spoken error feedback, one-time first-use safety disclaimer, distinct vibration patterns and action-scoped screen wake lock where supported.
- Manual SOS uses two-step confirmation; deep-link SOS only pre-arms an explicit confirmation. Optional three-shake SOS and opt-in voice SOS (wake phrase + confirmation + cancellation countdown) are implemented for visible Blind mode only.
- URL actions for Describe, Ask, SOS, Repeat and Help; Android home-screen shortcuts.
- Up to three camera frames are captured 250 ms apart and the sharpest scored frame is selected.
- Updated Help, README, accessibility notes, roadmap and phone-control instructions.
- Added a blank ten-scene scorecard template. No real-world scene results are claimed.

## Automated verification

Latest GitHub Actions run on commit 9c68fcf: 55 tests passed, 0 failed, and the JavaScript syntax check passed. The production deployment job was skipped for this pull request. These automated tests do not verify real phone sensor thresholds, voice recognition accuracy, Gemini quota or Bengali TTS behavior.

## Requires physical testing

- Bangla, English and mixed-language recognition on the actual Android phone.
- Bengali text-to-speech voice availability and pronunciation on the actual phone.
- TalkBack navigation, haptic feedback and large-target usability.
- Shake sensor thresholds, false-positive rate and Bangla/English voice wake and confirmation phrase accuracy on the target Android phone.
- Camera LAN reachability, three-frame selection, latency and motion-blur quality on the actual ESP32-CAM.
- Volume-key macros with the screen on and locked; Bluetooth headset controls.
- Two-device SOS and locked-screen delivery behavior.
- Supervised feedback sessions with blind and low-vision participants.

## Not implemented / deferred

- Native Android wrapper or Accessibility Service for direct volume-key interception. Browser shake and voice triggers are not reliable when the phone is locked or the page is backgrounded.
- Bluetooth Media Session button mapping; browser behavior is device-specific and not reliable enough to claim.
- Cloudflare Durable Object rate limiting. There is no server-side per-device 10-requests/minute throttle yet; an in-isolate counter would not be a dependable security boundary.
- Email OTP, guest trial counter, profiles, per-user usage database and admin usage dashboard (future roadmap phase).
- Read Text / Find Object specialist modes, local low-light warnings, admin prompt history and second AI provider.
- Formal accessibility audit, safety certification or independent security review.


## Android 16 / Samsung work in progress

- Target baseline: Android 16 / One UI 8 Samsung Galaxy phones; first reference handset: Galaxy A55 5G.
- Added a Diagnostics phone profile for browser-reported model/OS, browser, secure context, microphone/MediaRecorder, recording MIME types, speech recognition/synthesis, installed Bengali voices, wake lock, vibration, motion, service worker and standalone display.
- Added an opt-in five-second motion sensor check that requests permission where the browser requires it and reports whether sensor events reach the page.
- This is capability detection, not a compatibility certification. Samsung A55 hardware, Bangla recognition/TTS quality, SOS sensitivity and background behavior still require physical-device testing.


## Reliability, photo workflow, SOS push and account-history update (PR #5)

- **Gemini answer completion:** Gemini 3.6 Flash is excluded from automatic selection; automatic fallback remains on Flash models rather than unexpectedly using Pro. The Worker raises the output budget, retries on `MAX_TOKENS`, rejects incomplete responses and tries another Flash model.
- **Full Bangla voice mode:** system prompts and status/error/SOS speech use the selected Bangla language; voice transcription asks for Bengali script in Bangla mode. Long answers are split into sequential speech chunks. If no Bengali TTS voice is installed, the app reports that requirement rather than silently using an English voice.
- **Phone photos and uploads:** camera and upload are separate inputs. Images are resized/re-encoded locally to JPEG under 3.8 MB, previewed before send by default, and only sent after the user taps Ask AI. Admin can disable confirmation to auto-send. The question field is optional; without a question the default scene description prompt is used.
- **Shutter feedback:** the three ESP32-CAM frame requests each attempt a short synthetic shutter click after the user gesture primes audio. A web app cannot control the Samsung native Camera app's own shutter sound.
- **Screen-off SOS:** paired receivers can register Web Push notifications through the service worker. The push payload uses VAPID plus ECDH/HKDF and AES-128-GCM encryption. The sender reports that an alert was queued and whether the push service accepted it; that is not proof that the receiving phone displayed or sounded the alert. Notification permission, browser support, network, Do Not Disturb and battery policy still affect delivery.
- **Account and private history:** Account & History, Supabase Auth endpoints, encrypted per-user Gemini API-key storage, private photo objects and answer/model/token/usage metadata are implemented. History is optional and off by default. Raw IP addresses are not stored; a keyed pseudonymous fingerprint is stored with opted-in history, while usage-only records expire after 90 days. User history can be paged and deleted.
- **Supabase activation is pending:** no Supabase project is currently connected. Apply `supabase/migrations/202611170001_reliability_history.sql` and configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `API_KEY_ENCRYPTION_KEY` and `IP_HASH_SECRET` as GitHub Actions secrets before account/history routes can persist real data. Legacy anon/service_role secrets remain supported for older projects.
- **Navigation:** the site menu closes on outside tap, Escape and link selection.

### Verification boundary

- GitHub Actions run #439: **70 tests passed, 0 failed**, and all JavaScript syntax checks passed. The pull-request deployment job was skipped; production deployment after the main merge must be checked separately.
- Still requires physical tests on a Samsung Galaxy A55 running Android 16 and a second receiving phone: Bengali speech quality, large photo upload/compression, actual shutter audibility and screen-off SOS notification/vibration.
- The pre-change main state is preserved at `backup/main-before-reliability-photo-push-2026-11-17`; GitHub PR #5 can be reverted to roll back.
