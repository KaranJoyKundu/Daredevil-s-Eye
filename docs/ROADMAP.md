# Roadmap — future work only

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Purpose:** This file contains work that is not yet complete. It is not a feature catalogue, current status report or historical implementation diary.

For current capabilities and canonical page ownership, use [FEATURE-MAP](FEATURE-MAP.md). For evidence and current state, use [STATUS](STATUS.md) and [RELEASE](RELEASE.md). For the rationale behind durable choices, use [DECISIONS](DECISIONS.md). Older proposals are preserved in [HISTORY](HISTORY.md).

> **Status language:** Planned = not implemented. In progress = implementation is underway but not accepted. Blocked = cannot proceed until a named dependency is resolved. Completed work moves out of this file and into CHANGELOG/STATUS; do not leave a stale completed checklist here.

## Priority 0 — product structure and release hygiene

- [ ] Complete the [product/documentation overhaul checklist](OVERHAUL-CHECKLIST.md), including navigation, route ownership, documentation consolidation and automated link checks.
- [ ] Add Markdown linting and internal-link validation to GitHub Actions.
- [ ] Add route smoke tests for canonical pages and legacy compatibility routes.
- [ ] Add a pull-request template, bug report template, accessibility feedback template and feature request template.
- [ ] Add dependency and secret scanning where supported; verify that the workflows actually run before advertising badges.
- [ ] Keep README badges and status links connected to real workflow files and current project URLs.

## Priority 1 — physical-device and accessibility validation

- [ ] Complete Galaxy A55 5G / Android 16 / One UI 8 acceptance for the current debug APK.
- [ ] Verify foreground and global volume-key mapping, event arbitration, normal volume restoration and Accessibility Service behaviour.
- [ ] Test TalkBack coexistence, focus order, accessible names, touch targets and spoken status.
- [ ] Test camera, microphone, speaker, Bengali/English/mixed-language input, and installed Bengali TTS voices on the target handset.
- [ ] Test foreground, background, locked and screen-off states separately; document Android restrictions and failures accurately.
- [ ] Test SOS sender and receiver on two physical phones and different networks, including confirmation, cancellation, push delivery, acknowledgement, reconnect and offline failure.
- [ ] Test ESP32-CAM and RFID/RC522 workflows with the exact flashed boards and wiring.
- [ ] Conduct supervised, informed usability sessions with blind and low-vision participants before making broad accessibility claims.

## Priority 2 — camera experience improvements (planned)

- [ ] Evaluate a persistent in-page phone-camera session for foreground Action use.
- [ ] Evaluate a first-run camera choice: phone camera, ESP32-CAM or upload-only.
- [ ] Improve camera connection diagnostics and recovery without blocking upload fallback.
- [ ] Validate ESP32 MJPEG streaming, still capture, flash/LED controls and Android Chrome Local Network Access on the target network.
- [ ] Define a secure remote-camera architecture before implementing access beyond the local network.
- [ ] Never expose an unauthenticated ESP32 HTTP endpoint to the public internet.

## Priority 3 — visual memory (planned; not implemented)

- [ ] Define user stories, threat model, retention and opt-in/opt-out behaviour before implementation.
- [ ] Prototype structured scene facts from vision responses, including uncertainty and observation timestamps.
- [ ] Store a bounded five-observation window with strict account/guest isolation.
- [ ] Distinguish remembered facts from current camera evidence in every answer.
- [ ] Respect photo-history settings, account deletion and guest expiry.
- [ ] Add tests for stale facts, uncertain recognition, deletion, expiry and cross-account isolation.
- [ ] Measure latency and cost before enabling by default.

## Priority 4 — emergency media (planned; not implemented)

- [ ] Preserve ordinary SOS alert delivery as an independent path.
- [ ] Define explicit opt-in for live video and a separate opt-in for recording.
- [ ] Design short-lived receiver authorization, visible sharing indicator, stop/revoke action and session expiry.
- [ ] Evaluate WebRTC signalling and TURN relay requirements; do not send bulk video through Durable Objects.
- [ ] Define private object storage, encryption, access policy, retention, deletion and audit logs before recording.
- [ ] Test failure handling, receiver rejection, network loss and user cancellation.
- [ ] Do not claim emergency video is available until end-to-end tests pass on real devices.

## Priority 5 — public release readiness

- [ ] Complete independent security review and privacy impact assessment.
- [ ] Establish supported release channels, versioning, signed Android release and artifact checksums.
- [ ] Establish support/incident response and vulnerability triage expectations.
- [ ] Measure real-world latency, reliability, provider quotas and cost.
- [ ] Review legal/privacy requirements for any new account fields, email OTP, usage tracking or analytics before collection.
- [ ] Define an accessibility evaluation programme and publish only evidence-backed claims.

## Roadmap maintenance

Every new item must include a user outcome, owner, dependencies, safety/privacy impact and acceptance criteria. Remove duplicate ideas. When work ships, update [FEATURE-MAP](FEATURE-MAP.md), [STATUS](STATUS.md) and [CHANGELOG](../CHANGELOG.md), then remove it from this future-work list.