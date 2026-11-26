# Emergency video deployment and validation

This guide covers the optional WebRTC live-share and private incident-recording infrastructure. Both features are off by default. Do not enable emergency recording until the private R2 bucket and Supabase migration are ready.

## Required account setup

1. The new Supabase migration is already applied to the linked project (both private tables, indexes, five-entry trigger and deny policies were verified). After pulling this branch, run the commands below only to confirm the local migration history is in sync; `db push` should report no pending migrations:
   ```powershell
   npx supabase login
   npx supabase link --project-ref dyfpawbkttbgoorcgwbd
   npx supabase db push
   ```
   The migration is additive. It creates private `scene_memory_entries` and `emergency_recordings` tables, enables RLS, explicitly denies browser roles, grants the Worker service role, and keeps at most five scene-memory observations per account/guest session. Do not paste the database password or access token into chat or commit them.

2. Create the private Cloudflare R2 bucket (one time):
   ```powershell
   npx wrangler login
   npx wrangler r2 bucket create daredevils-eye-incident-recordings
   ```
   The Worker binding is named `INCIDENT_RECORDINGS`. Keep this bucket private; do not enable public access or custom public domains.

3. Configure a TURN relay. STUN-only WebRTC may work on the same Wi-Fi but can fail across mobile carrier NATs. Obtain a TURN service and set its server URL(s), username and credential as Worker secrets:
   ```powershell
   npx wrangler secret put TURN_URL
   npx wrangler secret put TURN_USERNAME
   npx wrangler secret put TURN_CREDENTIAL
   ```
   `TURN_URL` accepts comma-separated `turn:` / `turns:` URLs. Use provider-issued, time-limited credentials where possible and rotate them. Never put TURN credentials in frontend files or Git.

4. Confirm the existing Worker secrets are still configured: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `HISTORY_ENCRYPTION_KEY`, and the VAPID push secrets. Do not replace existing values unless they are missing.

5. After the reviewed PR is merged and CI passes, deploy the Worker:
   ```powershell
   npx wrangler deploy
   ```
   The repository's main-branch GitHub workflow may deploy automatically; do not run two deployments simultaneously.

6. In Cloudflare R2, add a lifecycle rule to delete objects under prefix `incidents/` after 30 days. The Worker also runs scheduled metadata/object cleanup; the bucket lifecycle rule is a second safety net for orphaned uploads.

## App setup

- On the sender phone, open Admin / Settings and enable **Offer live camera video after a confirmed SOS** only if you want it.
- Enable **Also save an emergency video recording privately** only if the R2 bucket and migration are ready. Recording is limited to five minutes / 50 MB and expires after 30 days.
- Keep the sender camera selected as Phone or ESP32-CAM. For ESP32 video, start the live preview at least once if the browser has not yet granted local-network access. The firmware stream must allow CORS so the browser can bridge MJPEG frames into a WebRTC track.
- Pair the receiver phone using a new six-character code. On the receiver, open the page, enable the siren/notifications, and keep it connected.
- Trigger a test SOS with both phones on the same Wi-Fi first. Confirm the receiver sees the live video, then test with one phone on mobile data. If the second test fails, verify TURN secrets and firewall/transport support.
- Stop sharing from either phone. Confirm recording appears in Account & History and can be played, downloaded and deleted.

## Important limitations

- WebRTC media is encrypted in transit; a TURN server relays encrypted packets but does not make a network path available when either device is offline.
- Browser camera permissions, Android battery management, screen lock, background suspension and local-network permission can interrupt the session. The app does not guarantee background camera operation.
- A successful push notification means the push provider accepted a request, not that the receiver saw it.
- ESP32-to-WebRTC uses a browser canvas bridge from the MJPEG preview. Test this on the target Android/Chrome version; if the browser blocks canvas access, use the phone camera for emergency live video.
- This feature does not contact emergency services. Keep a separate trusted-contact/emergency plan.
