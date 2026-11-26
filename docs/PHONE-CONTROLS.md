# Android phone controls

This guide distinguishes the **web/PWA controls** from the **native Capacitor Android controls**. They are not interchangeable. A browser page cannot reliably intercept hardware volume keys; the native companion includes Android-side key handling, but the target handset still needs physical validation.

## Native Android volume-button mapping

The approved mapping for the native companion is:

| Physical input | Intended action | Important behaviour |
|---|---|---|
| One Volume Up | Describe | Waits briefly so a double press is not misread as two Describe actions |
| One Volume Down | Ask AI | Requests microphone permission when required |
| Double Volume Up | Repeat | Must not also trigger Describe |
| Hold Volume Up + Volume Down | SOS confirmation | Opens confirmation; holding the keys alone must never send an alert |

The native Activity handles foreground key events. Global handling uses an optional Accessibility Service that the user must explicitly enable in Android Settings. The service is intended to observe volume-key events only; it is not permission to read other apps' screen contents.

### First-use setup and testing

1. Install the current debug APK from the Android build workflow artifact linked in [Native Android status](NATIVE-ANDROID-APP.md). It is a test build, not a permanent signed release.
2. Open the app while online. The first wrapper loads the production HTTPS app, so cloud AI requires an internet connection.
3. Test the four mappings with the app in the foreground. Verify the visible and spoken feedback for every action.
4. Open the in-app Documentation page and review the volume-shortcut settings.
5. If you want global shortcuts, read the explanation and enable the Daredevil's Eye Accessibility Service manually in Android Settings. Do not enable it if you are uncomfortable granting this capability.
6. Test with the app foregrounded, another app foregrounded, screen locked and display off as separate cases.
7. Repeat with TalkBack on and off. Check normal volume adjustment when global shortcuts are disabled.
8. Record misses, duplicate actions, latency and accidental SOS attempts. Do not tune timing based on a single successful press.

**Target:** Samsung Galaxy A55 5G · Android 16 · One UI 8. The implementation has not yet been accepted through a complete physical-device test matrix. CI build success is not device validation.

## Web/PWA action URLs

These routes are available to browser/automation integrations:

- Describe: https://daredevils-eye.karanjoykundu.workers.dev/blind/?action=describe
- Ask AI: https://daredevils-eye.karanjoykundu.workers.dev/blind/?action=ask
- SOS (confirmation only): https://daredevils-eye.karanjoykundu.workers.dev/blind/?action=sos

A URL shortcut is not a hardware-key listener. Opening the SOS URL may arm a confirmation flow, but must not dispatch an alert by itself. Some browsers require an additional user tap before microphone access or an action can start.

## MacroDroid / Tasker (web fallback)

If using the browser/PWA rather than the native app:

1. Create a macro that detects a chosen multi-press volume gesture.
2. Configure it to open the corresponding URL above.
3. Test with the screen unlocked first.
4. Verify the correct action starts and that SOS requires its separate confirmation.
5. Only then test locked-screen behaviour; vendor restrictions, permissions and battery settings may block it.

These automation apps are independent third-party integrations. Their triggers and background behaviour vary by Android version and device. Do not run overlapping macros and native shortcuts for the same gesture unless you have tested arbitration.

## Optional browser SOS triggers

Admin includes optional shake and voice SOS triggers. They are disabled by default and only operate while Blind mode is open and visible:

- **Shake SOS:** requires explicit motion permission and uses a multi-shake pattern followed by a cancellation countdown.
- **Voice SOS:** requires explicit microphone permission and a wake phrase followed by a separate confirmation and cancellation window.

Recognition may use an external browser speech service. Neither trigger is a reliable locked-screen or background emergency mechanism. Keep ordinary emergency options available.

## Web-app home-screen shortcuts

1. Open the live site in Chrome on Android.
2. Choose **Install app** or **Add to Home screen**.
3. Launch the installed web app.
4. Long-press its icon and use Describe, Ask AI or SOS if the launcher exposes shortcuts.
5. Confirm labels and the SOS confirmation step with TalkBack.

Launcher and browser support varies. These shortcuts open URLs; they do not provide native volume-key interception.

## Android limitations and safety

- Global volume-key handling requires explicit Accessibility Service enablement and may conflict with TalkBack or another key-filtering service.
- Android may prevent starting camera/microphone work from the background or while locked.
- Doze, battery optimisation, process death, permission revocation and Samsung-specific background rules can delay or stop actions.
- A queued event or notification is not proof an action ran. SOS must not be described as sent until the backend confirms the dispatch step.
- The receiver must be paired and online; push delivery is best-effort and not guaranteed.
- SOS does not call emergency services.

See [Native Android master plan](NATIVE-ANDROID-APP.md), [Accessibility](ACCESSIBILITY.md), [Safety](SAFETY.md) and [Current release checklist](CURRENT-RELEASE-CHECKLIST.md).
