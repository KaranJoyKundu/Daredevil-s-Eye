# Daredevil's Eye — v1.0.0 Engineering Path

**Release target:** v1.0.0  
**Device focus:** Samsung Galaxy A55 / Android 16  
**App:** Capacitor Android shell + existing web app + Cloudflare Worker/Durable Objects backend  
**Plan status:** Approved to begin implementation  
**Current branch:** `release/v1.0.0-engineering-overhaul`

This document is the agreed path toward a stable release. Root causes are currently hypotheses unless validated against code, logs, and device behavior. Work must be evidence-driven, preserve known-good features, and distinguish implemented, automated-tested, deployed, and physical-device-tested status.

## Scope and decisions

### 1. Restricted Accessibility setting
**Problem:** Android/Samsung restricts enabling the sideloaded Accessibility Service (“Controlled by Restricted Setting”).

**Path:** Explain the supported Settings > App info > overflow > Allow restricted settings flow where present. Audit whether Accessibility is truly required; make it optional and replace it where Android APIs can reasonably support foreground controls, MediaSession/headset buttons, Quick Settings tile, launcher widget, and supported native shortcuts. Never bypass platform security or misrepresent service status.

### 2. Background SOS and notifications (highest safety priority)
**Problem:** PC-originated SOS is stored server-side, but no push notification is accepted; the receiver has to reconnect/poll. Alerts do not reliably sound when app/pairing screen is not active.

**Path:** Trace pairing → backend event → delivery → Android receiver → notification/sound/vibration → acknowledgement. Evaluate Firebase Cloud Messaging (FCM) high-priority notification delivery and required credentials/configuration. Implement only a supported architecture; account for force-stop, DND, battery controls, connectivity, notification permission, full-screen-intent policy, and Android restrictions. Add native notification channels, diagnostics/test alert, acknowledgement actions, retries/duplicate handling, and honest delivery states. Persistent sockets must not be assumed reliable in background.

**Truthful states:** generated, server accepted, push accepted, notification posted, acknowledged; sound playback is only confirmed if actually measurable. Do not show “delivered” merely because an event was stored.

### 3. Notification quality
Audit Android 13+ notification permission, channel importance and sound (existing channels cannot be changed programmatically after user creation), vibration, Samsung battery policies and DND. Provide clear opt-in setup and a test-notification diagnostic without nagging.

### 4. Navigation and Back
Documentation is currently a navigation dead-end. Establish a predictable single policy: Capacitor system Back/predictive Back, internal history when appropriate, parent routes when history is empty, visible Back/Up affordance on secondary pages, and graceful root behavior. Avoid route rewrites unless necessary.

### 5. Insets and status-bar layout
Fix status-bar overlap using Android native window insets/Capacitor SystemBars or safe-area strategy. Check WebView viewport, display cutout, keyboard, gesture navigation and both themes. Do not stack native padding and CSS padding causing doubled gaps.

### 6. ESP32 camera live stream in Action tab
Investigate WebView mixed-content restrictions (HTTPS app to HTTP camera), cleartext/network policy, local network reachability, MJPEG support and ESP32 single-client limitations.

**Preferred exploration:** native/private-network snapshot polling for reliable helper preview, with clear disconnected/loading/error/retry states and reasonable rate limits; compare with native MJPEG proxy for true stream. Restrict hosts to user-configured local/private addresses, avoid broad security weakening, preserve capture functionality. The camera preview is primarily for sighted helpers; voice feedback must remain available.

### 7. Voice and photo workflows
Preserve working microphone functionality. Audit native Android SpeechRecognizer, recognition language availability, Bangla (bn-BD) and English (en-US), offline pack availability and fallbacks. Use native TextToSpeech with graceful missing Bangla voice guidance and no false claims. Prevent duplicated speech, manage audio focus and interrupt/repeat.

For photos, use MediaStore/Pictures on Android 10+, correct pending-write lifecycle, preview, save confirmation only after success, meaningful errors and avoid duplicate files. Review privacy/EXIF location handling.

### 8. Logo and visual system
Develop an original minimalist eye/perception/radar-inspired symbol that is readable at small sizes and high contrast, without cartoon, generic robot, or trademark imitation. Integrate master SVG/vector, adaptive launcher foreground/background/monochrome, splash, favicon and web/PWA variants. Verify generated artwork is actually integrated into assets.

## Logo concept exploration

Four original SVG directions are now committed under `web/icons/`:
- `daredevils-eye-v1.svg` — Radar Eye: eye + outward signal arcs (recommended starting point).
- `concept-b-voice-vision.svg` — Voice Vision: waveform inside an eye.
- `concept-c-shield-eye.svg` — Shield Eye: protection + perception.
- `concept-d-aperture-eye.svg` — Aperture Eye: camera/aperture geometry.

The generated brand boards are concept references, not production assets. The SVGs are editable vector candidates. Before choosing one, preview at 24/48/96 dp, monochrome, light/dark backgrounds and Android adaptive-icon safe zones. Once selected, create the adaptive foreground/background/monochrome resources, web favicon/PWA assets and splash integration. Do not claim launcher branding is complete until an APK is built and inspected.

### 9. SemVer and release
Use semantic versioning, starting target **1.0.0**. Establish a single source of truth for version name/build metadata, monotonic Android versionCode, changelog, tag/release notes and APK naming (e.g. `DaredevilsEye-v1.0.0-android.apk`). Maintain secure release keystore backup and protected GitHub secrets. Do not sign a public release with a debug key. Confirm upgrade signature continuity before publishing.

### 10. UX, accessibility, security and docs
Audit all key flows (Action, Blind Mode, camera, SOS, PC pairing, settings, documentation, medicine/RFID, voice) for dead controls, blank areas, contrast, labels, touch targets, focus order, TalkBack and screen-reader announcements.

Security review: secrets, authentication, pairing tokens, data retention, photos/audio, permissions, remote WebView navigation/origin restrictions, logging, rate limiting and Worker abuse. Update README, STATUS, ROADMAP, architecture, accessibility, safety, Android/release, testing and changelog to reflect verified reality.

## Implementation sequence

1. **Foundation (PR 1):** version metadata groundwork, insets, unified Back policy, Blind Mode exit/navigation, staging strategy.
2. **SOS & notification path (PR 2):** push design/configuration, FCM if selected and credentials available, native channels, diagnostics, acknowledgements, truthful delivery states, restricted-setting onboarding and alternatives.
3. **Camera & media (PR 3):** ESP32 preview approach, native speech/STT/TTS verification, MediaStore photo save.
4. **Brand & release hardening (PR 4):** logo assets, accessibility/security audit, docs/changelog, release signing, v1.0.0 release readiness.

Each phase is gated by tests and, where relevant, physical-device validation. Staging must be used for risky backend/web changes where feasible; remote-loaded web content means production changes can affect installed app users.

## Physical validation required
- A55 / Android 16 installation and upgrade behavior, safe areas, Back gestures, permissions and Accessibility restricted settings.
- Volume controls with/without Accessibility, foreground/background/screen off, TalkBack interaction and shortcut collisions.
- Two-phone SOS: app foreground/background/swiped away/locked, reboot, DND, battery saver, Wi-Fi/mobile transitions, push receipt, sound/vibration and acknowledgement.
- ESP32 stream on actual local network and hotspot, stream contention, reconnect.
- Bangla/English speech recognition/synthesis with missing and installed voice data.
- Photo save to Gallery and metadata/privacy checks.
- Release-signed update compatibility.

## Status definitions
- **Implemented:** code is present.
- **Automated verified:** relevant CI checks passed.
- **Deployed:** production deployment confirmed.
- **Device verified:** tested on named physical device and OS.
- **Blocked:** requires credentials, hardware, platform approval, or owner action.

Do not mark an item complete just because the code compiles. Keep an explicit open list of credentials, device tests, and platform limitations. Public-beta or production-ready status requires evidence, not optimism.


## Implementation log — 2026-11-26

The engineering branch now includes these code changes:
- Native WebView WindowInsets for status/navigation bars, display cutout and keyboard.
- Android Back: WebView history first; secondary routes fall back to `/action/`; root backgrounds the task.
- Accessibility onboarding explicitly marks the service optional and describes Android's supported `Allow restricted settings` path. No attempt is made to bypass Android's security controls.
- Native MediaStore photo writes now use `IS_PENDING` and remove partial entries on failure.
- Android Action preview has a native JPEG snapshot bridge limited to private IPv4 hosts and the ESP32 `/capture` endpoint; the UI polls at a controlled interval and stops polling when the preview is stopped or the page is hidden.
- Android build and Worker deployment workflows passed for commit `ebb7aba00144d7a36c4140083a281430a71b1948` (runs `45867985691` and `45867985596`). Debug APK artifact `15141243178` was downloaded and inspected as an APK; SHA-256: `18e125b565117b34d66f580305df6fe607d21c662ee42b28a7fc785053cf17fc`.
- Added `native-android/sync-version.mjs` and wired it into debug and signed-release workflows so Android `versionName` and `versionCode` follow `package.json` SemVer (`1.0.0-beta.1` → `1000001`; final `1.0.0` → `1000099`).
- CI verification workflow runs on this release branch.
- Selected navy/gold/white eye-and-signal brand is wired into Android vector launcher resources and the web/PWA SVG.

**Not yet completed:** native FCM background SOS, native SpeechRecognizer, Quick Settings/headset shortcuts, staging Worker isolation, and release signing. The ESP32 snapshot bridge is implemented in this branch; full-motion MJPEG proxy remains future work. SemVer-to-Gradle synchronization is now wired into both Android build workflows. These require further implementation and/or Firebase/keystore configuration.

**Not yet verified:** Android CI for the latest commit, deployment, and all physical Galaxy A55 tests. The Android Back and Insets changes are code-level implementations only until exercised on device. See `ISSUES-v1.0.0.md` for acceptance gates.
