# Architecture and product decisions

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Reviewed:** 28 November 2026  
This log records durable decisions and their rationale. It is not a roadmap or a release-status report. Current implementation status belongs in [STATUS](STATUS.md); future work belongs in [ROADMAP](ROADMAP.md).

## Product structure and ownership

### DEC-001 — Use five canonical navigation groups

**Decision:** Organise the product into USE, SAFETY, DEVICES, CONTROL CENTER and INFORMATION.

**Rationale:** Users should find task execution, safety workflows, device setup, configuration/diagnostics and reference information without mixing responsibilities.

**Consequences:** Every capability has one canonical destination in [FEATURE-MAP](FEATURE-MAP.md). Secondary shortcuts may link to that destination but must not create duplicate controls or competing pages.

### DEC-002 — Admin is configuration; Diagnostics is health

**Decision:** Admin configures app behaviour and connected devices. Diagnostics runs checks and reports outcomes.

**Rationale:** Settings and tests are different user tasks. Combining them makes the control surface difficult to understand and maintain.

**Consequences:** Admin must not contain documentation indexes, developer tutorials, release notes, roadmap, GitHub history or long project reports. Diagnostics must not become a second settings page.

### DEC-003 — Documentation is an INFORMATION destination

**Decision:** Documentation is a discoverable reference hub with task guides, technical references and links to canonical product destinations.

**Rationale:** Users and developers need an entry point to find the right guide; they should not have to search Admin or a roadmap page.

**Consequences:** The in-app `/documentation/` page must not be an Android-only progress tracker. Technical plans remain in versioned Markdown. Help is task-oriented; documentation is the structured index/reference library.

### DEC-004 — SOS sender and receiver belong to one SOS Center

**Decision:** `/sos/` is the canonical SOS destination and contains both sender and receiver workflows.

**Rationale:** Pairing, triggering and acknowledging an alert are parts of one trusted-contact feature.

**Consequences:** `/sos-receiver/` is legacy compatibility only if retained. It must route users to the canonical SOS Center and must not become a parallel feature home.

### DEC-005 — Medicine is a separate safety feature

**Decision:** Medicine identification and RFID-assisted medicine lookup belong under SAFETY, not general Admin settings.

**Rationale:** Medicine information has distinct user intent and safety implications.

**Consequences:** Admin may configure general app behaviour but should not become the medicine interface. Medicine output must be clearly fallible and not substitute for professional verification.

## Accessibility, privacy and safety

### DEC-006 — Bangla-first with English support

**Decision:** Bangla (Bangladesh) is the default experience; English remains selectable and mixed-language input is supported where the platform/model allows.

**Rationale:** The primary interaction must be accessible to Bangla-speaking users while remaining usable in English.

**Consequences:** UI, transcription, TTS and fallback behaviour must be tested separately. A language preference does not prove that a Bengali device voice is installed.

### DEC-007 — Safety confirmation before SOS dispatch

**Decision:** SOS triggers require deliberate confirmation and a cancellation opportunity; a hardware gesture or wake phrase must not silently dispatch an alert.

**Rationale:** False alarms can cause harm, and speech/motion/volume-key recognition is fallible.

**Consequences:** Test accidental triggers, duplicate events, countdown cancellation and receiver acknowledgement. Never claim push delivery merely because a provider accepted a request.

### DEC-008 — Informational privacy notice, no blocking consent gate

**Decision:** Explain image/audio processing visibly without a blocking popup, Accept button, checkbox or photo-history opt-in toggle.

**Rationale:** The intended flow should remain usable without a nonfunctional consent interaction while still disclosing processing.

**Consequences:** The privacy notice remains visible and links to the full privacy page. Do not silently imply that optional photo history is mandatory. Keep retention and deletion descriptions aligned with Worker and Supabase behaviour.

### DEC-009 — Secrets remain outside client source and repository

**Decision:** Provider/service secrets belong in protected deployment secrets or secure owner-managed configuration, never committed source, public client bundles or APK assets.

**Rationale:** Browser and APK contents are inspectable by users.

**Consequences:** A key entered in Admin is tab-scoped in sessionStorage. A signed-in user may separately save an account key through Account & History; the Worker stores encrypted ciphertext and IV in Supabase using AES-256-GCM and decrypts it only for the provider request. These are separate flows and must never be described as the same storage mechanism. ESP32 local HTTP endpoints must remain on trusted LANs.

### DEC-010 — Assistive AI is not a certified safety or medical system

**Decision:** The app provides descriptions and information, not guaranteed navigation, medical advice, emergency response or hazard detection.

**Rationale:** Vision models can hallucinate, omit hazards, misread labels and fail under real-world conditions.

**Consequences:** Retain clear safety language. Encourage independent verification for medicine, money, text and mobility decisions. SOS does not contact emergency services.

## Engineering and evidence

### DEC-011 — Keep implementation and validation evidence separate

**Decision:** Use distinct evidence levels: implemented in source, automated-tested, browser-verified, device-verified and user-evaluated.

**Rationale:** A successful build cannot establish real-world behaviour on a phone, camera, microphone, speaker or receiver.

**Consequences:** Status and release checklists must name the exact commit/build/device/scenario. Do not upgrade claims without evidence.

### DEC-012 — Native Android complements the web app

**Decision:** Use Capacitor to package the existing web experience and native Android code for platform-specific hardware controls.

**Rationale:** A normal mobile browser/PWA cannot reliably intercept global volume keys. The native layer is required for approved physical-button workflows.

**Consequences:** Android background, screen-off, microphone/camera, Accessibility Service and TalkBack limitations must be tested and documented. Never promise guaranteed screen-off operation.

### DEC-013 — SOS coordination uses server-side state

**Decision:** Pairing invitations and alert state are coordinated by Cloudflare Durable Objects; receivers use scoped tokens and Web Push with polling fallback where implemented.

**Rationale:** Sender/receiver state must not rely only on one browser's local storage.

**Consequences:** Invitations expire and can be replaced; receiver tokens are sensitive. Push acceptance is not delivery confirmation. See [Architecture](ARCHITECTURE.md) and [Threat model](SAFETY.md).

### DEC-014 — Supabase history is optional and private

**Decision:** Account/guest photo history is a separate optional service backed by Supabase Auth, database records and a private storage bucket.

**Rationale:** AI processing and durable personal history are distinct purposes.

**Consequences:** Verify RLS, Worker ownership checks, deletion and guest cleanup. Describe actual retention accurately; never infer it solely from UI state. See [Supabase setup](OPERATIONS.md).

## Supersession and maintenance

- If a new decision changes one above, add a new dated decision and mark the old one **Superseded by DEC-###** rather than silently rewriting history.
- Implementation status is not stored here; link to [STATUS](STATUS.md).
- Planned work is not stored here; link to [ROADmap](ROADMAP.md).
- Canonical feature ownership is defined in [FEATURE-MAP](FEATURE-MAP.md).
