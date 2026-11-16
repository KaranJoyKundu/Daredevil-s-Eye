# Accessibility notes

Daredevil's Eye is an experimental audio-first interface. It is not accessibility-certified and must not replace a white cane, guide dog, orientation and mobility training, or human assistance.

## Blind mode

- The four main touch targets are DESCRIBE, ASK AI, SOS and REPEAT.
- SPOKEN HELP is a separate full-width control below the four-action grid. It reads the basic instructions aloud; it is not a text-based Help overlay or one of the four primary actions.
- Blind mode has no brand header, navigation menu or on-screen exit control. Leaving it requires editing the URL to remove /blind/ or opening /action/.
- All primary actions are native buttons with accessible names. Status and response regions use live-region semantics.
- Current white-on-solid-background colour pairs are approximately 6.85:1 or higher by WCAG relative-luminance calculation, exceeding the 4.5:1 normal-text target. This is a source-colour calculation, not a full rendered-screen audit.
- SOS requires two taps within five seconds in the normal interface. A URL shortcut only pre-arms SOS for a confirmation tap and never sends an alert automatically.
- Repeat speaks the most recent answer held in the current page session.

## Voice input and output

- Microphone access requires HTTPS or localhost.
- Recommended Automatic mode records a short clip and sends it to the Worker/Gemini transcription path for language identification and transcription. It is intended to support Bangladeshi Bengali, English and mixed Bangla-English.
- Browser-first mode is optional. It uses a separately selected locale and switches to Gemini if the service fails, language support is missing, or no speech is returned.
- Audio is externally processed in Automatic mode and may be externally processed in browser-first fallback mode. Do not speak passwords or confidential information.
- For Bengali answers, the speech layer prefers an installed bn-BD or other bn-* device voice. If none is installed, device speech synthesis may pronounce Bengali incorrectly or fail; install Bengali TTS data on the phone.
- Speech input quality, Bengali translation, mixed-language recognition and pronunciation have not yet been confirmed on the target Android device.

## Additional support

- Haptic patterns distinguish Describe, Ask, SOS, Repeat and Help where vibration is supported.
- The page requests a screen wake lock while camera/AI/SOS actions run, when the browser supports it. It releases the lock when the action completes; the operating system may still suspend the page.
- Camera capture can take up to three frames spaced 250 ms apart and selects the sharpest frame using a small-image Laplacian-variance estimate.
- Spoken error messages identify common camera, connection, timeout, quota and microphone failures.
- The first-use safety disclaimer is spoken once after the user accepts consent, when device speech is available.

## Required evaluation

- Test TalkBack on Android and NVDA on Windows; VoiceOver is also desirable.
- Verify focus order, visible focus, names/roles/values and live-region announcements.
- Confirm every control is reachable and usable with TalkBack, keyboard and switch access.
- Test haptic patterns, SOS confirmation timing, repeat behavior and Spoken Help.
- Test Bengali, English and code-switching with Bangladeshi speakers on the actual target phone.
- Confirm an installed Bengali voice is used for Bengali answers and inspect pronunciation.
- Measure three-frame capture latency and verify the sharpest-frame heuristic across sharp, blurred, dark and low-texture scenes.
- Run supervised formative testing with blind and low-vision participants before claiming usability.

## Limitations

Browser speech recognition, microphone permission, synthesis, vibration, wake lock and background execution depend on the device and operating system. A browser tab may be suspended or stopped when the phone is locked. Android volume-key interception is not provided by ordinary web pages; automation apps and device-specific setup are required and must be tested on the actual phone.
