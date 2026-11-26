# Current release and validation checklist

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
- [ ] Add the four protected GitHub Actions secrets described in [Android release signing](ANDROID-RELEASE-SETUP.md).
- [ ] Run the signed release workflow using a new version tag.
- [ ] Verify APK signature and SHA-256 checksum.
- [ ] Install and upgrade-test the signed APK on the A55.
- [ ] Publish release notes and a clear download link.

## Production deployment record

The documentation/layout fix PR #72 is merged. Main deployment workflow [#45843735382](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45843735382) completed successfully. This proves the deployment workflow completed; it does not replace a manual smoke test of every page.

See [Project status](STATUS.md), [Native Android plan](NATIVE-ANDROID-APP.md), [Testing](TESTING.md) and [Deployment](DEPLOYMENT.md).
