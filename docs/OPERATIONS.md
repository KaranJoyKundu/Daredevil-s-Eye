# Operations — deployment, data and account services

> [Documentation hub](https://daredevils-eye.karanjoykundu.workers.dev/documentation/) · [Open the app](https://daredevils-eye.karanjoykundu.workers.dev/)


**Purpose:** Operational source of truth for Cloudflare deployment, secrets, Supabase, account/guest history, encrypted saved keys, verification and recovery. Never put secret values in this file.

## Hosting and production topology

Use Cloudflare Workers with Static Assets and Durable Objects. GitHub remains the source repository. GitHub Pages alone cannot host the Worker API and SOS Durable Objects required by this app.

Live main deployment (current baseline): https://daredevils-eye.karanjoykundu.workers.dev/

## GitHub Actions secrets

In GitHub, open Settings → Secrets and variables → Actions and add:

| Secret | Value |
|---|---|
| CLOUDFLARE_API_TOKEN | Scoped Cloudflare API token for Workers deployment |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account ID |
| GEMINI_API_KEY | Gemini API key for the server-side demo project |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY | Optional. Turns on account and guest photo history |
| API_KEY_ENCRYPTION_KEY, IP_HASH_SECRET | Optional. Encrypts saved personal keys and creates the keyed IP hash |
| SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | Optional older alternative to the publishable and secret key pair |

The workflow always uploads `GEMINI_API_KEY` as a Worker secret, and uploads the Supabase, encryption and IP-hash secrets only when all of them are set. VAPID keys for SOS web push are generated and stored by the SOS Durable Object, so they need no secret. Never put secret values in workflow files, front-end code, commits or logs. Follow Cloudflare's current least-privilege guidance for API tokens.

## Release flow

1. Push feature work to a branch and create a pull request to `main`.
2. GitHub Actions runs `npm test` and `npm run check` for the PR.
3. Review the diff and test results.
4. Merge only after the candidate is accepted.
5. A successful push to `main` deploys the Worker if all three secrets exist.
6. Confirm the Worker deployment job succeeds and test the live site.

A green test job on a feature branch does not update production. Do not treat CI as physical device verification.

Every push to `main` redeploys, including pushes that change only documentation. The workflow has no `paths` filter.

## API keys and quotas

The production Gemini project key remains a Worker secret. A visitor may optionally supply their own key in Admin; it is held in tab sessionStorage and sent to same-origin API endpoints in a header. The Worker does not store that custom key. Public demo visitors otherwise share the configured project's Google quota.

The Worker tries other compatible Gemini vision models on model-specific quota/overload/unavailability errors. Google's project-level quota still applies; model rotation cannot bypass it. A key from the same project will not create a separate project quota.

## Manual deploy

After authenticating Wrangler and selecting the correct Cloudflare account:

```powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Wrangler prompts for the key. Do not put secret values directly into command history.

## Production checks

- GET `/api/health` reports configuration state without exposing secret values.
- Open Home and Blind mode.
- Test a phone photo and a real Gemini response.
- Use Admin BYOK only with a key under your control.
- Test microphone transcription on HTTPS; record the exact browser/device and language.
- Pair two physical phones for SOS and test replacement and acknowledgement.
- Review the visible informational privacy notice and confirm there is no blocking consent popup, Accept button, checkbox or photo-history opt-in toggle.
- Verify that no API key, audio recording or private image appears in logs or commits.

## Supabase account, private photo history and guest history

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

## Production Worker secrets

The current main deployments (#448 and #450) have already uploaded the modern Supabase key pair, Supabase URL, API-key encryption secret and IP-hash secret to the production Worker. You do not need to add these again unless you rotate credentials. The list below documents the required values for a new environment or recovery deployment.

For a new environment, add these secrets to https://github.com/KaranJoyKundu/Daredevil-s-Eye/settings/secrets/actions:

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

A daily Cloudflare Cron job deletes guest photo objects and metadata older than 30 days. Clearing browser site data/cookies may remove access to guest records before automatic expiration. Guest photo rows can include a keyed HMAC fingerprint derived from the source IP for aggregate usage counts. Raw IP addresses and guest browser user-agent strings are never stored; the fingerprint is removed with its photo row after 30 days or sooner if deleted. Guest submissions do not create signed-in usage records.

## Usage and IP privacy

Signed-in usage rows can include request type, model, token counts, photo size, timestamp and keyed pseudonymous IP fingerprint. Raw IP addresses are never stored. Usage-only records expire after 90 days.

## Personal Gemini keys

A user's personal key is encrypted with AES-256-GCM in the Worker using API_KEY_ENCRYPTION_KEY and stored only as ciphertext plus IV. The browser can replace/delete the key and see a masked state; plaintext is never sent back. The Worker decrypts it only for the provider request. Rotating the encryption secret requires re-encrypting saved rows first.

## Deployment and verification

For a new environment, or after rotating any secret:
1. Open GitHub → Actions.
2. Select Verify and deploy Daredevil's Eye.
3. Select Run workflow, choose main and run it.
4. Confirm the deployment log says the modern Supabase keys and shared account-history secrets were uploaded.
5. Open Account & History. The status must report that the service is ready.
6. Submit one guest photo while signed out; confirm it appears after refresh and can be viewed/deleted.
7. Sign in and submit a second photo; confirm it appears in account history.
8. Test individual delete, delete-all and guest expiry with a controlled old record in a test database.

A successful Cloudflare Worker deploy does not by itself prove Supabase is connected. Until Account & History reports that the service is ready, do not assume a photo was persisted.

## Operational safety rules

- Keep Cloudflare Worker production as the authoritative live backend unless a separately reviewed migration is approved.
- Use separate preview/staging and production secrets where supported.
- Never copy secret values into documentation, issues, screenshots, shell history or client bundles.
- Verify schema, row-level security, private storage policies and scheduled cleanup before changing account/history behaviour.
- Record deployment commit, environment, workflow URL and smoke-test result in [STATUS](STATUS.md).
- For end-user release readiness, use [RELEASE](RELEASE.md); for actual component boundaries, use [ARCHITECTURE](ARCHITECTURE.md).
