# Implementation status

Updated for branch feat/blind-spoken-help-bangla-controls. Items described as implemented are source changes; they are not proof of physical-device usability.

## Production baseline on main

- Public Cloudflare Worker site and Gemini image-analysis API.
- ESP32-CAM /capture and phone image upload fallback.
- Standard home page, Admin, Diagnostics, consent and paired SOS receiver.
- Blind-mode foundation, Gemini audio transcription fallback, model selection/fallback and session-only personal API key.
- Current public URL: https://daredevils-eye.karanjoykundu.workers.dev/

## Added in this feature branch

- Blind mode now has four main controls: DESCRIBE, ASK AI, SOS and REPEAT. SPOKEN HELP is separate and reads instructions aloud.
- Microphone Automatic mode uses Gemini audio transcription to identify Bangla, English and mixed speech. Browser recognition remains available as an option; no-speech and service/language failures switch to Gemini.
- Admin separates AI response language from browser recognition language and input mode.
- Speech synthesis prefers an installed Bengali voice for Bengali-script answers and reports whether a Bengali voice is installed.
- Spoken error feedback, one-time first-use safety disclaimer, distinct vibration patterns and action-scoped screen wake lock where supported.
- Manual SOS uses two-step confirmation; deep-link SOS only pre-arms an explicit confirmation. Optional three-shake SOS and opt-in voice SOS (wake phrase + confirmation + cancellation countdown) are implemented for visible Blind mode only.
- URL actions for Describe, Ask, SOS, Repeat and Help; Android home-screen shortcuts.
- Up to three camera frames are captured 250 ms apart and the sharpest scored frame is selected.
- Updated Help, README, accessibility notes, roadmap and phone-control instructions.
- Added a blank ten-scene scorecard template. No real-world scene results are claimed.

## Automated verification

Latest GitHub Actions run on commit 9c68fcf: 55 tests passed, 0 failed, and the JavaScript syntax check passed. The production deployment job was skipped for this pull request. These automated tests do not verify real phone sensor thresholds, voice recognition accuracy, Gemini quota or Bengali TTS behavior.

## Requires physical testing

- Bangla, English and mixed-language recognition on the actual Android phone.
- Bengali text-to-speech voice availability and pronunciation on the actual phone.
- TalkBack navigation, haptic feedback and large-target usability.
- Shake sensor thresholds, false-positive rate and Bangla/English voice wake and confirmation phrase accuracy on the target Android phone.
- Camera LAN reachability, three-frame selection, latency and motion-blur quality on the actual ESP32-CAM.
- Volume-key macros with the screen on and locked; Bluetooth headset controls.
- Two-device SOS and locked-screen delivery behavior.
- Supervised feedback sessions with blind and low-vision participants.

## Not implemented / deferred

- Native Android wrapper or Accessibility Service for direct volume-key interception. Browser shake and voice triggers are not reliable when the phone is locked or the page is backgrounded.
- Bluetooth Media Session button mapping; browser behavior is device-specific and not reliable enough to claim.
- Cloudflare Durable Object rate limiting. There is no server-side per-device 10-requests/minute throttle yet; an in-isolate counter would not be a dependable security boundary.
- Email OTP, guest trial counter, profiles, per-user usage database and admin usage dashboard (future roadmap phase).
- Read Text / Find Object specialist modes, local low-light warnings, admin prompt history and second AI provider.
- Formal accessibility audit, safety certification or independent security review.
