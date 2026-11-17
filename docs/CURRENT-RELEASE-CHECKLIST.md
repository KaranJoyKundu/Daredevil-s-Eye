# Daredevil's Eye — current release checklist

Updated: 17 November 2026  
Target handset: Samsung Galaxy A55 5G, Android 16 / One UI 8  
Production URL: https://daredevils-eye.karanjoykundu.workers.dev/

This document is the current checklist. It supersedes older status text where the earlier descriptions conflict. Implemented code is not the same as verified physical-device behavior.

## Completed in source

| Area | Current behavior | Verification still required |
|---|---|---|
| Gemini model | Gemini 3.8 Flash is the default. Old saved Gemini 3.6 Flash selections migrate to 3.8 Flash. | Live-key quality/quota test. |
| Bangla defaults | Bangla (Bangladesh) is the default for AI replies, device speech, input preference and SOS voice language. Current Terms acceptance writes these defaults to existing browser settings. | Bengali TTS and speech-input testing on the A55. |
| Repeated safety warnings | Generic hazard warnings are removed from every AI response. Safety limits remain in Terms, Privacy and the consent screen. | Confirm fresh assets load after deployment. |
| Bengali voice | Browser voice enumeration is asynchronous; code waits for it and requests Android's bn-BD locale even when Chrome does not list a Bengali voice. Admin has refresh and preview controls. | Actual Google TTS playback/pronunciation on A55. |
| Account page | Redesigned responsive Account & History dashboard with sign-in, private account photos, guest photos, personal Gemini key, usage summary and deletion controls. | Mobile/TalkBack usability. |
| Signed-in photo history | Submitted compressed JPEG is written to the private bucket before Gemini starts; record is updated to completed or failed afterward. | Live persistence after secrets are configured. |
| Guest photo history | Guest session uses a random 256-bit HttpOnly cookie. Only its SHA-256 digest is stored. Guest photos are private and accessible through this browser's cookie. | Live end-to-end check after secrets are configured. |
| Guest retention | Guest photo rows and objects are scheduled for deletion after 30 days using a daily Worker Cron trigger. | Check scheduled execution in Cloudflare. |
| Support page | bKash/Nagad support page exists. Buy Me a Coffee remains skipped because no creator URL exists. | Nothing pending unless a creator URL is supplied. |

## Model decision

The default is Gemini 3.8 Flash, not 3.6 Flash. This is already configured in the Worker, Wrangler config and browser defaults. Keep 3.8 Flash rather than downgrading to an older model. Existing saved 3.6 selections are normalized to 3.8.

## Production activation

Supabase project: dyfpawbkttbgoorcgwbd, Mumbai ap-south-1. The base history schema and guest-history schema have been applied; the daredevil-history bucket is private.

The Cloudflare Worker still needs these GitHub Actions secrets:
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- API_KEY_ENCRYPTION_KEY
- IP_HASH_SECRET

The Supabase Secret key must stay private. Generate two different random secrets for the encryption and HMAC values. Add them at https://github.com/KaranJoyKundu/Daredevil-s-Eye/settings/secrets/actions, then run Actions → Verify and deploy Daredevil's Eye → Run workflow → main. The workflow uploads the values to the Worker. Supabase Auth must allow the production site URL.

Do not assume history is live merely because the Worker deployment succeeds. Confirm the Account page service status, then submit one guest photo and one signed-in photo and verify they appear.

## Remaining tasks, in priority order

| Priority | Remaining item | Done condition |
|---|---|---|
| P0 | Add the five Supabase secrets and redeploy | Account page reports the account/history service ready. |
| P0 | Guest-history end-to-end test | Submit while signed out; confirm the photo appears after refresh, opens privately, and can be deleted. |
| P0 | Signed-in history end-to-end test | Submit while signed in; confirm the photo appears on another browser/device and deletion works. |
| P1 | Guest 30-day cleanup | Confirm Cloudflare Cron runs; test purge with a controlled old timestamp in a test database. |
| P1 | Bengali output on A55 | Download Google Bengali speech data; use Admin refresh and preview; test prompts, errors and answers. |
| P1 | Bangla speech input on A55 | Test Bangla-only and mixed Bangla-English transcription and record accuracy. |
| P1 | Account UI/accessibility | Test small-screen layout, TalkBack focus, labels, live regions, large targets and delete confirmations. |
| P1 | Camera-history semantics | Confirm submitted compressed image is saved; preview-only cancelled image is not saved; failed Gemini analysis still leaves the image record. |
| P1 | Screen-off SOS | Pair a second phone, lock it, send SOS and verify actual notification visibility/sound/vibration. |
| P2 | ESP32-CAM/shutter/compression | Test LAN access, selected frame, audible shutter sounds and JPEG size under 4 MB on actual hardware. |
| P2 | Accessibility/security review | Test TalkBack, false-positive SOS behavior and re-run Supabase security/performance advisors after final schema changes. |
| Optional | Buy Me a Coffee | Add a creator page only when one exists; no placeholder payment URL is published. |

## Privacy boundaries

- Signed-in history belongs to the authenticated user and remains until deleted.
- Guest history is tied to this browser's random HttpOnly cookie and is deleted automatically after 30 days.
- The cookie bearer token is never stored in the database; only its SHA-256 digest is stored.
- Guest rows do not store raw IP address or browser user-agent.
- The saved image is the selected/compressed photo submitted to AI. Discarded internal camera frame candidates are not stored.
- Preview-only photos cancelled before submission are not stored.
- Audio recordings are not saved to the photo-history database.

## Branch and release record

This checklist tracks the current changes on feat/guest-photo-history-bangla-account-ui. Update the PR number, CI count and production deployment SHA after the branch passes checks and merges.
