# Architecture

## Runtime

One Cloudflare Worker serves static files from web/ and API routes from worker/src/index.js. Provider credentials remain server-side. Durable Objects store SOS invitation and alert state.

~~~mermaid
flowchart TD
  Browser[Public browser] --> Static[Worker static assets]
  Browser --> API[Public Worker API]
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
3. Worker validates image format, encoded size, question, model, wait limit and response language.
4. Worker validates the request and sends it to the requested Gemini model available to the API key. Google's own free-tier quotas apply.
5. Worker sends the image and safety prompt to Gemini using the server-side API key.
6. Worker returns the answer; browser displays and speaks it.

## Public API and quota limits

- No app access token or login is required to use the website.
- The browser sends same-origin requests to the Worker.
- The Gemini API key is held only in the Worker environment; it is never sent to the browser.
- Image-analysis calls consume four rate-limit units, Gemini TTS calls two, and model catalogue requests one.
- The public model list is restricted by the server-side GEMINI_ALLOWED_MODELS setting.
- Cloudflare rate-limit bindings are approximate and scoped by Cloudflare location. They do not provide a strict global quota or complete protection against distributed abuse.
- The app is a public single-demo deployment, not a multi-user account or billing system.

## Speech

- Mic permission is requested after a user action. The temporary getUserMedia stream is released before SpeechRecognition is started.
- Browser recognition may process audio through the browser vendor's service.
- Device TTS uses operating-system/browser voices.
- Gemini TTS sends answer text through the Worker to Google's TTS model.

## SOS flow

1. The sender browser creates a per-install 128-bit device identifier.
2. SOSDirectory generates a six-character code and stores only its SHA-256 hash with a ten-minute expiry.
3. Creating another invitation deletes the previous invitation and revokes the current receiver token.
4. Receiver submits the code without needing an owner access token.
5. SOSRoom issues a random 256-bit receiver token and stores only its hash. Invitation is consumed.
6. Receiver holds the token in tab sessionStorage and polls its sender's room.
7. Sender can trigger a ten-minute alert; receiver token authorises polling and acknowledgement.
8. Re-pairing invalidates the previous token.

The prototype uses polling rather than push. Browser tabs can be suspended by mobile operating systems; delivery is not guaranteed.

## Camera boundary

http://192.168.0.104 is a private LAN address. Public HTTPS hosting does not route to it. Remote camera use requires a separately designed authenticated gateway or outbound ESP32 relay, plus firmware and TLS testing. The phone camera/photo-upload path is the hosted fallback.
