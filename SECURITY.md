# Security policy

## Scope

Daredevil's Eye is an experimental assistive-vision prototype. It is not approved for safety-critical or unsupervised use. The public demo has no account login or general API rate limiter. Google provider quotas apply.

## Reporting a vulnerability

Do not publish API keys, access tokens, pairing codes, personal images, audio recordings or exploitable details in a public issue. Use GitHub's private Report a vulnerability / Security Advisory feature for this repository, or contact the maintainer privately through GitHub.

Include the affected file or route, impact, reproduction steps and suggested mitigation. Do not include Gemini keys, audio or emergency contact details.

## Secret handling

- Never commit `.dev.vars`, `.env`, provider keys, Cloudflare tokens or receiver tokens.
- The public demo does not use an app access-token gate.
- The server-side Gemini project key belongs in a Cloudflare Worker secret and GitHub Actions secret, never in browser source.
- Optional BYOK keys are held in the current browser tab's `sessionStorage` and sent to the same-origin Worker in a request header. They are not persisted in the app's database or local preferences; the user can remove the key or close the tab. A visitor must only enter a key they own and trust this site to use.
- A BYOK key is still visible to that visitor in browser developer tools and is transmitted to this site's Worker for the request. Session storage is not an encrypted vault.
- Rotate credentials that have been exposed or accidentally committed. Remove compromised keys from Google AI Studio / Cloudflare immediately.
- Use scoped, least-privilege Cloudflare deployment tokens.
- Never place production secrets in browser code, issue reports, screenshots or logs.

## Image and audio data

- Camera images are forwarded to Google Gemini for analysis.
- If native browser speech recognition cannot connect, a short audio recording may be sent to Gemini for transcription. Browser-native recognition may separately use the browser vendor's service.
- App code does not intentionally retain image/audio request payloads. Provider processing, retention and data-use terms still apply.
- Google states that content submitted through the Gemini API free tier may be used to improve its products. Do not send sensitive/confidential material through the shared free-tier project key.

## Before enabling accounts

Email OTP, guest detection quotas, profile usage history and an admin usage dashboard are not implemented. Before collecting names, email addresses, phone numbers or IP-derived usage signals, add server-side authorisation, data minimisation, explicit notice/consent, retention/deletion rules, administrator access controls and audit logs. IP addresses must not be used as the only identity signal.
