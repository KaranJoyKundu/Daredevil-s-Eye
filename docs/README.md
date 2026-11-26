# Daredevil's Eye — documentation hub

Welcome. This folder is organised around the questions people actually arrive with: getting started, completing a task, understanding the system, and checking exact technical behaviour.

## Choose your path

### I am a user or tester

- [Try the live app](https://daredevils-eye.karanjoykundu.workers.dev/)
- [Blind mode](https://daredevils-eye.karanjoykundu.workers.dev/blind/)
- [Help and usage notes](https://daredevils-eye.karanjoykundu.workers.dev/help/)
- [Accessibility notes](ACCESSIBILITY.md)
- [Safety and privacy](SAFETY.md)

### I want to develop or run it

1. [Local setup](SETUP.md)
2. [Architecture overview](ARCHITECTURE.md)
3. [Testing and acceptance matrix](TESTING.md)
4. [Deployment](DEPLOYMENT.md)

### I want to install the Android test app

- **[Download Daredevil's Eye for Android]( https://appdistribution.firebase.google.com/testerapps/1:196832423983:android:5398d21c07fd260c21d6da/releases/5u4gh86a181lo?utm_source=firebase-console )** — Firebase App Distribution tester release. Sign in with the invited Google account and follow the installation prompts. Access is limited to invited testers; this is not a public Play Store listing.

### I am working on the Android companion

1. [Native Android master plan](NATIVE-ANDROID-APP.md)
2. [Phone controls](PHONE-CONTROLS.md)
3. [Android release signing](ANDROID-RELEASE-SETUP.md)
4. [Current release checklist](CURRENT-RELEASE-CHECKLIST.md)
5. [Live implementation status](STATUS.md)

## Reference library

| Document | Use it for |
|---|---|
| [STATUS.md](STATUS.md) | Current verified state, recent incidents and open validation |
| [CURRENT-RELEASE-CHECKLIST.md](CURRENT-RELEASE-CHECKLIST.md) | Release gates and real-device evidence |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, routes, data flows and trust boundaries |
| [SETUP.md](SETUP.md) | Local install, secrets, camera, voice and web-app install |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Cloudflare, GitHub Actions, secrets and production checks |
| [TESTING.md](TESTING.md) | Automated tests and manual acceptance criteria |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | Blind mode, voice, assistive technology and evaluation |
| [PHONE-CONTROLS.md](PHONE-CONTROLS.md) | Web shortcuts, SOS triggers and Android physical keys |
| [NATIVE-ANDROID-APP.md](NATIVE-ANDROID-APP.md) | Capacitor architecture, volume mapping, Android limitations and release phases |
| [ANDROID-RELEASE-SETUP.md](ANDROID-RELEASE-SETUP.md) | Owner-managed keystore and signed APK release |
| [SAFETY.md](SAFETY.md) | Product safety and privacy boundaries |
| [THREAT-MODEL.md](THREAT-MODEL.md) | Assets, trust boundaries, threats and mitigations |
| [SECURITY.md](../SECURITY.md) | Responsible vulnerability reporting |
| [SUPABASE-ACCOUNT-HISTORY-SETUP.md](SUPABASE-ACCOUNT-HISTORY-SETUP.md) | Account and private photo-history backend |
| [ROADMAP.md](ROADMAP.md) | Product phases and planned work |
| [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) | Historical implementation plan |
| [NEXT-GENERATION-CAMERA-AND-EMERGENCY-ROADMAP.md](NEXT-GENERATION-CAMERA-AND-EMERGENCY-ROADMAP.md) | Proposed future camera and emergency capabilities |
| [CHANGELOG.md](../CHANGELOG.md) | User-visible changes over time |

## How to read project status

Every feature should be described at the correct evidence level:

- **Implemented:** code/configuration exists in the repository.
- **Automated-tested:** an automated test covers it and the exact commit's CI passed.
- **Browser-tested:** the stated route and scenario were manually/browser-automated checked.
- **Device-tested:** the stated physical device, OS, app version and steps were exercised.
- **User-evaluated:** blind/low-vision participants evaluated the workflow under an appropriate, informed process.

Never promote a feature to a stronger evidence level because a lower-level check passed.

## Documentation maintenance rules

- Keep the root [README](../README.md) as the concise project introduction and navigation entry point; link to detailed guides instead of copying every technical paragraph into it.
- Put current state in [STATUS.md](STATUS.md), release acceptance in [CURRENT-RELEASE-CHECKLIST.md](CURRENT-RELEASE-CHECKLIST.md), and long-lived Android decisions in [NATIVE-ANDROID-APP.md](NATIVE-ANDROID-APP.md).
- Date volatile facts such as workflow runs, artifact expiry and deployment status.
- Label proposed, implemented, tested and physically verified behaviour distinctly.
- When changing a feature, update its guide, status/checklist if evidence changed, and README summary only if the user-facing capability changed.
- Do not publish secrets, private tokens, personal data, or device-specific network credentials.
