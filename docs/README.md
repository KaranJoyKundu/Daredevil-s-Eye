# Daredevil's Eye documentation

This is the documentation portal for users, testers, contributors and maintainers. It is an index, not a second Admin dashboard. Use the live product to perform tasks, Help for short user instructions, and these version-controlled guides for complete reference.

## Find your destination in the product

| Group | Canonical destination | Responsibility |
|---|---|---|
| **USE** | [Action](/action/) · [Blind Mode](/blind/) | Describe a scene, ask a question, use camera/upload or the four-action accessible interface. |
| **SAFETY** | [SOS Center](/sos/) · [Medicine](/medicine/) | Trusted-contact alert workflows and medicine identification. |
| **DEVICES** | [Devices](/devices/) | Phone shortcut settings, connected camera and hardware setup entry points. |
| **CONTROL CENTER** | [Admin](/admin/) · [Diagnostics](/diagnostics/) | Admin changes preferences; Diagnostics tests and reports health. |
| **INFORMATION** | [Help](/help/) · [Documentation](/documentation/) · [Privacy](/privacy/) · [About](/) · [Support](/support/) · [Contact](/contact/) | User guidance, technical reference, transparency and support. |

**Ownership rules:** Admin is configuration only. Diagnostics is health/testing only. Documentation is a guide index/reference library. Hardware setup belongs under Devices; the detailed instructions live in these guides. SOS sender and receiver share the canonical SOS Center. Medicine is separate from general settings.

## Choose a guide by what you need

### Get started

- [Local development setup](SETUP.md) — Windows/PowerShell prerequisites, installation and first run.
- [Operations](OPERATIONS.md) — Cloudflare deployment, protected configuration, Supabase and account/history operations.
- [User Help](https://daredevils-eye.karanjoykundu.workers.dev/help/) — short task-oriented usage guidance.
- [Accessibility](ACCESSIBILITY.md) — Blind Mode, speech, assistive technology and evaluation.

### Use the product

- [Action](https://daredevils-eye.karanjoykundu.workers.dev/action/)
- [Blind Mode](https://daredevils-eye.karanjoykundu.workers.dev/blind/)
- [SOS Center](https://daredevils-eye.karanjoykundu.workers.dev/sos/)
- [Medicine](https://daredevils-eye.karanjoykundu.workers.dev/medicine/)
- [Privacy information](https://daredevils-eye.karanjoykundu.workers.dev/privacy/)

### Devices and Android

- [Device control centre](https://daredevils-eye.karanjoykundu.workers.dev/devices/)
- [Android companion guide](ANDROID.md) — Capacitor, volume-button mapping, Accessibility Service, background limitations, APK and signing.
- [ESP32-CAM firmware guide](../firmware/esp32-cam-ai-thinker/README.md)
- [RFID / RC522 hardware guide](../hardware/esp32-rfid/README.md)
- [Native Android source overlay](../native-android/README.md)

### Understand the system

- [Architecture](ARCHITECTURE.md) — routes, runtime components, data flows and trust boundaries.
- [Feature map](FEATURE-MAP.md) — every feature's canonical home, implementation pointers and evidence gaps.
- [Safety and threat model](SAFETY.md) — limitations, privacy, assets, threats and mitigations.
- [Operations](OPERATIONS.md) — production hosting, deployment, secrets, Supabase and data operations.
- [Security reporting policy](../SECURITY.md)

### Test and release

- [Release and verification handbook](RELEASE.md) — test commands, manual acceptance, evidence and release gates.
- [Current status](STATUS.md) — factual current snapshot only.
- [Roadmap](ROADMAP.md) — future work only.
- [Decisions log](DECISIONS.md) — durable product and architecture decisions.
- [Changelog](../CHANGELOG.md) — user-visible history.

## Project source of truth

| Document | Owns |
|---|---|
| [FEATURE-MAP.md](FEATURE-MAP.md) | Feature inventory, canonical route ownership, source references and evidence gaps. |
| [STATUS.md](STATUS.md) | Current state and observed evidence only. |
| [DECISIONS.md](DECISIONS.md) | Durable decisions, rationale, consequences and supersession. |
| [ROADMAP.md](ROADMAP.md) | Future work only; never use it to prove implementation. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Actual runtime components, routes, data flows and trust boundaries. |
| [OPERATIONS.md](OPERATIONS.md) | Deployment, secrets, database and storage operations. |
| [RELEASE.md](RELEASE.md) | Automated/manual tests, release gates and verification evidence. |
| [ANDROID.md](ANDROID.md) | Android companion, physical controls, permissions and signing. |
| [SAFETY.md](SAFETY.md) | Product safety, privacy boundaries and threat model. |
| [HISTORY.md](HISTORY.md) | Superseded proposals and dated historical context; not current instructions. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution workflow and documentation writing/maintenance rules. |
| [OVERHAUL-CHECKLIST.md](OVERHAUL-CHECKLIST.md) | Master acceptance checklist for the ongoing product and documentation overhaul. |
| [RECOVERY.md](RECOVERY.md) | Temporary checkpoint/recovery notes for this branch; retire after the overhaul is merged. |

## How we write and maintain documentation

The project follows the [Diátaxis framework](https://diataxis.fr/): tutorials teach, how-to guides solve a task, reference describes exact behaviour, and explanations document why a design exists. A single guide may link to more than one type, but should not blur their purpose.

- Keep one canonical source for each changing fact. Link to it instead of copying it into several files.
- Mark planned, incomplete and blocked work explicitly. Never present a proposal as an implemented feature.
- Separate source implementation, automated tests, browser verification, physical-device verification and user evaluation.
- Update documentation in the same pull request as the code or UI change.
- Do not publish secrets, private tokens, personal data or device-specific credentials.
- Use [CONTRIBUTING](CONTRIBUTING.md) for the writing style, templates and PR checklist.
- The [master overhaul checklist](OVERHAUL-CHECKLIST.md) records the remaining structural, documentation, testing and release work.

## Evidence vocabulary

- **Implemented in source:** implementation or configuration exists in the repository.
- **Automated-tested:** an automated test covers the behaviour and the exact commit's CI result is recorded.
- **Browser-verified:** the stated route and scenario were exercised in a browser.
- **Device-verified:** the named physical device, OS, build and steps were tested.
- **User-evaluated:** blind/low-vision participants evaluated the workflow through an appropriate, informed process.
- **Planned / incomplete / blocked:** not yet delivered or not yet validated; never present as available.

A passing build does not prove that a camera, microphone, speaker, screen-off shortcut, RFID reader or SOS receiver works on a physical device.
