# Local setup (Windows 11)

1. Install Node.js LTS.
2. Open PowerShell in the project directory.
3. Run `npm install`.
4. Run `npm test` and `npm run check`.
5. Run `npx wrangler dev` to start the local Worker and static assets.
6. Open the local URL printed by Wrangler.

Mock mode is the only supported mode in this phase. No API key is required. Do not add provider credentials to browser code.

## Camera
Configure the camera base URL in device settings. It should be the ESP32-CAM address only, for example `http://192.168.4.1`; the app appends `/capture`.

The browser must be able to reach the camera from the same network. If browser security blocks the request, record the exact browser error before changing architecture.

## Manual tests
- Confirm the mock backend health endpoint.
- Confirm the UI clearly labels replies as simulated.
- Test camera access on the actual phone and hotspot.
- Test speech output and speech input separately.
- Test SOS only with a test contact; the app opens the dialler and does not place a call automatically.