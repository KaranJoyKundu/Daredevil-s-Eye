# Daredevil's Eye

**An experimental audio-first assistive-vision project for blind and low-vision users.**

Daredevil's Eye explores how a camera, a phone browser, vision-language models and speech interfaces can help a person understand selected visual information in their surroundings. The current prototype combines an ESP32-CAM capture path, an optional phone-photo fallback, a Cloudflare Worker backend, Google Gemini vision and text-to-speech, browser speech recognition, and a paired emergency-alert receiver.

> **Safety:** This is an experimental project, not a navigation aid, medical device or emergency-dispatch service. AI can miss objects and hazards. Never rely on it to decide whether a route, road crossing or movement is safe. Continue using a white cane, guide dog, mobility training and human assistance.

## What is implemented

| Area | Current implementation | Verification status |
|---|---|---|
| Main interface | Four-colour DESCRIBE / ASK AI / SOS / HELP screen | Source present; visual and accessibility checks still required on target phones |
| Vision | Worker sends JPEG/PNG/WebP images to configured Gemini generateContent model | Automated validation tests; live API and device testing are separate |
| Camera | ESP32-CAM /capture helper, preview/download and phone-photo fallback | ESP32 capture previously worked on the developer's LAN; hosted camera access is not solved |
| Admin | Gemini model catalogue, response detail/wait settings, prompts, camera URL, speech and SOS controls | Source present; browser walkthrough still required |
| Speech | Device synthesis, Gemini TTS and browser speech recognition | Not all voice/language combinations verified; mic requires HTTPS or localhost |
| Bengali | bn-BD prompt and speech language configuration | End-to-end Bengali transcription and playback remain unverified |
| Diagnostics | Six cards, including Check all at once | Automated tests; physical tests remain outstanding |
| Consent | Versioned local privacy-consent record, migration and reset action | Automated tests included |
| SOS | Per-install rooms, single-use six-character invitations and receiver-token replacement | Durable Object unit tests; two-phone delivery remains unverified |
| Deployment | Cloudflare Worker with static assets and Durable Objects; GitHub Actions workflow | Requires owner-configured Cloudflare and application secrets |

## Architecture

- web/ contains the browser interface and shared client modules.
- worker/src/ contains the Worker API, validation, owner-token protection, rate-limit checks and Durable Objects.
- sos-directory issues short-lived one-time pairing codes; sos-room stores one sender's receiver session and active alert.
- tests/ contains Node.js tests for prompts, API validation, consent, pairing and alert state.
- .github/workflows/ contains CI and the optional production deployment job.

~~~mermaid
flowchart TD
  Browser[Owner browser] --> Static[Cloudflare Worker static assets]
  Browser -->|Bearer app token| API[Authenticated Worker API]
  API --> Gemini[Gemini Vision / TTS]
  API --> Directory[SOSDirectory Durable Object]
  Directory --> Room[Per-device SOSRoom Durable Object]
  Receiver[Trusted receiver browser] -->|Single-use code| Directory
  Receiver -->|Scoped receiver token| Room
  ESP[ESP32-CAM /capture] -. Local network only .-> Browser
  Phone[Phone camera / upload] --> Browser
~~~

## Important limitations

1. **Worldwide website does not mean worldwide ESP32-CAM access.** The camera address is a private LAN address. A hosted HTTPS page cannot directly fetch a private HTTP camera URL from anywhere on the Internet. The app includes a phone-photo fallback. A remote camera gateway or outbound ESP32 relay needs a separate secured design and firmware/network testing.
2. **Microphone input requires a secure browser context.** Use HTTPS in production or localhost during desktop development. An ordinary http://192.168.x.x address is not a secure context for getUserMedia().
3. **SOS is manual.** It does not detect falls, call emergency services or guarantee delivery. The receiver must be paired, online, open and able to play audio. Mobile browsers may suspend background pages.
4. **Private single-owner beta.** The API uses an owner-configured app access token. This is not a complete multi-user identity, billing or account system.
5. **Bengali support is configured but not certified.** Browser recognition, Gemini responses and TTS must each be tested with real bn-BD speech on the target device.

## Quick start (Windows 11 / PowerShell)

1. Install Node.js 24 or a supported current LTS release.
2. Clone the repository and open PowerShell in its directory.
3. Run npm install.
4. Copy .dev.vars.example to .dev.vars and set a private Gemini key and random app-access token. Never commit .dev.vars.
5. Run npm test and npm run check.
6. Start the local Worker: npx wrangler dev --ip 0.0.0.0 --port 8791.
7. Open the local URL printed by Wrangler, visit /access/, and enter the app token.

See docs/SETUP.md and docs/DEPLOYMENT.md.

## Security and privacy

- Gemini API keys and app access tokens belong in Worker secrets or local .dev.vars, never in client-side JavaScript or Git.
- AI requests are protected by an owner token and same-origin checks. Cloudflare rate-limit bindings provide approximate controls, not strict global quota enforcement.
- Receiver pairing codes are six characters, single-use and expire after ten minutes. A new pairing invalidates the previous receiver token.
- Images and audio are not intentionally persisted by the application. Browser speech recognition may process audio through the browser vendor's service; Gemini TTS sends response text to Google.
- Read web/privacy/index.html, docs/SAFETY.md and SECURITY.md.

## Documentation

- docs/ARCHITECTURE.md
- docs/STATUS.md
- docs/SETUP.md
- docs/DEPLOYMENT.md
- docs/TESTING.md
- docs/ACCESSIBILITY.md
- docs/THREAT-MODEL.md
- docs/ROADMAP.md
- docs/SAFETY.md
- CHANGELOG.md

## Project intent

This repository documents an ongoing engineering experiment: building an accessible camera-to-audio interaction, understanding browser and edge-runtime constraints, and evaluating what is needed before such a system could be responsibly tested with users. It does not claim research validation, safety certification or readiness for unsupervised real-world use.
