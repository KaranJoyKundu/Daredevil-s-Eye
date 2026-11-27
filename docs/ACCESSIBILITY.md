# Accessibility notes

Daredevil's Eye is an experimental audio-first interface. It is not accessibility-certified and must not replace a white cane, guide dog, orientation and mobility training, or human assistance.

## Blind mode

- The four main touch targets are DESCRIBE, ASK AI, SOS and REPEAT.
- SPOKEN HELP is a separate full-width control below the four-action grid. It reads the basic instructions aloud; it is not a text-based Help overlay or one of the four primary actions.
- Blind mode has no brand header, navigation menu or on-screen exit control. Leaving it requires editing the URL to remove /blind/ or opening /action/.
- All primary actions are native buttons with accessible names. Status and response regions use live-region semantics.
- Current white-on-solid-background colour pairs are approximately 6.85:1 or higher by WCAG relative-luminance calculation, exceeding the 4.5:1 normal-text target. This is a source-colour calculation, not a full rendered-screen audit.
- Manual SOS requires two taps within five seconds. Optional shake SOS requires three strong, separate motion peaks and an eight-second cancellation countdown. Optional voice SOS requires “Daredevil SOS” followed by “Confirm SOS”; a five-second countdown then allows “Cancel SOS” or the visible cancellation control. Both triggers are disabled by default, configured in Admin and operate only while Blind mode is visible.
- Voice SOS uses continuous browser speech recognition only after explicit opt-in and microphone permission. The browser's recognition provider may process audio externally. Shake readings are processed locally.
- Repeat speaks the most recent answer held in the current page session.

## Voice input and output

- Microphone access requires HTTPS or localhost.
- Recommended Automatic mode records a short clip and sends it to the Worker/Gemini transcription path for language identification and transcription. It is intended to support Bangladeshi Bengali, English and mixed Bangla-English.
- Browser-first mode is optional. It uses a separately selected locale and switches to Gemini if the service fails, language support is missing, or no speech is returned.
- Audio is externally processed in Automatic mode and may be externally processed in browser-first fallback mode. Do not speak passwords or confidential information.
- For Bengali answers, the app prefers an installed bn-BD or other bn-* device voice. On Android it asks for bn-BD even when Chrome does not list one. On desktops with no Bengali voice (for example Windows), it uses the Gemini cloud voice through `/api/speech`. If both fail, install Bengali text-to-speech data on the device.
- The English / বাংলা switch changes the visible text, the accessible labels and the spoken messages together. The switch message is spoken in the newly chosen language.
- Each photo capture plays one short shutter click, so the user knows the photo was taken.
- Speech input quality, Bengali translation, mixed-language recognition, voice-SOS phrase accuracy and pronunciation have not yet been confirmed on the target Android device.
- Three-shake sensitivity, false-positive resistance and voice-SOS reliability require real-phone evaluation. Do not rely on either automatic trigger as the only way to call for help.

## Additional support

- Haptic patterns distinguish Describe, Ask, SOS, Repeat and Help where vibration is supported.
- The page requests a screen wake lock while camera/AI/SOS actions run, when the browser supports it. It releases the lock when the action completes; the operating system may still suspend the page.
- Camera capture can take up to three frames spaced 250 ms apart and selects the sharpest frame using a small-image Laplacian-variance estimate.
- Spoken error messages identify common camera, connection, timeout, quota and microphone failures.
- The app provides an informational privacy notice. Do not reintroduce a blocking consent popup, Accept button, checkbox or photo-history opt-in toggle. Spoken safety feedback, where present, is separate from privacy controls.

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


## Android 16 / Samsung Galaxy target

The first handset validation target is Galaxy A55 5G on Android 16 / One UI 8. Test both the browser/PWA and the native Capacitor Android companion as separate clients. Use current Chrome for the browser baseline, then repeat on Samsung Internet to identify browser-specific differences.

- Microphone, speech recognition and speech synthesis must be tested independently. An API being present does not prove that the device's speech service is installed, reachable or accurate.
- Bengali TTS is considered available only when the browser reports an installed `bn` voice and a human listener confirms pronunciation. A voice-list entry alone is not acceptance.
- Device motion must be explicitly tested on the handset. Do not infer sensor reliability from desktop simulation or unit tests.
- Keep optional automatic SOS triggers foreground-only. Do not claim they work with the screen locked or while Android suspends the browser.
- Use the Diagnostics phone report to record browser, OS (when exposed), recording formats, Bengali voices and API availability. It does not upload the report.


## Native Android companion — Galaxy A55

The native companion is implemented in the repository with Capacitor and native Android code; a CI-built debug APK exists. Physical Galaxy A55 acceptance remains outstanding. The approved physical controls are Volume Up = Describe, Volume Down = Ask AI, double Volume Up = Repeat, and holding both = open SOS confirmation. Single Volume Up is delayed briefly so it can be distinguished from a double press.

Global controls require the user to explicitly enable Daredevil's Eye in Android Accessibility settings. The service is designed to observe volume-key events only; it must not inspect other apps' screen contents. Verify the actual manifest/service configuration and TalkBack coexistence on the handset before claiming compatibility. Android accessibility key filtering may conflict with TalkBack or another service that filters key events. This must be tested, not assumed.

The strongest supported background behaviour is best-effort: store a pending action, surface a notification and resume the app when Android allows it. Android background-start restrictions and foreground-service rules can prevent immediate camera or microphone use while locked. Phone-camera capture and microphone recording are not promised with the display off. SOS always requires confirmation and backend acknowledgement before the UI may say it was sent.

See [Native Android app master plan](ANDROID.md) for the release checklist and device-test matrix.
