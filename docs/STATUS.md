# Project status — Daredevil's Eye

**Last reviewed:** 26 November 2026  
**Production:** https://daredevils-eye.karanjoykundu.workers.dev/  
**Target Android handset:** Samsung Galaxy A55 5G · Android 16 · One UI 8  
**Default branch:** `main`

This is the current snapshot. Historical notes are retained below only when they explain a decision or incident. A source implementation, a passing CI run, a browser check and a physical-device test are different kinds of evidence.

## Current verified snapshot

### Production web app

- The Action startup failure was fixed in merged PR [#68](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/68). The obsolete consent-panel startup call had triggered a temporal-dead-zone error before Action event handlers registered.
- Merged PR [#69](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/69) prevents a device speech-synthesis error from overwriting the visible action status.
- The owner subsequently confirmed that the app was working again.
- The documentation layout correction in PR [#72](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/72) is merged. Main deployment workflow [#45843735382](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45843735382) completed successfully.
- Live routes: [Home](https://daredevils-eye.karanjoykundu.workers.dev/) · [Action](https://daredevils-eye.karanjoykundu.workers.dev/action/) · [Blind mode](https://daredevils-eye.karanjoykundu.workers.dev/blind/) · [Documentation](https://daredevils-eye.karanjoykundu.workers.dev/documentation/).

### Privacy and Action behaviour

- The requested privacy design is a visible informational notice, not a blocking consent popup.
- Do not reintroduce a consent popup, Accept button, checkbox or “save submitted photos to history” toggle.
- Do not restore the failed explicit Worker rewrite from PR #66. PR #67 reverted it after it caused a redirect loop.
- The phone gallery/photo picker was confirmed to open after the Action startup repair. The owner later confirmed the app was working.
- SOS browser automation did not prove alert delivery. A first tap armed the confirmation window, which expired before the automation inspected it; no alert was sent in that check.

### Native Android companion

- Native Android/Capacitor work is merged through PR [#64](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/64).
- Production bridge deployment workflow [#45756257754](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45756257754) succeeded.
- Android debug APK workflow [#45755955230](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45755955230) succeeded. Artifact: `daredevils-eye-android-debug`, artifact ID `15086769593`. The artifact was recorded as expiring 10 December 2026.
- Recorded debug APK SHA-256: `410ccff91587d07f8c7a819e6e2a4cc2b84c3bc69e6ea283720185bd6feb851a`.
- This is a debug-signed test APK, not a permanent updateable release. A persistent owner-controlled keystore and four protected GitHub Actions secrets are still required. See [Android release signing](ANDROID-RELEASE-SETUP.md).
- Physical Galaxy A55 validation remains open: install/launch, volume-key accuracy, global Accessibility Service, TalkBack coexistence, lock/screen-off behaviour, camera/microphone, RFID and two-phone SOS.

### Existing web capabilities

The current product includes a Bangla-first interface, Describe and Ask AI flows, device speech, phone photo capture/upload, ESP32-CAM integration, Blind mode, Admin presets, Diagnostics, SOS pairing, optional account/guest photo history and an installable web app. See the [README](../README.md) and [architecture](ARCHITECTURE.md) for component-level detail.

## Release evidence and open validation

| Area | Evidence currently recorded | Still required |
|---|---|---|
| Action page startup | PR #68 merged; browser page loaded and phone photo picker opened; owner confirmed app works | Re-run the critical Action flows after future shared-script changes |
| Speech feedback | PR #69 merged; visible action status is preserved when device TTS fails | Real-device speech engine coverage |
| SOS | Confirmation window armed in browser check; no alert dispatched in that check | Pair two physical phones; verify push, sound/vibration, acknowledgement, cancellation and offline failure |
| Android APK | CI built a debug APK and recorded its checksum | Install and validate on the Galaxy A55 |
| Volume shortcuts | Native Activity/Accessibility Service implementation is in the repository | Repeatability, key arbitration, normal volume behaviour and TalkBack conflict tests |
| Screen-off behaviour | Android restrictions and intended best-effort design are documented | Test each action with screen locked/off; never claim universal support |
| Camera | ESP32 stream/capture and browser upload support exist | A55 WebView local-network access, phone capture and flash/LED checks |
| Account/guest history | Supabase schema/storage and Worker paths are documented | End-to-end guest/signed-in save, view, delete and 30-day cleanup verification |
| Accessibility | Blind mode, spoken help, labels and haptics exist in source | TalkBack/NVDA and supervised blind/low-vision evaluation |
| Signed APK | Signing guide exists | Owner creates and securely backs up keystore, configures secrets, then publishes and tests a signed release |

## Safe release workflow

1. Work on a separate branch; do not experiment directly on `main`.
2. Keep changes scoped and review the complete diff.
3. Require the exact PR head's automated checks to pass.
4. For Worker changes, wait for the main deployment workflow to succeed.
5. Smoke-test production routes and the specific user flow changed.
6. Record physical-device evidence separately from CI/browser evidence.
7. Update this file only when a result has actually been observed.

## Historical incident notes

### 26 November — Action startup regression

The obsolete `updateConsentPanel()` startup call invoked `showCameraSetup()` before the camera-panel `const` bindings were initialized. The resulting temporal-dead-zone error stopped the shared module before event handlers were registered. PR #68 removed the premature call while preserving later camera-panel rendering and cache-busted the affected scripts.

### 26 November — visible action status and speech failure

A device TTS error could overwrite the visible status of SOS/Repeat/action feedback. PR #69 changed the speech error handling so speech remains optional feedback and does not erase the action result.

### 26 November — documentation layout

PR #71 introduced the visual refresh. PR #72 corrected oversized full-height sections inherited from the shared stylesheet and was merged; its main deployment workflow succeeded.

### Routing rollback

PR #66's explicit `/action/index.html` and `/blind/index.html` rewrite caused a redirect loop. PR #67 reverted it. Do not reintroduce that rewrite without a different, verified routing design.

## Source-of-truth documents

- [Current release checklist](CURRENT-RELEASE-CHECKLIST.md)
- [Native Android master plan](NATIVE-ANDROID-APP.md)
- [Testing plan](TESTING.md)
- [Deployment guide](DEPLOYMENT.md)
- [Documentation hub](README.md)
