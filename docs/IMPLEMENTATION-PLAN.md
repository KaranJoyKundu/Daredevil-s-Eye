# Daredevil's Eye — reliability, photo workflow, SOS delivery and user history

Target device: **Samsung Galaxy A55 5G, Android 16 / One UI 8**. Other Android 16 Samsung models are compatibility targets, not presumed identical.

This checklist records the owner's 17 November 2026 requests. A task is not "done" merely because code exists: automated checks, a production deployment, and the relevant A55 / second-phone test must all be recorded.

## Ordered implementation checklist

| # | Work item | Acceptance criteria | Status |
|---|---|---|---|
| 1 | Gemini responses cut off mid-sentence; remove the 3.6 Flash dependency and try alternatives | No response ending with `MAX_TOKENS` is presented as complete; larger visible-output budget; model fallback records which model succeeded; tests cover a truncated first model and a complete fallback | Implemented on branch; tests pending |
| 2 | Full Bangla mode for every spoken instruction | When Admin language is বাংলা, camera instructions, waiting/error/SOS/status prompts and AI answers are spoken in Bangla; no English system fallback is spoken; tests cover language routing | In progress |
| 3 | More effective Bangla voice transcription | Preserve Bangla in Bengali script when Bangla mode is selected; preserve mixed technical terms without translating the whole question to English; transcription models use low-cost-first fallback | In progress |
| 4 | Camera and upload path on Home / Action | Separate **Use phone camera** and **Upload photo** controls; both open the same preview/confirm flow; upload selection works without the camera-only capture hint | In progress |
| 5 | Automatic image compression | Resize/re-encode large camera and uploaded images locally to JPEG below 4,000,000 bytes before upload; EXIF is removed by re-encoding; clear error for formats the browser cannot decode | In progress |
| 6 | Preview and Ask AI buffer | Preview shows the exact compressed image; optional question box; default Ask AI button waits for explicit confirmation; Admin can disable the wait and restore automatic Describe; nothing is sent before confirmation when enabled | In progress |
| 7 | Three-frame camera shutter sounds | Three synthetic shutter clicks align with the three ESP32-CAM capture attempts; browser/device mute and autoplay restrictions are documented; no claim of changing the native Samsung camera app's shutter sound | Planned |
| 8 | SOS while the receiver phone screen is off | Receiver registers a Web Push subscription; sender pushes a notification through a service worker; receiver can acknowledge; foreground polling remains a fallback; delivery is labelled queued/attempted, never guaranteed | Planned — requires VAPID secrets and real A55/second-phone testing |
| 9 | Persistent user account, photo/answer history and usage | Authenticated per-user records; private image objects with database metadata, model/answer/timestamp and aggregate usage; user can revisit and delete their own records | Planned — requires provisioned database and private object storage |
| 10 | Persist user-owned Gemini keys across sign-in | Keys encrypted server-side with a Worker secret; never stored as plaintext, exposed in pages, logs or API responses; deletion and rotation controls | Planned — requires account/database stage |
| 11 | IP/usage audit | Store minimal pseudonymous IP fingerprints and request counts with a documented retention period; do not expose raw IPs in public pages or store indefinite location histories | Planned — retention controls required |
| 12 | Menu closes when tapping elsewhere | Clicking outside the site menu closes it; Escape and link navigation continue to close it; keyboard and touch behavior tested | Planned |

## Architecture decisions and privacy boundaries

- AI keys must never be written to the repository, browser localStorage, plaintext database columns, analytics or logs. Per-user keys are encrypted at rest with a Cloudflare Worker secret and decrypted only for the provider request.
- Photos and answers can reveal sensitive locations and people. Store them only under an authenticated user, with explicit history consent, a retention setting, and a delete-all action. Use private object storage for image bytes and database rows for metadata; do not make images public.
- Store a keyed, rotating IP fingerprint and usage counts rather than raw IP addresses by default. Admin should see useful counts without creating a permanent visitor-location log.
- Screen-off SOS needs Web Push / service-worker delivery. Browser polling and a Wake Lock do not wake a phone whose screen is off. Push notifications can still be delayed or blocked by permissions, network, Doze/battery policy or vendor settings.
- No paid SMS, paid APIs or new API-wide rate limit is introduced without approval. Login protection and secure session expiry are separate from AI usage throttling.

## Release gate

Changes stay on `feat/reliability-photo-history-push`. The existing production state is preserved on `backup/main-before-reliability-photo-push-2026-11-17`. Do not merge until the code checks pass and any Cloudflare resource/secret prerequisites are explicit. Do not mark hardware work complete without tests on the Galaxy A55 and the receiving handset.
