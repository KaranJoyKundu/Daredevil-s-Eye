# Medicine RFID reader setup

Daredevil's Eye can associate each RFID card UID with an account-owned medicine record and speak a configurable announcement when that card is scanned.

## Current behavior

- Open `/medicine/` while signed in to manage your own medicine cards.
- Register a card by entering its hexadecimal UID, medicine name, strength, expiry month, and prescription instructions.
- Optionally provide a complete custom spoken message and a separate expired-medicine warning.
- The phone's shared RFID listener speaks the server-resolved announcement on app pages while enabled.
- Expiry is checked by the Worker at scan time. Once the expiry date has passed, the expired warning replaces the normal announcement and dosage instructions.
- Medicine records are account-scoped. A reader can resolve only the cards belonging to the account that authorized its device token.
- The ESP32 sends only the card UID and event ID. It contains no hard-coded medicine catalogue; adding or editing medicine records does not require reflashing it.
- Device tokens are generated for the signed-in account and stored as SHA-256 hashes in the Durable Object.
- Events are retained for up to 24 hours; the ESP32 keeps up to five unsent events in Preferences/NVS and retries in order.

## Example announcement

With the fields configured as:

- Medicine: Paracetamol
- Strength: 500 mg
- Expiry month: December 2027
- Instructions: Your registered prescription says one tablet after food.

The generated announcement is similar to:

> Paracetamol. 500 mg. Expiry month: December 2027. Your registered prescription says one tablet after food.

When the expiry date has passed, the default announcement is:

> Warning! This medicine has expired.

A custom spoken message overrides the generated normal announcement. A custom expired message can override the default expired warning.

## Add a medicine card

1. Sign into Daredevil's Eye and open `/medicine/`.
2. Scan the RFID card and copy the UID shown in the ESP32 Serial Monitor.
3. Enter the UID in hexadecimal. Spaces, colons, and hyphens are accepted and normalized.
4. Enter the medicine name; optionally add strength, expiry month, and prescription instructions.
5. Leave the custom announcement blank to use the generated message, or enter the exact text to be spoken.
6. Save. The next scan uses the updated message immediately.

Only add dosage instructions from a verified prescription or healthcare professional. The app reads back the information entered; it does not prescribe or validate a dose.

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

Open `hardware/esp32-rfid/esp32-rfid.ino` in Arduino IDE.

Install:
- ESP32 board support (Arduino-ESP32 core 3.x)
- MFRC522 by Miguel Balboa

Set `WIFI_SSID` and `WIFI_PASSWORD` for a 2.4 GHz network.

The firmware uses the ESP32 Arduino core's built-in trusted CA certificate bundle through `useBuiltinCACertBundle()`. Do not disable TLS certificate verification.

## Authorize the ESP32

1. Sign into Daredevil's Eye and open `/medicine/`.
2. Click **Authorize ESP32 & generate token** and copy the token. It is shown only once.
3. Open the ESP32 Serial Monitor at 115200 baud.
4. Paste the 64-character token when prompted. It is stored in ESP32 NVS and is not printed.
5. Register each physical card UID in the Medicine RFID page. The same ESP32 can read any supported UID length (4, 7, or 10 bytes); the account must have a matching medicine record.
6. Scan a registered card. Changes to its announcement take effect on the next scan without a firmware update.

To authorize again after revocation or token loss, erase the ESP32 Preferences namespace `de-rfid`, then authorize a new device token from `/medicine/`.

## App-wide announcements

Enable **Medicine announcements** on `/medicine/`. The shared listener polls every three seconds while a Daredevil's Eye page is visible and the listener is enabled. It speaks the exact server-generated or user-authored announcement using the current speech language, then acknowledges the event after speech completes.

The first version requires the app to remain open in a foreground page. Background timers, closed tabs, and screen-locked behavior are not guaranteed.

## Verification boundary

Automated tests cover account-scoped medicine records, UID validation, custom announcements, expiry warnings, device authentication, event polling and acknowledgement, and the firmware's TLS safety gate.

A successful Worker deployment does not prove physical RC522 reads, Wi-Fi credentials, Android speech output, or background/screen-locked announcements.
