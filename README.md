# Daredevil's Eye

**An experimental, audio-first assistive-vision prototype for blind and low-vision users.**

Daredevil's Eye explores how a camera, a phone browser and vision-language AI can describe selected visual information aloud. The project combines an ESP32-CAM still-image path, a phone-photo fallback, a Cloudflare Worker API, Google Gemini vision, browser/device speech and a manually paired SOS receiver.

**Live demo:** https://daredevils-eye.karanjoykundu.workers.dev/

> **Safety first:** This is an experimental project, not a certified navigation aid, medical device or emergency-dispatch service. AI can miss objects and hazards. Never use it to decide whether a road crossing, path or movement is safe. Continue using a white cane, guide dog, mobility training and human assistance.

## Start using it

| Page | Address | Purpose |
|---|---|---|
| Home | `/` or `/action/` | Standard action screen |
| Blind mode | `/blind/` | Four large actions (Describe, Ask AI, SOS, Repeat) plus separate spoken Help |
| Admin | `/admin/` | Camera, SOS, AI, voice, API key and image test settings |
| Diagnostics | `/diagnostics/` | Six device and backend checks |
| Help | `/help/` | Detailed usage and troubleshooting |
| SOS Receiver | `/sos-receiver/` | Pair the trusted person's phone |
| Privacy | `/privacy/` | Data processing and storage explanation |
| Contact | `/contact/` | Project contact details |

Blind mode has no header, menu or on-screen exit control. Its four main tiles are Describe, Ask AI, SOS and Repeat; a separate Spoken Help button reads instructions aloud. To leave Blind mode, edit the browser address and remove /blind/, or go directly to /action/.

## Current implementation

| Feature | In source / branch | Verification still required |
|---|---|---|
| Four main actions | DESCRIBE, ASK AI, SOS, REPEAT; separate spoken Help | Blind/low-vision usability testing |
| Blind mode | Four main action tiles, separate spoken Help, no visible exit link | TalkBack and real-device testing |
| Camera input | ESP32-CAM `/capture`; phone photo/upload fallback | Target phone, CORS and LAN tests |
| Vision | Gemini image understanding through Worker | Live-key end-to-end tests |
| Voice input | Gemini multilingual audio transcription by default; optional browser-first mode with Gemini fallback | Bangla, English and code-switching on the target Android phone |
| Language handling | Bengali script detected/transcribed and translated to English; English speech preserved independent of accent | Real Bangla/English code-switch testing |
| Output | Device speech with language-matched voice selection; progressive text reveal | Bengali voice availability and pronunciation tests |
| Model handling | Ranked photo-understanding models; per-request fallback/rotation on model errors | Actual quota exhaustion and provider error testing |
| Personal key | Optional Gemini key in current tab's session storage | Key lifecycle and security review |
| Admin | Six quick-jump shortcuts to main setting areas | Usability feedback |
| Diagnostics | Six checks, including Check all at once | Physical camera/mic/speaker checks |
| SOS | Paired receiver relay, two-tap control, optional three-shake trigger and optional spoken wake phrase with confirmation | Sensor false-positive, voice phrase and two-phone testing |
| Consent | Versioned local consent record | Privacy review and participant testing |

**What voice input does:** the default Automatic multilingual mode records a short microphone clip and sends it to the Worker/Gemini transcription path. It is instructed to recognise Bangladeshi Bengali, English and mixed Bangla-English, translating only Bengali portions into English. This deliberately avoids starting Android's browser recogniser in English-only mode. Admin also offers Browser speech recognition first; that option uses a separately selected recognition locale and falls back to Gemini on network, language, service or no-speech errors. Audio is externally processed, so do not speak passwords or confidential information. Bengali speech is translated into English for the AI question; AI response language is a separate Admin setting and defaults to English. Select Bangla (Bangladesh) there for Bengali AI replies. Bengali spoken output also needs an installed Bengali device TTS voice. Real Bangla input/output accuracy still needs testing on the target phone.

**Bengali spoken answers:** device speech synthesis selects an installed Bengali voice when the answer contains Bengali script. If the phone has no Bengali text-to-speech voice installed, the app cannot provide reliable Bengali pronunciation; install Bengali speech data in Android's text-to-speech settings and check Admin's voice status.

**Camera frame selection:** the ESP32-CAM path captures up to three frames, 250 ms apart, scores their sharpness on a small canvas, and sends the sharpest scored frame. If canvas scoring is unavailable, it uses the newest frame. This is a simple sharpness heuristic, not a guarantee of blur-free capture.

**Hands-free SOS:** optional shake and voice triggers can be enabled in Admin. Three strong shakes start an eight-second cancellation countdown. Voice SOS requires “Daredevil SOS” and a separate “Confirm SOS” phrase, then provides a five-second cancellation countdown. Both are off by default and only run while the Blind mode page is visible. Voice recognition may process microphone audio through the browser's speech provider; shake readings stay local. These triggers are experimental and must not replace a phone call or other emergency plan.

**What automatic model fallback does:** the Worker ranks models that accept camera images and can generate text. If one model returns a model-specific quota, overload or availability error, it tries another compatible Gemini vision model. Rotating models does not bypass a project-wide Google quota. The rotation state is opportunistic per Worker isolate, not a globally coordinated scheduler. A personal API key from a separate Gemini project may help when the demo project's quota is exhausted.

**Model terminology:** this application analyses camera photos. Its selector is therefore a ranked *vision/photo-analysis* list, not an image-generation model list. Models which only generate images are not compatible with this use case.

## Architecture

- `web/` contains the standard site, Blind mode, Admin, Help, Diagnostics, privacy and SOS pages.
- `web/shared/` contains camera capture, consent, settings, navigation, API and speech modules.
- `worker/src/` contains validation, Gemini calls and Cloudflare Durable Objects for SOS.
- `tests/` contains Node tests for Worker behavior, prompts, consent and SOS state.
- `.github/workflows/ci.yml` runs tests and syntax checks; a successful `main` workflow deploys to Cloudflare when the three required secrets exist.

Main flow:

1. The browser captures a JPEG/PNG/WebP image.
2. It sends the image and task to the same-origin Worker.
3. The Worker selects the configured or session-only user Gemini key, validates the request and tries compatible image-understanding models.
4. The browser reveals the answer progressively while it is spoken.
5. In the default Automatic microphone mode, the browser records a short clip and sends it to Gemini for multilingual transcription. Browser-first recognition is optional in Admin and falls back to Gemini when the recogniser returns no speech or a service/language error.

## Important limits

1. **Google quotas still apply.** The public demo does not require an app login and does not add a Cloudflare-wide API request limiter. Google applies its own model/project quotas. Public visitors share the configured project quota and may receive 429 errors.
2. **Model rotation has limits.** It can recover from a model-specific cap when another model still has quota. It cannot defeat a project-wide daily or account-level cap.
3. **BYOK is optional.** An entered Gemini key is stored in the current browser tab's session storage, sent to this site's Worker in a request header and not saved by this app in its database or local preferences. Use a key you own. Closing the tab clears it.
4. **Voice recording is external processing.** Default Automatic mode sends a short browser-recorded clip to Google Gemini for transcription. Optional Browser-first mode may use the browser vendor's speech service, then falls back to Gemini. Avoid private speech.
5. **Camera reachability is local.** An ESP32-CAM address such as `192.168.0.104` is a private LAN address. A hosted HTTPS site cannot reach it from anywhere on the Internet. Phone camera/upload is the portable hosted fallback.
6. **SOS is manual and best effort.** It is not fall detection, ambulance dispatch or guaranteed delivery. The receiver must be paired, online, open and able to play audio. A locked or suspended phone may miss an alert.
7. **No accounts yet.** Email OTP registration, 10 free trial detections, individual quotas, profile usage history and an admin usage dashboard are future work, not current features.
8. **Gemini TTS remains incomplete.** Device/browser speech is the recommended output path. The Admin's legacy Gemini TTS selector is not backed by a completed Worker speech route in this prototype.

## Local setup (Windows PowerShell)

Requirements: Node.js 24 or supported current LTS, npm, Wrangler, and a Gemini API key for live AI use.

```powershell
git clone https://github.com/KaranJoyKundu/Daredevil-s-Eye.git
cd Daredevil-s-Eye
npm install
Copy-Item .dev.vars.example .dev.vars
```

Add `GEMINI_API_KEY` to `.dev.vars` locally. Never commit this file or paste a real key into source code.

```powershell
npm test
npm run check
npx wrangler dev --ip 0.0.0.0 --port 8791
```

Open the URL Wrangler prints. Use localhost for local microphone tests; use HTTPS on a phone.

## Production deployment

GitHub Actions deploys after tests pass on `main` if the repository secrets below exist:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GEMINI_API_KEY`

The Gemini key is uploaded as a Cloudflare Worker secret. Do not put secret values in GitHub workflow source, commits or frontend files. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation map

- [Implementation status](docs/STATUS.md)
- [Roadmap and original plan](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup](docs/SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)
- [Accessibility](docs/ACCESSIBILITY.md)
- [Phone controls and Android shortcuts](docs/PHONE-CONTROLS.md)
- [Safety and privacy](docs/SAFETY.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

The feature branch contains work that is not live until it is reviewed and merged to `main`. Automated checks do not replace hands-on device verification or supervised testing with blind and low-vision participants.
