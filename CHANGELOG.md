# Changelog

## Unreleased — voice-first blind controls and multilingual input

- Replaced the Blind mode Help tile with Repeat; moved Help to a separate spoken-help button outside the four main actions.
- Added a spoken first-use safety notice, concise spoken failure messages, haptic cues, and screen wake lock during active camera/AI/SOS actions where supported.
- Added double-tap SOS confirmation. URL shortcuts can pre-arm SOS but never dispatch an alert merely by opening a URL.
- Made Gemini audio transcription the default microphone mode for Bangla, English and mixed speech; retained browser recognition as an Admin option and now falls back to Gemini after a no-speech result.
- Strengthened transcription instructions for Bangladeshi Bengali and code-switching.
- Prefer an installed Bengali speech-synthesis voice when the response contains Bengali script; Admin reports whether a Bengali voice is installed and previews Bengali when selected.
- Capture up to three camera frames 250 ms apart and choose the sharpest using a Laplacian-variance heuristic.
- Added URL actions and Android home-screen shortcuts for Describe, Ask and confirmation-only SOS.
- Updated documentation and added a ten-scene scorecard template. No real test results are pre-filled.

## Previous unreleased — blind-first and voice resilience

- Added the Blind mode foundation, shared navigation, Admin quick-jump cards, BYOK, Gemini transcription fallback, ranked vision-model failover, and progressive response reveal.
- Updated project documentation, deployment address and privacy disclosures.

## Previous prototype work

- Cloudflare Worker serves static assets and the public API.
- Gemini photo-analysis integration and configurable model catalogue.
- ESP32-CAM still capture helper and phone image upload fallback.
- Versioned local privacy consent.
- Six Diagnostics checks including Check all at once.
- Per-install SOS rooms, one-time six-character pairing invitations, expiry, receiver-token replacement and acknowledgement.
- GitHub Actions tests and conditional Cloudflare production deployment.
- Removed the app login/access-token gate and Cloudflare-wide API rate-limit bindings; Google provider quotas still apply.

Automated checks do not replace real-device testing or supervised usability evaluation with blind and low-vision participants.
