# Test plan

## Automated checks

Run:

```powershell
npm test
npm run check
```

The Node suite (80 tests on `main` as of 20 November 2026) covers prompt safety and language rules, API input validation, public API behaviour, model ranking and fallback, consent, Bangla defaults, colour contrast, guest-history cleanup, web push and SOS invitation and room state. The syntax check parses the Worker, the Durable Objects and the browser modules listed in `package.json`.

Check every CI result against the exact commit SHA. A pass on another branch does not prove anything about this one.

## Manual acceptance matrix

| Area | Test | Pass condition |
|---|---|---|
| Landing | Open `/` at desktop, tablet and mobile sizes | Landing page loads with no overlap; **Try the live app** opens `/action/` |
| Home | Open `/action/` | The main four-action page loads |
| Language switch | Switch English ↔ বাংলা on several pages | All visible text, spoken messages and AI answers follow the choice; the Bangla switch message is "বাংলা চালু করা হয়েছে…" |
| Desktop Bangla voice | On Windows Chrome with no Bengali voice, get a Bangla answer | Spoken through `/api/speech` (Gemini) and pronounced correctly |
| Assistant modes | In Admin, choose each preset and Custom, then Describe | The answer follows the mode; Reset restores the default prompt |
| Install | In Android Chrome, choose Install app | The app installs, opens `/blind/`, and long-press shows the three shortcuts |
| Shutter | Describe with the phone camera and with the ESP32-CAM | Exactly one shutter click per capture |
| Shared navigation | Open each standard page | Brand returns to Home; menu opens every section |
| Blind mode | Open `/blind/` on phone | Four large tiles fill screen; no brand/nav/exit button |
| Blind mode Spoken Help | Tap Spoken Help | Instructions are read aloud; the four tiles stay in place |
| Blind mode screen reader | Use TalkBack/NVDA | Every tile has a clear name and action; no focus trap |
| Camera local | Capture ESP32 `/capture` on same LAN | JPEG preview and image analysis succeed |
| Hosted photo | Take/upload a phone photo | Exact image is analysed |
| Mic (Automatic, default) | Tap ASK AI on HTTPS | A short clip is transcribed by Gemini into the selected language |
| Mic (browser-first) | Choose browser-first in Admin; block or remove the native service | Falls back to a Gemini transcription of a short clip |
| English accent | Speak English with Bangladeshi accent | Transcript remains English |
| Bengali | Speak Bengali in Bangla mode | The question is written in Bengali script and answered in Bangla |
| Mixed speech | Speak Bangla and English together | Meaning is preserved without invented words |
| BYOK | Set personal key in Admin | /api/models and vision request use it; key not in localStorage |
| BYOK removal | Remove key / close tab | Project key is used or user-key indicator clears |
| Model ranking | Refresh models | Vision models ranked; each entry has a rank and tier |
| Fallback | Mock a 429 / 503 / missing-model response | Next compatible model is tried; final response reports actual model |
| Progressive text | Ask a question | Words appear sequentially while voice plays; Stop halts both |
| Diagnostics | Run individual and all checks | Results accurately identify failed component; AI request use is disclosed |
| SOS | Pair two physical phones | Pairing, alert, acknowledgement and replacement work |
| SOS suspended | Lock or background receiver | No guaranteed delivery claim; failures documented |
| Contact | Tap phone and WhatsApp links | Correct project number opens dialler/WhatsApp |

## Important test-cost note

The AI image test, voice transcription and live model fallback can consume Gemini quota. Use mock/unit tests first. Do not deliberately exhaust a real quota merely to demonstrate automatic fallback.

## Release acceptance

- CI passes on exact PR head SHA.
- No secret or local environment file is committed.
- Privacy notice clearly discloses image/audio forwarding.
- BYOK key is not persisted beyond the browser tab.
- Real-device results are recorded separately from automated test results.
- No navigation, medical or SOS reliability claims exceed evidence.
