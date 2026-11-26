# Camera Platform Upgrade — Implementation Guide

**Project:** Daredevil's Eye  
**Repository:** KaranJoyKundu/Daredevil-s-Eye  
**Status:** Camera foundation and ESP32 controls are implemented on `main`. Owner reports that live MJPEG streaming and normal JPEG capture work on the physical ESP32-CAM (2026-11-26). Flash capture, LED brightness, Android Chrome Local Network Access, scene memory, SOS live video and incident recording remain unverified or unimplemented as detailed below.  
**Plan date:** 2026-11-26  
**Production baseline at this handoff:** `8cfcfa53e0515f61da2eb901f1b24e928cdbffa1`

This document is the handoff source of truth. Read it before continuing work. Update the status/checklists and decision log as implementation progresses. Do not assume a planned feature is implemented merely because it appears here.

## 1. Product goal

Turn Daredevil's Eye into a camera-first assistive experience with:
1. A first-time camera/device setup on the Action page.
2. A persistent in-page phone camera stream; Describe captures a frame from that stream rather than launching the native camera picker repeatedly.
3. A complete ESP32-CAM experience: configurable IP, live MJPEG preview, stream lifecycle, LED brightness, normal capture and flash capture.
4. Optional five-observation scene memory so users can ask about things visible in recent earlier photos.
5. Optional, consent-based SOS live video to an already paired trusted receiver.
6. Secure, private incident recordings with download and retention controls.

Keep existing consent, Bangla/English speech, AI request, photo history, guest/account isolation and SOS alert behaviour working. A camera/video failure must never prevent an SOS alert from being sent.

## 2. Current architecture and verified baseline

The existing app is a static web app served by a Cloudflare Worker:
- Browser UI and shared modules: `web/`
- Worker API, Gemini integration and Durable Objects: `worker/src/`
- Supabase schema migrations: `supabase/migrations/`
- Browser/Worker tests: `tests/`
- Worker configuration: `wrangler.toml`

Existing modules inspected before this work:
- `web/shared/camera.js`: ESP32 still capture at `/capture`, image compression, sharpness selection and data-URL conversion.
- `web/shared/settings.js`: per-browser localStorage settings and device ID.
- `web/shared/app.js`: Action/Blind page actions, phone photo upload, AI request, voice and SOS flows.
- `web/action/index.html`: Action UI, existing phone file input, consent gate.
- `web/admin/index.html`, `web/admin/admin.js`: per-device camera and AI settings.
- `worker/src/index.js`: Gemini gateway, account/guest session handling, Supabase history and API routing.
- `worker/src/sos-room.js`, `worker/src/sos-directory.js`: existing SOS receiver coordination.
- `wrangler.toml`: Worker assets and existing SOS Durable Objects.

Current production baseline SHA: `47618f8445a10ffc28e65f37fbabe21149f5aa2f`.

The previous backup branch `backup/main-before-pr-12` is older than current production and is NOT the rollback point for this project. A fresh backup has been created: `backup/main-before-camera-upgrade-2026-11-26`.

## 3. Pull request #10 disposition

PR #10 (`fix/sos-guest-delete-language-themes`) is an open draft and is based on the older `backup/main-before-pr-12` commit, not current main. GitHub reported it as not mergeable. It overlaps 23 files with current camera/app/Admin/Worker areas, including:
- `web/action/index.html`
- `web/admin/admin.js`, `web/admin/index.html`
- `web/shared/app.js`, `camera.js`, `settings.js`, `speech.js`, `style.css`, `site-nav.js`, `sos-triggers.js`
- `worker/src/index.js`
- `tests/worker.test.js`

PR #10 also contains useful independent work (guest-history deletion/session refresh, forced/custom language modes and theme choices, email-confirmation handling, silent capture, SOS wake phrase changes). Do NOT merge it as-is and do NOT close/delete it without preserving its work. Keep it as a draft reference. For each useful change, review its exact patch and selectively port it onto a new branch from current main, with tests. Do not overwrite PR #12's newer homepage/language fixes with PR #10's older versions. Email confirmation requires separate Supabase redirect configuration verification before release.

PR #10 link: https://github.com/KaranJoyKundu/Daredevil-s-Eye/pull/10

## 4. Branch and release discipline

- Production branch: `main`; do not push feature work directly to it.
- Fresh rollback point: `backup/main-before-camera-upgrade-2026-11-26`.
- Current implementation branch: `feat/camera-platform-current-main` (PR #31).
- Keep feature work in focused commits and a PR. Never merge/deploy without explicit approval.
- Before editing a file, fetch/read its current full content from the target branch.
- After each meaningful phase: run `npm test`, `npm run check`; inspect exact GitHub Actions run for the pushed SHA.
- Test real-device behaviour separately; unit tests do not prove camera permission, local-network access, audio, or WebRTC behaviour.
- Keep secrets, API keys, private camera URLs/tokens and production credentials out of Git.

## 5. Device setup and camera manager

### First-time selection
On first visit to `/action/`, after required Terms/Privacy consent, present:
- Phone camera
- ESP32-CAM
- Upload-only fallback

Save the choice in local device settings (not a global server setting). Do not show the wizard again unless the user chooses Change camera or resets device setup. A different browser/device gets its own choice.

### Phone camera
- Use `navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false})`.
- Start only after an explicit user gesture and valid consent.
- Keep one active `MediaStream` while the Action page is visible.
- Show a visible preview and camera-active indicator.
- Describe/Ask captures a frame from the already-running video using canvas, then uses the existing JPEG compression and AI request pipeline.
- Do not invoke `input[type=file][capture]` for normal capture. Keep upload as a fallback.
- Stop all tracks when the user changes source, explicitly stops camera, leaves the page, or permission/session fails.
- On `visibilitychange`, handle hidden/background state conservatively; browsers may suspend camera access. Do not claim guaranteed lock-screen/background capture.
- Do not claim unrestricted or silent control. Browser permission, browser camera indicator and OS controls remain authoritative.

### ESP32-CAM
Default address for this project: `http://192.168.0.100` (user-supplied current LAN IP). It is configurable in Admin and saved per browser/device. Never hard-code the IP in multiple modules; centralize URL construction.

Endpoints:
- Still without flash: `GET /capture`
- Flash still: `GET /capture-flash` (firmware performs 150 ms delay)
- LED brightness: `GET /control?var=led_intensity&val=<0..255>`
- LED off: brightness 0
- MJPEG stream: `http://<host>:81/stream`
- Stream off: close the browser stream connection; no firmware stream-off endpoint exists.

Requirements:
- Separate stream state from LED/flash state.
- Clamp brightness to integer 0..255.
- Turn LED off before normal no-flash capture.
- Stop stream by releasing/closing its connection; don't pretend a missing URL exists.
- A stream failure must not break still capture.
- Provide connect/test feedback and clear CORS/network errors.
- HTTPS app to HTTP LAN camera access is gated by Chrome's Local Network Access permission. The top-level app must be a secure HTTPS context and the first LAN request must follow a user action. The supplied firmware source already returns `Access-Control-Allow-Origin: *` on its GET handlers; the app does not send credentials or custom headers. Current Chrome Local Network Access replaces the old Private Network Access preflight model, so do not add deprecated PNA headers just for this flow. Validate the actual flashed firmware and Chrome permission prompt on the target Android version. Never proxy a private LAN address through the public Worker; the user's browser is the LAN bridge.
- ESP32 frame-to-canvas operations require readable CORS-enabled frames. If the browser can display but cannot read pixels, report this and do not claim recording support.

### Phone torch
Only expose a torch control if the selected camera track supports the `torch` constraint. Check capabilities and handle unsupported devices gracefully. This is distinct from ESP32 LED brightness.

## 6. Five-observation scene memory

Memory is optional and controlled by Admin. Disabled mode must preserve the existing AI request path exactly.

When enabled:
1. Gemini vision analyzes each submitted photo and returns both a user-facing answer and structured scene facts (JSON schema).
2. Store a bounded rolling window of the latest five observations, scoped to authenticated user or private guest session.
3. Facts can include object, colour, visible text, relative position, scene summary, observation timestamp and evidence/uncertainty.
4. Include relevant recent facts and recent dialogue in subsequent requests.
5. Answer memory-only questions without requiring a new photo.
6. Distinguish remembered facts from current visual evidence; never state an earlier observation as currently visible.
7. When the six observation arrives, expire the oldest observation.
8. Provide clear-memory and disable-memory behaviour.
9. Prefer storing structured text facts separately from images. Memory can remain useful when photo-history saving is disabled. Respect user deletion, guest expiry and account deletion.
10. Enforce server-side owner scoping; never trust a client-supplied owner ID.

Proposed table: `scene_memory_entries`, with owner/user or guest-session scope, JSONB facts, scene summary, associated history ID (optional), created_at and retention metadata. Add RLS or service-role-only server access consistent with existing security model. Add cleanup for guest expiry and account deletion. Do not add a second AI provider until Gemini structured output and prompt composition are evaluated; current device speech can speak the final response.

## 7. SOS live video

This is a separate, later milestone. Existing SOS alert/push must continue independently.

- Explicit opt-in for live sharing and separate opt-in for recording.
- Share only with the paired trusted receiver, using short-lived session credentials.
- Visible recording/sharing indicator and Stop Sharing control.
- Receiver can accept/reject; session expires and can be revoked.
- Use WebRTC for media; existing Cloudflare Durable Objects are suitable for signalling/session coordination, not bulk video transport.
- Add TURN relay fallback for restrictive NAT/mobile networks.
- Phone camera can reuse its active MediaStream only while browser/OS permits it.
- ESP32 is reachable only on the user's local network; browser acts as bridge. Test CORS-enabled MJPEG-to-canvas conversion before claiming it can be recorded or sent through WebRTC.
- Never silently monitor or claim guaranteed background/lock-screen operation in a browser.
- SOS notification must be sent even if camera permission, streaming, network or recording fails.

## 8. Incident recording and storage

Recommended storage: private Cloudflare R2 bucket, separate from Supabase JPEG photo history.
- Supabase stores metadata/ownership/status only.
- Worker authorizes upload initiation, completion, listing, playback and deletion.
- Use multipart/chunked upload for larger recordings; do not buffer long videos in Worker memory.
- Private object keys; no public bucket or permanent public URLs.
- Short-lived signed download/playback links or authenticated Worker streaming.
- Initial policy proposal: max 5 minutes per clip and 30-day retention, both configurable after cost/security review.
- Show upload progress, incomplete/failed status, retry and delete.
- Add storage quotas, cleanup and account/guest deletion integration.
- Browser MediaRecorder codec support must be feature-detected; record actual MIME type.
- Recording requires explicit consent and a clear indicator.

## 9. Admin settings planned

- Camera source/device choice and Change camera action.
- ESP32 base URL.
- ESP32 LED brightness (0..255), stream state and connection test.
- Phone camera permission/status and torch capability where available.
- Optional five-photo scene memory toggle and Clear Memory.
- SOS live video opt-in.
- SOS incident recording opt-in, retention and quota display.
- Never expose provider secrets in the Admin UI or client storage.

## 10. Phased implementation checklist

### Phase 0 — repository safety and documentation
- [x] Inspect current main and PR #10 metadata/patch.
- [x] Create fresh backup from current main.
- [x] Create feature branch from current main.
- [x] Record plan and PR #10 disposition.
- [x] Confirm current CI baseline on feature branch (GitHub Actions run 45731269120 passed on the exact PR head SHA).

### Phase 1 — device setup and camera foundation
- [x] First-visit device selector after consent (initial UI and local state; requires browser QA).
- [x] Persist source selection per device.
- [x] Persistent phone camera stream and visible preview (foreground session; permission remains user-controlled).
- [x] Capture frame from existing phone stream and route Describe through it.
- [x] Preserve upload-only fallback.
- [x] Centralize ESP32 endpoint construction and set default IP to 192.168.0.100.
- [x] Add ESP32 /capture connection test in Admin.
- [x] Ensure cleanup on source change/page lifecycle (phone tracks stop on source change, pagehide and hidden-page transitions; user must re-enable after returning).
- [x] Add static regression tests for camera setup, phone capture, ESP32 endpoint generation and Admin controls.

### Phase 2 — ESP32 controls
- [x] Live stream preview UI in Admin and Action page (Action preview added in this continuation).
- [x] Stream start/stop by attaching/removing the MJPEG image URL, with cleanup on page hide/navigation.
- [x] LED brightness and off controls (0..255).
- [x] Normal still capture from the selected ESP32 camera is wired to Describe; Admin Image Lab also exposes flash-capture action.
- [x] Owner-confirmed physical hardware test: `:81/stream` live MJPEG stream and `/capture` still JPEG both work (2026-11-26; user report).
- [ ] Validate LED brightness, flash-off and `/capture-flash` on physical hardware.
- [x] Inspect the supplied firmware's existing GET CORS headers; no legacy PNA preflight code is needed for the current simple GET requests.
- [x] Prepare a separate `app_httpd.cpp` patch registering `/capture-flash` and restoring the previous LED brightness after capture. This patch is not part of the web repository and has not been flashed.
- [ ] Compile and flash the firmware patch; verify `/capture-flash` and LED brightness on the physical board. `/capture` and `:81/stream` are owner-reported working; record firmware SHA and exact test setup on the next hardware pass.
- [ ] Validate Chrome Local Network Access permission and same-Wi-Fi access on the target Android Chrome.
- [x] Phone torch capability detection and guarded UI control (shown only when the active phone-camera track advertises torch support).

### Phase 3 — scene memory
- [ ] Design and review Supabase migration/RLS.
- [ ] Gemini structured output.
- [ ] Five-entry bounded memory service.
- [ ] Context-aware and memory-only question path.
- [ ] Admin toggle, clear action and retention.
- [ ] Guest/account isolation and deletion tests.

### Phase 4 — SOS live video
- [ ] Threat model and consent UX.
- [ ] Session signalling and short-lived credentials.
- [ ] WebRTC sender and receiver.
- [ ] TURN fallback and connection recovery.
- [ ] Phone + ESP32 bridge tests.
- [ ] SOS continues if media fails.

### Phase 5 — incident recordings
- [ ] R2 bucket and credentials provisioned outside Git.
- [ ] Multipart upload API and authorization.
- [ ] Private metadata schema and cleanup.
- [ ] Recording list/player/download/delete UI.
- [ ] Retention, quota and failure-recovery tests.

## 11. Acceptance criteria for Phase 1

- First visit shows setup only after consent is accepted.
- A saved choice skips setup on later visits.
- User can change the camera source from the Action page/Admin.
- Phone camera permission is requested only after user action.
- Camera preview remains visible and active while Action page is foregrounded.
- Describe captures the current video frame without opening the native camera app.
- Upload fallback remains available.
- Changing source or leaving page releases camera tracks.
- Default ESP32 address is `http://192.168.0.100`; Admin can override it.
- Existing SOS, language, consent, voice and AI behaviour remains intact.
- `npm test` and `npm run check` pass on the exact PR SHA.
- Manual test results on a physical Android phone and ESP32 are recorded separately.

### Work completed on 2026-11-26

- Added this plan and repository handoff document.
- Created fresh backup and feature branch.
- Added per-device camera source/setup settings and migrated the legacy ESP32 default IP to 192.168.0.100.
- Added shared phone/ESP32 camera manager: persistent phone MediaStream, canvas still capture, stream cleanup, configurable ESP32 endpoints, LED brightness, flash/no-flash capture and connection test.
- Added first-time camera selector after consent and phone camera preview/enable flow to Action page.
- Routed Describe to the selected phone stream or ESP32 still capture; upload-only selection triggers the existing upload flow.
- Added Admin ESP32 connection test, LED brightness and stream start/stop controls.
- Added camera-manager regression tests and syntax-check coverage.
- Not yet verified on a physical phone or ESP32; browser local-network permission/CORS behaviour remains a manual test.
n### Port onto current main on 2026-11-26

- Main advanced by 60 commits after the original camera branch was created. The original PR #30 is now 60 commits behind and is not mergeable; it remains a draft reference and must not be merged.
- Created `feat/camera-platform-current-main` from current main commit `47618f8445a10ffc28e65f37fbabe21149f5aa2f` and selectively ported camera changes without replacing current RFID/medicine integration.

### Additional implementation on 2026-11-26

- Wired the Action page's first-time camera selector to device settings; the earlier UI-only markup was not connected to handlers.
- Existing consent now triggers the setup check on page load, not only immediately after clicking Accept.
- Phone-camera selection persists per device and exposes an explicit Enable action; permission is not requested automatically.
- Added visible phone-camera status feedback.
- Phone camera tracks are stopped when switching sources, hiding the page or leaving it; the user must explicitly re-enable after returning to the foreground.
- Added an Admin Image Lab action to capture an ESP32 still with flash and preview the returned image.
- Added regression coverage for camera setup wiring, lifecycle cleanup and flash capture.
- Original camera branch latest commit: `c9ef170559842b1af9ae98973df533373742e2d3`. Current-main port is tracked in PR #31.
- The original branch CI passed at commit `c9fbc796385012c00a3ab86b05bb2987714c6255`. Current-main PR #31 CI also passed on exact head `965b60305bcf15e91df69af625744c364d424b32` (run 45733994019): 95 tests passed, syntax checks passed, Worker bundle and Durable Object migration validation passed; production deployment was skipped.
- A separate firmware patch file was prepared but not compiled or flashed. Scene-memory backend, SOS WebRTC, R2 recording, TURN configuration and production deployment are not complete.

## 12. Continue-work instructions for a future session

1. Read this document first.
2. Check GitHub current main SHA, feature branch SHA, PR status and latest CI.
3. Read the current versions of every file to be changed; do not rely on this document's code descriptions as source.
4. Check PR #10 patches for any useful independent work before touching overlapping modules. Port selectively; never merge its stale base.
5. Continue Phase 2 hardware validation, then design Phase 3 scene memory on an isolated Supabase development environment.
6. The current Action-page ESP32 live-preview continuation is isolated in PR #49 (`feat/complete-camera-memory-emergency`). Do not merge it until its exact-head checks and a browser test pass. Keep scene memory, WebRTC and recording work in separate reviewed milestones.
7. Run tests/checks and inspect GitHub Actions on the exact pushed SHA.
8. Update this document's checklist, status and decisions before ending the session.

## 13. Decision log

- 2026-11-26: Keep Gemini as the initial vision/structured-memory provider; do not add a second conversational provider before evaluating structured outputs.
- 2026-11-26: Use the browser as the bridge to ESP32 on the LAN; the public Worker cannot reach a private 192.168.x.x address.
- 2026-11-26: Use WebRTC for emergency video, Durable Objects for signalling only, and private R2 for incident media.
- 2026-11-26: Camera and recording are never silently or unconditionally active; permission, visible status and explicit opt-in are required.
- 2026-11-26: PR #10 remains an unmerged draft reference because it is based on an older backup and is not mergeable. Selectively port valuable fixes.


### Phone torch implementation on 2026-11-26

- Added feature detection using the active MediaStreamTrack capabilities; the phone-light control is hidden when the camera/browser does not advertise torch support.
- Added guarded applyConstraints handling and user-visible failure feedback.
- Added lifecycle handling so the torch control is hidden when the stream is stopped or the camera source changes.
- Added regression coverage for capability detection, control wiring and Admin camera markup.
- Updated the Action page cache-busting versions for the camera manager and app.
- Physical torch behaviour still requires a real Android Chrome test; not every Galaxy A55/browser build exposes the torch constraint.


### Action-page ESP32 preview — 2026-11-26

- Added an ESP32 live-preview panel to `/action/` when ESP32-CAM is selected. Users can explicitly start/stop the MJPEG stream, see connection feedback, and invoke Describe to capture a separate JPEG still.
- Stopping the preview closes the image stream connection and does not disable `/capture`; the preview is also stopped when the page is hidden or unloaded.
- The stream preview uses the browser's image element and does not claim canvas access or video recording support.

### Physical camera report — 2026-11-26

- Owner confirmed the ESP32-CAM live MJPEG stream and still-image capture are working. This validates the stream and normal capture path only.
- Still pending: flash-assisted capture, LED brightness control, browser CORS/canvas access, Chrome Local Network Access permission on Android, and full Action-page Describe flow using the configured ESP32.
- The actual board IP and firmware binary/source hash were not included in the report; keep the app's per-device address configurable and do not infer the IP from this test.

### Historical current-main camera validation — 2026-11-26 (PR #31, later superseded)

- PR #31 introduced guarded phone torch detection and UI control; PR #43 later integrated the current camera platform into `main`.
- Fixed malformed Admin camera markup and stale ESP32 address guidance.
- PR #43's exact integration head passed GitHub Actions run 45743354907. The current local checkout later reported 105 passing tests and `npm run check` success on main commit `8cfcfa5`.
- No production deployment occurred; the deployment job was skipped.
- Firmware source is present in the repository, but the physical board's flashed revision has not yet been matched to the committed source.
