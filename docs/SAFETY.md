# Safety and privacy

- This is an experimental assistive-vision prototype, not a certified navigation aid, medical device or emergency-dispatch service.
- Never claim that a path, obstacle or road crossing is safe.
- Never invent distances, directions or measurements.
- Keep descriptions factual, concise and uncertainty-aware.
- Do not identify people or infer sensitive personal traits.
- Camera images are sent to Gemini for analysis. In the default voice mode, a short voice recording is sent to Gemini for transcription. On desktops without a Bengali voice, the answer text is sent to Gemini to be spoken.
- Users can replace the scene instructions with their own system prompt or a preset (for example Medicine or Taka). `SAFETY_CORE` is always added. Medicine and money answers are best guesses: check them with a person or the label before acting on them.
- Browser speech recognition may also send audio to the browser vendor's recognition service.
- Personal Gemini keys are sent to the same-origin Worker in a request header and kept only in the current browser tab's session storage. Never share a screenshot containing a key.
- App code does not intentionally retain image/audio payloads, but providers process requests under their own terms.
- Manual SOS requires a deliberate two-tap action. Optional shake SOS requires three strong, separated motion peaks and an eight-second cancellation countdown. Optional voice SOS requires a distinctive wake phrase and a separate spoken confirmation, followed by a five-second cancellation countdown. Both automatic triggers are off by default and only run while the Blind mode page is visible.
- Shake sensor readings are processed locally. Opt-in continuous voice SOS uses the browser's speech-recognition provider, which may process audio externally; the app does not intentionally store its audio. Disable the feature in Admin to stop microphone monitoring.
- The trusted receiver must be paired, open, online and able to play audio. Alert delivery is not guaranteed.
- SOS is not fall detection, ambulance dispatch or a replacement for emergency services.
- Continue using a white cane, guide dog, mobility training and human assistance.
- Before email signup and IP-based usage tracking are introduced, document legal basis, purpose, data minimisation, retention, deletion and user access.
