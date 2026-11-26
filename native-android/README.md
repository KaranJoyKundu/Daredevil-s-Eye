# Native Android source overlay

The CI workflow runs Capacitor's Android project generation, syncs the web app, then overlays this directory into the generated `android/app` project.

- `android-app/src/main/AndroidManifest.xml`: application permissions, launcher Activity and Accessibility Service declaration.
- `android-app/src/main/java/.../MainActivity.java`: registers the Capacitor volume plugin.
- `VolumeControlsPlugin.java`: exposes native key events to the web layer and links to Android Accessibility settings.
- `VolumeKeyAccessibilityService.java`: optional global volume key recognizer; user must enable it manually in Android Settings.

The service observes only Volume Up and Volume Down. It does not retrieve window content. Accessibility Service availability, key filtering, screen-off delivery and TalkBack coexistence are device/OS dependent and require A55 testing.
