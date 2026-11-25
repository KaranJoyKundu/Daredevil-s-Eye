# Medicine RFID reader setup

This feature adds an account-paired ESP32 + RC522 medicine reader to Daredevil's Eye.

## Current implementation

- /medicine/ is the dedicated setup page and appears directly after Home / Action in the shared app menu.
- A signed-in account generates a six-digit, ten-minute pairing code.
- The ESP32 exchanges the code for a 256-bit device token. Only its SHA-256 digest is stored in the RFID Durable Object.
- The Worker associates each event with the account paired to the device; the ESP32 cannot choose an account ID.
- Medicine events are retained for up to 24 hours, with a bounded queue. The phone acknowledges an event after speech completes.
- The app-wide listener polls while a Daredevil's Eye page using shared navigation is open and the listener is enabled.
- Device revocation invalidates the stored token immediately.
- Pairing attempts are capped at ten per active code.

## Hardware wiring

| RC522 | ESP32 |
|---|---|
| SDA / SS | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 22 |
| 3.3V | 3V3 |
| GND | GND |

Use 3.3V only. RC522 SDA is SPI chip select, not I²C SDA.

## Firmware prerequisites

Open hardware/esp32-rfid/esp32-rfid.ino in Arduino IDE.

Install:
- ESP32 board support (Arduino-ESP32)
- MFRC522 by Miguel Balboa

Set WIFI_SSID and WIFI_PASSWORD for a 2.4 GHz network.

### TLS certificate is a deliberate setup gate

The firmware uses certificate-verified HTTPS and does not call setInsecure(). ROOT_CA_CERT is intentionally empty in the committed template. Before sending a pairing code or device token, paste the trusted root CA PEM that validates the current daredevils-eye.karanjoykundu.workers.dev certificate chain into that constant. The firmware stops with TLS_CA_NOT_CONFIGURED until this is done. Do not bypass this check: the device token must not travel over unverified TLS.

## Pairing and first run

1. Deploy the Worker changes, including the RFIDDirectory Durable Object migration.
2. Sign into Daredevil's Eye and open /medicine/.
3. Generate a pairing code.
4. Open the ESP32 Serial Monitor at 115200 baud.
5. The firmware connects to Wi-Fi, validates /api/health, then prompts for the six-digit code.
6. Enter the code. The device token is stored in ESP32 NVS (Preferences); it is not printed.
7. Scan a registered card. The current firmware maps:
   - A1618C04 → Napa One
   - 1474D505 → Monus 10

To pair again after revocation or a token loss, erase the ESP32 Preferences namespace de-rfid or clear the token and deviceId values with a small Preferences sketch, then generate a new pairing code.

## App-wide announcements

On /medicine/, enable Medicine announcements. The setting is stored in this browser and the shared listener is started by site-nav.js on app pages. It polls every three seconds while the page is visible, then speaks the exact registered medicine name using the current speech language. It acknowledges the event after speech completes.

The first version requires the app to remain open in a foreground page. Browser background timers, Android battery management, closed tabs, and screen-locked behavior are not guaranteed. Push notification / background delivery is a later stage.

## Verification boundary

Automated tests cover pairing, token authentication, account-scoped event polling, duplicate event IDs, acknowledgements, revocation, the setup page, and the firmware's TLS safety gate.

A successful Worker deployment does not prove:
- RC522 wiring and physical card reads
- Wi-Fi credentials and reconnect behavior
- The correct root CA PEM on the ESP32
- Android speech output / Bangla voice availability
- Background or screen-locked announcements

Record each hardware stage's serial output before moving to the next one.
