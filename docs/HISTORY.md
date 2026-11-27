# Project history and superseded proposals

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Purpose:** Preserve useful context from older planning documents without allowing old proposals to masquerade as current architecture, implementation or roadmap. This file is archival. For current facts use [STATUS](STATUS.md), for current capabilities use [FEATURE-MAP](FEATURE-MAP.md), for durable decisions use [DECISIONS](DECISIONS.md), and for future work use [ROADMAP](ROADMAP.md).

> **Important:** The proposals below were written at different dates and against different repository baselines. Paths, IP addresses, endpoints, feature status, branch names, PR numbers and implementation assumptions may be stale. Never execute a historical instruction without checking the current source and configuration. Do not copy a historical device IP or secret into production.

## Historical document: Camera Platform Upgrade

**Project:** Daredevil's Eye  
**Repository:** KaranJoyKundu/Daredevil-s-Eye  
**Status:** Camera foundation and ESP32 controls are implemented on `main`. Owner reports that live MJPEG streaming and normal JPEG capture work on the physical ESP32-CAM (2026-11-26). Flash capture, LED brightness, Android Chrome Local Network Access, scene memory, SOS live video and incident recording remain unverified or unimplemented as detailed below.  
**Plan date:** 2026-11-26  
**Production baseline at this handoff:** `8cfcfa53e0515f61da2eb901f1b24e928cdbffa1`

**Document role:** historical camera-platform implementation proposal and handoff notes. It is not the global product source of truth. Use [FEATURE-MAP](FEATURE-MAP.md) for canonical ownership, [STATUS](STATUS.md) for current evidence, [DECISIONS](DECISIONS.md) for durable decisions and [ROADMAP](ROADMAP.md) for future work. Do not assume a planned feature is implemented merely because it appears here.

## 1. Product goal

Turn Daredevil's Eye into a camera-first assistive experience with:
1. A first-time camera/device setup on the Action page.
2. A persistent in-page phone camera stream; Describe captures a frame from that stream rather than launching the native camera picker repeatedly.
3. A complete ESP32-CAM experience: configurable IP, live MJPEG preview, stream lifecycle, LED brightness, normal capture and flash capture.
4. Optional five-observation scene memory so users can ask about things visible in recent earlier photos.
5. Optional, consent-based SOS live video to an already paired trusted receiver.
6. Secure, private incident recordings with download and retention controls.

Keep the visible informational privacy notice, Bangla/English speech, AI request, optional photo-history behaviour, guest/account isolation and SOS alert behaviour working. A camera/video failure must never prevent an SOS alert from being sent.

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
Default address for this project: `http://ESP32_LAN_IP_PLACEHOLDER` (user-supplied current LAN IP). It is configurable in Admin and saved per browser/device. Never hard-code the IP in multiple modules; centralize URL construction.

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
- [x] Centralize ESP32 endpoint construction and set default IP to ESP32_LAN_IP_PLACEHOLDER.
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
- Default ESP32 address is `http://ESP32_LAN_IP_PLACEHOLDER`; Admin can override it.
- Existing SOS, language, consent, voice and AI behaviour remains intact.
- `npm test` and `npm run check` pass on the exact PR SHA.
- Manual test results on a physical Android phone and ESP32 are recorded separately.

### Work completed on 2026-11-26

- Added this plan and repository handoff document.
- Created fresh backup and feature branch.
- Added per-device camera source/setup settings and migrated the legacy ESP32 default IP to ESP32_LAN_IP_PLACEHOLDER.
- Added shared phone/ESP32 camera manager: persistent phone MediaStream, canvas still capture, stream cleanup, configurable ESP32 endpoints, LED brightness, flash/no-flash capture and connection test.
- Added first-time camera selector after consent and phone camera preview/enable flow to Action page.
- Routed Describe to the selected phone stream or ESP32 still capture; upload-only selection triggers the existing upload flow.
- Added Admin ESP32 connection test, LED brightness and stream start/stop controls.
- Added camera-manager regression tests and syntax-check coverage.
- Not yet verified on a physical phone or ESP32; browser local-network permission/CORS behaviour remains a manual test.
### Port onto current main on 2026-11-26

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

---

## Historical document: Next-generation camera and emergency roadmap

> **Status: Proposed — not implemented.** This document preserves the complete feature plan agreed on 26 November 2026. Check the current code, open pull requests, deployed Worker and device firmware before implementation. A design in this document is not evidence that a feature exists or is safe to use.
>
> This is a forward-looking product plan. Keep the currently working Describe, Ask AI, voice, account/history and SOS paths working while each milestone is built and tested independently.

## Vision

Evolve Daredevil's Eye from a photo-taking web assistant into a more capable camera-based assistive device with:

- A first-run choice between the phone camera, ESP32-CAM and upload-only mode.
- A persistent in-page phone camera preview and a unified camera session.
- A complete ESP32 camera panel with live stream, flash brightness and capture controls.
- Optional short-term visual memory that remembers facts from the five latest photo observations.
- Context-aware Bangla and English questions and spoken answers.
- Explicitly authorized emergency live video sharing with a paired trusted contact.
- Optional private incident video recordings, with account controls to view, download and delete them.

The existing Cloudflare Worker remains the API gateway. Supabase remains responsible for accounts, private history and structured memory/recording metadata. Cloudflare R2 is the proposed storage for video files.

## 1. Target architecture

```text
First-run device setup
  ├── Phone camera
  ├── ESP32-CAM
  └── Upload-only mode
          |
          v
Unified camera session manager
  ├── Live preview
  ├── Capture / compression
  ├── Flash and stream controls
  └── Recording stream (where supported)
          |
          v
Cloudflare Worker API
  ├── Gemini vision analysis
  ├── Structured scene facts
  ├── Five-observation memory
  ├── Conversation context
  └── Emergency session signalling
          |
          +---- Supabase: private history, memory and metadata
          |
          +---- Cloudflare R2: private incident video objects
          |
          +---- SOS Durable Objects: authorized session signalling
                         |
                         v
                Paired trusted receiver
```

The assistant should produce a natural spoken answer and structured scene facts from the same vision request. Existing device speech output should continue to handle ordinary spoken answers. Do not add another hosted AI provider merely to make responses sound conversational.

## 2. First-time camera selection and persistent phone camera

### First-run device selector

On the first visit to `/action/`, show a setup screen:

**Let's set up your camera**

- **Phone camera** — use the phone's rear camera inside the app. Recommended for supported phones.
- **ESP32-CAM** — connect an external camera over Wi-Fi.
- **Upload-only mode** — choose or upload photos without starting a camera.

Expected behavior:

1. Show the selector only when no camera choice has been saved for this device.
2. Let the user select a camera.
3. Save the selection in device-local settings; two phones may use different cameras.
4. Open the matching camera interface.
5. Do not show the selector on every visit. Let the user change or reset the choice later in Settings.

### Phone camera mode

Replace the hidden file input using `capture="environment"` as the primary camera mechanism with a persistent browser camera session:

- `navigator.mediaDevices.getUserMedia()`
- A retained `MediaStream`
- An HTML `video` element for the live preview
- Canvas frame capture for photographs

Expected flow:

1. User selects Phone Camera.
2. User presses **Enable Camera**.
3. Android Chrome requests camera permission.
4. The rear camera starts and remains visible in the Action page.
5. Pressing **Describe** captures a frame from the existing stream.
6. Compress the frame and send it to Gemini.
7. Reuse the stream for further photos, voice questions and (if supported and separately authorized) video recording.

**Browser boundary:** camera permission is mandatory. The browser displays its camera-use indicator. A website cannot silently take unrestricted control of the camera or guarantee continuous camera access when another app is open or the phone is locked. The dependable browser mode is the visible, foreground Action page. If dependable screen-off/background camera operation becomes a requirement, plan a native Android companion app rather than promising that a browser can do it.

## 3. ESP32-CAM integration and controls

Build a complete ESP32 camera panel, not just an IP-address text field.

### Camera address configuration

The original proposal recorded the then-supplied ESP32 address as `ESP32_LAN_IP_PLACEHOLDER` and noticed older hard-coded references to `ESP32_LAN_IP_PLACEHOLDER`. Treat `ESP32_LAN_IP_PLACEHOLDER` as the proposed default from that plan, not as a guarantee of the board's current address. Verify the actual firmware and network before changing production configuration.

Centralize the camera address in one configuration. Every endpoint must derive from that setting; do not scatter IP literals across the app.

| Purpose | Endpoint |
|---|---|
| Normal photograph | `/capture` |
| Flash photograph | `/capture-flash` |
| Flash control | `/control` |
| Live MJPEG stream | Port `81`, path `/stream` |

Consider a DHCP reservation in the router for a stable local address.

### Proposed control panel

- Connection status and a user-initiated **Connect Camera** test.
- Live camera preview with **Start stream** and **Stop stream**.
- Flash brightness slider from 0 to 255.
- **Flash OFF** control.
- **Normal photo** (no flash).
- **Flash photo** (firmware's proposed 150 ms delay).
- Connection diagnostics and useful error/recovery messages.

Expected endpoint behavior:

| Control | Request / behavior |
|---|---|
| Brightness | `/control?var=led_intensity&val=0–255` |
| Flash OFF | `/control?var=led_intensity&val=0` |
| Stream ON | Connect to port `81`, `/stream` |
| Stream OFF | Close the actual stream connection |
| Capture without flash | `/capture` |
| Capture with flash | `/capture-flash` |

Important behavior:

- Flash OFF must set intensity to zero before a normal capture.
- Flash capture should use the firmware's 150 ms sequence, if that remains the verified firmware behavior.
- Stopping the stream must close its network connection.
- A stream failure must not disable ordinary still-photo capture.
- Phone torch support may be added where browser and hardware capabilities permit it.

### Browser and local-network constraints

The app is served over HTTPS while the ESP32 may use a private HTTP address. Modern browsers may require Local Network Access permission for private-network connections. Initiate connection from a user action and handle permission denial clearly. The camera firmware needs appropriate CORS headers for cross-origin access. In particular, reading stream frames into a canvas for recording requires successful CORS handling; displaying a stream alone does not prove that canvas pixel access will work.

The browser is the bridge between the local ESP32 and the internet. The Cloudflare Worker cannot directly reach a private LAN address such as `ESP32_LAN_IP_PLACEHOLDER`.

## 4. Five-photo visual memory

### User-facing behavior

When memory is enabled, the assistant should be able to answer questions about the five most recent photo observations.

Example:

1. Photo 1: user shows a living room. The assistant describes a white ceiling fan, blue sofa and wooden table. Save the scene facts.
2. Photo 2: user turns around. The assistant identifies the dining table and chairs. Save the observation.
3. Photo 3: user points elsewhere. The assistant describes the window and bookshelf. Save the observation.
4. Photo 4: user walks to another part of the room. Save the new observation.
5. Photo 5: user shows the current surroundings. Save the new observation.

The user asks: **"What colour was the fan I showed you earlier?"**

Expected answer: **"The fan you showed me earlier was white. I remember it from your earlier photo."**

This is an illustrative scenario, not a claim that the system already has this memory or that visual recognition is always correct.

### Structured Gemini response

Ask Gemini for both:

1. A natural answer to speak.
2. A structured description of relevant visual facts.

Example output shape:

```json
{
  "spoken_answer": "There is a white ceiling fan above you.",
  "scene_summary": "A living room with a ceiling fan, blue sofa and wooden table.",
  "facts": [
    {
      "object": "ceiling fan",
      "color": "white",
      "location": "above the living room",
      "observation": "clearly visible"
    },
    {
      "object": "sofa",
      "color": "blue",
      "location": "against the wall",
      "observation": "clearly visible"
    }
  ]
}
```

Use schema-constrained structured output where supported. Validate the returned structure server-side and tolerate missing or uncertain facts. Never imply that every object, colour or position is identified correctly.

### Storage and retention

Proposed Supabase table: `scene_memory_entries`.

Each observation should record:

| Field | Purpose |
|---|---|
| Owner | Authenticated account ID or isolated guest session |
| Scene summary | Overall understanding of the image |
| Facts | Objects, colours, positions and observations |
| Question | What the user asked, if applicable |
| Answer | What the assistant said |
| Created at | Observation timestamp |

Rules:

- Keep exactly the latest five photo observations for the relevant user/session.
- Retain only the conversation context needed to interpret those observations.
- Automatically remove older observations when a new one is saved.
- Keep text memory separate from ordinary photo/image history.
- Provide a **Clear Memory** action.
- Enforce strict account and guest-session isolation.
- Memory may remain useful when ordinary photo-history saving is off: store only the text observations, not the underlying photographs, when the user has enabled memory and the applicable privacy notice/consent permits it.
- Do not silently enable memory. Make its behavior and retention understandable to the user.

### Memory-aware requests

When memory is enabled:

- **Describe** sends the new image and relevant previous observations.
- **Ask AI** can use the live image and previous observations.
- A memory-only question can use stored observations without a new photo.
- The assistant distinguishes what it remembers from what it can currently see.

For example, if asked about a fan in an earlier image, say it was white in the earlier observation; do not claim it is currently white unless it is visible now.

### Admin controls and fallback

Add an Admin setting:

- **Enable five-photo memory** — OFF by default until the feature is implemented and tested.
- Display capacity: last five photo observations.
- Explain that stored information is textual scene facts and dialogue context.
- **Clear visual memory** action.

When disabled, preserve today's existing Gemini request path and behavior. Memory must be optional and must not break the existing Describe/Ask AI flow.

## 5. Emergency live sharing and incident video

Treat live emergency sharing and incident recording as two separate capabilities:

**A. Live emergency sharing:** an authorized paired trusted contact can view the camera during an explicitly authorized emergency session.

**B. Incident recording:** a video is recorded and saved privately for later review and download.

Both should support the phone camera and, where technically supported, ESP32-CAM.

### SOS flow and consent

Proposed Admin setting: **Automatically offer video sharing after confirmed SOS**. Default OFF.

If the user enables it and a confirmed SOS occurs:

1. Send the existing SOS notification first.
2. Start an authorized emergency video session only if the camera is available and permission has been granted.
3. Show a clear sharing/recording indicator.
4. Connect only the paired, authorized receiver.
5. Start recording only if the user has separately enabled recording.
6. Stop when the user stops sharing, the session expires or the connection is lost.

The SOS alert must still work if video sharing or recording fails.

Never implement invisible, unrestricted always-on monitoring. The person using the device must know when video is shared, and a **Stop Sharing** control must remain available.

### Live transport

For the phone camera:

- Reuse the existing `getUserMedia()` stream.
- Use WebRTC to send video to the paired receiver.
- Use the existing Cloudflare Durable Object infrastructure for secure session signalling.
- Evaluate a TURN relay fallback for networks where direct peer-to-peer connections fail.

For ESP32-CAM:

- Read the MJPEG stream from the configured local address (the original proposal used `http://ESP32_LAN_IP_PLACEHOLDER:81/stream`).
- Display it in the application.
- Where CORS permits, convert incoming frames to a browser `MediaStream` using a canvas.
- Use that stream for WebRTC and recording.

Durable Objects are for signalling/session coordination, not bulk video-file storage. The browser must bridge the private ESP32 network to the remote receiver. Test CORS and canvas access on the real firmware before committing to the ESP32 streaming/recording architecture.

### Video storage: Cloudflare R2

Do not put video files into the existing photo-history bucket by default. Use a dedicated private R2 bucket for incident recordings.

| Component | Responsibility |
|---|---|
| Cloudflare R2 | Store video objects |
| Supabase | Recording metadata, ownership and retention state |
| Cloudflare Worker | Authorized upload, playback and download endpoints |
| Account page | View, download and delete recordings |
| SOS receiver | View an authorized live session |

Use chunked recording and multipart uploads where appropriate. The browser's `MediaRecorder` can record camera streams and supported canvas streams. Avoid holding an entire long video in browser memory.

### Initial recording limits (proposed)

- Maximum five minutes per emergency recording.
- Moderate resolution and bitrate to reduce data usage and storage.
- Private storage; never expose public video URLs.
- Thirty-day default retention.
- Let the owner download or delete a recording earlier.
- Automatically clean up expired recordings.
- Monitor storage quota and upload failures.

Each recording should have an incident ID, owner, source camera, timestamp, duration, file size and upload status.

### Account and receiver UI

Add an **Emergency recordings** section to the Account page with:

- Recording list and incident metadata.
- Private playback.
- Download.
- Delete recording.

Use the existing SOS Receiver page for authorized live viewing rather than creating an unrelated pairing system.

## 6. Implementation roadmap and release order

Build this as separate, independently testable releases. Do not create one enormous PR.

### Milestone 0 — Foundation and safety review

- [ ] Re-check the current `main` branch and live deployment.
- [ ] Review overlapping open PRs and reconcile changes before touching shared files.
- [ ] Create a fresh backup of the current `main` branch.
- [ ] Confirm actual ESP32 firmware, board, IP and endpoint behavior.
- [ ] Define consent, permissions, data retention and account/guest isolation.
- [ ] Preserve working AI and SOS behavior as regression baselines.

### Milestone 1 — Device setup and unified camera manager

- [ ] Add first-time camera selection.
- [ ] Save camera choice per device.
- [ ] Centralize camera address configuration; verify whether `ESP32_LAN_IP_PLACEHOLDER` is still correct before using it.
- [ ] Create a shared camera manager.
- [ ] Implement persistent phone camera preview and capture.
- [ ] Implement ESP32 connection testing, live preview and diagnostics.
- [ ] Ensure Describe uses the active camera session.

### Milestone 2 — ESP32 camera controls

- [ ] Flash brightness slider.
- [ ] Flash OFF control.
- [ ] Start/stop stream.
- [ ] Normal and flash photo capture.
- [ ] Firmware CORS support.
- [ ] Verify the flash capture delay against the actual firmware.
- [ ] Phone torch support where supported.
- [ ] Confirm stream failure does not break still-photo capture.

### Milestone 3 — Five-photo scene memory

- [ ] Supabase database migration for scene memory.
- [ ] Structured Gemini visual analysis.
- [ ] Latest-five-observations retention.
- [ ] Memory-aware Describe and Ask AI.
- [ ] Memory-only questions.
- [ ] Admin enable/disable toggle and Clear Memory.
- [ ] Guest and account privacy isolation.
- [ ] Existing AI behavior preserved when memory is off.

### Milestone 4 — Emergency live sharing

- [ ] WebRTC transport.
- [ ] Secure session signalling through Durable Objects.
- [ ] Extend existing SOS pairing for live sessions.
- [ ] Trusted receiver video viewer.
- [ ] Visible sharing indicator and Stop Sharing control.
- [ ] Explicit authorization and session expiry.
- [ ] Test reconnect and network failure behavior.
- [ ] SOS notification remains functional if video fails.

### Milestone 5 — Emergency video recording

- [ ] MediaRecorder integration.
- [ ] ESP32 stream-to-recording support after CORS/canvas validation.
- [ ] Private R2 storage.
- [ ] Secure multipart/chunked upload and failure recovery.
- [ ] Supabase recording metadata and ownership.
- [ ] Account recording viewer, downloads and deletion.
- [ ] Thirty-day retention and automatic cleanup.
- [ ] Storage quota monitoring.

## 7. Proposed files and module boundaries

These are suggested entry points based on the architecture recorded in the original proposal. Verify the current repository layout before implementation; module boundaries may change.

| Existing file | Proposed responsibility |
|---|---|
| `web/shared/camera.js` | Replace or adapt into reusable camera manager |
| `web/shared/settings.js` | Device selection, camera IP and memory settings |
| `web/action/index.html` | First-time setup and camera interface |
| `web/shared/app.js` | Integrate capture, AI, memory and voice |
| `web/admin/admin.js` | Camera, memory and emergency settings |
| `worker/src/index.js` | Protected AI, memory and recording API routes |
| `worker/src/sos-room.js` | Emergency session coordination |
| `wrangler.toml` | R2 binding and Worker configuration |

Potential new modules:

```text
web/shared/
  camera-manager.js
  phone-camera.js
  esp32-camera.js
  scene-memory.js
  emergency-video.js
  recording-manager.js

worker/src/
  scene-memory.js
  video-sessions.js
  recording-storage.js

supabase/migrations/
  scene-memory.sql
  emergency-recordings.sql
```

Do not put every new responsibility into `app.js` or the main Worker handler. Keep camera providers, memory, signalling and recording as separable modules.

## 8. Testing and acceptance criteria

A successful unit-test run alone is not enough. Test with real hardware and preserve evidence of what was actually checked.

| Test | Required result |
|---|---|
| First-time setup | Appears once per device; can be reset in Settings |
| Phone camera | Persistent preview; no repeated camera-app launch |
| Camera permission denied | Helpful recovery instructions |
| Describe | Captures from the already active stream |
| ESP32 IP | Uses the configured address everywhere |
| ESP32 stream | Starts and disconnects properly |
| Flash slider | Sends correct values from 0 to 255 |
| Normal photo | Flash remains off |
| Flash photo | Verified firmware delay and successful capture |
| Memory disabled | Existing AI behavior is preserved |
| Memory enabled | Previous five observations can be used |
| Memory retention | Older observations are removed as new ones arrive |
| Memory privacy | No cross-account or cross-guest leakage |
| Memory clear | User can clear stored observations |
| Emergency streaming | Only paired, authorized receiver can view |
| Sharing indicator | User can see and stop active sharing |
| Recording | Correct video is saved privately and downloadable |
| Recording deletion | Owner can delete; expired recordings are cleaned up |
| Recording failure | SOS still functions |
| Screen locked/backgrounded | App accurately reports whether camera sharing stopped |

Target real-device test setup from the original plan:

- Samsung Galaxy A55, Android 16.
- The actual ESP32-CAM board and firmware.
- A second phone acting as the paired SOS receiver.

Record browser version, Android version, firmware version, network conditions, test date and result. Do not claim screen-off/background camera reliability unless it is proven on the target device. A browser cannot promise continuous camera monitoring after Android suspends it.

## 9. Decisions proposed in the original plan

| Area | Proposed decision |
|---|---|
| Default camera | User chooses during first setup |
| ESP32 address | `ESP32_LAN_IP_PLACEHOLDER` was the supplied address in the original plan; verify before use |
| Phone camera | Persistent in-page stream |
| ESP32 preview | Actual MJPEG stream |
| Scene memory | Optional, latest five photo observations |
| Memory storage | Private text-only scene facts and dialogue context |
| AI | Keep Gemini initially |
| Spoken answer | Existing device speech engine |
| Emergency sharing | Paired trusted contact |
| Emergency recording | Explicit opt-in |
| Video storage | Cloudflare R2 |
| Initial video retention | 30 days |
| Release strategy | Separate PRs and deployments |

These are proposed defaults, not production configuration. Revisit privacy, cost, browser compatibility and user consent before implementation.

## 10. Original planning snapshot and prerequisites

The source planning note recorded the following repository state at the time it was written:

- Main baseline: `b81df7c`.
- Latest checked workflow: #474, reported passed.
- PR #10 was reported open and draft, with overlapping camera, app and Admin changes.
- The old `backup/main-before-pr-12` backup was identified as an older snapshot; the plan called for a fresh backup before implementation.

**Important:** these are historical notes from the original plan, not verified current state. Re-check the live repository and pull requests before starting. In particular, do not assume PR #10 is still open or that the recorded commit/workflow is still the latest.

Before the first implementation PR:

1. Fetch current `main`.
2. Review every open PR touching camera, Action, Admin, Worker or SOS code.
3. Reconcile or merge approved overlapping work first.
4. Create a new backup branch from the exact current `main` commit.
5. Create a dedicated feature branch for Milestone 1.
6. Run the existing tests and syntax checks before changes.
7. Implement only the first milestone and open a focused PR.
8. Test on the Galaxy A55 and ESP32 before proceeding to the next milestone.

## 11. Non-negotiable safety and privacy boundaries

- No invisible or unrestricted always-on camera monitoring.
- Camera and microphone access must follow browser permission requirements.
- Emergency video sharing must be visible, authorized and stoppable.
- Recording must have a separate, explicit opt-in.
- Only a paired, authorized receiver may access an emergency session.
- SOS alert delivery must not depend on video streaming or recording succeeding.
- Memory must be optional, clearable and isolated per account/guest session.
- Do not retain photographs just to provide text-only visual memory unless the user has separately enabled photo history.
- Incident recordings must be private, access-controlled and deletable.
- Never expose R2 objects through public URLs.
- Do not promise background camera operation from a browser.
- Do not claim the prototype is a certified navigation aid, medical device or emergency service.
- Keep existing working functionality available while each new feature is developed and tested.

---

## Progress tracker

Update this section as implementation proceeds. Keep planned work unchecked until code, automated checks and the required device tests have actually passed.

- [ ] Milestone 0 — Foundation and safety review
- [ ] Milestone 1 — Device setup and unified camera manager
- [ ] Milestone 2 — ESP32 camera controls
- [ ] Milestone 3 — Five-photo scene memory
- [ ] Milestone 4 — Emergency live sharing
- [ ] Milestone 5 — Emergency video recording

**Next recommended task:** Complete PR #49 validation and the remaining ESP32 hardware checks, then implement Milestone 3 scene memory on an isolated development schema before moving to emergency live sharing and recording.
### Current implementation status — 2026-11-26

- The camera platform foundation (phone/ESP32 source selection, shared camera manager, still capture and Admin ESP32 controls) is present on `main`.
- PR #49 adds the missing ESP32 live preview to the Action page, with independent `/capture` still-photo analysis and stream lifecycle cleanup. It is open and must pass exact-head CI and browser validation before merge.
- Owner-reported physical test: ESP32 `:81/stream` and `/capture` work. Flash-assisted capture, LED brightness, Android Chrome Local Network Access and end-to-end Action-page AI analysis are not yet verified.
- Five-photo scene memory (Milestone 3), emergency WebRTC live sharing (Milestone 4), and private R2 incident recording (Milestone 5) remain unimplemented. They require separate code, tests and infrastructure validation; do not mark them complete based on this camera PR.
- No production deployment or Supabase schema change is included in this continuation.

---

## Historical document: Implementation plan

> **Historical plan:** This records the November 2026 reliability/photo-history work and its acceptance criteria at that time. It is not the current feature inventory or status. Use [FEATURE-MAP.md](FEATURE-MAP.md), [STATUS.md](STATUS.md), [CURRENT-RELEASE-CHECKLIST.md](CURRENT-RELEASE-CHECKLIST.md) and [DECISIONS.md](DECISIONS.md) for current ownership, evidence and decisions. Rows below are retained as historical implementation notes.

> **Historical record (20 November 2026):** this plan was merged and deployed in PRs #7–#9. Item 7 has since changed: each capture now plays one recorded shutter click, not three generated clicks. The test counts below are from that time; `main` now passes 80 tests.


Target device: **Samsung Galaxy A55 5G, Android 16 / One UI 8**. Other Android 16 Samsung models are compatibility targets, not presumed identical.

This checklist records the owner's 17 November 2026 requests. A task is not "done" merely because code exists: automated checks, a production deployment, and the relevant A55 / second-phone test must all be recorded.

## Ordered implementation checklist

| # | Work item | Acceptance criteria | Status |
|---|---|---|---|
| 1 | Gemini responses cut off mid-sentence; remove the 3.6 Flash dependency and try alternatives | No response ending with `MAX_TOKENS` is presented as complete; larger visible-output budget; model fallback records which model succeeded; tests cover a truncated first model and a complete fallback | Implemented on branch; 70/70 CI tests pass; A55 model-quality validation pending |
| 2 | Full Bangla mode for every spoken instruction | When Admin language is বাংলা, camera instructions, waiting/error/SOS/status prompts and AI answers are spoken in Bangla; no English system fallback is spoken; tests cover language routing | Implemented on feature branch; 69/69 CI tests pass; A55 voice playback pending |
| 3 | More effective Bangla voice transcription | Preserve Bangla in Bengali script when Bangla mode is selected; preserve mixed technical terms without translating the whole question to English; transcription models use low-cost-first fallback | Implemented on feature branch; transcription tests pass; A55 microphone/transcription test pending |
| 4 | Camera and upload path on Home / Action | Separate **Use phone camera** and **Upload photo** controls; both open the same preview/confirm flow; upload selection works without the camera-only capture hint | Implemented on feature branch; CI markup test passes; Android upload test pending |
| 5 | Automatic image compression | Resize/re-encode large camera and uploaded images locally to JPEG below 4,000,000 bytes before upload; EXIF is removed by re-encoding; clear error for formats the browser cannot decode | Implemented on feature branch; compression path is covered by syntax/flow checks; large-photo Android test pending |
| 6 | Preview and Ask AI buffer | Preview shows the exact compressed image; optional question box; default Ask AI button waits for explicit confirmation; Admin can disable the wait and restore automatic Describe; nothing is sent before confirmation when enabled | Implemented on feature branch; CI control tests pass; manual preview/auto-send test pending |
| 7 | Three-frame camera shutter sounds | Three synthetic shutter clicks are attempted for the three ESP32-CAM frame requests after priming audio on the user tap; native Android camera-app shutter sound cannot be controlled by a web page | Implemented on feature branch; CI checks pass; actual ESP32 shutter audibility needs device confirmation |
| 8 | SOS while the receiver phone screen is off | Receiver registers a Web Push subscription; sender pushes a notification through a service worker; receiver can acknowledge; foreground polling remains a fallback; delivery is labelled queued/attempted, never guaranteed | Implemented on feature branch; Web Push encryption/subscription tests pass; real A55/second-phone screen-off test pending |
| 9 | Persistent user account, photo/answer history and usage | Authenticated per-user records; private image objects with database metadata, model/answer/timestamp and aggregate usage; user can revisit and delete their own records | Code, UI, SQL schema and mocked storage tests added; Supabase project still needs provisioning and credentials |
| 10 | Persist user-owned Gemini keys across sign-in (implemented in Account; see Supabase setup) | Keys encrypted server-side with a Worker secret; never stored as plaintext, exposed in pages, logs or API responses; deletion and rotation controls | Encryption, per-user key endpoints and mocked round-trip test pass; requires Supabase secrets |
| 11 | IP/usage audit | Store minimal pseudonymous IP fingerprints and request counts with a documented retention period; do not expose raw IPs in public pages or store indefinite location histories | Pseudonymous IP fingerprint and usage tests pass; requires Supabase secrets for live records |
| 12 | Menu closes when tapping elsewhere | Clicking outside the site menu closes it; Escape and link navigation continue to close it; keyboard and touch behavior tested | Implemented on feature branch; CI outside-click logic test passes; touch/keyboard device test pending |

## Architecture decisions and privacy boundaries

- AI keys must never be written to the repository, browser localStorage, plaintext database columns, analytics or logs. Per-user keys are encrypted at rest with a Cloudflare Worker secret and decrypted only for the provider request.
- Photos and answers can reveal sensitive locations and people. Store them only under an authenticated user, with explicit history consent, a retention setting, and a delete-all action. Use private object storage for image bytes and database rows for metadata; do not make images public.
- Store a keyed, rotating IP fingerprint and usage counts rather than raw IP addresses by default. Admin should see useful counts without creating a permanent visitor-location log.
- Screen-off SOS needs Web Push / service-worker delivery. Browser polling and a Wake Lock do not wake a phone whose screen is off. Push notifications can still be delayed or blocked by permissions, network, Doze/battery policy or vendor settings.
- No paid SMS, paid APIs or new API-wide rate limit is introduced without approval. Login protection and secure session expiry are separate from AI usage throttling.

## Current verification boundary

- Latest GitHub Actions run **43989545596** (run #437) passed **70/70 tests** and completed `npm run check` with all JavaScript syntax checks passing. The production deployment job was skipped because this is a pull request / feature branch.
- The latest physical Galaxy A55 / receiver-phone tests have not been performed.
- Account, private photo history, encrypted saved keys and usage reporting do not become active until the Supabase migration is applied and the five Supabase/encryption secrets are configured in GitHub Actions. The Worker supports modern `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` values and a legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` fallback.
- CI is green on the current PR head. Screen-off SOS, ESP32 shutter audibility, Android photo compression/upload and Bengali voice quality still require real-device checks.

## Release gate

Changes stay on `feat/reliability-photo-history-push`. The existing production state is preserved on `backup/main-before-reliability-photo-push-2026-11-17`. Do not merge until the code checks pass and any Cloudflare resource/secret prerequisites are explicit. Do not mark hardware work complete without tests on the Galaxy A55 and the receiving handset.

## How to use this archive

- Treat all historical checkboxes and status statements as snapshots from their original dates.
- A feature is current only when [FEATURE-MAP](FEATURE-MAP.md) and [STATUS](STATUS.md) support the claim with evidence.
- A future feature belongs in [ROADMAP](ROADMAP.md) and must have a current owner, dependency, risk and acceptance criteria.
- A decision that still governs the product belongs in [DECISIONS](DECISIONS.md), not only in this archive.
- Keep this file for historical context; do not append new current plans here.
