# Native Android application — master plan and release tracker

**Project:** Daredevil's Eye  
**Primary handset:** Samsung Galaxy A55 5G  
**Target OS:** Android 16 / One UI 8  
**Implementation:** Capacitor + native Android Kotlin/Java integration  
**Distribution:** Signed APK through GitHub Releases first; Google Play later  
**Feature branch:** `feat/native-android-capacitor-a55`  
**Rollback point:** `backup/main-before-native-android-2026-11-26`  
**Status:** Native implementation merged into `main`; CI-built debug APK exists. Physical Galaxy A55 validation and persistent signed release remain outstanding. This document is the durable source of truth; update every checkbox only after evidence exists.

> Safety boundary: Daredevil's Eye is an experimental assistive tool, not a certified mobility aid, medical device, or emergency service. It must not claim guaranteed camera/microphone access with the display off. Keep ordinary emergency options and mobility aids available.

## 1. Owner-approved product decisions

- [x] Build a real Android APK using Capacitor and native Android code, not just a PWA shortcut.
- [x] Primary test device: Samsung Galaxy A55 5G, Android 16 / One UI 8.
- [x] Volume Up = **Describe**.
- [x] Volume Down = **Ask AI**.
- [x] Double Volume Up = **Repeat last answer**.
- [x] Hold Volume Up + Volume Down together = **SOS flow**, with spoken warning, cancellation window and deliberate confirmation before dispatch.
- [x] Implement the strongest Android-permitted background operation and clearly document restrictions.
- [x] Signed APK distributed through GitHub Releases first; Play Store is a later phase.
- [x] Bangla remains the default language; English remains selectable.
- [x] Preserve the existing web app, Cloudflare Worker, Gemini, Supabase, RFID medicine flow, ESP32 camera, SOS pairing, account/history and settings.

## 2. How the app is intended to work

The Android application is a native shell around the existing Daredevil's Eye interface. Capacitor provides the WebView and JavaScript/native bridge. Native Android code owns physical volume-key handling, accessibility-service integration, notifications, lifecycle, foreground-service permissions and Android settings links. The existing web application continues to own its established UI and user workflows. The Cloudflare Worker remains the backend for AI, accounts, RFID events and SOS coordination.

The first deliverable may use the live HTTPS app as its WebView origin so existing same-origin API calls, authentication cookies and Worker routes continue to work without introducing a second API/authentication stack. This means network access is required. Do not describe this as offline AI. If a bundled offline shell is introduced later, preserve the same-origin API/authentication contract and test it before replacing the remote origin.

## 3. Volume-button interaction specification

| Physical input | Action | Spoken feedback |
|---|---|---|
| One Volume Up press | Describe | “Describe. Capturing the scene.” |
| One Volume Down press | Ask AI | “Ask AI. Please speak your question.” |
| Two Volume Up presses inside the configured double-press window | Repeat | “Repeating the last answer.” |
| Hold Volume Up and Volume Down together for the configured hold duration | SOS confirmation flow | “SOS requested. Say or select Confirm to send, or Cancel to stop.” |

### Input arbitration and safety

- Single-press actions wait for the default 360 ms double-press window before firing Volume Up; otherwise a double press would accidentally run Describe before Repeat. Tune this value after physical A55 testing.
- A Volume Up double press must produce Repeat only, not two Describe actions. The current default window is 360 ms.
- Volume Down remains a single press for Ask. A long Volume Down press may invoke spoken Help only if it can be distinguished without delaying or swallowing ordinary volume changes; otherwise Help remains an in-app/voice action.
- The simultaneous hold has priority over individual key actions. The current default SOS hold duration is 700 ms. Do not send SOS on key-down alone.
- SOS requires a clear spoken confirmation and/or a deliberate on-screen/notification confirmation. Holding both keys only opens the confirmation flow.
- Provide a setting to disable global interception and restore ordinary volume-key behaviour.
- Explain that a global Accessibility Service needs explicit user enablement in Android Settings. Never enable it silently.
- Provide an in-app test page that speaks the detected action and shows the key event; never dispatch a real SOS from the test.
- When TalkBack is enabled, test for conflicts. Accessibility key filtering may be incompatible with another service that requests key-event filtering; do not claim simultaneous support until measured on the A55.

## 4. Background and screen-off operating model

### Intended strongest supported behaviour

1. While the app is visible, native Activity key handling provides immediate controls.
2. When the user explicitly enables the optional Daredevil's Eye Accessibility Service, it can observe supported hardware key events while another app is foregrounded, subject to Android's accessibility rules and competition with TalkBack/other services.
3. The service stores a pending action durably and signals the app when the app process is available.
4. If the app cannot safely run the action while backgrounded, show a notification explaining that the user must unlock/open the app to continue. Do not silently drop the event.
5. Use a foreground service only for a user-visible, currently active operation that meets Android's foreground-service type and launch requirements. Show a persistent notification and a Stop control.
6. SOS should use the existing server-side paired-device alert and Web Push design. A notification action can open the confirmation screen; sending an alert must remain explicit.
7. Repeat can speak cached text only when the native app has a valid saved response and the user has granted the necessary notification/audio interaction. Otherwise resume the app and repeat through the existing speech module.

### Android restrictions that must be reported

- A normal WebView/PWA cannot globally capture volume keys.
- Accessibility key-event filtering is a user-enabled special capability, not a hidden permission. It may conflict with TalkBack or another key-filtering service.
- Android restricts starting activities from the background and starting microphone/camera foreground services from the background. An accessibility event is not a universal exemption.
- Camera and microphone privacy indicators and OS permission controls remain authoritative.
- Phone-camera Describe may not run with the screen off. ESP32-CAM may be a better capture source, but network reachability, authentication and app/backend state still need testing.
- Microphone Ask AI cannot be promised while locked unless the app has a legally valid, user-started foreground microphone session and Android allows it to continue. Do not keep a microphone open continuously just to listen for commands.
- Battery optimisation, Doze, Samsung background limits, lock-screen policy, network availability and process death may delay or prevent background work.
- Accessibility Service cannot guarantee action delivery after force-stop, service revocation, reboot before the service is re-enabled, or vendor-specific restrictions.
- A full-screen intent is not a general-purpose way to bypass lock-screen restrictions.
- If a key press arrives while the screen is off and the requested action cannot safely run, queue it and show the appropriate notification on the next permitted opportunity. SOS must never be falsely reported as sent.

### Acceptance language

Use “works on the tested Galaxy A55 configuration” only after the actual device test. Use “best-effort background shortcut” for unverified or OS-dependent paths. Never advertise “always works with screen off”.

## 5. Preserve the existing product

The native app must retain and regression-test:

- Blind mode: Describe, Ask AI, SOS, Repeat and separate Spoken Help.
- Bangla-first UI and speech; English toggle; mixed Bangla-English input.
- Gemini image understanding, transcription, speech and model fallback.
- Phone camera, ESP32-CAM, live stream, still capture, LED/flash controls and upload fallback.
- Medicine RFID: account-specific pairing, medicine UID lookup, personalized announcements, expiry messages and custom text.
- RFID duplicate suppression and stale-backlog coalescing from merged PR #48.
- SOS pairing, one-time invitations, receiver replacement, acknowledgement and Web Push where configured.
- Account/guest access, photo history, privacy consent, Admin, Diagnostics and Help.
- Existing server-side secrets and data isolation. No API keys or device tokens in source code, APK assets, logs or analytics.

Do not mark optional roadmap work (scene memory, WebRTC SOS video, R2 incident recording, TURN relay) complete just because the native shell exists. Integrate them only when their own prerequisites and tests are satisfied.

## 6. Implementation phases and checklist

### Phase 0 — safety, backup and documentation
- [x] Record the owner's approved mapping and release preference.
- [x] Create backup branch from current main.
- [x] Create isolated Android feature branch from current main.
- [x] Write this master plan and add a revisit-able Documentation page.
- [ ] Add Android implementation and security decisions to the architecture docs.
- [x] Record baseline main SHA and verify the implementation was developed on a feature branch.

### Phase 1 — Capacitor Android foundation
- [x] Add Capacitor dependencies and configuration.
- [x] Commit the Android project/native source overlay.
- [x] Configure app identity and Android project metadata in the merged implementation.
- [x] Configure the production HTTPS app origin in the wrapper.
- [x] Add the Android debug-build workflow and separate signed-release workflow.
- [x] Build a debug APK in CI (workflow #45755955230; artifact ID 15086769593).
- [ ] Install the debug APK on the Galaxy A55 and verify first launch, permissions, WebView routes, cookies and Blind Mode controls.

### Phase 2 — Native volume controls
- [x] Add foreground Activity key handling in the merged native source.
- [x] Add single/double press arbitration and simultaneous Up+Down hold handling in source.
- [x] Add optional Accessibility Service source and Android settings entry point.
- [x] Add the native-to-web event bridge and settings controls.
- [ ] Physically verify timing, duplicate protection, haptics, visible/spoken feedback and restoration of normal volume behaviour on the A55.
- [ ] Test with TalkBack enabled and disabled; document any conflict.

### Phase 3 — Background and locked-screen behaviour
- [ ] Add durable pending-action storage and delivery acknowledgement.
- [ ] Add notification channel, action notification and notification permission handling.
- [ ] Add lifecycle handling for screen-off, unlock, process death and reconnect.
- [ ] Add foreground service only for user-initiated work with valid service type and persistent notification.
- [ ] Add safe handoff from a locked-screen key event to an app/notification confirmation.
- [ ] Verify Repeat where the app is backgrounded and clearly handle unavailable cached speech.
- [ ] Verify SOS notification/confirmation path; never claim sent until backend confirms.
- [ ] Test phone camera and microphone restrictions separately from key detection.
- [ ] Test Samsung battery/background settings and document required user setup.

### Phase 4 — Product integration
- [ ] Verify sign-in, guest mode, cookies/session refresh and account isolation in WebView.
- [ ] Verify Gemini Describe and Ask, Bangla/English speech and microphone permissions.
- [ ] Verify phone camera and photo upload.
- [ ] Verify ESP32 camera access from Android WebView and Chrome Local Network Access differences.
- [ ] Verify RFID medicine page, paired device, duplicate handling and announcements.
- [ ] Verify SOS sender/receiver and Web Push on two physical phones.
- [ ] Verify Admin, Diagnostics, privacy consent and Help.
- [ ] Verify network loss, app resume and stale-event behaviour.
- [ ] Verify no secrets are embedded in the APK or exposed in logs.

### Phase 5 — Galaxy A55 accessibility and reliability
- [ ] Test Android 16 / One UI 8 exact build and record model/software version.
- [ ] Test each button pattern 100 times with screen on; check missed/duplicate/wrong actions.
- [ ] Test app foreground, other app foreground, lock screen and display off separately.
- [ ] Test TalkBack on/off and volume accessibility conflicts.
- [ ] Test Bangla and English spoken feedback and installed Bengali TTS voice.
- [ ] Test microphone/camera indicators, permission revocation and privacy toggles.
- [ ] Test battery saver, Doze, Wi-Fi/mobile data switch and reboot.
- [ ] Test SOS cancellation and ensure no accidental dispatch.
- [ ] Test with a blind/low-vision participant under informed consent before public accessibility claims.

### Phase 6 — signed APK and GitHub release
- [ ] Configure a unique Android application ID and signing key.
- [ ] Keep keystore and passwords outside Git; use protected GitHub Actions secrets.
- [ ] Build release APK with reproducible version metadata.
- [ ] Generate SHA-256 checksum and release notes.
- [ ] Upload APK to a GitHub Release; publish a QR-friendly download page.
- [ ] Test download, checksum verification, install, upgrade and uninstall/reinstall on A55.
- [ ] Keep Play Store publishing as a later, separate approval phase.

### Phase 7 — handoff
- [ ] Update all checkboxes based on actual evidence.
- [ ] Record known limitations and device-specific setup.
- [ ] Link the latest APK, release notes, workflow and PR from the Documentation page.
- [ ] Keep the feature branch/PR unmerged until owner reviews the working APK and explicitly approves merge.

## 7. Security and privacy requirements

- Do not request Accessibility Service enablement without explaining exactly which keys it observes and why.
- Do not capture arbitrary text, passwords or content from other apps.
- Do not use the service to inspect screen contents; only the minimum key event needed for the chosen shortcut.
- Do not store raw audio or images for background triggers.
- Do not log spoken questions, API keys, session cookies, RFID device tokens or SOS receiver tokens.
- Use Android Keystore for any native secret that must persist; prefer existing HttpOnly account sessions for web authentication.
- Use explicit notification, microphone and camera permission flows.
- Keep a visible status/notification while any foreground microphone/camera operation is active.
- Provide a one-step disable control for global volume shortcuts and a link to Android Accessibility settings.
- SOS is best-effort notification to a paired trusted receiver, not dispatch to emergency services.

## 8. Build and release policy

See [ANDROID-RELEASE-SETUP.md](ANDROID-RELEASE-SETUP.md) for the exact Windows PowerShell commands to create the persistent signing keystore, add protected GitHub Actions secrets and publish the APK.

- Main remains production; do all Android work on `feat/native-android-capacitor-a55`.
- Keep `backup/main-before-native-android-2026-11-26` as the rollback point.
- CI must run the existing Node tests and syntax checks plus Android Gradle build.
- Build debug APK artifacts for PR testing; do not sign a public release with debug credentials.
- Release signing is allowed only with protected repository/environment secrets and a reviewed tag/workflow.
- Do not merge or deploy to production until the owner has reviewed and installed a usable APK.
- Do not claim a physical test from a CI build.

## 9. Current progress and handoff notes — 26 November 2026

- Production rollback branch: `backup/main-before-native-android-2026-11-26`.
- Android implementation branch: `feat/native-android-capacitor-a55`.
- PR #64: [merged](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/64).
- Main merge commit: `5e525a0dd8b48f54170fbc3d5d80de25a3774d5b`.
- Production deployment: [workflow run 45756257754 — success](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45756257754).
- Android debug build: [workflow run 45755955230 — success](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45755955230).
- GitHub Actions artifact: `daredevils-eye-android-debug`, artifact ID `15086769593`, 4,313,560 bytes. It expires 10 December 2026.
- Extracted APK size: 4,688,232 bytes. SHA-256: `410ccff91587d07f8c7a819e6e2a4cc2b84c3bc69e6ea283720185bd6feb851a`.
- This is an installable **debug-signed test build**, not the permanent release-signed APK. The CI debug signing identity is not suitable for long-term updates. A later release APK will have a different signature; uninstall the debug build before installing that release.
- The first wrapper loads the production HTTPS Worker app at `/blind/`; the web-side native bridge and Documentation page are deployed.
- The release workflow is in `.github/workflows/android-release.yml`. A persistent owner-controlled keystore and four protected GitHub Actions secrets are required before publishing an updateable signed APK. See [ANDROID-RELEASE-SETUP.md](ANDROID-RELEASE-SETUP.md).

### Still outstanding — physical Galaxy A55 validation

- Install the debug APK on the Samsung Galaxy A55 (Android 16 / One UI 8).
- Verify first-run permissions, native Accessibility Service setup and Documentation page settings.
- Test Volume Up, Volume Down, double Volume Up and simultaneous hold with the app open.
- Test global key handling while another app is foregrounded and with the screen locked/off.
- Test TalkBack enabled/disabled and normal volume behaviour when shortcut toggles are off.
- Verify Bangla/English speech, Ask AI microphone permission, phone camera and ESP32 camera.
- Verify RFID medicine announcements and SOS pairing/receiver delivery from the native wrapper.
- Record missed/duplicate actions, latency and false SOS activation; tune the 360 ms double-press and 700 ms SOS-hold defaults only from measured A55 results.
- Create the persistent release keystore, add the four GitHub secrets, run the signed release workflow, and verify install/upgrade on the A55.

**Do not mark screen-off camera/microphone or TalkBack coexistence complete from CI alone.** The debug APK is built and the production web bridge is deployed, but real-device acceptance remains open.
