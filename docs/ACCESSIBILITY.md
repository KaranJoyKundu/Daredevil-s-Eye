# Accessibility notes

Daredevil's Eye is an experimental audio-first interface. It is not accessibility-certified. It must not be used as a substitute for established mobility aids.

## Interface decisions

- Standard Home provides four large labelled actions.
- Blind mode is served at `/blind/` and uses four full-screen tiles in a 2×2 grid: DESCRIBE, ASK AI, SOS and HELP.
- Blind mode omits the shared brand bar, hamburger menu and any on-screen exit control. Leaving it requires editing the URL to remove `/blind/` or opening `/action/`.
- The Help tile opens an overlay with a return-to-four-actions link.
- Standard pages use a shared keyboard-accessible navigation menu; the Daredevil's Eye brand link returns to Home.
- Native buttons, links, labels, form controls and live regions are used for key interactions.
- The written answer is revealed progressively while speech starts, rather than appearing as a single block.
- Typed-question fallback remains on the standard Home page.

## Voice input

- Microphone access requires HTTPS or localhost.
- Native browser speech recognition is attempted first.
- If it is missing or reports network/service/language availability errors, the app records a short clip and sends it to Gemini for language-aware transcription.
- Bengali-language speech is instructed to translate into English; English speech is preserved even with a Bangladeshi accent. This is not guaranteed until tested with speakers.
- Audio recording is a privacy-relevant fallback; users must be informed before use.

## Required evaluation

- Test TalkBack on Android and NVDA on Windows; VoiceOver is also desirable.
- Verify heading order, focus order, visible focus, names/roles/values and live-region announcements.
- Confirm all four Blind mode controls can be activated by keyboard and assistive technology.
- Ensure the Help overlay can be opened/closed with keyboard and focus is sensible.
- Test touch targets, one-handed use, zoom, large text and screen orientation.
- Test the SOS control with deliberate confirmation and clear status announcements.
- Test English, Bangla and mixed-language voice input, transcript timing and pronunciation.
- Run supervised formative testing with blind/low-vision participants before claiming usability.

## Limitations

Browser speech recognition, audio recording, synthesis, microphone permission and background playback depend on the browser, device and operating system. A browser tab may be suspended or stopped when the phone is locked.
