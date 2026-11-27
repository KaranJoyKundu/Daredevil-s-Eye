## Unreleased — documentation, navigation and Admin cleanup

These changes are on `docs/product-map-and-ux-overhaul` and are not deployed to production yet.

- Added a canonical feature map and architecture/product decisions log; reorganized the documentation index around the five product groups.
- Replaced the Android-only `/documentation/` progress tracker with a structured guide hub.
- Added `/devices/` for Android volume-shortcut settings and device setup links.
- Grouped shared navigation into USE, SAFETY, DEVICES, CONTROL CENTER and INFORMATION; made SOS Center and Medicine visible canonical destinations.
- Removed the photo-history toggle and stale JavaScript bindings from Admin; narrowed Admin shortcuts to settings sections.
- Corrected route ownership, SOS setup links, Android documentation references and the tab-scoped versus encrypted account API-key descriptions.

# Changelog

## 26 November 2026 — Documentation layout and project documentation

- PR #71 refreshed the Android documentation page styling; PR #72 corrected oversized sections inherited from the shared site stylesheet.
- PR #72 merged to main; production deployment workflow #45843735382 succeeded.
- Project documentation overhaul is tracked separately from application code.


## 26 November 2026 — Preserve visible action feedback when speech fails (PR #69 merged)

- A device text-to-speech failure no longer overwrites the visible status produced by SOS, Repeat and other actions.
- The existing SOS confirmation feedback remains visible for its full five-second confirmation window; speech is optional feedback, not the only indication that the tap registered.
- Live verification showed the first SOS tap did arm the confirmation flow; the browser automation only observed the later expiry because it read the page after the five-second window. No alert was sent.


## 26 November 2026 — Action/Blind startup recovery (PR #68 merged)

- Fixed a fatal startup-order bug in the shared browser app: the removed consent-panel initializer called `showCameraSetup()` before camera-panel `const` bindings were initialized, aborting the module before any user-action handlers were registered.
- Removed that obsolete initializer; camera panels continue to render after their bindings are initialized.
- Bumped the Action and Blind app script URL to force browsers to fetch the corrected module.
- Kept the requested privacy design: informational notice only, with no consent popup, buttons, checkbox or photo-history toggle.
- Documented the failed explicit static-page routing attempt: PR #66 introduced a redirect loop and PR #67 reverted it. Do not restore that rewrite.
- PR #68 CI passed and the fix was merged. Browser verification confirmed the Action page loaded and the phone photo picker opened; the owner later confirmed the app was working.

## 20 November 2026 — hackathon release (PRs #14–#24)

- Fixed overlapping landing-page sections and footer on short desktop screens (#14).
- Bangla across the whole interface: navigation, Admin, Diagnostics, Account, Help, status lines and camera errors (`web/shared/bn-text.js`) (#16, #18).
- Bangla speech on Windows and other desktops: if the device has no Bengali voice, answers are spoken by Gemini text-to-speech through `POST /api/speech`. Only the text to be spoken is sent (#16, #18).
- Switching to বাংলা now says "বাংলা চালু করা হয়েছে…", a direct translation of the English message (#18).
- Admin: the system prompt can now be edited (up to 4,000 characters, and the safety rules are always added). Added presets: All-in-one, Single object, Medicine (Bangladeshi brand and generic names), Read text, Taka, Colour and Custom (#16, #20).
- The app can be installed from Chrome to the home screen: web manifest, service worker, icons and shortcuts for Describe, Ask AI and SOS (#16).
- Camera: each capture plays one recorded shutter click (`web/shared/shutter.mp3`) instead of three generated clicks (#18, #22, #24).

## 20 November 2026 — landing page, brand restyle and language switch (#12)

- Added a landing page at `/` (previously a redirect to `/action/`), built with the taste-skill kit (`web/assets/`, unchanged kit files).
- Restyled the app pages to the same green-black-bone palette and Familjen Grotesk / Noto Sans Bengali type; replaced emoji icons with Lucide SVG icons; new app icon (PNG 192/512 + SVG). Blind-mode tiles keep white-text contrast of 4.5:1 or more (test updated).
- Added an English | বাংলা answer-language switch (`web/shared/language.js`) in the site nav and Blind mode; tile labels and aria-labels switch with it.
- Fixed: accepting the consent notice no longer resets the chosen language to Bangla; more status lines now follow the chosen language.
- Fixed: Admin save button lookup; Bangla text passed to `localizeSpeech` is kept as-is.

## 17 November 2026 — Bangla defaults, account history and guest photos (#7–#9)

- Bangla (Bangladesh) became the default language for answers, speech and input. Gemini 3.8 Flash became the default model.
- Private photo history for signed-in users and guests, using Supabase. Guest data is deleted after 30 days by a daily cron job.
- Usage counts use a keyed hash of the IP address (HMAC). Raw IP addresses are never stored.

## Optional hands-free SOS triggers

- Added opt-in three-shake SOS detection with distinct motion peaks and an eight-second cancellation countdown.
- Added opt-in continuous voice SOS monitoring in visible Blind mode, with a distinctive wake phrase, a separate spoken confirmation and a cancellation phrase.
- Added Admin permission/setup controls, Bengali/English recognition-language selection, privacy disclosures and trigger-detection tests.
- Both triggers are disabled by default; phone sensor and speech recognition behavior still require physical testing.

## Voice-first blind controls and multilingual input

- Replaced the Blind mode Help tile with Repeat; moved Help to a separate spoken-help button outside the four main actions.
- Added a spoken first-use safety notice, concise spoken failure messages, haptic cues, and screen wake lock during active camera/AI/SOS actions where supported.
- Added double-tap SOS confirmation. URL shortcuts can pre-arm SOS but never dispatch an alert merely by opening a URL.
- Made Gemini audio transcription the default microphone mode for Bangla, English and mixed speech; retained browser recognition as an Admin option and now falls back to Gemini after a no-speech result.
- Strengthened transcription instructions for Bangladeshi Bengali and code-switching.
- Prefer an installed Bengali speech-synthesis voice when the response contains Bengali script; Admin reports whether a Bengali voice is installed and previews Bengali when selected.
- Capture up to three camera frames 250 ms apart and choose the sharpest using a Laplacian-variance heuristic.
- Added URL actions and Android home-screen shortcuts for Describe, Ask and confirmation-only SOS.
- Updated documentation and added a ten-scene scorecard template. No real test results are pre-filled.

## Blind-first and voice resilience

- Added the Blind mode foundation, shared navigation, Admin quick-jump cards, BYOK, Gemini transcription fallback, ranked vision-model failover, and progressive response reveal.
- Updated project documentation, deployment address and privacy disclosures.

## Previous prototype work

- Cloudflare Worker serves static assets and the public API.
- Gemini photo-analysis integration and configurable model catalogue.
- ESP32-CAM still capture helper and phone image upload fallback.
- Versioned local privacy consent.
- Six Diagnostics checks including Check all at once.
- Per-install SOS rooms, one-time six-character pairing invitations, expiry, receiver-token replacement and acknowledgement.
- GitHub Actions tests and conditional Cloudflare production deployment.
- Removed the app login/access-token gate and Cloudflare-wide API rate-limit bindings; Google provider quotas still apply.

Automated checks do not replace real-device testing or supervised usability evaluation with blind and low-vision participants.
