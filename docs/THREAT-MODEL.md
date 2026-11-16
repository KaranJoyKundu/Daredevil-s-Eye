# Threat model (prototype)

## Assets

- Gemini provider key.
- Camera image content and AI response text.
- SOS invitation codes, receiver tokens and alert state.
- Device preferences and consent record.

## Trust boundaries

- Browser to Worker API.
- Worker to Gemini.
- Worker to Cloudflare Durable Objects.
- Owner browser to receiver browser via invitation and scoped token.
- Browser to ESP32-CAM on a local network.

## Controls present

- Provider and owner secrets are server-side.
- Public API routes apply same-origin request checks and input validation; there is no additional Cloudflare rate limiter.
- Gemini request quotas are enforced by Google according to the API project's usage tier and selected model.
- Six-character SOS invitations are hashed, single-use and expire after ten minutes.
- Pairing attempts are limited per source IP in SOSDirectory.
- Receiver receives a random 256-bit token; only its hash is stored in the device room.
- Pairing a new receiver revokes the old receiver token.
- Application code does not intentionally persist images or audio.

## Residual risks

- AI endpoints are public. Anyone can use Gemini-backed endpoints and consume the project's quota; the app has no login or per-user identity.
- Public visitors share the same Gemini project quota; no per-user quota isolation is implemented.
- Six-character invitations have limited entropy; expiry, single use and attempt limiting reduce but do not eliminate guessing risk.
- A compromised receiver browser can expose its receiver token.
- Public pairing can be abused to consume attempts; rate limits are best effort.
- Browser storage can be cleared or copied by a local user.
- ESP32-CAM local HTTP may be unauthenticated and must not be exposed directly to the Internet.
- Browser SOS does not guarantee delivery or audible output.
- No independent penetration test, privacy impact assessment or formal safety certification has been performed.

## Before a broader public service release

Add real user/device registration, per-user quotas, stronger pairing recovery, monitoring/abuse response, strict quota accounting, operational alerting, privacy review and independent security testing.
