# Implementation status

This file distinguishes source implementation from real-device verification.

## Implemented in source

- Cloudflare Worker serves static assets from web/ and API routes.
- Gemini vision calls use server-side GEMINI_API_KEY and selectable generateContent models.
- Payload validation, response styles, wait limits and bn-BD prompt instructions.
- Public same-origin API without Cloudflare rate limits or a server-side model allowlist; Google enforces its own model-specific usage quotas.
- Gemini TTS and browser speech helpers.
- Explicit getUserMedia permission request followed by browser SpeechRecognition.
- Versioned privacy consent, legacy migration and reset.
- ESP32-CAM /capture helper and phone-photo fallback.
- Diagnostics page has six cards, including Check all at once.
- Per-install SOS rooms, one-time six-character invitations, 10-minute expiry, attempt limiting, receiver tokens and replacement.
- GitHub Actions CI and optional Cloudflare deployment workflow.

## Automated verification

GitHub Actions runs npm test and npm run check. Always refer to the latest run for the current result; previous test counts are not a release guarantee.

## Not verified

- Production Gemini vision and TTS with Cloudflare secrets.
- Bengali transcription, response quality and TTS on target phones.
- Android Chrome microphone behaviour.
- ESP32-CAM capture from a hosted HTTPS origin.
- Camera access outside the local network.
- SOS delivery and replacement between physical phones on different networks.
- Alarm reliability when a phone is locked, suspended or offline.
- Screen-reader evaluation, usability tests, load tests, penetration tests and independent safety assessment.

## Deployment status

The repository is configured for Cloudflare Workers, Static Assets and Durable Objects. A deployment workflow can publish after CI when the owner has configured GitHub Actions secrets. Workflow presence alone does not mean that a live Worker exists.

## Known limits

- No login or app access token is required. Public users share the project's Gemini free-tier quota; Google may return 429 when its request or token limits are reached.
- ESP32-CAM private IP is not globally reachable; phone photo/upload is the portable fallback.
- Browser speech recognition may use a browser vendor's cloud service.
- SOS is a manual best-effort alert, not fall detection or emergency dispatch.
