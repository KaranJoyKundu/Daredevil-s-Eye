# Implementation status

## In this branch
- Worker API with mock-only `/api/health`, `/api/config`, `/api/describe`, and `/api/ask` routes.
- Immutable safety prompt core.
- Wrangler static asset configuration.
- Browser-side API, local settings, and speech helper modules.

## Explicitly not enabled
- No live vision provider or external AI calls.
- No API keys or provider secrets.
- No firmware changes.
- No public deployment.
- No claim that mock responses describe an image.

## Important integration note
The ESP32-CAM capture endpoint is fetched directly by the phone browser. A hosted HTTPS origin may be blocked from fetching a local HTTP camera endpoint by browser mixed-content, CORS, or private-network restrictions. Validate this on the target phone/network before selecting a proxy or changing firmware.

## Safety
This prototype is not a navigation system and cannot guarantee hazard detection. It must not replace a cane, guide dog, or mobility training.