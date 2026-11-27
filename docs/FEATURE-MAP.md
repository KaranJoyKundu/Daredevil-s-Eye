# Feature map — Daredevil's Eye

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Reviewed:** 28 November 2026  
**Purpose:** One index for where each capability belongs, where its implementation lives, and what evidence is still required. This is an inventory, not a claim that every feature has passed end-to-end testing.

## Canonical product structure

| Group | Canonical destination | Responsibility |
|---|---|---|
| **USE** | [Action](https://daredevils-eye.karanjoykundu.workers.dev/action/), [Blind mode](https://daredevils-eye.karanjoykundu.workers.dev/blind/) | The two ways a person uses the assistant. |
| **SAFETY** | [SOS Center](https://daredevils-eye.karanjoykundu.workers.dev/sos/), [Medicine](https://daredevils-eye.karanjoykundu.workers.dev/medicine/) | Trusted-contact alerts and medicine identification. |
| **DEVICES** | [Devices](https://daredevils-eye.karanjoykundu.workers.dev/devices/), [ESP32-CAM guide](../firmware/esp32-cam-ai-thinker/README.md), [RFID guide](../hardware/esp32-rfid/README.md) | Phone camera, ESP32-CAM, RFID and hardware provisioning. |
| **CONTROL CENTER** | [Admin](https://daredevils-eye.karanjoykundu.workers.dev/admin/), [Diagnostics](https://daredevils-eye.karanjoykundu.workers.dev/diagnostics/) | Admin changes preferences; Diagnostics tests health. These are separate jobs. |
| **INFORMATION** | [Help](https://daredevils-eye.karanjoykundu.workers.dev/help/), [Documentation](https://daredevils-eye.karanjoykundu.workers.dev/documentation/), [Privacy](https://daredevils-eye.karanjoykundu.workers.dev/privacy/), [About](https://daredevils-eye.karanjoykundu.workers.dev/), [Support](https://daredevils-eye.karanjoykundu.workers.dev/support/), [Contact](https://daredevils-eye.karanjoykundu.workers.dev/contact/) | User guidance, technical reference, transparency and project information. |

The site navigation should use these five groups consistently. A shortcut may appear elsewhere, but the canonical destination owns the feature and its controls. Do not duplicate settings or place documentation indexes inside Admin.

## Evidence vocabulary

- **Implemented in source** — implementation/configuration is present in the repository.
- **Automated-tested** — an automated test covers the behaviour and the exact commit's CI result is recorded.
- **Browser-verified** — the route and stated scenario were exercised in a browser.
- **Device-verified** — the named physical device, OS and build were tested.
- **Incomplete / blocked** — implementation or validation is unfinished.
- **Planned** — not implemented; do not describe as available.

A higher evidence level must never be inferred from a lower one. Check [STATUS](STATUS.md), [release checklist](RELEASE.md), and [Testing](RELEASE.md) for current evidence.

## Feature inventory

| Capability | Canonical home | Main implementation / reference | Configuration or dependencies | Evidence / open work |
|---|---|---|---|---|
| Landing and product introduction | `/` — INFORMATION | `web/index.html`, `web/assets/` | Static assets and Worker routing | Production route exists; smoke-test after navigation changes. |
| Scene description | `/action/` — USE | `web/action/`, Worker vision API, `worker/src/prompts.js` | Camera/image input, Worker, Gemini | Source implemented; repeat browser/device checks after shared UI changes. |
| Ask AI about an image | `/action/` — USE | Action client, transcription and vision API | Microphone permission, audio transcription, image, Gemini | Source implemented; Bangla/English/mixed speech needs physical-device evaluation. |
| Photo capture and upload | `/action/` — USE | Action camera and upload modules | Camera permission, JPEG processing, HTTPS for browser capture | Browser/device coverage is scenario-specific; test both camera and file picker. |
| Blind-first four-action interface | `/blind/` — USE | `web/blind/` | Speech, haptics and action services | Source implemented; TalkBack and blind/low-vision evaluation remain release gates. |
| Spoken help, repeat, status and haptics | `/blind/` — USE | Shared speech/action modules | Device TTS, browser capabilities, vibration support | Browser/device voice availability varies; document fallback and limitations. |
| Phone camera permissions, capture and torch | `/devices/` for setup; `/action/` for capture | Camera modules under `web/` | Browser/WebView camera permissions and hardware capabilities | Device setup entry point exists; test on target Android/WebView; do not promise locked-screen capture. |
| ESP32-CAM address, stream, capture and LED | DEVICES setup; current configuration controls remain in Admin → Camera & Devices | `web/admin/`, ESP32 helper modules, `firmware/esp32-cam-ai-thinker/` | Same trusted LAN, camera firmware, local HTTP endpoint | Source implemented; Devices links to setup guidance. Test actual board/network. Never expose unauthenticated HTTP camera publicly. |
| RFID reader and medicine tag workflow | DEVICES; result in Medicine | `hardware/esp32-rfid/`, RFID listener and medicine UI | RC522/Arduino wiring, firmware, provisioned tag data | Validate exact board, wiring, tag provisioning and duplicate-event handling. |
| Gemini vision model selection and fallback | Action capability; preferences in Admin | `worker/src/`, `web/admin/admin.js` | Worker secret or tab-scoped personal key; Google quotas | Source implements model listing/fallback; fallback cannot bypass project-wide quota. |
| Assistant modes and custom prompt | Admin configures; Action consumes | `web/admin/admin.js`, `worker/src/prompts.js` | Browser settings and Worker safety core | Source implemented; verify that safety instructions remain server-enforced. |
| Response style, wait limit and language | Admin configures; Action consumes | Admin settings and shared language modules | Browser settings, Worker request validation | Verify selected preferences are persisted and applied. |
| Voice input mode and speech output | Admin configures; Action/Blind consume | Admin, transcription and speech endpoints | Microphone permission, browser recognition, device TTS / cloud fallback | Device-specific. Bengali voice may not be installed on the phone. |
| BYOK Gemini key | Admin (tab-scoped) and Account (signed-in saved key) | Admin session-key helpers; Account API-key UI; Worker encryption/decryption endpoints | Tab `sessionStorage` for Admin key; AES-256-GCM ciphertext in Supabase for signed-in saved key | Both paths exist in source. Verify account save/replace/delete and tab-key clearing; never describe the Admin key as the saved account key. |
| Diagnostics and health tests | `/diagnostics/` — CONTROL CENTER | `web/diagnostics/` | Camera, microphone, speaker, AI and backend access | Keep tests/reporting here; record actual test outcomes. |
| App preferences and device settings | `/admin/` — CONTROL CENTER | `web/admin/` | Browser-local settings and connected device endpoints | Admin must contain configuration only, not documentation, project history or roadmap. |
| SOS sender and receiver | `/sos/` — SAFETY | Worker Durable Objects, Web Push, SOS client modules | Pairing code, receiver token, push subscription, network | Combined SOS Center is canonical. Test on two physical phones; push is best-effort. |
| Legacy SOS receiver entry | `/sos-receiver/` — compatibility only | Existing receiver route if retained | Redirect/compatibility to canonical SOS Center | Do not make a second canonical SOS destination or duplicate pairing controls. |
| Medicine recognition and spoken result | `/medicine/` — SAFETY | Medicine page and Worker vision prompt | Camera/photo or RFID tag data; Gemini | Treat names as suggestions; verify packaging and dosage with a trusted source. |
| Accounts, photo history and saved key | `/account/` — INFORMATION / account service | Supabase Auth, Worker history routes, encrypted API-key endpoints, private bucket | Supabase project, RLS, service credentials, guest cookie, API_KEY_ENCRYPTION_KEY | Source and schema exist; viewing/deleting existing records and saved-key replace/delete are implemented in source. New photo-history requests default off; the Admin toggle has been removed and no user-facing opt-in control is currently exposed. Treat new history saving as unavailable until an approved control is restored and end-to-end verified. |
| Privacy notice and data controls | `/privacy/` — INFORMATION | Shared navigation notice, privacy page, Worker retention | Google processing, optional Supabase history | Keep notice informational; do not reintroduce blocking consent popup, Accept button, checkbox or photo-history opt-in toggle. |
| PWA install and shortcuts | Install from browser; help in INFORMATION | `web/manifest.webmanifest`, `web/sw.js` | Browser support, HTTPS | Verify install/shortcuts on target browser; capability varies by platform. |
| Native Android wrapper and volume keys | `/devices/` — DEVICES; full guide in `ANDROID.md` | `native-android/`, Capacitor plugin and Android source | Android permissions, optional Accessibility Service | CI debug APK exists; physical A55, screen-off, TalkBack and signed-release checks remain open. |
| Android shortcut preferences | `/devices/` — DEVICES | `web/devices/index.html`, `VolumeControlsPlugin.java` | Native Capacitor bridge; Accessibility Service for global shortcuts | Settings bridge exists in source; verify each control on the physical A55 before relying on it. |
| Support and contact | `/support/`, `/contact/` — INFORMATION | Corresponding `web/` routes | External contact channels | Verify links and current contact details. |
| Threat model and security reporting | Technical documentation | [Threat model](SAFETY.md), [Security policy](../SECURITY.md) | Repository security process | Keep reporting instructions and threat analysis out of Admin. |

## Route inventory

| Route | Canonical group | Purpose / notes |
|---|---|---|
| `/` | INFORMATION | Landing and project introduction. |
| `/action/` | USE | Main task interface. |
| `/blind/` | USE | Blind-first four-action interface. |
| `/sos/` | SAFETY | Combined SOS Center: sender and receiver. |
| `/medicine/` | SAFETY | Medicine identification and RFID result. |
| `/devices/` | DEVICES | Android shortcut settings and hardware setup entry points. |
| `/admin/` | CONTROL CENTER | Settings only. |
| `/diagnostics/` | CONTROL CENTER | Health checks and diagnostics report. |
| `/documentation/` | INFORMATION | In-app documentation hub; not an Android-only roadmap. |
| `/help/` | INFORMATION | Task-oriented user instructions. |
| `/privacy/` | INFORMATION | Privacy notice and data practices. |
| `/terms/` | INFORMATION | Terms. |
| `/support/` | INFORMATION | Support information. |
| `/contact/` | INFORMATION | Contact information. |
| `/account/` | INFORMATION / account service | Sign-in and optional history. |
| `/sos-receiver/` | Legacy compatibility | Redirect or link to canonical `/sos/`; no duplicate feature ownership. |

## Planned work — not current functionality

- Remote ESP32 camera access requires a secured gateway/relay, provisioning, authentication, revocation and firmware update design.
- Visual memory, remote camera access, SOS video/recordings and other next-generation ideas remain roadmap items unless a source implementation and evidence are explicitly recorded.
- Android physical volume controls, screen-off behaviour and signed public release remain incomplete until the Galaxy A55 and release gates pass.
- Any account OTP, quota, trial or usage-console feature must be checked against the live source and status before being described as implemented.

## Maintenance contract

When a feature changes, update this map only after checking its actual source, then update the relevant guide and status/evidence. Do not infer a route from a document title. Keep source links, route links and tests grounded in the current repository tree. Update [Decisions](DECISIONS.md), [Status](STATUS.md) and [Release checklist](RELEASE.md) when a change alters architecture or validation state.
