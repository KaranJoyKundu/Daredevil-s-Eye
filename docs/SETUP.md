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

In Admin → Camera & SOS, enter the ESP32-CAM's current LAN address; its IP can change between networks or router leases. The app appends `/capture`. The browser and ESP32-CAM must be on a network that allows fetch access. A hosted HTTPS page cannot reach a private camera IP from outside its LAN. Use the phone-photo upload path when remote.

## Voice and language

Use the English / বাংলা switch at the top of each page. Bangla is the default.

In the default Automatic mode, ASK AI records a short clip with MediaRecorder and Gemini transcribes it into the selected language. The optional browser-first mode (Admin) tries native SpeechRecognition first. Both use your quota and send audio to Google. Use HTTPS or localhost, allow the microphone, and don't say anything confidential.

Answers are spoken with the device voice. On Windows or another desktop with no Bengali voice, Bangla answers are spoken by Gemini through `/api/speech`, which also uses your quota.

## Assistant mode and system prompt

In Admin → AI, choose a preset (All-in-one, Single object, Medicine, Read text, Taka, Colour) or Custom, and edit the system prompt (up to 4,000 characters). Reset restores the default. The settings are saved in this browser only, and the safety rules are always added on the server.

## BYOK

On Admin → AI models, enter your own Gemini key and select “Use key for this tab.” The key is held in the current tab's sessionStorage. Remove it from Admin or close the tab. Do not paste API keys into chat, screenshots or repository files.

## SOS

Generate a fresh invitation in Admin. The receiver opens the canonical SOS Center at `/sos/`, enters the six-character code and taps Enable alarm & start listening. Keep the receiver foregrounded and online for testing. See Help for detailed steps.

## Blind mode

Open `/blind/`. It has no menu on purpose. To leave, change the address to `/action/`.

## Install as a web app

On Android Chrome, open the site and choose ⋮ → Install app (or Add to Home screen). The installed web app opens Blind mode. Long-press its icon for the Describe, Ask AI and SOS shortcuts.

## Secrets

`.dev.vars`, `.env` and Wrangler state are ignored. Inspect staged files before every commit.
