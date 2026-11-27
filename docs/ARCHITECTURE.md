# Architecture

## Runtime

A Cloudflare Worker serves the static files in `web/` and the API routes in `worker/src/index.js`. The project's Gemini API key stays a Worker secret. Admin can send a tab-scoped personal key in a same-origin request header. Signed-in users can separately save an account key through Account & History; the Worker encrypts it with AES-256-GCM and stores ciphertext plus IV in Supabase. Durable Objects store SOS invitations and alert state. Supabase (Postgres plus a private storage bucket) stores optional account and guest photo history. A daily cron trigger deletes guest history older than 30 days.

## Browser and route layout

The canonical page ownership and full feature inventory are maintained in [FEATURE-MAP](FEATURE-MAP.md). The five navigation groups are USE, SAFETY, DEVICES, CONTROL CENTER and INFORMATION.

- `/`: project landing and About page (`web/index.html` and `web/assets/`).
- `/action/`: main task interface: Describe, Ask AI, phone camera and upload.
- `/blind/`: blind-first four-action interface with spoken help and accessible status.
- `/sos/`: canonical SOS Center containing both sender and receiver workflows.
- `/sos-receiver/`: legacy compatibility route only; it must not be a second SOS feature home.
- `/medicine/`: medicine identification and RFID-assisted result.
- `/devices/`: phone shortcut settings and hardware setup entry points.
- `/admin/`: app/device configuration, assistant prompt, model, voice and preferences. No documentation index or roadmap.
- `/diagnostics/`: camera, microphone, AI, speaker, motion and backend health checks; not a settings page.
- `/account/`: sign-in and optional account/guest photo history.
- `/documentation/`: structured guide hub; task-oriented instructions are in Help and technical references are in versioned Markdown.
- `/help/`, `/terms/`, `/privacy/`, `/support/`, `/contact/`: information and support pages.
- `web/shared/site-nav.js`: grouped global navigation and privacy notice. `web/shared/language.js` and `web/shared/bn-text.js` handle English / বাংলা.
- `web/manifest.webmanifest` and `web/sw.js`: installable web app and SOS Web Push handler.

## Prompt assembly

`buildPrompt` in `worker/src/prompts.js` builds the final instruction from these parts:

- the scene rules, or the user's own system prompt from Admin (up to 4,000 characters), which replaces the scene rules;
- the mode (describe or ask), the user's question, the response style and the response language;
- `SAFETY_CORE`, which is always added and cannot be removed from the browser.

The Admin presets (All-in-one, Single object, Medicine, Read text, Taka, Colour, Custom) are prompt texts kept in `web/admin/admin.js`. The selected text is saved in browser settings and sent with each request.

## Vision flow

1. The browser captures a still image from the ESP32-CAM (up to three frames; the sharpest is kept) or gets a phone or file image. It plays one shutter click and shrinks the image to a JPEG under 4 MB.
2. The browser sends the image and user options to the same-origin Worker.
3. The Worker validates MIME type, payload size, question, model, wait limit, response style and language.
4. The Worker uses the session personal Gemini key in `x-user-gemini-api-key` if supplied; otherwise it uses `GEMINI_API_KEY`.
5. `/api/models` lists available `generateContent` Gemini models that can be used for image understanding. Models are ranked using a maintained quality/cost priority order and response metadata.
6. If a selected model returns a model-specific 429, overload, not-found or availability error, the Worker tries other compatible models.
7. The Worker returns the actual model name used. The browser progressively reveals the answer while device speech begins.

Model rotation state is a module-level counter within each Worker isolate. It is best-effort distribution, not a durable globally coordinated scheduler. All models may still share a Google API project's quota. Image-generation-only models are excluded because this product needs image-input understanding, not image creation.

## Voice flow

1. The user taps ASK AI and allows the microphone.
2. In the default Automatic mode, the browser records a short clip with `MediaRecorder`. The optional browser-first mode tries `SpeechRecognition` first and switches to recording if that fails, the language is unsupported, or no speech is heard.
3. `POST /api/transcribe` sends the audio to the Worker.
4. The Worker tries a low-cost Gemini audio model first, then other models that can transcribe.
5. The question is written in the selected answer language: Bengali script in Bangla mode, English in English mode. Mixed speech keeps its technical terms.
6. The question is sent with the camera image to the vision endpoint.

## Speech output

1. Answers are spoken with the device's speech synthesis by default. On Android, a `bn-BD` voice is requested even when Chrome does not list one.
2. On desktop browsers with no Bengali voice (for example Windows), Bangla text goes to `POST /api/speech`. The Worker asks a Gemini text-to-speech model for audio and returns it as WAV. Only the text to be spoken is sent.
3. The Admin "Gemini studio voices" engine option is disabled in this build. The cloud voice is used only for the automatic desktop Bangla fallback above.

The audio is processed transiently by the Worker and forwarded to Google. App code does not intentionally persist the clip or transcript. Provider terms apply.

## BYOK key flow

- Browser Admin stores the user's key in `sessionStorage` for the current tab.
- `apiFetch` attaches it only to relevant same-origin API requests, not SOS endpoints or arbitrary external requests.
- Worker reads the custom request header or the project secret.
- The Worker does not write the personal key to the database or durable storage.
- Closing the tab clears the browser session key.
- This Admin path is not an account-level key vault. Signed-in users can manage a separately encrypted saved key from Account & History; the Worker decrypts it only for the provider request.

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
5. The receiver keeps the token and registers a Web Push subscription through the service worker. Polling remains as a fallback while the page is open.
6. The sender triggers a ten-minute alert. The Worker sends a push notification, and the receiver acknowledges it.
7. Invitation guess attempts are limited within SOSDirectory.

SOS is started by the user. A push service accepting the notification does not prove it was delivered, and delivery can be delayed or blocked by battery-saving or network settings.

## Accounts and photo history

- Supabase Auth handles email and password sign-in. The Worker checks who owns each record and uses the server-side Supabase key. Browser roles have no direct access to the tables (row-level security is on).
- A submitted photo is saved to the private bucket before Gemini is called. Its record then changes from pending to completed or failed.
- Guests are identified by a random HttpOnly cookie. Only its SHA-256 hash is stored, and guest records are deleted after 30 days.
- Usage counts use a keyed hash of the IP address (HMAC). Raw IP addresses are never stored.
- Not built yet: email OTP, guest trial limits, per-user quotas and an admin usage dashboard (see [Roadmap](ROADMAP.md)). An IP address alone must not be treated as one person.

See [Supabase setup](SUPABASE-ACCOUNT-HISTORY-SETUP.md).


## Native Android application

The native Android companion is merged into `main` and documented in [NATIVE-ANDROID-APP.md](NATIVE-ANDROID-APP.md). It uses Capacitor for the Android WebView and a native volume-key plugin plus an optional, explicitly enabled Accessibility Service. The current wrapper loads the existing HTTPS Worker app so same-origin API calls and HttpOnly session cookies remain intact; it is online-first. A debug APK was built successfully by CI, but this is not evidence of physical Galaxy A55 acceptance. WebView mixed content and Android cleartext are enabled for the existing configurable HTTP ESP32-CAM LAN endpoint; keep that endpoint on a trusted local network and never expose it to the public Internet. Global volume shortcuts, screen-off event delivery, TalkBack coexistence and camera/microphone behaviour require physical Galaxy A55 validation. Never assume a WebView can run camera or microphone actions after Android suspends it.
