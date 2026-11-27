# Daredevil's Eye — documentation hub

This is the reference index for users, testers, contributors and maintainers. Use the live app for tasks, Help for step-by-step usage, and this hub for structured guides and technical references.

## Find the right place in the app

| Group | Destination | Use it for |
|---|---|---|
| **USE** | [Action](/action/) · [Blind mode](/blind/) | Describe a scene, ask a question, or use the four-action accessible interface. |
| **SAFETY** | [SOS Center](/sos/) · [Medicine](/medicine/) | Pair/alert a trusted contact or identify medicine packaging. |
| **DEVICES** | [Device setup help](/help/#devices) · [ESP32-CAM guide](SETUP.md#esp32-cam) · [RFID hardware guide](../hardware/esp32-rfid/README.md) | Configure the phone camera, ESP32-CAM and RFID hardware. |
| **CONTROL CENTER** | [Admin](/admin/) · [Diagnostics](/diagnostics/) | Configure preferences in Admin; test health and report failures in Diagnostics. |
| **INFORMATION** | [Help](/help/) · [Documentation](/documentation/) · [Privacy](/privacy/) · [About](/) · [Support](/support/) · [Contact](/contact/) | Find guidance, project information and transparency details. |

Admin is settings only. Diagnostics is health/testing only. Neither is a documentation index. SOS sender and receiver workflows belong together in the canonical SOS Center.

## Choose a documentation path

### I am a user or tester

- [Try the live app](https://daredevils-eye.karanjoykundu.workers.dev/)
- [Blind mode](https://daredevils-eye.karanjoykundu.workers.dev/blind/)
- [User help](https://daredevils-eye.karanjoykundu.workers.dev/help/)
- [Accessibility guide](ACCESSIBILITY.md)
- [Safety and privacy](SAFETY.md)
- [Phone controls and SOS triggers](PHONE-CONTROLS.md)

### I want to develop or run the project

1. [Local setup](SETUP.md)
2. [Architecture overview](ARCHITECTURE.md)
3. [Testing and acceptance matrix](TESTING.md)
4. [Deployment](DEPLOYMENT.md)
5. [Security policy](../SECURITY.md) and [threat model](THREAT-MODEL.md)

### I want to install or work on the Android companion

- [Download Android tester build](https://appdistribution.firebase.google.com/testerapps/1:196832423983:android:5398d21c07fd260c21d6da/releases/5u4gh86a181lo?utm_source=firebase-console) — invited Firebase App Distribution testers only; not a public Play Store release.
- [Native Android implementation guide](NATIVE-ANDROID-APP.md)
- [Android release signing](ANDROID-RELEASE-SETUP.md)
- [Current release checklist](CURRENT-RELEASE-CHECKLIST.md)

## Active overhaul and acceptance tracking

- [Master overhaul checklist](OVERHAUL-CHECKLIST.md) — the complete acceptance checklist for product grouping, page boundaries, navigation, documentation consolidation, repository quality, testing, PR and deployment. Checkboxes are evidence-based and must be updated with the implementation.

## Project source of truth

| Document | Owns |
|---|---|
| [FEATURE-MAP.md](FEATURE-MAP.md) | Feature inventory, canonical page ownership, source references and evidence gaps. |
| [DECISIONS.md](DECISIONS.md) | Durable product and architecture decisions, rationale and supersession. |
| [STATUS.md](STATUS.md) | Current state and verified evidence only. |
| [CURRENT-RELEASE-CHECKLIST.md](CURRENT-RELEASE-CHECKLIST.md) | Release gates and device acceptance evidence. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Actual components, routes, data flows and trust boundaries. |
| [ROADMAP.md](ROADMAP.md) | Future work and explicitly incomplete items. |
| [RECOVERY.md](RECOVERY.md) | Safe checkpoint and recovery instructions for this documentation overhaul. |\n| [OVERHAUL-CHECKLIST.md](OVERHAUL-CHECKLIST.md) | Master acceptance checklist and tracked completion record. |
| [CHANGELOG.md](../CHANGELOG.md) | User-visible history. |

## Reference library

| Document | Use it for |
|---|---|
| [SETUP.md](SETUP.md) | Local install, secrets, camera, voice and PWA setup. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Cloudflare, GitHub Actions, secrets and production release procedure. |
| [TESTING.md](TESTING.md) | Automated commands and manual acceptance matrix. |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | Blind mode, voice, assistive technology and evaluation. |
| [PHONE-CONTROLS.md](PHONE-CONTROLS.md) | Web shortcuts, SOS triggers and Android physical keys. |
| [NATIVE-ANDROID-APP.md](NATIVE-ANDROID-APP.md) | Capacitor architecture, volume mapping, Android limitations and release phases. |
| [ANDROID-RELEASE-SETUP.md](ANDROID-RELEASE-SETUP.md) | Owner-managed keystore and signed APK workflow. |
| [SAFETY.md](SAFETY.md) | Product safety and privacy boundaries. |
| [THREAT-MODEL.md](THREAT-MODEL.md) | Assets, trust boundaries, threats and mitigations. |
| [SUPABASE-ACCOUNT-HISTORY-SETUP.md](SUPABASE-ACCOUNT-HISTORY-SETUP.md) | Account and private photo-history backend. |
| [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) | Historical implementation plan; check STATUS before assuming an item remains open. |
| [NEXT-GENERATION-CAMERA-AND-EMERGENCY-ROADMAP.md](NEXT-GENERATION-CAMERA-AND-EMERGENCY-ROADMAP.md) | Proposed future camera and emergency capabilities. |

## Evidence vocabulary

- **Implemented in source:** code or configuration exists.
- **Automated-tested:** an automated test covers it and the exact commit's CI result is recorded.
- **Browser-verified:** the stated route and scenario were exercised in a browser.
- **Device-verified:** the named physical device, OS, build and steps were tested.
- **User-evaluated:** blind/low-vision participants evaluated the workflow through an appropriate, informed process.
- **Planned / incomplete / blocked:** not yet delivered or not yet validated; never present as available.

A successful build does not prove a physical camera, microphone, speaker, screen-off shortcut or SOS receiver works.

## Documentation maintenance rules

The active file-count reduction plan and merge map are tracked in [OVERHAUL-CHECKLIST](OVERHAUL-CHECKLIST.md). Do not delete or merge a guide until its unique instructions, commands, warnings and links have been migrated and reviewed.

- Keep the root [README](../README.md) concise: project purpose, safety, quick start and links.
- Keep current state in [STATUS](STATUS.md), inventory in [FEATURE-MAP](FEATURE-MAP.md), durable rationale in [DECISIONS](DECISIONS.md), future work in [ROADMAP](ROADMAP.md), and acceptance evidence in [CURRENT-RELEASE-CHECKLIST](CURRENT-RELEASE-CHECKLIST.md).
- Keep task-oriented instructions in Help and the relevant guide; keep technical reference in versioned Markdown.
- Date volatile facts such as workflow runs, artifact expiry and deployment status.
- When a feature changes, update its canonical guide and evidence record. Do not duplicate settings or controls across pages.
- Do not publish secrets, private tokens, personal data or device-specific network credentials.
