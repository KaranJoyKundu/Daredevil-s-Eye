# Security policy

## Scope

Daredevil's Eye is an experimental assistive-vision prototype. It is not approved for safety-critical or unsupervised use. The app can be used without signing in. Accounts are optional and only enable private history and a saved key. There is no general API rate limiter, but Google's quotas still apply.

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
- In the default voice mode, a short audio recording is sent to Gemini for transcription. The optional browser-first mode may use the browser maker's own recognition service.
- When a desktop has no Bengali voice, the answer text is sent to Gemini text-to-speech through `/api/speech`.
- When photo history is turned on, the submitted JPEG and its answer are stored in a private Supabase bucket and table. Signed-in records stay until the user deletes them; guest records are deleted after 30 days. Audio is never stored.
- The app does not store audio or text-to-speech data on purpose. Google's processing, retention and data-use terms still apply.
- Google states that content submitted through the Gemini API free tier may be used to improve its products. Do not send sensitive/confidential material through the shared free-tier project key.

## Accounts and stored data

- Signed-in users can save a personal Gemini key. The Worker encrypts it with `API_KEY_ENCRYPTION_KEY` before storing it and never returns it in plain text.
- Supabase tables have row-level security on. Only the Worker, using the server-side secret key, can read or write them, after checking who owns each record.
- Not built yet: email OTP, guest quotas and an admin usage dashboard. Before collecting more personal data (for example names or phone numbers), add explicit notice and consent, rules for keeping and deleting data, admin access controls and audit logs. Do not use an IP address as the only way to identify a person.
