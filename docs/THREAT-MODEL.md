# Threat model (prototype)

## Assets

- The server-side Gemini project key, a visitor's own Gemini key for the tab, and encrypted saved keys for signed-in users.
- Camera images, audio sent for transcription, text sent for speech, and the AI's answers.
- Private photo history in Supabase, the guest cookie, and usage counts based on a keyed hash of the IP address.
- SOS invitation codes, receiver tokens and alert state.
- Settings in the browser, including the custom system prompt, the camera address and the emergency contact.
- Account identity (email) handled by Supabase Auth.

## Trust boundaries

- Browser to same-origin Worker API.
- Worker to Google Gemini.
- Worker to Cloudflare Durable Objects.
- Worker to Supabase (Auth, Postgres, private storage).
- Worker to the push service, for SOS web push.
- Sender browser to receiver browser via invitation/token.
- Browser to ESP32-CAM over a local network.
- User-supplied API key from Admin to Worker request header.

## Controls present

- Production project key remains a Worker secret, not in frontend source.
- BYOK requests send a custom key only to same-origin AI endpoints and do not persist it server-side; the browser holds it in tab sessionStorage.
- Worker validates image type/size, question, model ID and request options.
- Same-origin request checks reject cross-origin browser requests with a foreign Origin header.
- SOS invitations are hashed, single use and expire after ten minutes.
- Pairing attempts are limited in SOSDirectory.
- Receiver receives a random 256-bit token; only its hash is stored in the room.
- Pairing a replacement receiver revokes the old receiver token.
- App code does not intentionally persist camera/audio payloads.
- Saved personal keys are encrypted with a Worker secret. Guest cookies are stored only as SHA-256 hashes. IP addresses are stored only as keyed hashes.
- Supabase row-level security blocks direct access from the browser. Photos are kept in a private bucket.
- A custom system prompt is limited to 4,000 characters, and `SAFETY_CORE` is always added on the server.

## Residual risks

- Public AI routes, including `/api/speech`, can use up the shared Gemini project quota. There is no per-user quota or general API rate limiter.
- A custom system prompt can make answers less useful or try to override the scene rules. The safety rules are still added, but they cannot guarantee safe output.
- A user-supplied API key is visible to the user in browser developer tools and sent to this site's Worker. Users must only enter keys they own and should remove them after a demo.
- SessionStorage limits persistence but does not make a key a secure account vault.
- Model rotation is per Worker isolate and best-effort; concurrent isolates do not share a rotation counter.
- Different models may all share the same project-level quota. Rotation cannot evade project-wide caps.
- Microphone fallback records a short clip and forwards it to Google Gemini. Users may accidentally speak personal information.
- Native SpeechRecognition may send audio through the browser vendor's service.
- Browser storage may be copied or cleared by a local user.
- ESP32-CAM local HTTP may be unauthenticated; do not expose the camera directly to the Internet.
- SOS delivery/audio is not guaranteed on a suspended, locked or offline device.
- No independent penetration test, privacy impact assessment or formal safety certification has been performed.

## Before public multi-user launch

Add server-side OTP and quota controls, robust email delivery throttling, account authorisation, admin audit protections, privacy notice and retention/deletion tooling. Use IP only as one abuse signal; shared mobile carrier NAT, campus Wi-Fi, VPNs and dynamic addresses can group innocent visitors or evade simplistic counters. Minimise raw IP retention; consider keyed hashes and a documented expiry period. Never expose the usage dashboard publicly.
