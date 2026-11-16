# Threat model (prototype)

## Assets

- Gemini provider key and owner app access token.
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
- Owner-only APIs require a Bearer app token and same-origin check.
- AI, owner-auth and SOS routes use Cloudflare approximate rate-limit bindings.
- Six-character SOS invitations are hashed, single-use and expire after ten minutes.
- Pairing attempts are limited per source IP in SOSDirectory.
- Receiver receives a random 256-bit token; only its hash is stored in the device room.
- Pairing a new receiver revokes the old receiver token.
- Application code does not intentionally persist images or audio.

## Residual risks

- Owner token is a shared single-owner secret, not an identity system. Anyone who obtains it can use the owner's AI quota.
- Cloudflare simple rate limits are approximate and local to each Cloudflare location, not strict global quotas.
- Six-character invitations have limited entropy; expiry, single use and attempt limiting reduce but do not eliminate guessing risk.
- A compromised receiver browser can expose its receiver token.
- Public pairing can be abused to consume attempts; rate limits are best effort.
- Browser storage can be cleared or copied by a local user.
- ESP32-CAM local HTTP may be unauthenticated and must not be exposed directly to the Internet.
- Browser SOS does not guarantee delivery or audible output.
- No independent penetration test, privacy impact assessment or formal safety certification has been performed.

## Before a multi-user release

Add real user/device registration, per-user quotas, stronger pairing recovery, monitoring/abuse response, strict quota accounting, operational alerting, privacy review and independent security testing.
