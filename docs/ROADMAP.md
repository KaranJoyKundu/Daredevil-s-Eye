# Roadmap — original goals, current state and next phases

This roadmap replaces the old token/rate-limit checklist, which no longer describes the current public demo. “Implemented” means source/configuration exists; it does not mean a real user or device test has passed.

## Hackathon release — 20 November 2026 (done)

- [x] Landing page at `/`, with the app restyled using a shared palette, type and Lucide icons.
- [x] Full English / বাংলা interface switch; Bangla is the default.
- [x] Bangla speech on desktop through the Gemini cloud voice (`/api/speech`).
- [x] Editable system prompt and assistant presets (All-in-one, Single object, Medicine, Read text, Taka, Colour, Custom).
- [x] Installable app with home-screen shortcuts.
- [x] One recorded shutter click per capture.
- [x] Account and guest photo history (Supabase) with 30-day guest cleanup (17 November).
- [ ] Real-device checks: listed in the [release checklist](CURRENT-RELEASE-CHECKLIST.md).
- [ ] Native Android app for hardware volume-button shortcuts (Up = Describe, Down = Ask AI, both = SOS).

## Phase 0 — working public prototype foundation

- [x] Cloudflare Worker serves the web app, API and Durable Objects.
- [x] Gemini camera-photo analysis using a server-side project key.
- [x] Public demo without app access-token login.
- [x] No additional Cloudflare-wide API rate-limit bindings; Google provider quotas remain.
- [x] ESP32-CAM still-photo helper and phone image upload fallback.
- [x] Standard four-action home screen.
- [x] Admin settings for camera, AI response options, speech and SOS configuration.
- [x] Diagnostics page with six cards, including Check all at once.
- [x] Versioned local privacy consent.
- [x] One-time SOS invitations, receiver tokens, replacement and acknowledgement.
- [x] GitHub Actions test/syntax workflow and conditional Cloudflare deployment.
- [x] Public Cloudflare URL deployed: https://daredevils-eye.karanjoykundu.workers.dev/

## Phase 1 — blind-first and voice-resilience improvements (merged)

- [x] Dedicated Blind mode at /blind/ with four main actions (Describe, Ask AI, SOS, Repeat), separate spoken Help and no visible exit button.
- [x] Shared navigation menu and brand link on standard pages.
- [x] Six Admin quick-jump shortcuts.
- [x] Expanded Help and privacy text.
- [x] Optional personal Gemini key kept only in tab session storage.
- [x] Vision model ranking and best-effort rotation/fallback on model-specific errors.
- [x] Gemini-first multilingual audio transcription for Bangladeshi Bengali, English and mixed-language speech; browser-first mode remains optional.
- [x] Browser recognition falls back after service, language and no-speech failures.
- [x] Bengali-specific speech synthesis voice selection when a Bengali device voice is installed.
- [x] Progressive written answer reveal while speech is playing.
- [x] Spoken Help, spoken errors, first-use spoken safety notice, haptic action patterns and wake lock where supported.
- [x] SOS tap-to-confirm and URL actions / Android shortcut definitions.
- [x] Up to three camera frames and sharpness-based best-frame selection.
- [x] Phone-control setup documentation and empty real-scene scorecard template.
- [x] Project phone/WhatsApp contact link.
- [x] Optional three-shake SOS and opt-in spoken wake phrase with a separate confirmation and cancellation countdown.
- [x] PR CI passed on commit 9c68fcf: 55 tests, 0 failures; JavaScript syntax check passed. Production deployment was skipped for the PR.
- [ ] Android Chrome hands-on voice test with English, Bangla and mixed-language speech.
- [ ] Confirm Bengali voice installation and pronunciation; source code cannot install phone TTS language data.
- [ ] TalkBack test of Blind mode, focus order, touch targets and spoken status.
- [ ] Verify model fallback with controlled test responses and no quota-spending experiment.
- [ ] Evaluate three-frame sharpness selection for latency, low-texture images and dark scenes.
- [ ] Security review of BYOK flow and tab session lifecycle.
- [ ] Usability review and colour/visual refinement after functional acceptance.
- [ ] Test MacroDroid/Tasker volume triggers and Android home-screen shortcuts on the target device.
- [ ] Measure three-shake false-positive/false-negative rates and test Bangla/English voice-SOS wake and confirmation phrases on the target phone.

## Device-control notes

The web app cannot reliably intercept Android hardware volume keys. MacroDroid/Tasker URL triggers and manifest shortcuts are integration paths; event delivery, lock-screen behavior and permissions must be checked on the actual phone. A native Android wrapper with a volume-key handler remains deferred.

## Phase 2 — physical prototype verification

- [ ] Confirm the actual ESP32-CAM board/firmware and `/capture` endpoint across target devices.
- [ ] Confirm HTTPS microphone permission and Gemini recording fallback on current Android browsers.
- [ ] Measure transcription accuracy for Bangladeshi English, Bengali and code-switching.
- [ ] Test actual local camera network constraints, CORS and browser private-network handling.
- [ ] Verify phone speech synthesis, volume, interrupt and replay.
- [ ] Pair two physical phones on different networks and test SOS, replacement, acknowledgement and reconnection.
- [ ] Test receiver when screen locks, browser backgrounds, phone enters battery saver or connectivity drops; document failures rather than claim delivery.
- [ ] NVDA, TalkBack and VoiceOver accessibility review.
- [ ] Supervised feedback sessions with blind/low-vision participants, with informed consent.

## Phase 3 — remote camera access

- [ ] Choose a secured local gateway or outbound ESP32 relay.
- [ ] Define camera identity, provisioning, mutual authentication, image transport, revocation and updates.
- [ ] Evaluate TLS, memory constraints and firmware support on the exact ESP32 board.
- [ ] Never expose an unauthenticated camera HTTP endpoint to the public Internet.

## Phase 4 — accounts, guest trial and usage tracking

Partly done. Email and password accounts, private photo history, guest history, encrypted saved keys and keyed-hash IP usage counts are live (see [Supabase setup](SUPABASE-ACCOUNT-HISTORY-SETUP.md)). The items below are still open.

- [ ] Choose a transactional database and email provider; define secrets and deployment environments.
- [ ] On first visit, show a sign-in / sign-up option and a clearly labelled guest path with **10 free image detections**.
- [ ] Enforce guest usage on the server, not only in local storage. Use IP-based abuse signals with care: shared networks, carrier NAT, VPNs and changing IPs mean IP alone is not a reliable person identifier.
- [ ] Collect only the fields needed at signup: name, email, phone number and “How did you hear about us?” with a clear purpose and consent.
- [ ] Require an expiring, single-use email verification code (OTP); rate-limit sending and attempts; hash codes at rest; prevent enumeration and resend abuse.
- [ ] Validate phone numbers server-side as digits with an optional leading plus and bounded length; reject letters, words, control characters and invalid formats. A valid phone-number library should be evaluated for country-specific formatting.
- [ ] Create user records, verified-email state, per-user detection usage, timestamps and provider/model outcome records.
- [ ] Show profile usage: detections used, remaining guest/trial or account quota, recent request history and account settings.
- [ ] Add a protected admin usage console with search/filter by user/email/date, aggregate statistics and controlled CSV export.
- [ ] Add server-enforced per-user quotas and abuse controls. Never allow a browser-supplied count to decide quota.
- [ ] Document data retention, IP handling, deletion/export, access roles, privacy consent and breach response before collecting personal information.
- [ ] Consider storing a keyed hash or shortened IP signal where sufficient; minimise raw IP retention and set an explicit deletion period.
- [ ] Add tests for OTP expiry, reuse, brute-force resistance, quota concurrency, duplicate accounts, phone validation, admin authorisation and data deletion.

## Current implementation handoff — 26 November 2026

- The current camera manager, phone camera preview, ESP32 still capture and Action-page ESP32 live MJPEG preview are merged into main. Owner-reported physical verification covers /stream and /capture only; Android and flash/LED checks remain open.
- PR #52 implements the next-generation camera/emergency software milestones: optional five-photo text-only memory; paired WebRTC SOS live video; optional five-minute/50 MB private recording; account playback/download/delete; 30-day cleanup; consent/privacy disclosures; and deployment documentation.
- Supabase migrations for scene memory and emergency recording metadata have been applied to the linked project. RLS is enabled, browser roles have explicit deny policies, service_role access was verified, and the five-observation retention trigger is installed.
- PR #52 exact-head GitHub Actions passed in run 45749717683: tests, syntax checks, Worker bundle and Durable Object migration validation. Production deployment is intentionally pending the private R2 bucket.
- Cloudflare R2 bucket daredevils-eye-incident-recordings and TURN relay secrets are not yet provisioned. Do not merge/deploy the R2 binding until the bucket exists. The live video may work on direct paths without TURN, but cross-network success is not guaranteed.
- The wider roadmap still has separate unfinished work: native Android volume-key wrapper, remote ESP32 gateway/relay, email OTP and signup profile fields, 10-detection guest quota and server-enforced account quotas, protected admin usage console/CSV export, and independent security/accessibility/real-user reviews. These are not included in PR #52 and must not be described as completed.
- Hardware/browser acceptance still requires the Galaxy A55 on Android 16, a second receiver phone, screen-lock/background tests, TalkBack and blind/low-vision feedback sessions.

## Phase 5 — research and public release readiness

- [ ] Threat model and independent security review.
- [ ] Privacy impact assessment and clear data-use notices.
- [ ] Accessibility review with blind/low-vision testers and documented consent.
- [ ] Reliability, latency and cost/quota measurements under realistic loads.
- [ ] Clear incident/support process, limitation statements and versioned release notes.
- [ ] No safety-readiness claims without supporting test evidence.
