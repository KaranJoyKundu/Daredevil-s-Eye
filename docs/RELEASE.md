# Release and verification handbook

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Purpose:** One authoritative place for automated test commands, manual acceptance scenarios, release gates and evidence. A successful build is not a substitute for browser or physical-device verification.

## Contents

- [Automated checks](#automated-checks)
- [Manual acceptance matrix](#manual-acceptance-matrix)
- [Release evidence and current open validation](#release-evidence-and-current-open-validation)
- [Release acceptance](#release-acceptance)
- [Production deployment record](#production-deployment-record)
- [Signed APK release gate](#signed-apk-release-gate)
- [Maintenance rule](#maintenance-rule)

## Automated checks

Run:

```powershell
npm test
npm run check
```

The Node suite covers prompt safety and language rules, API input validation, public API behaviour, model ranking and fallback, privacy/consent behaviour, Bangla defaults, colour contrast, guest-history cleanup, web push and SOS invitation/room state. The exact test count changes over time; use the CI run for the commit under review rather than copying a historical count. The syntax check parses the Worker, Durable Objects and browser modules listed in `package.json`.

Check every CI result against the exact commit SHA. A pass on another branch does not prove anything about this one.

## Manual acceptance matrix

| Area | Test | Pass condition |
|---|---|---|
| Landing | Open `/` at desktop, tablet and mobile sizes | Landing page loads with no overlap; **Try the live app** opens `/action/` |
| Home | Open `/action/` | The main four-action page loads |
| Language switch | Switch English ↔ বাংলা on several pages | All visible text, spoken messages and AI answers follow the choice; the Bangla switch message is "বাংলা চালু করা হয়েছে…" |
| Desktop Bangla voice | On Windows Chrome with no Bengali voice, get a Bangla answer | Spoken through `/api/speech` (Gemini) and pronounced correctly |
| Assistant modes | In Admin, choose each preset and Custom, then Describe | The answer follows the mode; Reset restores the default prompt |
| Install | In Android Chrome, choose Install app | The app installs, opens `/blind/`, and long-press shows the three shortcuts |
| Shutter | Describe with the phone camera and with the ESP32-CAM | Exactly one shutter click per capture |
| Shared navigation | Open each standard page | Brand returns to Home; menu opens every section |
| Blind mode | Open `/blind/` on phone | Four large tiles fill screen; no brand/nav/exit button |
| Blind mode Spoken Help | Tap Spoken Help | Instructions are read aloud; the four tiles stay in place |
| Blind mode screen reader | Use TalkBack/NVDA | Every tile has a clear name and action; no focus trap |
| Camera local | Capture ESP32 `/capture` on same LAN | JPEG preview and image analysis succeed |
| Hosted photo | Take/upload a phone photo | Exact image is analysed |
| Mic (Automatic, default) | Tap ASK AI on HTTPS | A short clip is transcribed by Gemini into the selected language |
| Mic (browser-first) | Choose browser-first in Admin; block or remove the native service | Falls back to a Gemini transcription of a short clip |
| English accent | Speak English with Bangladeshi accent | Transcript remains English |
| Bengali | Speak Bengali in Bangla mode | The question is written in Bengali script and answered in Bangla |
| Mixed speech | Speak Bangla and English together | Meaning is preserved without invented words |
| BYOK | Set personal key in Admin | /api/models and vision request use it; key not in localStorage |
| BYOK removal | Remove key / close tab | Project key is used or user-key indicator clears |
| Model ranking | Refresh models | Vision models ranked; each entry has a rank and tier |
| Fallback | Mock a 429 / 503 / missing-model response | Next compatible model is tried; final response reports actual model |
| Progressive text | Ask a question | Words appear sequentially while voice plays; Stop halts both |
| Diagnostics | Run individual and all checks | Results accurately identify failed component; AI request use is disclosed |
| SOS | Pair two physical phones | Pairing, alert, acknowledgement and replacement work |
| SOS suspended | Lock or background receiver | No guaranteed delivery claim; failures documented |
| Contact | Tap phone and WhatsApp links | Correct project number opens dialler/WhatsApp |

## Important test-cost note

The AI image test, voice transcription and live model fallback can consume Gemini quota. Use mock/unit tests first. Do not deliberately exhaust a real quota merely to demonstrate automatic fallback.

## Release acceptance

- CI passes on exact PR head SHA.
- No secret or local environment file is committed.
- Privacy notice clearly discloses image/audio forwarding.
- BYOK key is not persisted beyond the browser tab.
- Real-device results are recorded separately from automated test results.
- No navigation, medical or SOS reliability claims exceed evidence.

## Release evidence and current open validation

**Last reviewed:** 26 November 2026  
**Production URL:** https://daredevils-eye.karanjoykundu.workers.dev/  
**Android validation target:** Samsung Galaxy A55 5G · Android 16 · One UI 8

This checklist is evidence-based. “Implemented” means the repository contains the implementation. It does not imply that a real user, browser, phone, camera or receiver has passed an end-to-end test.

## Production web app

| Area | Current evidence | Remaining validation |
|---|---|---|
| Main site and routes | Cloudflare Worker production deployment is active; routes include Home, Action, Blind, Admin, Diagnostics and support pages | Smoke-test the critical flows after future shared-script or routing changes |
| Action startup | PR #68 merged; startup-order failure was fixed; phone photo picker opened in browser verification; owner later confirmed app working | Re-test Describe, Ask, camera-source selection, upload, SOS arm/cancel, Repeat and Stop after relevant changes |
| Speech feedback | PR #69 merged; speech-engine failure no longer replaces visible action status | Verify on physical Android devices and with Bengali/English voices |
| Privacy notice | Requested informational notice; no blocking popup, Accept button, checkbox or history opt-in toggle | Ensure future changes do not reintroduce the removed consent UI |
| Bangla / English | Bangla is the default and English is selectable | Native-speaker review of translations and A55 pronunciation |
| Phone and ESP32 camera | Phone upload/capture and ESP32 stream/still-capture support exist | Test A55 WebView local-network access, JPEG quality/size, flash/LED and shutter audibility |
| Gemini vision and voice | Worker routes support vision, transcription, speech and compatible-model fallback | Record real-device quality, latency, quota and failure behaviour |
| SOS | Pairing, receiver tokens, confirmation and Web Push implementation exist | Test two physical phones, acknowledgement, cancellation, offline and locked receiver |
| Account/guest history | Supabase schema, private bucket and Worker history paths exist | End-to-end guest and signed-in save/view/delete plus 30-day cleanup verification |
| Accessibility | Blind mode, spoken help, status announcements and haptics exist in source | TalkBack/NVDA and supervised blind/low-vision evaluation |

## Native Android companion

| Area | Current evidence | Remaining validation |
|---|---|---|
| Capacitor/native project | Merged PR #64; native source and bridge are in `main` | Install and launch on the target A55 |
| Debug APK | CI workflow #45755955230 succeeded; artifact ID `15086769593`; recorded SHA-256 below | Install, launch, update/uninstall behaviour and permissions on A55 |
| Production bridge | Deployment workflow #45756257754 succeeded | Verify all native-to-web actions on handset |
| Volume mapping | Native Activity and optional Accessibility Service implementation are in repository | Test Up, Down, double Up, simultaneous hold, missed/duplicate events and ordinary volume restoration |
| Global shortcuts | User-enabled Accessibility Service implementation exists | Verify on A55 with other apps foregrounded; test TalkBack conflict |
| Screen-off/lock-screen | Best-effort design and Android limitations are documented | Test separately; never promise camera/microphone always work while locked |
| Signed release | Signing workflow and owner setup guide exist | Owner creates and backs up keystore, adds protected secrets, publishes signed APK and tests upgrade |

Debug APK details recorded on 26 November:
- Workflow: [Android debug build #45755955230](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45755955230)
- Artifact: `daredevils-eye-android-debug` (ID `15086769593`); recorded expiry 10 December 2026
- SHA-256: `410ccff91587d07f8c7a819e6e2a4cc2b84c3bc69e6ea283720185bd6feb851a`
- This is a **debug-signed test APK**, not the permanent release-signed build. A later release signed with the owner's keystore will have a different signing identity; follow the release guide before installing/updating.

## Safety and privacy release gates

- [ ] No secrets, API keys, receiver tokens, session cookies or private user data are committed or embedded in APK assets.
- [ ] Privacy notice accurately describes image/audio processing and optional history.
- [ ] No blocking consent popup, Accept button, checkbox or photo-history toggle has been reintroduced.
- [ ] Medicine, banknote and text-reading outputs are treated as fallible; high-stakes details are checked independently.
- [ ] SOS requires deliberate confirmation and never claims delivery without evidence.
- [ ] No navigation, road-crossing, medical, emergency-service or screen-off reliability claims exceed test evidence.
- [ ] ESP32-CAM HTTP endpoint remains restricted to a trusted local network.

## Required physical test record

For every device test, record: date, exact handset/model code, Android and One UI build, app build/commit, browser (if relevant), permissions, network conditions, steps, expected result, observed result and pass/fail.

- [ ] Galaxy A55: install and first launch of debug APK.
- [ ] Volume Up = one Describe; no duplicate action.
- [ ] Volume Down = Ask AI; microphone permission and recording feedback.
- [ ] Double Volume Up = Repeat only; no Describe leakage.
- [ ] Hold both = SOS confirmation only; cancellation works; no accidental dispatch.
- [ ] Global shortcuts with Accessibility Service enabled and disabled.
- [ ] TalkBack on/off; normal volume controls restored when global shortcuts are off.
- [ ] Foreground, other-app foreground, locked screen and display-off cases tested separately.
- [ ] Bangla, English and mixed-language speech input/output.
- [ ] Phone camera, gallery picker and ESP32 camera in the native WebView.
- [ ] RFID medicine announcement and duplicate-event handling.
- [ ] SOS from sender to a second physical receiver, including acknowledgement and failure cases.
- [ ] Account/guest history save, refresh, view and delete.
- [ ] Supervised accessibility feedback from blind/low-vision participants with informed consent.

## Signed APK release gate

- [ ] Create a persistent owner-controlled Android keystore.
- [ ] Keep at least one encrypted offline backup and store passwords in a password manager.
- [ ] Add the four protected GitHub Actions secrets described in [Android release signing](ANDROID.md).
- [ ] Run the signed release workflow using a new version tag.
- [ ] Verify APK signature and SHA-256 checksum.
- [ ] Install and upgrade-test the signed APK on the A55.
- [ ] Publish release notes and a clear download link.

## Production deployment record

The documentation/layout fix PR #72 is merged. Main deployment workflow [#45843735382](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45843735382) completed successfully. This proves the deployment workflow completed; it does not replace a manual smoke test of every page.

See [Project status](STATUS.md), [Native Android plan](ANDROID.md), [Testing](RELEASE.md) and [Deployment](OPERATIONS.md).

## Maintenance rule

Update this document only when a command or test result has actually been observed. Record the commit SHA and workflow URL for CI, the exact route/build for browser tests, and model/OS/build/steps for physical-device tests. Keep the latest concise state in [STATUS](STATUS.md); keep future work in [ROADMAP](ROADMAP.md).
