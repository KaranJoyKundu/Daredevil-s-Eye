# Daredevil's Eye — v1.0.0 Issue Tracker

Release target: **v1.0.0**  
Current prerelease metadata: **1.0.0-beta.1**  
Status: **Engineering review accepted; implementation not yet verified**

This tracker records observed issues and hypotheses. Items remain open until code changes, automated checks, and required physical-device tests are recorded.

## P0 — Safety / background reliability

- [ ] **SOS alert delivery outside the active pairing screen** — currently alerts are stored server-side but no push notification is accepted; receiver must reconnect/poll. Investigate delivery architecture and implement a supported Android background notification path. Do not label an alert delivered unless delivery state supports it.
- [ ] **Notification sound/vibration reliability** — audit notification permissions, channel importance/sound, Android/Samsung background restrictions, DND and diagnostics.
- [ ] **Accessibility service blocked by Restricted Settings** — provide accurate user-guided allow-restricted-settings steps where Android supports them; assess non-accessibility alternatives. No security bypass.

## P1 — Core Android usability

- [ ] **Status-bar / safe-area overlap** — content is drawn underneath Android status bar; apply correct system insets/edge-to-edge handling.
- [ ] **Android Back navigation** — Documentation page has no usable return path; unify internal route history and system Back/predictive Back handling.
- [ ] **ESP32 live stream missing in Action tab** — investigate HTTP/MJPEG, WebView mixed content, local network and stream concurrency; propose/implement a reliable view.
- [ ] **Background/global volume controls** — distinguish foreground support from global and screen-off support; Accessibility remains optional where possible and limitations must be explicit.

## P1 — Voice and image flows

- [ ] **Speech/TTS reliability** — native speech path, Bangla voice availability, English fallback, queue/interrupt behavior and errors.
- [ ] **Photo saving** — verify Android Gallery/Pictures save through MediaStore and only show success when save succeeds.
- [ ] **Microphone flow** — preserve currently working mic feature; test lifecycle and permission denial.

## P2 — Identity and release readiness

- [ ] **Minimal professional logo and icon family** — master vector, Android adaptive foreground/background/monochrome, splash, favicon and web assets.
- [ ] **SemVer and release metadata** — centralize version name/code; begin at 1.0.0 with monotonic versionCode and consistent APK naming.
- [ ] **Documentation and changelog refresh** — reconcile README, STATUS, ROADMAP, Android, SOS, accessibility, setup and release instructions.
- [ ] **Security/privacy review** — audit credentials, permission scope, photo/audio handling, pairing tokens, remote WebView origin/navigation and public API abuse controls.
- [ ] **Accessibility audit** — TalkBack labels/focus, touch targets, high contrast, voice controls and errors.

## Work started on overhaul branch

- [x] Draft issue tracker and engineering path committed in PR #74.
- [x] WebView system Back now checks browser history before delegating to Android default behavior (automated compilation still pending).
- [x] Set package metadata to `1.0.0-beta.1` as prerelease; not a final v1.0.0 release.
- [x] Added initial vector logo asset at `web/icons/daredevils-eye-v1.svg`; app/launcher integration remains open.

## Validation gates

- [ ] Automated test suite and web checks pass.
- [ ] Android APK build passes and artifact/checksum verified.
- [ ] A55 test: installation, insets, back gestures, volume shortcuts, TTS/STT, gallery saving and ESP32.
- [ ] SOS two-device matrix: foreground, background, swipe-away, locked, reboot, battery saver, DND, network change and acknowledgement.
- [ ] Release signing secrets/keystore are configured and securely backed up.
- [ ] Release notes and v1.0.0 checklist complete.

## Status convention

- **OPEN**: not implemented or not verified.
- **IN PROGRESS**: active work on branch.
- **AUTOMATED VERIFIED**: CI or automated checks passed; physical behavior is not implied.
- **DEVICE VERIFIED**: tested on named hardware/OS with reproducible results.
- **BLOCKED**: requires credentials, hardware, platform policy, or owner action.

Do not close an issue based on code presence alone.
