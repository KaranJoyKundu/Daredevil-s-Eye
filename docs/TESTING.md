# Test plan

## Automated checks

Run:

```powershell
npm test
npm run check
```

The Node suite covers prompt safety/language instructions, API payload validation, public API behavior, model ranking/fallback helpers, consent persistence and SOS invitation/room state. The syntax check parses Worker, Durable Object and browser modules.

The feature-branch run must be checked against the exact commit SHA. Baseline main previously passed 39 tests; that result is not proof for this branch.

## Manual acceptance matrix

| Area | Test | Pass condition |
|---|---|---|
| Home | Open `/` and `/action/` | Standard action page loads |
| Shared navigation | Open each standard page | Brand returns to Home; menu opens every section |
| Blind mode | Open `/blind/` on phone | Four large tiles fill screen; no brand/nav/exit button |
| Blind mode Help | Tap Help then Return | Help overlay opens and returns to the 4-tile grid |
| Blind mode screen reader | Use TalkBack/NVDA | Every tile has a clear name and action; no focus trap |
| Camera local | Capture ESP32 `/capture` on same LAN | JPEG preview and image analysis succeed |
| Hosted photo | Take/upload a phone photo | Exact image is analysed |
| Mic native | Tap ASK AI on HTTPS | Browser recognises speech where supported |
| Mic fallback | Block native service or test where unavailable | Short MediaRecorder clip is transcribed via Gemini |
| English accent | Speak English with Bangladeshi accent | Transcript remains English |
| Bengali | Speak Bengali | Faithful English translation/question is produced |
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
