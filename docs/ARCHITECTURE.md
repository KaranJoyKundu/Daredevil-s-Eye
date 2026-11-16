# Architecture

## Runtime

A Cloudflare Worker serves static files from `web/` and API routes from `worker/src/index.js`. The project's Gemini API key remains a Worker secret. Optional personal keys are sent by the browser in a same-origin request header and are not persisted by the Worker. Durable Objects store SOS invitations and alert state.

## Browser and route layout

- `/action/`: normal four-action interface.
- `/blind/`: four-tile accessible mode; no shared header or navigation script.
- `/admin/`: local settings, model catalogue, BYOK and image tester.
- `/diagnostics/`: camera, microphone, AI, speaker and backend checks.
- `/help/`, `/privacy/`, `/contact/`, `/sos-receiver/`: supporting pages.
- `web/shared/site-nav.js`: shared menu and brand home link for standard pages.

## Vision flow

1. The browser captures a still image from ESP32-CAM or obtains a phone/file image.
2. The browser sends the image and user options to the same-origin Worker.
3. The Worker validates MIME type, payload size, question, model, wait limit, response style and language.
4. The Worker uses the session personal Gemini key in `x-user-gemini-api-key` if supplied; otherwise it uses `GEMINI_API_KEY`.
5. `/api/models` lists available `generateContent` Gemini models that can be used for image understanding. Models are ranked using a maintained quality/cost priority order and response metadata.
6. If a selected model returns a model-specific 429, overload, not-found or availability error, the Worker tries other compatible models.
7. The Worker returns the actual model name used. The browser progressively reveals the answer while device speech begins.

Model rotation state is a module-level counter within each Worker isolate. It is best-effort distribution, not a durable globally coordinated scheduler. All models may still share a Google API project's quota. Image-generation-only models are excluded because this product needs image-input understanding, not image creation.

## Voice flow

1. The user explicitly taps ASK AI and grants mic permission.
2. The client tries the browser's native `SpeechRecognition` API.
3. If unsupported or unavailable due to network/service/language errors, the browser uses `MediaRecorder` to collect a short clip.
4. `POST /api/transcribe` sends audio data to the Worker.
5. The Worker calls a low-cost Gemini audio model first and falls back through configured transcription-capable candidates.
6. The model is instructed to detect language from actual words: translate Bengali speech into English, preserve English even when spoken with a Bangladeshi accent, and handle mixed speech faithfully.
7. The resulting English question is sent with the camera image to the vision endpoint.

The audio is processed transiently by the Worker and forwarded to Google. App code does not intentionally persist the clip or transcript. Provider terms apply.

## BYOK key flow

- Browser Admin stores the user's key in `sessionStorage` for the current tab.
- `apiFetch` attaches it only to relevant same-origin API requests, not SOS endpoints or arbitrary external requests.
- Worker reads the custom request header or the project secret.
- The Worker does not write the personal key to the database or durable storage.
- Closing the tab clears the browser session key.
- This is not an account-level key vault or an encrypted saved-key feature.

## Public API and provider quotas

- No app sign-in is required in the present prototype.
- This project adds no general Cloudflare API rate limiter.
- Google model-specific and project-level request/token quotas continue to apply. Public visitors share the configured project quota.
- A different model may recover from a model-specific cap, but not a project-wide daily/request cap.
- A personal API key from another Google API project may use its own project's quota.

## SOS flow

1. Sender browser generates a per-install 128-bit device identifier.
2. SOSDirectory generates a six-character invitation and stores only its SHA-256 hash with a ten-minute expiry.
3. A replacement invitation revokes the previous receiver.
4. Receiver submits the one-time code and receives a scoped random receiver token.
5. Receiver holds the token in tab sessionStorage and polls its sender's room.
6. Sender triggers a ten-minute alert; receiver acknowledges it.
7. Invitation guess attempts are limited within SOSDirectory.

SOS is manual, polling-based and not guaranteed when a mobile browser is suspended.

## Future account-system boundary

The planned account/usage service is not implemented. It will require a database, email OTP delivery provider, server-side usage accounting, guest trial enforcement, authentication/authorisation, admin reporting, retention/deletion rules and a privacy review. IP address alone must not be treated as a stable unique person identifier.
