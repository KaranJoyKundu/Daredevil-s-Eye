# Deployment

## Hosting model

Use **Cloudflare Workers with Static Assets and Durable Objects**. Wrangler serves web/, routes /api/* through the Worker, and binds the SOS Durable Objects. GitHub remains the source repository.

GitHub Pages is static hosting and cannot run this Worker or Durable Objects. It is not the correct host for this complete application.

The deployed Worker uses a public HTTPS workers.dev address. Anyone can open the website and call its public AI features without an app access token or login.

## GitHub Actions secrets

In GitHub, open **Settings → Secrets and variables → Actions** and add these repository secrets:

| Secret | Value |
|---|---|
| CLOUDFLARE_API_TOKEN | Scoped Cloudflare API token for Workers deployment |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account ID |
| GEMINI_API_KEY | Current Gemini key |

The deploy workflow passes only the Gemini key to Wrangler as a Worker secret. Never put secret values in workflow source, frontend code, commits or logs.

Cloudflare's official guidance uses an API token with the **Edit Cloudflare Workers** permission policy. Scope it to the intended account and review the permissions.

## Release flow

1. Merge an approved PR into main.
2. GitHub Actions runs CI.
3. After CI succeeds, the deploy job runs only if all three repository secrets exist.
4. Wrangler deploys the Worker and static assets to the Cloudflare account.
5. Obtain the workers.dev URL from the GitHub Actions deployment output or Cloudflare Dashboard.
6. Open the website directly. No app access token or login is required.

If secrets are absent, the workflow deliberately skips deployment. A green CI check alone does not prove a production Worker is live.

## Public API and quota protection

The public demo currently allows only the server-configured Gemini model (Gemini Flash in the committed Wrangler configuration). Expensive API calls use weighted Cloudflare per-IP rate limits: image analysis consumes four units, Gemini speech consumes two units and model-list requests consume one unit.

These limits provide basic abuse friction, not a strict global quota or billing cap. Cloudflare documents that rate-limit decisions are approximate and applied separately per Cloudflare location. Anyone can still consume Gemini quota from multiple IPs or locations. Review Gemini usage and configure provider-side spending/usage controls where available.

## Manual alternative

After authenticating Wrangler and selecting the correct Cloudflare account:

~~~powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
~~~

Wrangler prompts for the key. Do not put secret values directly into shell commands/history.

## Production verification

- GET /api/health reports configuration status without exposing secrets.
- Open / and confirm the app loads without an unlock screen.
- Test a phone-photo upload and Gemini vision response.
- Test Bengali input/output separately.
- Pair two physical phones; verify replacement, alert and acknowledgement.
- Confirm HTTPS and microphone permission.
- Do not test the SOS system with anyone depending on it for safety.

## Camera limitation

The camera IP 192.168.0.104 is private to the local network. The hosted app can be used worldwide with phone-photo input, but the ESP32-CAM cannot be accessed remotely until an authenticated gateway or outbound camera relay is designed and tested.
