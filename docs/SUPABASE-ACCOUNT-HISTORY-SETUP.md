# Supabase account, private history and BYOK setup

This project keeps the Cloudflare Worker as the API gateway. Supabase supplies email/password authentication, PostgreSQL records and a private Storage bucket. Gemini API calls and all secret-key decryption stay inside the Worker.

## Provisioning (one-time)

1. Connect the Supabase app in ChatGPT and select the Supabase project you want to use.
2. In Supabase, create a project on a plan you have approved. No paid upgrade is required by this code, but your chosen plan has its own quotas and storage limits.
3. Open the SQL Editor and run `supabase/migrations/202611170001_reliability_history.sql`.
4. Copy the Project URL, anon/public key and service-role key from the Supabase project's API settings.
5. Add these as **Cloudflare Worker secrets**, never as browser variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `API_KEY_ENCRYPTION_KEY` (random secret, at least 32 bytes)
   - `IP_HASH_SECRET` (a separate random secret)
6. The existing Worker still needs its `GEMINI_API_KEY` secret.
7. Configure Supabase Auth's site URL / allowed redirect URLs for the production site. Enable email confirmation if you want email verification before login.

## What is stored

When the signed-in user enables **Save photo and answer history** in Admin, a successful Describe/Ask operation stores:
- The compressed JPEG in the private `daredevil-history` bucket (not public).
- The question, system prompt, answer, model, attempted fallback models, finish reason, output language, usage tokens and timestamp.
- A keyed, pseudonymous IP fingerprint and browser user-agent. The fingerprint stays with the photo/answer record until the user deletes it; usage-only fingerprint rows expire after 90 days. The raw IP address is never written to the database.

Authenticated AI requests also write usage rows for the signed-in user, with a 90-day expiry timestamp. The app does not store photos or responses from unsigned users. A user can delete individual history records and all saved data.

## Gemini API keys

A user's key is encrypted with AES-256-GCM in the Worker using `API_KEY_ENCRYPTION_KEY`, and stored only as ciphertext + IV. The browser can set or delete its key and see a masked value; it cannot read the plaintext back. The key is decrypted only inside the Worker for the provider request. Rotating the encryption secret requires re-encrypting stored keys before switching secrets.

## Deployment requirements

The Worker can still run without Supabase; account/history routes return a clear setup-required message. The feature is not fully available in production until the Supabase project, SQL, bucket and Worker secrets above are configured. The existing GitHub Actions deployment workflow must upload the new secrets to Cloudflare as part of deployment. The Supabase service-role key must never be added to the front-end, Git repository, issue comments or logs.
