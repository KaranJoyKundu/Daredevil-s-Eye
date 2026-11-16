# Deployment

## Hosting model

Use **Cloudflare Workers with Static Assets and Durable Objects**. Wrangler serves web/, routes /api/* through the Worker, and binds the SOS Durable Objects. GitHub remains the source repository.

GitHub Pages is static hosting and cannot run this Worker or Durable Objects. It is not the correct host for this complete application.

A deployed Worker can use a public HTTPS workers.dev address. HTTPS does not solve private-network access to the ESP32-CAM.

## GitHub Actions secrets

In GitHub, open **Settings → Secrets and variables → Actions** and add these repository secrets:

| Secret | Value |
|---|---|
| CLOUDFLARE_API_TOKEN | Scoped Cloudflare API token for Workers deployment |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account ID |
| GEMINI_API_KEY | Current Gemini key |

The deploy workflow passes the Gemini key to Wrangler as a Worker secret. Never put these values in workflow source, frontend code, commits or logs.

Cloudflare's official guidance uses an API token with the **Edit Cloudflare Workers** permission policy. Scope it to the intended account and review the permissions.

## Release flow

1. Merge an approved PR into main.
2. GitHub Actions runs CI.
3. After CI succeeds, the deploy job runs only if all three repository secrets exist.
4. Wrangler deploys the Worker and static assets to the Cloudflare account.
5. Obtain the workers.dev URL from the GitHub Actions deployment output or Cloudflare Dashboard.
6. Open /access/ and enter the configured APP_ACCESS_TOKEN.

If secrets are absent, the workflow deliberately skips deployment. A green CI check alone does not prove a production Worker is live.

## Manual alternative

After authenticating Wrangler and selecting the correct Cloudflare account:

~~~powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
~~~

Wrangler prompts for each value. Do not place secret values directly into shell commands/history.

## Production verification

- GET /api/health reports boolean configuration status without exposing secrets.
- /access/ accepts the app token.
- Test a phone-photo upload and Gemini vision response.
- Test Bengali input/output separately.
- Pair two physical phones; verify replacement, alert and acknowledgement.
- Confirm HTTPS and microphone permission.
- Do not test the SOS system with anyone depending on it for safety.

## Camera limitation

The camera IP 192.168.0.104 is private to the local network. The hosted app can be used worldwide with phone-photo input, but the ESP32-CAM cannot be accessed remotely until an authenticated gateway or outbound camera relay is designed and tested.
