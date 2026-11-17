# Supabase account, private photo history and guest history setup

This project keeps the Cloudflare Worker as the API gateway. Supabase supplies email/password authentication, PostgreSQL records and a private Storage bucket. Gemini requests and secret-key decryption remain inside the Worker.

## Provisioned project

- Project reference: dyfpawbkttbgoorcgwbd
- Region: Mumbai (ap-south-1)
- Project URL: https://dyfpawbkttbgoorcgwbd.supabase.co
- Private bucket: daredevil-history
- Bucket size limit: 4,000,000 bytes; allowed type: JPEG
- Tables: user_api_keys, ai_history, api_usage
- Guest-history migration: supabase/migrations/20261117020000_guest_photo_history.sql

The base private-history migration and guest-history schema have been applied. The ai_history table allows either a signed-in owner UUID or a guest-session hash, never both. RLS remains enabled; direct browser roles have no table access. The Worker verifies ownership/cookie and uses the server-side Supabase Secret key.

## Required GitHub Actions secrets

Add these secrets to https://github.com/KaranJoyKundu/Daredevil-s-Eye/settings/secrets/actions:

- SUPABASE_URL — https://dyfpawbkttbgoorcgwbd.supabase.co
- SUPABASE_PUBLISHABLE_KEY — copy the sb_publishable key from Project Settings → API Keys
- SUPABASE_SECRET_KEY — copy the sb_secret key from Project Settings → API Keys; never paste this into chat or browser code
- API_KEY_ENCRYPTION_KEY — new random secret, at least 32 bytes
- IP_HASH_SECRET — different random secret, at least 32 bytes

The Worker also requires the existing GEMINI_API_KEY, CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID repository secrets. The deployment workflow uploads the Supabase secrets to Cloudflare. The legacy SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY pair remains supported for older projects; modern key types are recommended for this project.

Generate two different 32-byte secrets in Windows PowerShell:

    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    1..2 | ForEach-Object {
        $bytes = New-Object byte[] 32
        $rng.GetBytes($bytes)
        [Convert]::ToBase64String($bytes)
    }
    $rng.Dispose()

Use output one for API_KEY_ENCRYPTION_KEY and output two for IP_HASH_SECRET. Keep both in a password manager. Never reuse one value for both purposes.

Configure Supabase Auth Site URL as:

    https://daredevils-eye.karanjoykundu.workers.dev

Add any account-confirmation redirect URL used by the app to Supabase Auth's allowed redirect URLs.

## Signed-in photo history

When photo saving is enabled (on by default after Terms acceptance), each compressed JPEG submitted to AI is uploaded to a private storage path under the authenticated user's UUID before Gemini starts. The Worker inserts a pending history row, then patches it with the question, prompt, answer when available, model, fallback models, finish reason, response language, token usage and completed/failed status. If Gemini times out or returns an error, the photo remains saved and is marked failed.

Signed-in records remain until the user deletes them. Account & History supports paging, short-lived signed image URLs, individual deletion and delete-all of the user's photos, answers and usage.

## Guest photo history

The Worker issues a random 256-bit de_guest cookie with HttpOnly, Secure, SameSite=Lax and a 30-day lifetime. Browser JavaScript cannot read the cookie. PostgreSQL stores only the SHA-256 digest of the cookie, never the bearer token itself. Guest files use a private storage folder prefix derived from that digest.

Guest photos are saved when the selected/compressed image is submitted for AI analysis, before Gemini runs. Preview-only images cancelled before submission are not saved. If AI analysis fails, the image remains in guest history with a failed status. The Account page can list, show, individually delete and delete all guest records for the current browser.

A daily Cloudflare Cron job deletes guest photo objects and metadata older than 30 days. Clearing browser site data/cookies may remove access to guest records before automatic expiration. Guest rows do not store raw IP address or user-agent. Guest submissions do not create signed-in usage records.

## Usage and IP privacy

Signed-in usage rows can include request type, model, token counts, photo size, timestamp and keyed pseudonymous IP fingerprint. Raw IP addresses are never stored. Usage-only records expire after 90 days.

## Personal Gemini keys

A user's personal key is encrypted with AES-256-GCM in the Worker using API_KEY_ENCRYPTION_KEY and stored only as ciphertext plus IV. The browser can replace/delete the key and see a masked state; plaintext is never sent back. The Worker decrypts it only for the provider request. Rotating the encryption secret requires re-encrypting saved rows first.

## Deployment and verification

After adding the secrets:
1. Open GitHub → Actions.
2. Select Verify and deploy Daredevil's Eye.
3. Select Run workflow, choose main and run it.
4. Confirm the deployment log says the modern Supabase keys and shared account-history secrets were uploaded.
5. Open Account & History. The status must report that the service is ready.
6. Submit one guest photo while signed out; confirm it appears after refresh and can be viewed/deleted.
7. Sign in and submit a second photo; confirm it appears in account history.
8. Test individual delete, delete-all and guest expiry with a controlled old record in a test database.

A successful Cloudflare Worker deploy does not by itself prove Supabase is connected. Until Account & History reports that the service is ready, do not assume a photo was persisted.
