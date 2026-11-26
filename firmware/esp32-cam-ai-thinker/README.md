# ESP32-CAM AI Thinker firmware for Daredevil's Eye

This is the firmware source for the ESP32-CAM AI Thinker board paired with Daredevil's Eye.

## Setup

1. Open `CameraWebServer/CameraWebServer.ino` in Arduino IDE.
2. Copy `wifi_secrets.example.h` to `wifi_secrets.h` in the same sketch folder.
3. Enter your local 2.4 GHz Wi-Fi SSID and password in `wifi_secrets.h`. This file is Git-ignored; never commit it.
4. Install the Espressif ESP32 Arduino board package and select **AI Thinker ESP32-CAM**.
5. Select a partition scheme with at least 3 MB application space. The included `partitions.csv` is a custom layout for a 4 MB flash device; select a matching custom partition scheme if you use it.
6. Upload and open Serial Monitor at 115200 baud. The board prints its IP address after joining Wi-Fi.

## Endpoints

The camera control server listens on port 80 and the MJPEG stream server on port 81.

| URL path | Purpose |
| --- | --- |
| `/capture` | Capture a JPEG without forcing the flash on |
| `/capture-flash` | Briefly illuminate the flash, capture a JPEG, then restore the previous LED setting |
| `/control?var=led_intensity&val=0` | Turn the flash off |
| `/control?var=led_intensity&val=255` | Set flash intensity to maximum |
| `/status` | Read camera status, including LED intensity |
| `:81/stream` | MJPEG stream |

Use the actual IP printed by the board in Daredevil's Eye camera settings. Keep the phone and ESP32-CAM on the same Wi-Fi network.

## Implementation notes

- Flash is kept off at boot.
- LED intensity values are clamped to 0–255.
- Flash capture restores the previously configured LED intensity, including the off state.
- Existing simple GET handlers include permissive CORS response headers. Chrome may still ask for Local Network Access permission when an HTTPS page contacts the local HTTP camera.
- The flash LED draws significant current. Use a stable supply and test the camera before relying on it.

## Source and validation

The camera web UI and pin mapping are from Espressif's Arduino ESP32 CameraWebServer example. The capture routes and Daredevil's Eye-specific Wi-Fi setup are maintained here. This source upload has not yet been compiled or flashed on the target board; do that validation before using it in a demo or release.
