# Project status — Daredevil's Eye

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Last reviewed:** 28 November 2026  
**Production URL:** https://daredevils-eye.karanjoykundu.workers.dev/  
**Production platform:** Cloudflare Worker + static web assets  
**Default branch:** `main`  
**Current overhaul branch:** `docs/product-map-and-ux-overhaul`  
**Android target for physical acceptance:** Samsung Galaxy A55 5G · Android 16 · One UI 8

> This page is a factual snapshot, not a roadmap. “Implemented in source”, “CI passed”, “browser verified” and “physical device verified” are different evidence levels. When evidence is missing, the feature remains unverified.

## Current production and project state

- The public production application remains hosted on Cloudflare Workers at the URL above.
- Action startup and visible speech-status regressions were fixed in merged PRs [#68](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/68) and [#69](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/69).
- Documentation layout corrections were merged in PR [#72](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/72); the associated main deployment workflow completed successfully.
- The app is Bangla-first with English selection, Action and Blind Mode, camera/photo input, AI analysis, voice feedback, ESP32-CAM integration, Medicine/RFID workflows, SOS pairing, Admin, Diagnostics, accounts/history and installable web-app support in source.
- The canonical SOS route is `/sos/`; `/sos-receiver/` is compatibility only.
- The product's canonical five-group architecture is USE, SAFETY, DEVICES, CONTROL CENTER and INFORMATION. Details are in [FEATURE-MAP](FEATURE-MAP.md).

## Android evidence

- Native Android/Capacitor implementation is merged through PR [#64](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/64).
- A CI workflow built a debug APK (workflow [#45755955230](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/45755955230)); recorded artifact ID: `15086769593`.
- Recorded debug APK SHA-256: `410ccff91587d07f8c7a819e6e2a4cc2b84c3bc69e6ea283720185bd6feb851a`.
- The debug APK is a test artifact, not a persistent signed production release.
- Physical Galaxy A55 validation remains open: install/launch, volume-key mapping, global Accessibility Service, TalkBack coexistence, lock/screen-off behaviour, camera/microphone, RFID and two-phone SOS.
- Android limitations and release signing steps are in [ANDROID](ANDROID.md).

## Verification still required

| Area | Evidence currently available | Still required |
|---|---|---|
| Action | Merged startup repair; owner confirmed the app works after the fix | Repeat critical camera, upload, Describe and Ask AI flows after shared UI changes |
| Blind Mode | Interface and accessible actions exist in source | TalkBack and supervised blind/low-vision evaluation |
| Speech | Browser/cloud speech paths and visible status fallback exist | Galaxy A55 Bengali/English/mixed-language and installed TTS checks |
| Camera | Phone photo input and ESP32-CAM stream/capture support exist in source; owner reported board capture working | Current A55 WebView permission/local-network/torch checks against exact firmware |
| SOS | Pairing, confirmation, push and receiver workflows exist in source | Two-phone, cross-network push, acknowledgement, cancellation and offline tests |
| Medicine/RFID | Medicine page, RFID listener and hardware guide exist | Exact board/wiring/tag provisioning and real medicine-label verification workflow |
| Account/history | Supabase schema, Worker paths, account UI and private storage exist in source | New photo saves default off and no user-facing opt-in control is currently exposed after Admin toggle removal; verify existing-record view/delete and key management. Owner decision needed before restoring a privacy control. |
| Android | CI-built debug APK | Physical A55 acceptance and owner-managed signed release |

## Documentation and navigation overhaul

**Status: In progress.**

The work is isolated on `docs/product-map-and-ux-overhaul`. The pre-overhaul backup is `backup/pre-documentation-overhaul-2026-11-28`.

- [x] Create the backup branch and isolated work branch.
- [x] Add [RECOVERY](RECOVERY.md) and the permanent [OVERHAUL CHECKLIST](OVERHAUL-CHECKLIST.md).
- [x] Add the feature map and decisions log.
- [x] Create the five-group navigation structure and the dedicated Devices page.
- [x] Replace the Android-only Documentation page with a structured guide hub.
- [x] Remove the photo-history toggle from Admin and remove its stale JavaScript bindings.
- [x] Consolidate Android, release/testing, safety/threat-model and deployment/Supabase source guides into canonical drafts.
- [x] Add contribution/documentation standards and preserve older plans in a history archive.
- [ ] Complete Markdown consolidation, link migration and stale-content audit.
- [ ] Run automated tests, Markdown/link checks, route smoke tests and responsive/accessibility review.
- [ ] Open and review the PR; do not merge until explicit owner approval.
- [ ] Verify preview deployment and production release separately.

**Production has not been changed by this branch.** Do not treat branch-only pages or documentation as live until deployment evidence is recorded.

## How to interpret status

- **Implemented in source:** code/configuration exists.
- **Automated-tested:** automated test and exact CI result are recorded.
- **Browser-verified:** named route/scenario was exercised in a browser.
- **Device-verified:** named physical device, OS, build and steps were tested.
- **User-evaluated:** informed accessibility/usability evaluation was completed.
- **Planned / incomplete / blocked:** not yet delivered or not yet validated.

See [RELEASE](RELEASE.md) for the detailed acceptance matrix, [ROADMAP](ROADMAP.md) for future work and [HISTORY](HISTORY.md) for dated superseded proposals.
