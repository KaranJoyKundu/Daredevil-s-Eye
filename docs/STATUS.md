# Project status — Daredevil's Eye

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Last reviewed:** 28 November 2026  
**Production URL:** https://daredevils-eye.karanjoykundu.workers.dev/  
**Production platform:** Cloudflare Worker + static web assets  
**Default branch:** `main`  
**Current overhaul branch:** `docs/product-map-and-ux-overhaul`  
**Android target for physical acceptance:** Samsung Galaxy A55 5G · Android 16 · One UI 8

> This page is a factual snapshot, not a roadmap. “Implemented in source”, “CI passed”, “browser verified” and “physical device verified” are different evidence levels. When evidence is missing, the feature remains unverified.

## Current overhaul verification

- **Review PR:** [#77 — Overhaul product navigation, documentation and repository quality](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/77) — open, draft, unmerged.
- **Main/base checkpoint:** `98c9864fabf068ca7a904f5b91d6ad8264561108`. The `main` branch is unchanged.
- **Overhaul branch head at latest design deployment:** `706353077bc173d236c2cb978d157bde287a0312`.
- **Vercel preview:** [Open Quiet Clarity UI preview](https://daredevils-eye-rfid-preview-mvvcsquvn-kundu2409056-5098.vercel.app/). Deployment `dpl_Aa23frPtF8NEi9yCXaFVxvoWKfsE` is READY. This is a UI-only preview; API-backed AI, SOS and Account operations are not connected. A visible warning is shown in the preview.
- **CI:** Node tests, JavaScript syntax, Worker bundle and Durable Object migration validation passed in [run 46086314817](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/46086314817).
- **Documentation quality:** Markdown lint, internal Markdown links and canonical route smoke checks passed in [run 46086314690](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/46086314690).
- **CodeQL:** passed in [run 46086314700](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/46086314700).
- **Android build:** debug APK build and artifact upload passed in [run 46086314709](https://github.com/KaranJoyKundu/Daredevil-s-Eye/actions/runs/46086314709). This is CI build evidence only, not a signed release or physical-device verification.
- **Visual direction:** Added the Quiet Clarity shared design system to the app surfaces and a matching landing-page stylesheet. It replaces the heavy dark/gradient/card treatment with warm off-white surfaces, dark forest-green actions, restrained borders, editorial headings and consistent focus styling. Blind Mode retains its dedicated high-contrast 2×2 interface.
- **Browser verification:** The prior preview deployment was stale and did not contain the new styles. A fresh preview was deployed from the exact design commit above; its visual verification is in progress. Do not treat the new styles as browser-verified until that run completes.
- **Production deployment:** skipped for the PR branch. No Cloudflare Worker, production route, DNS or main-branch change was made.

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
- [x] Complete Markdown consolidation, link migration and stale-content audit.
- [x] Run automated tests, Markdown lint, internal link checks and route smoke tests.
- [x] Browser-check the Documentation hub/search, Admin boundaries, SOS receiver redirect and privacy/Terms behaviour on the Vercel preview.
- [ ] Complete responsive/mobile and accessibility evaluation, including real TalkBack and blind/low-vision testing.
- [x] Open draft [PR #77](https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/77); owner review is pending. Do not merge until explicit owner approval.
- [x] Verify the Vercel UI preview separately; production deployment was intentionally skipped and remains unchanged.

**Production has not been changed by this branch.** Do not treat branch-only pages or documentation as live until deployment evidence is recorded.

## How to interpret status

- **Implemented in source:** code/configuration exists.
- **Automated-tested:** automated test and exact CI result are recorded.
- **Browser-verified:** named route/scenario was exercised in a browser.
- **Device-verified:** named physical device, OS, build and steps were tested.
- **User-evaluated:** informed accessibility/usability evaluation was completed.
- **Planned / incomplete / blocked:** not yet delivered or not yet validated.

See [RELEASE](RELEASE.md) for the detailed acceptance matrix, [ROADMAP](ROADMAP.md) for future work and [HISTORY](HISTORY.md) for dated superseded proposals.
