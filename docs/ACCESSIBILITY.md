# Accessibility notes

Daredevil's Eye explores audio-first interactions for blind and low-vision users. It is not accessibility-certified.

## Current design decisions

- Four large, labelled primary actions.
- Text status regions intended for screen-reader announcements.
- Native buttons, links, inputs and forms.
- Spoken response with repeat and stop actions.
- Typed question fallback when speech input is unavailable.
- Visible diagnostic output for camera, microphone, AI and speech.

## Required evaluation

- Test NVDA on Windows and TalkBack on Android; VoiceOver evaluation is also desirable.
- Confirm heading order, focus order, visible focus, names/roles/values and error announcements.
- Verify icons have accessible labels.
- Test zoom, large text, touch-target sizes and keyboard operation.
- Ensure SOS cannot be activated accidentally and status/acknowledgement is spoken clearly.
- Test English and Bengali transcript display and pronunciation.
- Conduct supervised formative testing with blind/low-vision participants before claiming usability.

## Limitations

Speech recognition, synthesis, microphone permissions and background audio depend on browser, device and operating system. A browser may stop listening or sounding an alarm while suspended or locked.
