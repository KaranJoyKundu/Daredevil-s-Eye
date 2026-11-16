# Local setup (Windows 11 / PowerShell)

## Requirements

- Node.js 24 or supported current LTS.
- npm and Wrangler.
- Gemini API key for live model and speech tests.
- ESP32-CAM and phone/PC on the same LAN for local camera tests.

## Install

```powershell
git clone https://github.com/KaranJoyKundu/Daredevil-s-Eye.git
cd Daredevil-s-Eye
npm install
Copy-Item .dev.vars.example .dev.vars
```

Add `GEMINI_API_KEY` to `.dev.vars` using a key you own. Never commit `.dev.vars`, paste secrets into GitHub source or place a production key in frontend code.

## Verify and run

```powershell
npm test
npm run check
npx wrangler dev --ip 0.0.0.0 --port 8791
```

Open the local URL printed by Wrangler. Use `http://localhost:8791` for microphone permission on the same development computer. A phone needs HTTPS for microphone access.

## Camera

Admin → Camera & SOS defaults to `http://192.168.0.104`; the app appends `/capture`. The browser and ESP32-CAM must be on a network that allows fetch access. A hosted HTTPS page cannot reach a private camera IP from outside its LAN. Use the phone-photo upload path when remote.

## Voice and language

ASK AI first tries native browser SpeechRecognition. If that service is unavailable/network-blocked, it records a short clip using MediaRecorder and asks Gemini to transcribe it. The transcription prompt converts Bengali words to English and preserves English speech regardless of accent. This uses provider quota and sends audio to Google. Use HTTPS or localhost, allow the microphone and avoid speaking confidential details.

## BYOK

On Admin → AI models, enter your own Gemini key and select “Use key for this tab.” The key is held in the current tab's sessionStorage. Remove it from Admin or close the tab. Do not paste API keys into chat, screenshots or repository files.

## SOS

Generate a fresh invitation in Admin. The receiver opens `/sos-receiver/`, enters the six-character code and taps Enable alarm & start listening. Keep the receiver foregrounded and online for testing. See Help for detailed steps.

## Blind mode

Open `/blind/`. To leave, edit the URL and remove `/blind/` or navigate to `/action/`.

## Secrets

`.dev.vars`, `.env` and Wrangler state are ignored. Inspect staged files before every commit.
