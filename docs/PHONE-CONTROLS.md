# Android phone controls

This page describes integrations that can be tried with the Android phone. The website itself does not receive Android volume-key events reliably. Do not assume a macro works while the phone is locked or another app is in the foreground until it is tested on that device.

## Action URLs

- Describe: https://daredevils-eye.karanjoykundu.workers.dev/blind/?action=describe
- Ask AI: https://daredevils-eye.karanjoykundu.workers.dev/blind/?action=ask
- SOS (confirmation only): https://daredevils-eye.karanjoykundu.workers.dev/blind/?action=sos

Opening the Describe URL starts a Describe action after privacy consent has already been accepted. Opening Ask requests microphone access and starts the configured voice-input mode; some browsers may require a tap on the Ask AI button instead. Opening the SOS URL only arms a 30-second confirmation window. The user must then tap SOS in the app; opening the URL never sends an alert by itself.

## MacroDroid / Tasker volume-button macros

1. Install MacroDroid or Tasker from the Play Store and grant only the permissions needed for the volume-button trigger and opening a URL.
2. Create a macro that listens for three Volume Up presses in quick succession. If your version cannot count presses directly, use a short-lived counter or a multi-press trigger.
3. Set its action to Open Website / Browse URL and paste the Describe URL above.
4. Create a second macro for three Volume Down presses and use the Ask AI URL.
5. Test with the screen unlocked first. Confirm the phone launches the page, the correct action starts, the microphone permission prompt works, and no accidental SOS is sent.
6. Test with the screen locked only after the unlocked flow is reliable. Android versions, device vendors, battery optimisation and macro permissions can prevent or delay locked-screen triggers.

The app can react to the query string after the browser opens it. It cannot itself capture the hardware volume-key sequence from an ordinary Android Chrome page. MacroDroid or Tasker must recognise the physical button events.

## Built-in optional SOS triggers

Admin also offers two browser-based triggers. Both are off by default and only run while `/blind/` is open and visible:

- **Shake SOS:** in Admin, tick Enable three-shake SOS and press Request motion access & enable. Three strong, separated motion peaks within roughly 2.6 seconds start an eight-second countdown. Tap Cancel SOS or, when voice SOS is also enabled, say Cancel SOS. Sensor values are processed locally; sensitivity varies by handset.
- **Voice SOS:** in Admin, tick Enable voice SOS phrase, choose Bengali or English recognition and press Grant microphone access & enable. In Blind mode say “Daredevil SOS”, then say “Confirm SOS” within twelve seconds. A five-second countdown follows; say “Cancel SOS” or tap Cancel SOS to stop it. In Bangla recognition, try “ডেয়ারডেভিল এসওএস”, then “নিশ্চিত করুন”. Voice recognition uses the browser's recognition provider and may process audio externally.

Neither trigger is guaranteed to work when the phone is locked, the page is hidden, Android suspends the browser, or the phone lacks the required sensor / speech service. Keep normal emergency options available.

## Home-screen app shortcuts

1. Open the live website in Chrome on Android and visit Blind mode.
2. From Chrome's menu, choose Install app or Add to Home screen (wording depends on the device).
3. Launch the installed app and long-press its home-screen icon.
4. When the launcher supports web-app shortcuts, use Describe, Ask AI or SOS.
5. Use TalkBack to confirm each shortcut's spoken label and the confirmation step.

The web manifest declares these three shortcuts. Launcher and browser support varies. A shortcut opens the matching URL; the SOS shortcut requires a separate in-app confirmation tap.

## Not included yet

- Native Android volume-key handling is now under implementation in the Capacitor companion. See [Native Android app plan](NATIVE-ANDROID-APP.md).
- A native Accessibility Service for global shortcuts is being implemented; locked-screen delivery is not yet verified on the Galaxy A55.
- Bluetooth earbud play/pause/next/previous mappings. Media Session behavior varies and is not dependable enough to enable as an emergency control.

A native Android wrapper can be planned later if these web integrations prove too unreliable. The web app's SOS is a best-effort paired-device alert, not emergency-service dispatch.


## Android 16 / Samsung Galaxy validation profile

The first reference handset for this project is the **Samsung Galaxy A55 5G**, with Android 16 / One UI 8 as the baseline target. The implementation remains browser-based and should degrade gracefully on other Android 16 Samsung Galaxy models; it does not assume that every model, carrier firmware or browser exposes identical APIs.

Recommended first-pass setup on the A55:

1. Open the HTTPS site in an up-to-date **Chrome for Android** first. Samsung Internet may be tested separately; do not assume browser speech recognition behaves identically between them.
2. Open `/diagnostics/`, run **Check this phone**, then **Test motion sensor**. Save or share the report only if you are comfortable sharing the browser user-agent string; the report is generated locally.
3. When prompted, allow the site's microphone permission. In Chrome, review it under **⋮ → Settings → Site settings → Microphone**. Also confirm Android's system-wide microphone access is not disabled.
4. In Samsung Settings, open **General management → Text-to-speech output** (labels can vary by One UI version). Check the preferred engine and install/download Bengali voice data if available. Return to Admin, refresh the installed-voice list, and play the Bengali sample.
5. Keep the browser in the foreground while testing voice SOS and shake SOS. Android restricts background access to microphone and continuous sensor data; a browser page cannot promise reliable locked-screen or background SOS.
6. Test with the phone unlocked before trying home-screen installation. Install the PWA only after the browser tests pass.

The phone check reports the model and Android version only when the browser exposes them. Samsung firmware and rollout timing vary by exact model code, country and carrier. Confirm the actual OS in **Settings → About phone → Software information**. A successful motion reading is not evidence that shake SOS has safe sensitivity; that requires supervised tuning and false-positive testing.


## Native Android companion — implementation in progress

The owner approved a native Capacitor Android app for the Galaxy A55. The agreed mapping is:

- **One Volume Up:** Describe (single press waits briefly to distinguish a double press).
- **One Volume Down:** Ask AI.
- **Double Volume Up:** Repeat the last answer.
- **Hold Volume Up + Volume Down:** open the SOS confirmation flow. Holding the keys does not send an alert by itself.

The Android Activity handles keys while the app is open. An optional Accessibility Service is being added for global key handling and must be enabled manually in Android Settings. It observes only the two volume keys and does not read screen contents. Compatibility with TalkBack and other key-filtering services must be tested.

When a key event arrives while the app cannot safely perform the action, the native layer stores a pending action and can show a notification asking the user to reopen/unlock the app. Android may block camera or microphone startup from the background. Screen-off camera, microphone and SOS behaviour are not guaranteed. A notification or queued event is not proof an SOS was sent.

The first wrapper loads the existing HTTPS Worker app to preserve same-origin API routes and session cookies. It therefore requires internet access for cloud AI. A signed APK is planned through GitHub Releases; Play Store distribution is later. Track progress in the in-app [Documentation page](/documentation/) and the full [master plan](NATIVE-ANDROID-APP.md).
