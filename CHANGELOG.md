# Changelog

## Unreleased — blind-first accessibility and voice resilience

- Added a dedicated `/blind/` 2×2 action screen without a brand header, navigation menu or on-screen exit control.
- Added shared top navigation with a Daredevil's Eye home link on standard pages.
- Added six Admin quick-jump tiles to reduce scrolling.
- Expanded Help with setup, voice fallback, language handling, privacy, quota, diagnostics and SOS instructions.
- Added the project phone and WhatsApp contact supplied by the maintainer.
- Added a short-recording Gemini fallback when native browser speech recognition is unavailable or reports a service/network failure.
- Added language-aware transcription rules: Bengali speech is translated to English; English speech remains English irrespective of accent.
- Added ranked compatible image-understanding models and best-effort fallback when a selected model is unavailable, overloaded or over its model quota.
- Added optional session-only personal Gemini API key support (BYOK).
- Added progressive word-by-word written response display while speech playback runs.
- Updated README, privacy, status, architecture, setup, testing, security and roadmap documentation.
- Email OTP accounts, ten free guest detections, account/profile usage records and admin usage dashboard are documented as a future phase; not implemented.

## Previous prototype work

- Cloudflare Worker serves static assets and the public API.
- Gemini photo-analysis integration and a configurable model catalogue.
- ESP32-CAM still capture helper and phone image upload fallback.
- Versioned local privacy consent.
- Six Diagnostics checks including Check all at once.
- Per-install SOS rooms, one-time six-character pairing invitations, expiry, receiver-token replacement and acknowledgement.
- GitHub Actions tests and conditional Cloudflare production deployment.
- Removed the app login/access-token gate and Cloudflare-wide API rate-limit bindings; Google provider quotas still apply.

All unreleased items are branch source changes until CI passes and a pull request is reviewed. Real-device verification remains a separate requirement.
