# Architecture

## Runtime

One Cloudflare Worker serves static files from web/ and API routes from worker/src/index.js. Provider credentials remain server-side. Durable Objects store SOS invitation and alert state.

~~~mermaid
flowchart TD
  Browser[Owner browser] --> Static[Worker static assets]
  Browser -->|Bearer app token| API[Worker API]
  API --> Gemini[Gemini Vision and TTS]
  API --> Directory[SOSDirectory Durable Object]
  Directory --> Room[Per-device SOSRoom]
  Receiver[Trusted receiver browser] -->|Single-use code| Directory
  Receiver -->|Scoped receiver token| Room
  ESP[ESP32-CAM /capture] -. local network only .-> Browser
  Phone[Phone photo upload] --> Browser
~~~

## Vision flow

1. Browser captures a frame from ESP32-CAM or obtains a phone/file image.
2. Browser converts it to a data URL and sends it with preferences to the Worker.
3. Worker authenticates the owner and validates image format, encoded size, question, model, wait limit and response language.
4. Worker sends the image and safety prompt to Gemini.
5. Worker returns the answer; browser displays and speaks it.

## Speech

- Mic permission is requested after a user action. The temporary getUserMedia stream is released before SpeechRecognition is started.
- Browser recognition may process audio through the browser vendor's service.
- Device TTS uses operating-system/browser voices.
- Gemini TTS sends answer text through the Worker to Google's TTS model.

## Owner API access

Owner enters a high-entropy app token at /access/. It is stored in sessionStorage for that browser tab. Private API requests send it as a Bearer token. This is a single-owner beta gate, not a multi-user account system.

## SOS flow

1. The owner browser creates a per-install 128-bit device identifier.
2. SOSDirectory generates a six-character code and stores only its SHA-256 hash with a ten-minute expiry.
3. Creating another invitation deletes the previous invitation and revokes the current receiver token.
4. Receiver submits the code without receiving the owner's Gemini/app token.
5. SOSRoom issues a random 256-bit receiver token and stores only its hash. Invitation is consumed.
6. Receiver holds the token in tab sessionStorage and polls its sender's room.
7. Owner can trigger a ten-minute alert; receiver token authorises polling and acknowledgement.
8. Re-pairing invalidates the previous token.

The prototype uses polling rather than push. Browser tabs can be suspended by mobile operating systems; delivery is not guaranteed.

## Camera boundary

http://192.168.0.104 is a private LAN address. Public HTTPS hosting does not route to it. Remote camera use requires a separately designed authenticated gateway or outbound ESP32 relay, plus firmware and TLS testing. The phone camera/photo-upload path is the hosted fallback.
