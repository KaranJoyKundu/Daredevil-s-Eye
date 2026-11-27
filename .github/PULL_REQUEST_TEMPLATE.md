## What changed?

<!-- Explain the user problem and intended result. -->

## Canonical ownership

- [ ] I checked `docs/FEATURE-MAP.md` and kept one canonical feature/page owner.
- [ ] Admin is configuration only; Diagnostics is health/testing only.
- [ ] Documentation is not mixed into Admin.
- [ ] Devices, SOS Center and Medicine retain their canonical boundaries.

## Verification

- [ ] `npm test`
- [ ] `npm run check`
- [ ] `node scripts/check-doc-links.mjs`
- [ ] `node scripts/check-routes.mjs`
- [ ] Markdown lint
- [ ] Browser smoke test (routes and responsive layout)
- [ ] Physical-device test (if relevant; name device, OS and build)

## Accessibility, safety and privacy

- [ ] Keyboard/focus/screen-reader/touch-target review where relevant.
- [ ] Privacy/data-flow impact reviewed.
- [ ] Safety limitations and confirmation/cancellation behaviour reviewed.
- [ ] No secrets, tokens, personal data or signing material added.

## Documentation

- [ ] Updated the canonical guide and feature map.
- [ ] Updated STATUS/ROADMAP/DECISIONS/CHANGELOG only where appropriate.
- [ ] Added evidence, screenshots or logs without private data.
