# Daredevil's Eye — reliability, photo workflow, SOS delivery and user history

Target device: **Samsung Galaxy A55 5G, Android 16 / One UI 8**. Other Android 16 Samsung models are compatibility targets, not presumed identical.

This checklist records the owner's 17 November 2026 requests. A task is not "done" merely because code exists: automated checks, a production deployment, and the relevant A55 / second-phone test must all be recorded.

## Ordered implementation checklist

| # | Work item | Acceptance criteria | Status |
|---|---|---|---|
| 1 | Gemini responses cut off mid-sentence; remove the 3.6 Flash dependency and try alternatives | No response ending with `MAX_TOKENS` is presented as complete; larger visible-output budget; model fallback records which model succeeded; tests cover a truncated first model and a complete fallback | Implemented on branch; 69/69 CI tests pass; A55 model-quality validation pending |
| 2 | Full Bangla mode for every spoken instruction | When Admin language is বাংলা, camera instructions, waiting/error/SOS/status prompts and AI answers are spoken in Bangla; no English system fallback is spoken; tests cover language routing | Implemented on feature branch; 69/69 CI tests pass; A55 voice playback pending |
| 3 | More effective Bangla voice transcription | Preserve Bangla in Bengali script when Bangla mode is selected; preserve mixed technical terms without translating the whole question to English; transcription models use low-cost-first fallback | Implemented on feature branch; transcription tests pass; A55 microphone/transcription test pending |
| 4 | Camera and upload path on Home / Action | Separate **Use phone camera** and **Upload photo** controls; both open the same preview/confirm flow; upload selection works without the camera-only capture hint | Implemented on feature branch; CI markup test passes; Android upload test pending |
| 5 | Automatic image compression | Resize/re-encode large camera and uploaded images locally to JPEG below 4,000,000 bytes before upload; EXIF is removed by re-encoding; clear error for formats the browser cannot decode | Implemented on feature branch; compression path is covered by syntax/flow checks; large-photo Android test pending |
| 6 | Preview and Ask AI buffer | Preview shows the exact compressed image; optional question box; default Ask AI button waits for explicit confirmation; Admin can disable the wait and restore automatic Describe; nothing is sent before confirmation when enabled | Implemented on feature branch; CI control tests pass; manual preview/auto-send test pending |
| 7 | Three-frame camera shutter sounds | Three synthetic shutter clicks are attempted for the three ESP32-CAM frame requests after priming audio on the user tap; native Android camera-app shutter sound cannot be controlled by a web page | Implemented on feature branch; CI checks pass; actual ESP32 shutter audibility needs device confirmation |
| 8 | SOS while the receiver phone screen is off | Receiver registers a Web Push subscription; sender pushes a notification through a service worker; receiver can acknowledge; foreground polling remains a fallback; delivery is labelled queued/attempted, never guaranteed | Implemented on feature branch; Web Push encryption/subscription tests pass; real A55/second-phone screen-off test pending |
| 9 | Persistent user account, photo/answer history and usage | Authenticated per-user records; private image objects with database metadata, model/answer/timestamp and aggregate usage; user can revisit and delete their own records | Code, UI, SQL schema and mocked storage tests added; Supabase project still needs provisioning and credentials |
| 10 | Persist user-owned Gemini keys across sign-in | Keys encrypted server-side with a Worker secret; never stored as plaintext, exposed in pages, logs or API responses; deletion and rotation controls | Encryption, per-user key endpoints and mocked round-trip test pass; requires Supabase secrets |
| 11 | IP/usage audit | Store minimal pseudonymous IP fingerprints and request counts with a documented retention period; do not expose raw IPs in public pages or store indefinite location histories | Pseudonymous IP fingerprint and usage tests pass; requires Supabase secrets for live records |
| 12 | Menu closes when tapping elsewhere | Clicking outside the site menu closes it; Escape and link navigation continue to close it; keyboard and touch behavior tested | Implemented on feature branch; CI outside-click logic test passes; touch/keyboard device test pending |

## Architecture decisions and privacy boundaries

- AI keys must never be written to the repository, browser localStorage, plaintext database columns, analytics or logs. Per-user keys are encrypted at rest with a Cloudflare Worker secret and decrypted only for the provider request.
- Photos and answers can reveal sensitive locations and people. Store them only under an authenticated user, with explicit history consent, a retention setting, and a delete-all action. Use private object storage for image bytes and database rows for metadata; do not make images public.
- Store a keyed, rotating IP fingerprint and usage counts rather than raw IP addresses by default. Admin should see useful counts without creating a permanent visitor-location log.
- Screen-off SOS needs Web Push / service-worker delivery. Browser polling and a Wake Lock do not wake a phone whose screen is off. Push notifications can still be delayed or blocked by permissions, network, Doze/battery policy or vendor settings.
- No paid SMS, paid APIs or new API-wide rate limit is introduced without approval. Login protection and secure session expiry are separate from AI usage throttling.

## Current verification boundary

- Latest GitHub Actions run **43988577256** passed **69/69 tests** and completed `npm run check` with all JavaScript syntax checks passing. The production deployment job was skipped because this is a feature branch.
- The latest physical Galaxy A55 / receiver-phone tests have not been performed.
- Account, private photo history, encrypted saved keys and usage reporting do not become active until the Supabase migration is applied and the five Supabase/encryption secrets are configured in GitHub Actions.
- CI is green on the current PR head. Screen-off SOS, ESP32 shutter audibility, Android photo compression/upload and Bengali voice quality still require real-device checks.

## Release gate

Changes stay on `feat/reliability-photo-history-push`. The existing production state is preserved on `backup/main-before-reliability-photo-push-2026-11-17`. Do not merge until the code checks pass and any Cloudflare resource/secret prerequisites are explicit. Do not mark hardware work complete without tests on the Galaxy A55 and the receiving handset.
