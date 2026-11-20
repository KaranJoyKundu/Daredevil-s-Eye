# Daredevil's Eye

**An experimental, audio-first assistive-vision prototype for blind and low-vision users.**

Daredevil's Eye explores how a camera, a phone browser and vision-language AI can describe selected visual information aloud. It combines ESP32-CAM and phone photo paths, a Cloudflare Worker API, Google Gemini, device speech and a paired SOS receiver.

**Live demo:** https://daredevils-eye.karanjoykundu.workers.dev/

## Start using it

| Page | Address | Purpose |
|---|---|---|
| Landing page | / | Project overview for visitors and judges; links to the app and Blind mode |
| Home | /action/ | Main actions and phone-photo workflow |
| Blind mode | /blind/ | Describe, Ask AI, SOS, Repeat and spoken Help |
| Admin | /admin/ | Camera, SOS, AI, voice, photo-history and image-test settings |
| Diagnostics | /diagnostics/ | Device/browser and backend tests |
| Account & History | /account/ | Signed-in history, guest photo history, personal key and usage |
| Terms & Conditions | /terms/ | Terms accepted before app use |
| Privacy | /privacy/ | Detailed data processing/storage explanation |
| Support | /support/ | bKash/Nagad support details |
| Help | /help/ | Troubleshooting |
| SOS Receiver | /sos-receiver/ | Pair the receiving phone |

## Current implementation

- Up to three ESP32-CAM frames are captured and the sharpest selected. Phone camera and upload use the preview/confirmation path.
- Images are locally compressed to JPEG below 4 MB before submission.
- Gemini 3.8 Flash is the default vision model; saved Gemini 3.6 Flash settings are migrated to 3.8 Flash.
- Bangla (Bangladesh) is the default AI reply and device-speech language. Admin can change it. The code waits for the Android/Chrome voice list and attempts the bn-BD locale when Chrome does not expose a Bengali voice name.
- Default microphone mode uses Gemini for multilingual Bangla, English and mixed-language transcription.
- Each submitted photo is saved to private history before AI analysis when photo saving is enabled. Signed-in users get account history; signed-out users get browser-scoped guest history for 30 days. Failed Gemini requests keep the photo and show a failed status.
- Account & History supports private image viewing, individual delete and delete-all for account and guest histories.
- Terms acceptance is required before protected app pages become usable.
- SOS uses a paired Web Push receiver; push-service acceptance is not a delivery receipt.

The old generic safety warning is no longer appended to every AI reply. The project's limitations and safety boundaries are explained in Terms and Privacy.

## Photo history and privacy

The private Supabase bucket is not publicly accessible. Signed-in history remains until the user deletes it. Guest history uses a random HttpOnly browser cookie; only its SHA-256 digest is stored, and records/photos are deleted after 30 days. A preview cancelled before submission is not saved. Photos submitted for AI analysis are saved even if Gemini fails.

The Supabase Worker secrets were uploaded successfully by production deployment runs #448 and #450. Account and guest history are configured in production, but still need an end-to-end photo test from a browser/phone. See [Supabase account/history setup](docs/SUPABASE-ACCOUNT-HISTORY-SETUP.md).

## Model choice

The project defaults to Gemini 3.8 Flash rather than 3.6 Flash. Keep this current compatible vision model as the default; the Worker can fall back among supported Gemini vision models when a model-specific error occurs. Model rotation cannot bypass a project-wide quota.

## Important limits and safety

Daredevil's Eye is an experimental project, not a certified navigation aid, medical device or emergency-dispatch service. Continue using usual mobility aids and emergency plans. SOS remains best-effort and does not guarantee screen-off notification delivery. Bengali voice playback, actual photo workflow and locked-screen SOS must be verified on the physical Galaxy A55 and a second receiving phone.

## Local setup (Windows PowerShell)

Requirements: Node.js 24, npm, Wrangler and a Gemini API key for live AI use.

    git clone https://github.com/KaranJoyKundu/Daredevil-s-Eye.git
    cd Daredevil-s-Eye
    npm install
    Copy-Item .dev.vars.example .dev.vars

Add GEMINI_API_KEY to .dev.vars locally. Never commit it.

    npm test
    npm run check
    npx wrangler dev --ip 0.0.0.0 --port 8791

## Documentation map

- [Current release checklist](docs/CURRENT-RELEASE-CHECKLIST.md)
- [Implementation plan](docs/IMPLEMENTATION-PLAN.md)
- [Implementation status](docs/STATUS.md)
- [Supabase account and photo-history setup](docs/SUPABASE-ACCOUNT-HISTORY-SETUP.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup](docs/SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)
- [Accessibility](docs/ACCESSIBILITY.md)
- [Phone controls](docs/PHONE-CONTROLS.md)
- [Safety and privacy](docs/SAFETY.md)
- [Threat model](docs/THREAT-MODEL.md)

## Remaining device tests

See the current release checklist for prioritized acceptance criteria. Remaining validation is guest/account photo persistence, 30-day cleanup execution, Bengali speech on the A55, Account-page TalkBack review, and screen-off SOS on a second handset.
