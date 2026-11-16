# Deployment

## Hosting

Use Cloudflare Workers with Static Assets and Durable Objects. GitHub remains the source repository. GitHub Pages alone cannot host the Worker API and SOS Durable Objects required by this app.

Live main deployment (current baseline): https://daredevils-eye.kjkundu2006.workers.dev/

## GitHub Actions secrets

In GitHub, open Settings → Secrets and variables → Actions and add:

| Secret | Value |
|---|---|
| CLOUDFLARE_API_TOKEN | Scoped Cloudflare API token for Workers deployment |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account ID |
| GEMINI_API_KEY | Gemini API key for the server-side demo project |

The workflow uploads only `GEMINI_API_KEY` as a Worker secret. Never place values in workflow source, frontend code, commits or logs. Follow Cloudflare's current least-privilege guidance for API tokens.

## Release flow

1. Push feature work to a branch and create a pull request to `main`.
2. GitHub Actions runs `npm test` and `npm run check` for the PR.
3. Review the diff and test results.
4. Merge only after the candidate is accepted.
5. A successful push to `main` deploys the Worker if all three secrets exist.
6. Confirm the Worker deployment job succeeds and test the live site.

A green test job on a feature branch does not update production. Do not treat CI as physical device verification.

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
- Review privacy notice and consent text.
- Verify that no API key, audio recording or private image appears in logs or commits.
