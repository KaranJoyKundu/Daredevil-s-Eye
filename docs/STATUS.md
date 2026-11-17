# Daredevil's Eye — implementation status

Updated: 17 November 2026  
Production URL: https://daredevils-eye.karanjoykundu.workers.dev/  
Target handset: Samsung Galaxy A55 5G, Android 16 / One UI 8.

This is the current release status. Earlier descriptions retained in history are superseded where they conflict with the current checklist.

## Current change set

The current branch is feat/guest-photo-history-bangla-account-ui. It is not yet merged or deployed.

### Completed in source

- Bangla (Bangladesh) is now the default AI response, device speech, input preference and SOS voice language for new browser settings. Accepting the current Terms writes these defaults for existing settings too.
- The generic warning appended to every AI answer has been removed. Safety information remains in the Terms, Privacy and consent notice.
- Gemini 3.8 Flash remains the default vision model. Saved Gemini 3.6 Flash selections are migrated to 3.8 Flash.
- Bengali voice discovery waits for Chrome's asynchronous voice list and tries the Android bn-BD locale when Chrome does not enumerate a Bengali voice.
- Account & History has been redesigned with a responsive account dashboard, guest-photo panel, key management, usage summary and delete controls.
- The Worker saves the selected/compressed JPEG to private storage before Gemini starts and records pending/completed/failed analysis status.
- Signed-in photos are owned by the account UUID. Guest photos are tied to a random 256-bit HttpOnly cookie; only its SHA-256 digest is stored.
- Guest history can be listed, viewed, individually deleted and bulk deleted from this browser's Account page. A daily Cron job removes guest records and photo objects older than 30 days.
- The guest-history database schema has been applied to Supabase and is represented by a migration file in the current branch.
- The Support page retains bKash/Nagad details. Buy Me a Coffee is intentionally skipped because no creator URL exists.

### Database and production activation

- Supabase project dyfpawbkttbgoorcgwbd exists in Mumbai (ap-south-1).
- Private bucket daredevil-history exists.
- Base account-history and guest-history schema changes have been applied.
- The production Worker still needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, API_KEY_ENCRYPTION_KEY and IP_HASH_SECRET as GitHub Actions secrets. The old production deployment logs showed that optional Supabase secrets were skipped.
- Until those secrets are uploaded by a successful main deployment, do not assume the live site is persisting guest or account photos.

### Verification still required

- Run the current branch's full GitHub Actions test and JavaScript syntax-check run.
- Deploy the merged main branch and check that the optional Supabase secret-upload steps succeed.
- Test one photo while signed out and a separate photo while signed in, including refresh, private image view, failed AI request, individual delete and delete-all.
- Verify the 30-day scheduled cleanup on Cloudflare.
- Test Google Bengali TTS, Bengali transcription and code-switching on the physical Galaxy A55.
- Test locked-screen SOS on a second handset.
- Test ESP32-CAM frame selection, photo compression and shutter audibility.
- Perform mobile/TalkBack review of the redesigned Account page.

See CURRENT-RELEASE-CHECKLIST.md for detailed acceptance criteria and priority order.

## Historical context

PR #5 added Gemini response reliability, photo upload/compression, SOS Web Push and the original account-history implementation. PR #6 added mandatory Terms acceptance, the first Support page, early Bengali voice-list refresh and the Admin Save button placement. This branch supersedes earlier history-storage and Account UI behavior.
