# Local setup (Windows 11 / PowerShell)

## Requirements

- Node.js 24 or supported current LTS.
- npm and Wrangler.
- Gemini API key for live AI tests.
- ESP32-CAM and a phone/PC on the same LAN for local camera tests.

## Install and configure

~~~powershell
cd "C:\path\to\Daredevil-s-Eye"
npm install
Copy-Item .dev.vars.example .dev.vars
~~~

Edit .dev.vars locally:
- GEMINI_API_KEY: current Gemini key; never paste into chat, commit, or frontend.
- APP_ACCESS_TOKEN: random private token, at least 32 characters.
- AI_MODE=gemini for live requests; AI_MODE=mock only for deliberate mock tests.

Generate a strong app token without displaying it:

~~~powershell
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$token | Set-Clipboard
Write-Host "Random app token copied to clipboard. Paste it into .dev.vars as APP_ACCESS_TOKEN=..."
~~~

Run tests and syntax checks:

~~~powershell
npm test
npm run check
~~~

Start the Worker:

~~~powershell
npx wrangler dev --ip 0.0.0.0 --port 8791
~~~

Open the URL Wrangler prints, visit /access/, and enter the app token.

## Camera

Admin defaults to http://192.168.0.104 and the app appends /capture. Browser and ESP32-CAM must be on a network that allows the browser fetch, including CORS/private-network permissions. A hosted HTTPS page cannot directly fetch a private HTTP camera IP. Use phone camera/photo upload on the hosted app. Never expose the camera web server directly to the Internet.

## Microphone

Use http://localhost:8791 on the same PC for local mic permission testing. Phone mic requires the deployed HTTPS origin. SpeechRecognition language availability depends on the browser and device.

## SOS

The sender must be unlocked. Generate a fresh invitation in Admin. The receiver opens /sos-receiver/, enters the six-character code, pairs, then the page refreshes. Tap Enable alarm & start listening. Receiver does not need the owner's app token; it receives a scoped receiver token. Test only with consenting contacts; keep the page foregrounded and online.

## Secrets

.dev.vars, .env and Wrangler state are ignored. Check staged files before every commit.
