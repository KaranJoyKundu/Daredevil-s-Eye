# Daredevil's Eye — v1.0.0 Issue Tracker

**Target:** v1.0.0 · **Prerelease:** `1.0.0-beta.1` · **Device:** Galaxy A55 / Android 16  
**Branch:** `release/v1.0.0-engineering-overhaul`

Status meanings: `DONE IN CODE` is not the same as device-tested or production-ready. All phone-only checks remain open until tested on real hardware.

## P0 — Safety and Android behavior

### [ ] Background SOS delivery when receiver app is closed
- Observed: PC sender reports that the SOS is stored but no push notification was accepted.
- Current backend: Durable Objects store/pair events and the web receiver supports Web Push. Do not assume Android WebView can receive browser push when closed.
- Path: native Firebase Cloud Messaging receiver + token registration + Worker FCM HTTP v1 sender + native high-priority notification channel + acknowledgement actions and deduplication.
- External prerequisite: register the Android package in Firebase and provide CI-safe Firebase config plus service-account credentials through GitHub/Cloudflare secrets. Never commit credentials or paste them into chat.
- Acceptance: two physical Android phones; test foreground, background, swiped away, locked, DND, battery saver, network transitions and reboot. Distinguish server-stored, FCM-accepted, notification-posted and acknowledged states.
- Limits: force-stop, no network, revoked notification permission, DND and OEM restrictions can still prevent or silence delivery.

### [ ] Accessibility restricted setting
- Observed: Android displays “Controlled by Restricted Setting” for the sideloaded app.
- **DONE IN CODE:** first-run explanation now calls Accessibility optional and opens App info rather than repeatedly sending users to the blocked service screen.
- Path: App info > ⋮ > Allow restricted settings (if shown), then Accessibility > Installed apps > Daredevil's Eye. Proper long-term route: Google Play internal/closed testing with the required accessibility declaration.
- Do not bypass Android security or claim this permission can be silently enabled. Core camera/voice/SOS features must remain usable without it.
- Acceptance: A55/One UI and another Android phone.

### [ ] Global hardware shortcuts without Accessibility
- Current: foreground volume shortcuts are native; global volume keys depend on the Accessibility Service.
- Path: evaluate supported headset/media buttons, Quick Settings tile, launcher shortcuts and Samsung side-key launch. Avoid silent-audio tricks and unsupported global key interception.
- Acceptance: test with Accessibility disabled, screen locked, TalkBack enabled and disabled.

## P1 — Core UX

### [x] Native system-bar and cutout insets added
- WebView receives native system-bar, display-cutout and IME padding.
- **DEVICE TEST REQUIRED:** A55 portrait/landscape, keyboard open, gesture navigation and status-bar contrast; check for duplicate CSS safe-area padding.

### [x] Android Back fallback improved
- WebView history is used first; when empty, secondary routes return to `/action/`; Action/root backgrounds the task.
- **DEVICE TEST REQUIRED:** predictive Back gesture, Documentation → Back, Blind Mode exit and TalkBack.

### [x] Native ESP32 snapshot preview path added for Android Action tab
- Existing UI uses MJPEG `/stream` on port 81 in an image element; still capture uses `/capture`.
- **DONE IN CODE:** Android now requests JPEG snapshots through a native bridge restricted to private IPv4 addresses and the exact `/capture` endpoint; the Action preview polls at a controlled interval and tears down on page/stream teardown. This avoids HTTPS-to-HTTP mixed-content and browser CORS for the preview path.
- **DEVICE TEST REQUIRED:** inspect A55 local-network permission behavior, image freshness, frame rate, network errors and camera contention. A snapshot preview is not full-motion MJPEG video.
- **CI:** latest Android debug build passed (run `45870190784`, commit `5310e454643b42811a4bddb0298d191e7a790b4c`); artifact `15142052564` downloaded and APK verified. APK SHA-256: `b176389ee6bcbd62ed8044777ca4cba459e75245b5d0fcac7f27c8bdbab041a5`.
- Acceptance: ESP32 on same Wi-Fi and phone hotspot; test stream contention, reconnect and screen rotation.

### [x] MediaStore photo save hardened
- Native photo save now uses `IS_PENDING` while writing and removes partial MediaStore rows on failure.
- **DEVICE TEST REQUIRED:** verify image appears in Gallery/Pictures on Android 10+ and A55.

### [ ] Native speech recognition and Bangla voice readiness
- User reports microphone capture works; speech output has worked in latest test, but browser may report no speech synthesis.
- Path: use Android SpeechRecognizer for `bn-BD` and `en-US` inside Capacitor, Android TextToSpeech for output, and retain web/Gemini fallback. Explain missing voice/recognition packs with a settings shortcut.
- Acceptance: both languages with packs installed/missing, screen locked/unlocked, TalkBack and audio interruptions.

## P2 — Release quality

### [x] Selected eye/radar brand integrated into vector resources
- Navy/gold/white eye + signal arcs are wired into Android launcher resources and PWA SVG.
- **DEVICE TEST REQUIRED:** adaptive icon mask, Android monochrome themed icon, splash and 24/48/96 dp rendering.

### [ ] SemVer and signed release pipeline
- Package version currently `1.0.0-beta.1`.
- **DONE IN CODE:** `native-android/sync-version.mjs` syncs Gradle `versionName` and `versionCode` from `package.json`; both debug and signed-release workflows call it.
- **REMAINING:** changelog/tag/release APK naming and user-owned persistent keystore secrets. Use protected secrets only.
- Acceptance: signed RC-to-final update test. Debug signing is not a production update identity.

### [ ] Security and accessibility audit
- Audit WebView origin/navigation allowlist, local-network camera access, CSP, permissions, data retention, photo metadata, pairing tokens, rate limits, TalkBack, focus order and touch targets.

### [x] Android launcher shortcuts added
- Describe, Ask AI, Repeat and SOS confirmation are available as Android launcher shortcuts.
- **DEVICE TEST REQUIRED:** long-press app icon and verify each shortcut launches the correct action; SOS must still require the app's confirmation flow.

## Work committed in this engineering branch
- Optional Accessibility onboarding and supported restricted-setting guidance.
- Back fallback for secondary routes.
- Atomic MediaStore photo writes and failure cleanup.
- CI verification trigger for this release branch.
- Retained native WindowInsets handling and selected vector branding.

## v1.0.0 release gate
Do not label the app production-ready until P0 issues are resolved or explicitly accepted with documented limits, CI is green, a signed APK is produced, and the physical-device acceptance matrix is complete.
