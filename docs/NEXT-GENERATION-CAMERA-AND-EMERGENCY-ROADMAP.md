# Next-generation camera, visual memory and emergency video roadmap

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

The original proposal recorded the then-supplied ESP32 address as `192.168.0.100` and noticed older hard-coded references to `192.168.0.104`. Treat `192.168.0.100` as the proposed default from that plan, not as a guarantee of the board's current address. Verify the actual firmware and network before changing production configuration.

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

The browser is the bridge between the local ESP32 and the internet. The Cloudflare Worker cannot directly reach a private LAN address such as `192.168.0.100`.

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

- Read the MJPEG stream from the configured local address (the original proposal used `http://192.168.0.100:81/stream`).
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
- [ ] Centralize camera address configuration; verify whether `192.168.0.100` is still correct before using it.
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
| ESP32 address | `192.168.0.100` was the supplied address in the original plan; verify before use |
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

### Implementation handoff — 2026-11-26

- The camera platform foundation and Action-page ESP32 MJPEG preview are merged into main. Owner-reported hardware checks confirm /stream and /capture work on the physical ESP32-CAM; flash LED, Android Local Network Access and the full Action-page AI capture flow still need a hands-on test.
- Feature branch feat/scene-memory-sos-video-recordings (PR #52) now contains the five-photo visual-memory APIs/UI, the paired SOS WebRTC signalling protocol and sender/receiver clients, private chunked R2 recording APIs/client, account playback/download/delete UI, the additive Supabase migration, consent/privacy disclosures and deployment guide.
- Scene memory is off by default and stores only sanitized text observations. Account and guest scopes are separated. A database trigger enforces a five-entry maximum.
- Emergency video and recording are separately opt-in and off by default. WebRTC sessions are paired-token protected, expire after five minutes and support optional TURN credentials. Recording is limited to five minutes / 50 MB and expires after 30 days.
- A fresh backup branch of current main was created: backup/main-2026-11-26-before-camera-emergency-merge (base 57ff340). The Supabase migrations are applied and verified. The R2 bucket and TURN secrets have not yet been provisioned. No production Worker deployment has been performed for PR #52.
- PR #52 exact-head GitHub Actions passed in run 45749717683 (tests, syntax checks, Worker bundle and Durable Object migration validation). Supabase migration is applied and verified. R2 deployment validation and physical Android/ESP32 tests remain required. Do not check the milestones complete until those pass.

## Progress tracker

Update this section as implementation proceeds. Keep planned work unchecked until code, automated checks and the required device tests have actually passed.

- [ ] Milestone 0 — Foundation and safety review
- [ ] Milestone 1 — Device setup and unified camera manager
- [ ] Milestone 2 — ESP32 camera controls
- [ ] Milestone 3 — Five-photo scene memory (implementation on feature branch; migration and CI validation pending)
- [ ] Milestone 4 — Emergency live sharing
- [ ] Milestone 5 — Emergency video recording

**Next recommended task:** Complete PR #49 validation and the remaining ESP32 hardware checks, then implement Milestone 3 scene memory on an isolated development schema before moving to emergency live sharing and recording.
### Current implementation status — 2026-11-26

- The camera platform foundation (phone/ESP32 source selection, shared camera manager, still capture and Admin ESP32 controls) is present on `main`.
- PR #49 adds the missing ESP32 live preview to the Action page, with independent `/capture` still-photo analysis and stream lifecycle cleanup. It is open and must pass exact-head CI and browser validation before merge.
- Owner-reported physical test: ESP32 `:81/stream` and `/capture` work. Flash-assisted capture, LED brightness, Android Chrome Local Network Access and end-to-end Action-page AI analysis are not yet verified.
- Five-photo scene memory (Milestone 3), emergency WebRTC live sharing (Milestone 4), and private R2 incident recording (Milestone 5) remain unimplemented. They require separate code, tests and infrastructure validation; do not mark them complete based on this camera PR.
- No production deployment or Supabase schema change is included in this continuation.
