# Daredevil's Eye — implementation status

Updated: 20 November 2026  
Production URL: https://daredevils-eye.karanjoykundu.workers.dev/  
Target handset: Samsung Galaxy A55 5G, Android 16 / One UI 8.

## Current production state (20 November 2026)

- `main` is at 6a9f3bf (merge of PR #24). Main deployment run #470 succeeded, and the CI run for that PR (#469) passed 80/80 tests and the syntax check.
- Released on 20 November: the landing page at `/` (#12, #14); the full Bangla interface, Bangla speech through Gemini on desktop, the editable system prompt and the installable app (#16); the fixed Bangla switch message and a single shutter click (#18); the assistant-mode presets (#20); the recorded shutter sound (#22, #24).
- Checked in Chrome: the live site at desktop, tablet and mobile sizes, the Bangla interface, the app install check, and that the deployed `shutter.mp3` matches the repository file.
- Not yet checked on real devices: the shutter sound on a phone, Gemini Bangla speech on Windows, the quality of each preset's answers, installing on a real Android phone, and a native speaker's review of the Bangla text.
- Open item: the source and licence of `web/shared/shutter.mp3` (from a "Camera shutter sound effect 007" clip) are not recorded. Confirm them, or replace the file, before any public release beyond the hackathon.

## Production state on 17 November 2026 (history)

PR #7 and PR #8 are merged to main. The current main commit is b6a6ffc25b15dcee76518cdb46069df52170d00a.

- PR #7 CI run #447 passed 72 tests, zero failures, and JavaScript syntax checks. Main deployment #448 succeeded.
- PR #8 CI run #449 passed 72 tests, zero failures, and JavaScript syntax checks. Main deployment #450 succeeded.
- Production Worker deployment logs confirm that GEMINI_API_KEY, SUPABASE_URL, API_KEY_ENCRYPTION_KEY, IP_HASH_SECRET, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY were uploaded successfully.
- The daily guest-history Cron trigger is deployed with the Worker.
- Supabase project dyfpawbkttbgoorcgwbd is in Mumbai (ap-south-1); private bucket daredevil-history and account/guest history schema are provisioned.
- Supabase security and health advisors reported no findings. Performance advisories only identify indexes that are unused so far because the history tables are empty.

## Implemented and deployed

- Bangla (Bangladesh) is the default AI response, device speech, input preference and SOS voice language. Accepting the current Terms applies those defaults to existing browser settings too.
- The generic hazard warning is no longer appended to each AI answer or repeated on the consent screen. Full safety details remain in Terms and Privacy.
- Gemini 3.8 Flash is the default photo model; old saved Gemini 3.6 Flash selections migrate to 3.8 Flash.
- Bengali voice discovery waits for Chrome's asynchronous voice list and attempts Android's bn-BD locale when Chrome does not enumerate a Bengali voice.
- Account & History has a responsive redesign with account and guest panels, private thumbnails, model/status details, usage summary and individual/bulk deletion.
- The selected/compressed submitted JPEG is saved to the private bucket before Gemini starts. Its record transitions from pending to completed or failed; failed Gemini analysis does not discard the photo.
- Signed-in records belong to the user's UUID. Guest records are tied to a random 256-bit HttpOnly cookie; only its SHA-256 digest is stored.
- Signed-in and guest photo records can include a keyed HMAC IP fingerprint for aggregate counts. Raw IP addresses are never stored, and guest browser user-agent strings are not stored.
- Guest history can be viewed and deleted from the current browser's Account page. Guest files and rows are scheduled for deletion after 30 days.
- Terms, Privacy, Admin, README, Supabase setup guide and current release checklist reflect these rules. Buy Me a Coffee is skipped because no creator URL exists.

## Remaining validation

The release is deployed, but these checks need a real user/browser/device:
1. Submit a photo while signed out; confirm it appears in Guest photo history after refresh, the signed URL opens, and individual/bulk delete works.
2. Sign in and submit a separate photo; confirm it appears in Account photo history and can be viewed from another browser/device.
3. Cause or simulate a Gemini error after photo submission; confirm the image remains with failed status.
4. Verify the daily 30-day guest-history cleanup actually runs.
5. On the Galaxy A55, test Google Bengali TTS after installing Bengali speech data, Bangla/mixed speech input, and all spoken prompts/errors.
6. Pair a second handset, lock its screen and verify the real SOS notification is shown/heard.
7. Test ESP32-CAM frame selection, upload compression and synthetic shutter audibility on hardware.
8. Review Account UI with TalkBack and at mobile widths.

See CURRENT-RELEASE-CHECKLIST.md for detailed acceptance criteria and device-test steps.


## Native Android companion — in progress (26 November 2026)

- Backup branch: `backup/main-before-native-android-2026-11-26`.
- Feature branch: `feat/native-android-capacitor-a55`.
- Draft PR: [#64](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/64).
- Master plan: [NATIVE-ANDROID-APP.md](NATIVE-ANDROID-APP.md); revisit tracker is served at `/documentation/`.
- Capacitor configuration, Android native source overlay, volume-key Activity/Accessibility Service, JavaScript event bridge and debug APK workflow have been added to the feature branch.
- Android CI is being debugged. No APK artifact is verified yet. Global key interception, TalkBack coexistence and screen-off behaviour have not been physically tested on the A55.
- Release signing still needs protected Android keystore secrets. Do not upload a debug-signed build as a production release or claim that it can be updated with a future release key.

- Android signing guide: `docs/ANDROID-RELEASE-SETUP.md` explains persistent keystore creation and the four GitHub Actions secrets required for a signed GitHub Release.


## Native Android companion — live status (26 November 2026)

- PR #64 merged; main commit: `5e525a0dd8b48f54170fbc3d5d80de25a3774d5b`.
- Production deployment workflow #45756257754: successful.
- Android debug APK workflow #45755955230: successful; artifact ID `15086769593`, artifact name `daredevils-eye-android-debug`.
- Debug APK SHA-256: `410ccff91587d07f8c7a819e6e2a4cc2b84c3bc69e6ea283720185bd6feb851a`.
- Documentation page is live at `/documentation/`; permanent plan is `docs/NATIVE-ANDROID-APP.md`.
- Current APK is debug-signed for initial A55 testing. Permanent signed GitHub Release requires the owner-controlled keystore and four protected GitHub Actions secrets in `docs/ANDROID-RELEASE-SETUP.md`.
- Physical Galaxy A55 tests remain open: volume gesture accuracy, global Accessibility Service, screen-off/lock-screen handling, TalkBack coexistence, camera/microphone, RFID and SOS.


## Action/Blind startup recovery — 26 November 2026

- Incident: all delegated Action controls and phone-photo input handlers were missing because `web/shared/app.js` threw during module initialization.
- Root cause: the obsolete `updateConsentPanel()` call invoked `showCameraSetup()` before the `const` bindings for the camera panels were initialized. This accessed `cameraSetupPanel` in its temporal dead zone and stopped the module before it registered click, file-input, form, and camera event handlers.
- Fix prepared on `hotfix/action-startup-temporal-dead-zone`: remove the obsolete consent-panel startup call; retain the normal `renderCameraPanels()` call after panel bindings are initialized; bump the Action and Blind app-module URL so browsers fetch the corrected module.
- Privacy requirement retained: no popup, no Accept button, no checkbox, and no photo-history toggle. The always-visible informational privacy notice remains.
- Routing review: PR #66's explicit `/action/index.html` and `/blind/index.html` Worker rewrite caused `ERR_TOO_MANY_REDIRECTS`; PR #67 correctly reverted that rewrite. Do not reintroduce the PR #66 rewrite.
- Verification status: source-level root cause and patch identified. Do not mark production fixed until CI passes, deployment succeeds, and live browser checks confirm Describe, Ask AI, SOS arm/cancel, Repeat/Stop, camera-source controls, phone gallery picker, phone camera and ESP32 controls.
