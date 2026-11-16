# Test plan

## Automated tests

Run npm test and npm run check.

The Node test suite covers prompt safety and language instructions, API validation, public access, cross-origin rejection, Gemini request/model selection without an app login or Cloudflare rate limit, consent persistence, SOS invitation expiry and consumption, per-device isolation, pairing attempt limits, receiver-token replacement, acknowledgement and revocation.

The JavaScript syntax check parses Worker, Durable Object, browser and access-page modules.

Tests use simulated storage and bindings. They do not emulate a Cloudflare production account or physical devices.

## Manual release checks

| Area | Test | Pass condition |
|---|---|---|
| Desktop | Open the website and use the app | Home, Admin and Diagnostics open without a login prompt |
| Camera local | Capture ESP32 /capture on same LAN | JPEG preview and download work |
| Hosted image | Upload/take a phone photo | Exact image is analysed |
| Gemini | Describe several known photos | Responses are grounded; no mock output |
| Bengali text | Set bn-BD and ask a question | Bengali-script response |
| Bengali speech input | Speak Bengali on Android Chrome | Transcript appears in Bengali; limitations recorded |
| Bengali speech output | Play Bengali test phrase | Intelligible Bengali speech on target device |
| Microphone | Test on HTTPS phone browser | Hardware, permission, recognition and transcript separately reported |
| Consent | Accept, reload, navigate, return | Notice stays dismissed; reset makes it appear again |
| SOS pair | Generate invite and pair receiver | Six-character code succeeds once; receiver refreshes |
| SOS one-use | Reuse invitation | Rejected as used |
| SOS replacement | Generate new invite and pair a second receiver | Old receiver token rejected |
| SOS alert | Trigger and acknowledge | Foreground receiver shows alert, sounds and stops after acknowledgement |
| Network change | Sender and receiver on different networks | Relay works without local-IP dependency |
| Suspended phone | Lock/suspend/close receiver | Delivery/audio may stop; no guaranteed alert is claimed |

## Release acceptance criteria

- CI passes on exact merge candidate.
- No secret or local environment file is committed.
- Public Gemini APIs use the configured API key server-side and return Google quota errors when its free-tier allowance is exhausted.
- Receiver uses single-use invitations and scoped tokens.
- README and safety/deployment docs match actual code.
- Real-device camera, Gemini, Bengali, microphone and two-phone SOS tests are recorded with device/browser details.
