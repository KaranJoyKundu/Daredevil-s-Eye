# Roadmap

## Phase 0 — private beta foundation
- [x] Worker serves static assets and API.
- [x] Owner API token and approximate rate limits.
- [x] Versioned privacy consent.
- [x] SOS single-use invitation and receiver-token replacement.
- [x] Bengali response-language prompt selection.
- [ ] Configure Cloudflare and Gemini production secrets.
- [ ] Deploy from GitHub Actions and verify the live endpoint.

## Phase 1 — real-device verification
- [ ] Android Chrome microphone permission and recognition.
- [ ] Bangla input/output quality on device voices and Gemini TTS.
- [ ] ESP32-CAM local browser capture under current CORS/PNA behaviour.
- [ ] Two-phone SOS delivery, replacement, acknowledgement and reconnect.
- [ ] TalkBack and desktop screen-reader evaluation.
- [ ] Supervised tests and feedback with blind/low-vision users.

## Phase 2 — remote camera
- [ ] Choose authenticated local gateway or outbound ESP32 relay.
- [ ] Define device provisioning, mutual authentication, image transport and revocation.
- [ ] Test TLS feasibility and memory limits on the exact ESP32 board/firmware.
- [ ] Avoid public inbound camera ports and untrusted image relays.

## Phase 3 — multi-user and research readiness
- [ ] Replace shared owner token with real account/device identity.
- [ ] Per-user provider quotas and billing protection.
- [ ] Stronger SOS recovery, monitoring and abuse controls.
- [ ] Privacy impact assessment and independent security review.
- [ ] Controlled usability study, consent process and documented outcomes.
- [ ] Publish measured performance/reliability data only after testing.
