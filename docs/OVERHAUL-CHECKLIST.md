# Product structure and documentation overhaul — master checklist

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


> **This is the acceptance checklist for the complete overhaul.** Keep it in the repository and update it in the same pull request as the work it tracks. Do not mark an item complete because a page or file merely exists: use the evidence rule at the end.

**Working branch:** `docs/product-map-and-ux-overhaul`  
**Safety baseline:** `backup/pre-documentation-overhaul-2026-11-28`  
**Production remains:** Cloudflare Worker at [daredevils-eye.karanjoykundu.workers.dev](https://daredevils-eye.karanjoykundu.workers.dev/)  
**Current state:** In progress — branch changes are not merged or deployed to production.

---

## 0. Safe execution and change boundaries

- [x] Create a pre-overhaul backup branch from the known main checkpoint.
- [x] Create a separate working branch; do not edit `main` directly.
- [x] Record the baseline SHA and recovery instructions in [RECOVERY.md](RECOVERY.md).
- [x] Recheck that `main` still matches the recorded baseline before opening the PR; if it has moved, review and rebase/merge deliberately.
- [ ] Keep this phase limited to product information architecture, UI/navigation, documentation, tests and release plumbing.
- [ ] Do not change Worker business logic, AI prompts, camera capture, SOS delivery, RFID authorization, firmware, Android native behaviour, Supabase schema, authentication or data-retention behaviour as part of this structural overhaul.
- [ ] Review the full diff for accidental changes, generated files, secrets, private data and unrelated formatting.

## 1. Canonical product information architecture

### 01 — USE
- [x] **Action** is the canonical home for Describe, Ask AI, camera, gallery/upload and image analysis.
- [x] **Blind Mode** is the canonical home for the blind-first four-action interface, spoken help, repeat and accessible feedback.
- [ ] Keep recent responses and immediate task actions in the experience, not in Admin or Documentation.
- [ ] Verify the Action and Blind Mode pages have no technical/admin clutter and remain usable on mobile.

### 02 — SAFETY
- [x] **SOS Center** at `/sos/` is the canonical home for sender, receiver, pairing, alert, acknowledgement and cancellation workflows.
- [x] Treat `/sos-receiver/` as legacy compatibility only; do not maintain competing pairing/receiver controls.
- [x] **Medicine** at `/medicine/` remains separate from general settings.
- [ ] Verify both SOS roles are discoverable from the same SOS Center and that all old links resolve safely.
- [ ] Keep medicine warnings clear: AI/RFID identification is fallible and does not verify a prescription or dosage.

### 03 — DEVICES
- [x] Add a dedicated `/devices/` destination for phone shortcut settings and device setup entry points.
- [x] Keep Android physical-button setup out of Admin and out of the Documentation roadmap.
- [x] Audit phone-camera permission/capture/torch ownership and link it from Devices without duplicating Action controls.
- [ ] Organise ESP32-CAM connection, stream, capture and firmware guidance under Devices with canonical guides.
- [ ] Organise RFID/RC522/Arduino wiring, firmware and authorization/token provisioning under Devices with canonical guides.
- [ ] Verify every device control has one canonical owner and every guide links back to its relevant device page.

### 04 — CONTROL CENTER
- [x] **Admin** is for changing app behaviour and preferences only.
- [x] **Diagnostics** is for running checks and reporting health only.
- [x] Remove the photo-history checkbox from Admin and its obsolete JavaScript bindings.
- [x] Remove Documentation/roadmap-style shortcuts from Admin quick navigation.
- [x] Audit every Admin control and classify it under General, Camera & Devices, AI & Intelligence, Voice & Accessibility, SOS & Triggers, Testing tools, or Account & Data where appropriate.
- [ ] Keep Image Lab/live testing tools in Admin only if they are genuinely interactive testing tools; move health checks to Diagnostics.
- [ ] Audit Diagnostics to ensure it tests and reports rather than changing persistent settings.
- [ ] Add small contextual help links only where useful; links must open the exact canonical guide.

### 05 — INFORMATION
- [x] **Documentation** is a separate INFORMATION destination, not an Admin feature.
- [x] **Help** remains task-oriented user guidance.
- [x] Privacy, Terms, About, Support and Contact remain distinct information/support destinations.
- [x] Replace the Android-only Documentation progress page with a structured documentation hub.
- [ ] Verify About/landing is a useful entry point and does not become a directory dump.
- [ ] Verify privacy, terms, support and contact pages are reachable from the shared navigation and footer.

## 2. Navigation and page-level experience

- [x] Use the five consistent groups: USE, SAFETY, DEVICES, CONTROL CENTER and INFORMATION.
- [x] Put SOS Center and Medicine in the SAFETY group.
- [x] Put Devices in the DEVICES group.
- [x] Keep Admin and Diagnostics separate within CONTROL CENTER.
- [x] Keep Documentation in INFORMATION.
- [ ] Verify the shared navigation module parses and loads on every route.
- [ ] Verify active-route indication, keyboard navigation, Escape-to-close and outside-click behaviour.
- [ ] Verify compact mobile menu, no horizontal overflow, no huge blank panels and no oversized empty cards.
- [ ] Add consistent breadcrumbs or equivalent page context on deep pages.
- [ ] Ensure every deep page offers a clear route back to Documentation (where relevant) and back to the app.
- [ ] Check all internal links for 404s, redirects and stale route names.
- [ ] Ensure secondary shortcuts point to canonical pages and do not create duplicate controls.
- [ ] Check light/dark theme contrast, focus indicators, touch targets and screen-reader labels.

## 3. Documentation centre structure

The Documentation hub must organise content by reader intent, not by an unstructured list of files.

- [x] **Getting started:** quick start, install, first-time setup, language/voice, camera setup.
- [x] **User guides:** Action, Blind Mode, Describe/Ask AI, photo upload, SOS, Medicine.
- [x] **Hardware guides:** ESP32-CAM, RFID/RC522, Arduino IDE, wiring, firmware, authorization/token provisioning.
- [x] **Android:** installation, volume-button mapping, permissions, accessibility service, background/lock-screen limitations, APK/release.
- [x] **Technical reference:** architecture, routes, APIs/Worker, Supabase, authentication, security and data flows.
- [x] **Project planning:** current status, feature map, roadmap, decisions and release gates.
- [x] Provide a single documentation landing/index with links to the source guides.
- [x] Add a searchable index that filters guide titles and summaries, plus direct section anchors and section navigation. Full article body search remains a future enhancement.
- [ ] Give every long guide a useful table of contents and stable section headings.
- [ ] Distinguish tutorials, how-to guides, reference and explanations; do not mix all four writing modes into one article.
- [ ] Label future/unimplemented features visibly as planned, incomplete or blocked.
- [ ] Preserve useful historical decisions and completed plans without presenting them as current instructions.
- [x] Provide a clear back-to-Documentation and back-to-App path from every guide.

## 4. Admin boundary and required settings taxonomy

- [x] **General:** language, defaults and user preferences.
- [x] **Camera & Devices:** phone camera, ESP32 connection and device preferences that genuinely configure app behaviour.
- [x] **AI & Intelligence:** model selection, prompt presets, fallback preferences and personal API-key entry.
- [x] **Voice & Accessibility:** speech recognition mode, TTS voice/language and haptics.
- [x] **SOS & Triggers:** shake, voice trigger, confirmation, cancellation and alert preferences.
- [x] **Testing tools:** Image Lab and controlled live tests only; not general health reporting.
- [x] **Account & Data:** account/session/history/privacy controls only where those controls actually exist and are supported.
- [x] Forbidden content removed from Admin: Documentation index, roadmap, developer tutorials, GitHub project history, hardware wiring tutorials, release notes and long status reports.
- [x] Confirm no Admin page section duplicates a canonical Devices, SOS, Medicine, Account or Diagnostics control.
- [x] Remove the photo-history toggle from Admin and its stale bindings.
- [x] Remove the nonfunctional Reset consent button/script; keep the privacy notice informational and non-blocking.
- [x] Move SOS invitation generation into the canonical SOS Center Sender tab and remove the duplicate Admin pairing control.
- [x] Redirect the legacy `/sos-receiver/` route into the canonical Receiver tab.
- [x] Add Phone camera, ESP32-CAM and RFID entry points to Devices; keep existing configuration controls linked rather than duplicated.
- [x] Correct homepage, Privacy, Terms and Account copy to state that new photo-history requests default off.
- [ ] Owner decision required: keep new history disabled or approve a privacy-consistent opt-in control outside Admin; do not silently change the default.

## 5. Devices vs Admin vs Diagnostics — boundary acceptance

| User intent | Canonical destination | Acceptance |
|---|---|---|
| Use camera to describe something | Action | [ ] |
| Use simplified blind-first interaction | Blind Mode | [ ] |
| Connect/configure ESP32 camera | Devices | [ ] |
| Configure selected AI model | Admin → AI & Intelligence | [ ] |
| Check whether camera works | Diagnostics | [ ] |
| Provision RFID authorization | Devices → RFID | [ ] |
| Read RC522 wiring instructions | Documentation → Hardware | [ ] |
| Pair SOS sender and receiver | SOS Center | [ ] |
| Change SOS trigger preferences | Admin → SOS & Triggers | [ ] |
| Test microphone | Diagnostics | [ ] |
| Change speech voice/language | Admin → Voice & Accessibility | [ ] |
| Download Android app | Documentation → Android / release link | [ ] |
| Configure Android volume shortcuts | Devices | [ ] |
| Read how volume shortcuts work | Documentation → Android | [ ] |
| Understand photo/audio processing | Privacy | [ ] |
| Read implementation details | Documentation → Technical reference | [ ] |
| See unfinished project ideas | Roadmap | [ ] |

## 6. Documentation inventory and consolidation

**Audited baseline:** 27 Markdown files in the working branch (3 root-level, 21 under `docs/`, and 3 component-local READMEs). The aim is not to delete useful technical detail; it is to reduce parallel sources of truth and make each file's ownership obvious.

### Target maintained set

- [ ] Root `README.md` — concise project introduction, live demo, safety, quick start and links.
- [ ] Root `CHANGELOG.md` — chronological user-visible changes; no current status or future roadmap.
- [ ] Root `SECURITY.md` — supported versions, vulnerability reporting and response expectations.
- [ ] `docs/README.md` — documentation portal and navigation index.
- [ ] `docs/FEATURE-MAP.md` — complete feature inventory, canonical route, implementation references and evidence gaps.
- [ ] `docs/STATUS.md` — current factual state only, with a review date and evidence.
- [ ] `docs/DECISIONS.md` — durable decisions, rationale, consequences and superseded decisions.
- [ ] `docs/ROADMAP.md` — future work only; no duplicate current-status claims.
- [ ] `docs/ARCHITECTURE.md` — actual runtime components, routes, data flows, trust boundaries and dependencies.
- [ ] `docs/SETUP.md` — local development setup and first-run configuration.
- [x] `docs/OPERATIONS.md` — Cloudflare deployment, secrets, Supabase operations, storage/history and release operations (merge current Deployment + Supabase setup without losing exact steps).
- [x] `docs/RELEASE.md` — automated/manual test matrix, release gates, evidence and current release checklist (merge TESTING + CURRENT-RELEASE-CHECKLIST).
- [ ] `docs/ACCESSIBILITY.md` — assistive technology, blind-mode interaction, voice and evaluation guidance.
- [x] `docs/SAFETY.md` — product safety, privacy boundaries, threat model, assets, trust boundaries and mitigations (merge THREAT-MODEL without losing threats/controls).
- [x] `docs/ANDROID.md` — Capacitor architecture, volume mapping, phone controls, permissions, limitations, signing and APK release (merge NATIVE-ANDROID-APP + PHONE-CONTROLS + ANDROID-RELEASE-SETUP).
- [x] `docs/CONTRIBUTING.md` — contribution workflow, documentation style, file ownership, PR checklist and local validation.
- [ ] Keep `firmware/esp32-cam-ai-thinker/README.md`, `hardware/esp32-rfid/README.md` and `native-android/README.md` close to their code because hardware/source-specific setup belongs beside that component.
- [x] `docs/RECOVERY.md` records the temporary safe checkpoint for this overhaul; remove or replace it with a general recovery section once the work is merged and the checkpoint is no longer special.

### Merge/archive candidates — preserve content before removing

- [x] Merge `docs/ANDROID-RELEASE-SETUP.md`, `docs/PHONE-CONTROLS.md` and `docs/NATIVE-ANDROID-APP.md` into `docs/ANDROID.md`; retain every safety limitation and owner-only signing step.
- [x] Merge `docs/TESTING.md` and `docs/CURRENT-RELEASE-CHECKLIST.md` into `docs/RELEASE.md`; preserve all test commands, device matrix and evidence history.
- [x] Merge `docs/THREAT-MODEL.md` into `docs/SAFETY.md`; preserve all assets, boundaries, threat scenarios, mitigations and residual risks.
- [x] Merge `docs/DEPLOYMENT.md` and `docs/SUPABASE-ACCOUNT-HISTORY-SETUP.md` into `docs/OPERATIONS.md`; preserve exact environment-variable names and deployment/verification procedures without exposing values.
- [x] Reconcile `docs/IMPLEMENTATION-PLAN.md`, `docs/CAMERA-PLATFORM-UPGRADE.md` and `docs/NEXT-GENERATION-CAMERA-AND-EMERGENCY-ROADMAP.md` into current Decisions/Roadmap/Changelog as appropriate; preserve historical context and clearly mark superseded proposals in [HISTORY](HISTORY.md).
- [x] After link migration, remove 11 superseded duplicate documents; preserve their historical material in [HISTORY](HISTORY.md) and consolidated guides.
- [x] Update active Markdown, README, Documentation hub and Devices page links to the consolidated guides.
- [x] Recounted 23 Markdown files on this branch, including the temporary recovery note and PR template; expected maintained total after recovery retirement is 22.

**Target:** 22 maintained Markdown files after the temporary recovery note is retired (3 root files + 13 core guides + the master checklist + the history archive + the PR template + 3 component-local READMEs). During this transition, the recovery note makes 23. The count is a maintainability target, not a reason to split or merge content unnaturally.

## 7. Writing quality and documentation maintenance system

- [ ] Apply the Diátaxis distinction: tutorials teach, how-to guides solve a task, reference documents describe exact interfaces, explanations describe why.
- [ ] Use one canonical source for each volatile fact. Other pages link to it rather than copying it.
- [ ] Give each document an owner/purpose statement, reviewed date where facts change, audience, prerequisites and relevant links.
- [ ] Use consistent terminology, heading hierarchy, tables only for genuinely comparative data, concise paragraphs and tested code blocks.
- [x] Add a documentation style guide and contribution/PR standards in [CONTRIBUTING](CONTRIBUTING.md).
- [ ] Include copy-pasteable PowerShell commands for the Windows-first developer workflow where relevant.
- [ ] Never put secrets, API keys, access tokens, private user data, personal device IPs or private signing material in docs.
- [ ] Add a docs change to the same PR whenever a feature, route, setting, API, secret or release process changes.
- [ ] Define a stale-doc review cadence and require a review date for status/roadmap/release pages.
- [ ] Make all external links descriptive and verify internal relative links automatically.

## 8. Repository quality additions

- [x] Add Markdown linting with a documented configuration and a CI check.
- [x] Add internal Markdown link validation that handles relative paths, Markdown anchors and app routes.
- [x] Add a route inventory/smoke test so every canonical route and legacy compatibility page is checked.
- [ ] Add a documentation build/preview or static docs rendering check; avoid adding a heavyweight docs platform unless search/navigation needs justify it.
- [x] Add issue templates for bug reports, accessibility feedback and feature requests.
- [x] Add a pull-request template with test evidence, screenshots, accessibility checks, documentation updates and security/privacy impact.
- [x] Add CODEOWNERS with the current repository owner as the default reviewer.
- [ ] Add architecture/data-flow diagrams and a threat-boundary diagram that match actual code.
- [ ] Choose and add an explicit repository licence only after the owner decides the reuse terms; no LICENSE file currently exists, so do not imply that the code is open-source licensed.
- [ ] Add a signed release provenance/SBOM and artifact checksums when the first supported public Android release is prepared.
- [ ] Add release artifacts/checksums and reproducible release instructions; do not label debug APKs as production releases.
- [x] Add live demo, CI, security policy and documentation-quality links/badges to README; validate workflow status before claiming passing.
- [x] Add CodeQL analysis, dependency review and Dependabot update configuration. Secret scanning/push protection still requires repository-level settings verification.
- [ ] Add accessibility checks to CI where automatable, while keeping real TalkBack/blind-user evaluation as separate evidence.
- [x] Add a contribution, ownership, issue-triage and PR maintenance policy in [CONTRIBUTING](CONTRIBUTING.md).

## 9. Testing and acceptance

- [ ] Parse-check every edited JavaScript module.
- [ ] Run the full existing automated test suite and record pass/fail counts.
- [ ] Run route smoke tests for all canonical pages and legacy redirects.
- [x] Run Markdown lint and internal link validation.
- [ ] Test shared navigation on desktop and mobile widths, keyboard and screen reader.
- [ ] Test Admin settings load/save and confirm no removed history setting is read/written.
- [ ] Test Diagnostics independently from Admin.
- [ ] Test Documentation hub, search/index and every guide link.
- [x] Test Devices page in the normal browser preview.\n- [ ] Test Devices page inside the Android wrapper on the physical target device.
- [ ] Verify the live Cloudflare production Worker is unchanged until explicit release approval.
- [x] Record browser verification separately from physical-device verification.
- [ ] Review accessibility, privacy, security and safety language.
- [ ] Inspect complete diff and verify no functional backend/firmware/Android logic changed.

## 10. Pull request, deployment and handoff

- [x] Create a PR from `docs/product-map-and-ux-overhaul` into `main` with a complete scope summary and test evidence.
- [ ] Wait for required GitHub Actions checks and resolve failures.
- [ ] Review all changed files and links in the PR.
- [x] Keep the PR unmerged until the owner has reviewed the preview and explicitly approved merge.
- [x] If using Vercel, create a separate preview deployment only; do not replace the existing Cloudflare production deployment or change DNS.
- [x] Verify the preview routes and clearly document that Vercel preview API/Worker integration may differ from production.
- [ ] After approval and merge, verify the Cloudflare production deployment and update STATUS/CHANGELOG with exact commit and deployment evidence.
- [ ] Retire the temporary recovery checkpoint only after the merged branch and backup are confirmed.
- [ ] Publish a final handoff with PR, preview URL, production URL, test evidence, remaining limitations and final Markdown count.

---

## Evidence and completion rules

- A checked item means the work is present **and** its acceptance evidence has been observed.
- **Implemented in source** is not the same as automated-tested.
- **Automated-tested** is not the same as browser-verified.
- **Browser-verified** is not the same as physical-device-verified.
- Planned Android background/lock-screen behaviour, AI accuracy, SOS delivery and medical identification must never be presented as guaranteed.
- If an item is blocked, leave it unchecked and explain the blocker in the relevant source-of-truth document.
- Update this checklist in the same pull request as the work; never silently delete unfinished items.
