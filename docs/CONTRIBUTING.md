# Contributing to Daredevil's Eye

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


Thank you for helping improve Daredevil's Eye. This is an assistive vision prototype, so correctness, accessibility, privacy and honest safety claims matter more than shipping quickly.

## Before you change anything

1. Read the root [README](../README.md), [project status](STATUS.md), [architecture](ARCHITECTURE.md) and [feature map](FEATURE-MAP.md).
2. Check [DECISIONS](DECISIONS.md) and [ROADMAP](ROADMAP.md) before proposing new behaviour.
3. Identify the feature's one canonical home before editing UI.
4. Work on a feature branch. Do not push directly to `main`.
5. Identify whether the change touches user data, secrets, Worker routes, SOS, medicine, hardware, camera or Android permissions. Treat those as higher-risk changes.

## Canonical product ownership

The five groups are fixed: USE, SAFETY, DEVICES, CONTROL CENTER and INFORMATION. Canonical page ownership is recorded in [FEATURE-MAP](FEATURE-MAP.md).

- Admin changes settings; Diagnostics checks health.
- Documentation explains and indexes; it never becomes an Admin dashboard.
- Devices owns hardware connection/provisioning; Documentation owns the instructions.
- SOS sender and receiver belong together in SOS Center.
- Medicine remains a separate safety workflow.
- Shortcuts may link to a canonical feature but must not duplicate its controls.

## Documentation architecture

Use the four Diátaxis content types:

| Type | Reader question | Write it as |
|---|---|---|
| Tutorial | Can you teach me? | Guided learning path with a working outcome |
| How-to | How do I do this task? | Short ordered steps and expected result |
| Reference | What exactly is supported? | Precise routes, settings, API fields, constraints and defaults |
| Explanation | Why does this work this way? | Context, trade-offs, decisions and limitations |

Do not mix all four types into one long page. Link between them when a reader needs both a procedure and the reason behind it.

## Where information belongs

| Information | Canonical file |
|---|---|
| Project introduction and quick links | Root `README.md` |
| User-visible change history | Root `CHANGELOG.md` |
| Vulnerability reporting | Root `SECURITY.md` |
| Current factual state | `docs/STATUS.md` |
| Feature ownership and implementation pointers | `docs/FEATURE-MAP.md` |
| Durable decisions and rationale | `docs/DECISIONS.md` |
| Future work only | `docs/ROADMAP.md` |
| Actual components and data flows | `docs/ARCHITECTURE.md` |
| Local developer setup | `docs/SETUP.md` |
| Deployments, secrets, database and storage operations | `docs/OPERATIONS.md` |
| Tests, release gates and evidence | `docs/RELEASE.md` |
| Android wrapper, controls, permissions and signing | `docs/ANDROID.md` |
| Accessibility evaluation | `docs/ACCESSIBILITY.md` |
| Safety, privacy boundaries and threat model | `docs/SAFETY.md` |
| Superseded plans and dated historical context | `docs/HISTORY.md` |
| Hardware-specific setup | Component-local README |

## Writing standards

- Start with a one-sentence purpose and intended audience.
- Put prerequisites before steps; give commands in complete, copy-pasteable blocks.
- Prefer direct language, active voice, short paragraphs and descriptive headings.
- Use consistent names: Action, Blind Mode, SOS Center, Medicine, Devices, Admin, Diagnostics and Documentation.
- Use tables only for comparisons or structured reference data.
- Include expected output and recovery steps for operational commands.
- Distinguish source implementation, automated test, browser verification, physical-device verification and user evaluation.
- Put dates on volatile facts; do not put an unreviewed “current” status into an old handoff.
- Mark future ideas **Planned — not implemented**. Mark incomplete or blocked work explicitly.
- Do not write “works”, “secure”, “real-time”, “screen-off”, “guaranteed”, “medical-grade” or “accessible” without evidence appropriate to the claim.
- Never publish API keys, tokens, private URLs, user data or signing material.

## Security, privacy and safety rules

- Never commit API keys, passwords, tokens, private URLs, signing keystores, personal data or screenshots containing secrets.
- Do not weaken server-side authorization to make a demo easier.
- Do not change retention, account isolation or privacy behaviour without updating [SAFETY](SAFETY.md), [OPERATIONS](OPERATIONS.md), tests and the privacy page.
- SOS gestures must require explicit confirmation and a cancellation path.
- Medicine identification is informational and must never be presented as dosage/prescription verification.
- Never promise camera/microphone operation while Android is locked or in the background without device evidence.

## Pull request requirements

- [ ] Clear problem statement, scope and canonical feature owner.
- [ ] Files and data flows affected.
- [ ] Automated tests run and results.
- [ ] Browser/device tests with exact environment and steps.
- [ ] Screenshots/recordings for meaningful UI changes, without exposing private data.
- [ ] Accessibility review: keyboard, focus, labels, contrast, screen reader and touch targets.
- [ ] Privacy/security/safety impact statement.
- [ ] Documentation and [FEATURE-MAP](FEATURE-MAP.md) updated.
- [ ] [STATUS](STATUS.md), [ROADMAP](ROADMAP.md) and [CHANGELOG](../CHANGELOG.md) updated only where facts require it.
- [ ] No secrets, unrelated changes or unverified claims.

## Local validation

Run the current repository scripts from the root:

```powershell
npm test
npm run check
npm run docs:check
npx --yes markdownlint-cli2@0.17.2 "**/*.md" "#node_modules"
```

If a script is missing, report that clearly rather than inventing a passing result.

## Review and merge policy

- Keep work isolated on a branch and use a pull request.
- Review the complete diff, including generated files and configuration.
- Require relevant CI checks to pass.
- Do not merge or deploy production changes without explicit owner approval.
- Record the final commit and deployment evidence in [STATUS](STATUS.md).
