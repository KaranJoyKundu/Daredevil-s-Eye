# Daredevil's Eye — current release checklist

Updated: 20 November 2026  
Target handset: Samsung Galaxy A55 5G, Android 16 / One UI 8  
Production URL: https://daredevils-eye.karanjoykundu.workers.dev/

This document is the current checklist. It supersedes older status text where the earlier descriptions conflict. Implemented code is not the same as verified physical-device behavior.

## Completed in source

| Area | Current behavior | Verification still required |
|---|---|---|
| Landing page | `/` is the project landing page. `/action/` is the main app and `/blind/` is Blind mode. | None. Checked in Chrome at desktop, tablet and mobile sizes. |
| Language switch | The English / বাংলা switch changes the interface, spoken messages and AI answers. The Bangla switch message is a direct translation of the English one. | A native speaker's review of the Bangla text. |
| Bangla speech on desktop | If the device has no Bengali voice (for example Windows), answers are spoken by Gemini text-to-speech through `/api/speech`. Android uses its own bn-BD voice. | Listen on a Windows PC. Check quota use. |
| Assistant modes | Admin presets: All-in-one, Single object, Medicine, Read text, Taka, Colour and Custom. The system prompt can be edited (up to 4,000 characters), and the safety rules are always added. | Check answer quality for each preset with real photos. |
| Installable app | Web manifest, service worker, icons and three home-screen shortcuts. | Install and launch on the Galaxy A55. |
| Shutter sound | One recorded click (`web/shared/shutter.mp3`) for each capture. | Check that it is audible on a phone. Confirm the file's licence. |
| Gemini model | Gemini 3.8 Flash is the default. Old saved Gemini 3.6 Flash selections migrate to 3.8 Flash. | Live-key quality/quota test. |
| Bangla defaults | Bangla (Bangladesh) is the default for AI replies, device speech, input preference and SOS voice language. Current Terms acceptance writes these defaults to existing browser settings. | Bengali TTS and speech-input testing on the A55. |
| Repeated safety warnings | Generic hazard warnings are removed from every AI response. Safety limits remain in Terms, Privacy and the consent screen. | Confirm fresh assets load after deployment. |
| Bengali voice | Browser voice enumeration is asynchronous; code waits for it and requests Android's bn-BD locale even when Chrome does not list a Bengali voice. Admin has refresh and preview controls. | Actual Google TTS playback/pronunciation on A55. |
| Account page | Redesigned responsive Account & History dashboard with sign-in, private account photos, guest photos, personal Gemini key, usage summary and deletion controls. | Mobile/TalkBack usability. |
| Signed-in photo history | Submitted compressed JPEG is written to the private bucket before Gemini starts; record is updated to completed or failed afterward. | Production secrets are now uploaded; end-to-end live persistence still needs user-device verification. |
| Guest photo history | Guest session uses a random 256-bit HttpOnly cookie. Only its SHA-256 digest is stored. Guest photos are private and accessible through this browser's cookie. | Production secrets are now uploaded; end-to-end live persistence still needs user-device verification. |
| Guest retention | Guest photo rows and objects are scheduled for deletion after 30 days using a daily Worker Cron trigger. | Check scheduled execution in Cloudflare. |
| Support page | bKash/Nagad support page exists. Buy Me a Coffee remains skipped because no creator URL exists. | Nothing pending unless a creator URL is supplied. |

## Model decision

The default is Gemini 3.8 Flash, not 3.6 Flash. This is already configured in the Worker, Wrangler config and browser defaults. Keep 3.8 Flash rather than downgrading to an older model. Existing saved 3.6 selections are normalized to 3.8.

## Production activation

Supabase project: dyfpawbkttbgoorcgwbd, Mumbai ap-south-1. The base history schema and guest-history schema have been applied; the daredevil-history bucket is private.

The required Worker secrets were successfully uploaded by production workflow run #448 (and re-uploaded by #450):
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- API_KEY_ENCRYPTION_KEY
- IP_HASH_SECRET

The modern publishable/secret pair, project URL, encryption key and HMAC key are now present on the production Worker. Do not add them again unless rotating credentials. Keep the Supabase Secret key private. Supabase Auth must allow the production site URL.

Do not assume history is live merely because the Worker deployment succeeds. Confirm the Account page service status, then submit one guest photo and one signed-in photo and verify they appear.

## Remaining tasks, in priority order

| Priority | Remaining item | Done condition |
|---|---|---|
| P0 | Add the five Supabase secrets and deploy | Done: workflow runs #448 and #450 uploaded the modern Supabase keys and shared secrets successfully. |
| P0 | Guest-history end-to-end test | Submit while signed out; confirm the photo appears after refresh, opens privately, and can be deleted. |
| P0 | Signed-in history end-to-end test | Submit while signed in; confirm the photo appears on another browser/device and deletion works. |
| P1 | Guest 30-day cleanup | Confirm Cloudflare Cron runs; test purge with a controlled old timestamp in a test database. |
| P1 | Bengali output on A55 | Download Google Bengali speech data; use Admin refresh and preview; test prompts, errors and answers. |
| P1 | Bangla speech input on A55 | Test Bangla-only and mixed Bangla-English transcription and record accuracy. |
| P1 | Account UI/accessibility | Test small-screen layout, TalkBack focus, labels, live regions, large targets and delete confirmations. |
| P1 | Camera-history semantics | Confirm submitted compressed image is saved; preview-only cancelled image is not saved; failed Gemini analysis still leaves the image record. |
| P1 | Screen-off SOS | Pair a second phone, lock it, send SOS and verify actual notification visibility/sound/vibration. |
| P2 | ESP32-CAM/shutter/compression | Test LAN access, the selected frame, the single shutter click and JPEG size under 4 MB on real hardware. |
| P2 | Accessibility/security review | Test TalkBack, false-positive SOS behavior and re-run Supabase security/performance advisors after final schema changes. |
| Optional | Buy Me a Coffee | Add a creator page only when one exists; no placeholder payment URL is published. |

## Privacy boundaries

- Signed-in history belongs to the authenticated user and remains until deleted.
- Guest history is tied to this browser's random HttpOnly cookie and is deleted automatically after 30 days.
- The cookie bearer token is never stored in the database; only its SHA-256 digest is stored.
- Signed-in and guest photo rows may include a keyed HMAC IP fingerprint for aggregate counts; raw IP addresses are never stored. Guest browser user-agent strings are not stored, and the fingerprint is removed with the 30-day guest record.
- The saved image is the selected/compressed photo submitted to AI. Discarded internal camera frame candidates are not stored.
- Preview-only photos cancelled before submission are not stored.
- Audio recordings are not saved to the photo-history database.

## Branch and release record

## Completed merge and deployment record

- PR #7 merged to main as 7f5b3ad8c45fc5516559357c0f4268d3e0819015. CI run #447 passed 72/72 tests; main production deployment #448 succeeded and uploaded the Supabase URL, modern publishable/secret keys, encryption key and IP-hash secret.
- PR #8 merged to main as b6a6ffc25b15dcee76518cdb46069df52170d00a. CI run #449 passed 72/72 tests; the follow-up main deployment #450 succeeded and re-uploaded the Supabase secrets.
- Supabase security and health advisors reported no findings after the guest schema update. The performance advisor only reported unused indexes while the tables are still empty.
- Remaining live checks are guest/account photo persistence, 30-day Cron execution, A55 Bengali speech and second-phone screen-off SOS.
