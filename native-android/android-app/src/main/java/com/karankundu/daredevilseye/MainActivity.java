package com.karankundu.daredevilseye;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import android.webkit.WebSettings;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    public static volatile boolean isActivityResumed = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean upDown, downDown, chordConsumed, upPending, sosTriggered;
    private long lastUpRelease;
    private Runnable describeRunnable, sosRunnable;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VolumeControlsPlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebView webView = getBridge().getWebView();
            webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            final int initialLeft = webView.getPaddingLeft();
            final int initialTop = webView.getPaddingTop();
            final int initialRight = webView.getPaddingRight();
            final int initialBottom = webView.getPaddingBottom();
            ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                view.setPadding(initialLeft + bars.left, initialTop + bars.top,
                    initialRight + bars.right, initialBottom + Math.max(bars.bottom, ime.bottom));
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(webView);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 8401);
        }
        dispatchPendingAction();
        handleLauncherShortcut(getIntent());
        showAccessibilitySetupOnce();
    }

    @Override
    public void onResume() {
        super.onResume();
        isActivityResumed = true;
        dispatchPendingAction();
    }

    @Override
    public void onPause() {
        isActivityResumed = false;
        super.onPause();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchPendingAction();
        handleLauncherShortcut(intent);
    }

    private void showAccessibilitySetupOnce() {
        SharedPreferences prefs = getSharedPreferences("dee_native_setup", MODE_PRIVATE);
        if (prefs.getBoolean("accessibility_prompt_shown", false)) return;
        prefs.edit().putBoolean("accessibility_prompt_shown", true).apply();
        new AlertDialog.Builder(this)
            .setTitle("Optional background volume shortcuts")
            .setMessage("Foreground volume shortcuts work while Daredevil's Eye is open. To use them over other apps, Android requires an optional Accessibility Service. On some phones, Android blocks this permission for sideloaded apps. If blocked, open App info > ⋮ > Allow restricted settings, then return to Accessibility > Installed apps > Daredevil's Eye. This permission is never required for the main camera, voice or SOS features.")
            .setPositiveButton("Open app info", (dialog, which) -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            })
            .setNegativeButton("Later", null)
            .show();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int key = event.getKeyCode();
        if (key != KeyEvent.KEYCODE_VOLUME_UP && key != KeyEvent.KEYCODE_VOLUME_DOWN) {
            return super.dispatchKeyEvent(event);
        }
        if (!getSharedPreferences("dee_native_setup", MODE_PRIVATE).getBoolean("foreground_shortcuts_enabled", true)) {
            return super.dispatchKeyEvent(event);
        }
        if (event.getRepeatCount() > 0) return true;
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            if (key == KeyEvent.KEYCODE_VOLUME_UP) upDown = true;
            if (key == KeyEvent.KEYCODE_VOLUME_DOWN) downDown = true;
            if (upDown && downDown && !chordConsumed) {
                cancelDescribe();
                upPending = false;
                chordConsumed = true;
                sosRunnable = () -> { sosTriggered = true; dispatchAction("sos"); };
                handler.postDelayed(sosRunnable, 700L);
            }
            return true;
        }
        if (event.getAction() == KeyEvent.ACTION_UP) {
            if (chordConsumed && !sosTriggered && sosRunnable != null) {
                handler.removeCallbacks(sosRunnable);
                sosRunnable = null;
            }
            if (key == KeyEvent.KEYCODE_VOLUME_UP) {
                upDown = false;
                if (!chordConsumed) {
                    long now = System.currentTimeMillis();
                    if (upPending && now - lastUpRelease <= 360L) {
                        cancelDescribe();
                        upPending = false;
                        dispatchAction("repeat");
                    } else {
                        cancelDescribe();
                        upPending = true;
                        lastUpRelease = now;
                        describeRunnable = () -> {
                            if (upPending && !chordConsumed) dispatchAction("describe");
                            upPending = false;
                        };
                        handler.postDelayed(describeRunnable, 360L);
                    }
                }
            } else {
                downDown = false;
                if (!chordConsumed) dispatchAction("ask");
            }
            if (!upDown && !downDown) {
                if (sosRunnable != null) handler.removeCallbacks(sosRunnable);
                sosRunnable = null;
                chordConsumed = false;
                sosTriggered = false;
            }
            return true;
        }
        return true;
    }

    private void cancelDescribe() {
        if (describeRunnable != null) handler.removeCallbacks(describeRunnable);
        describeRunnable = null;
    }

    private void handleLauncherShortcut(Intent intent) {
        if (intent == null || !intent.hasExtra("dee_shortcut_action")) return;
        String action = intent.getStringExtra("dee_shortcut_action");
        intent.removeExtra("dee_shortcut_action");
        if ("describe".equals(action) || "ask".equals(action) ||
            "repeat".equals(action) || "sos".equals(action)) {
            dispatchAction(action);
        }
    }

    private void dispatchAction(String action) {
        SharedPreferences prefs = getSharedPreferences(VolumeKeyAccessibilityService.PREFS, MODE_PRIVATE);
        String eventId = Long.toString(System.currentTimeMillis()) + "-" + action;
        prefs.edit().putString(VolumeKeyAccessibilityService.KEY_PENDING_ACTION, action)
            .putString("pending_event_id", eventId).putLong("pending_at", System.currentTimeMillis()).apply();
        dispatchToWeb(action, eventId, 0);
    }

    private void dispatchPendingAction() {
        SharedPreferences prefs = getSharedPreferences(VolumeKeyAccessibilityService.PREFS, MODE_PRIVATE);
        String action = prefs.getString(VolumeKeyAccessibilityService.KEY_PENDING_ACTION, "");
        String eventId = prefs.getString("pending_event_id", "");
        if (action == null || action.isEmpty() || eventId == null || eventId.isEmpty()) return;
        dispatchToWeb(action, eventId, 0);
    }

    private void dispatchToWeb(String action, String eventId, int attempt) {
        if (attempt >= 60 || isFinishing()) return;
        handler.postDelayed(() -> {
            SharedPreferences pendingPrefs = getSharedPreferences(VolumeKeyAccessibilityService.PREFS, MODE_PRIVATE);
            if (!eventId.equals(pendingPrefs.getString("pending_event_id", ""))) return;
            try {
                if (getBridge() != null) {
                    JSONObject data = new JSONObject();
                    data.put("action", action);
                    data.put("eventId", eventId);
                    getBridge().triggerJSEvent("deeVolumeAction", "window", data.toString());
                }
            } catch (Exception ignored) {}
            if (attempt < 59) dispatchToWeb(action, eventId, attempt + 1);
            else {
                SharedPreferences prefs = getSharedPreferences(VolumeKeyAccessibilityService.PREFS, MODE_PRIVATE);
                if (eventId.equals(prefs.getString("pending_event_id", ""))) {
                    prefs.edit().remove(VolumeKeyAccessibilityService.KEY_PENDING_ACTION).remove("pending_event_id").apply();
                }
            }
        }, attempt == 0 ? 450L : 500L);
    }
    /** Back follows web history, then returns secondary app routes to the Action page. */
    @Override
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            moveTaskToBack(true);
            return;
        }
        android.webkit.WebView webView = getBridge().getWebView();
        String current = webView.getUrl() == null ? "" : webView.getUrl();
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        android.net.Uri uri = android.net.Uri.parse(current);
        String path = uri.getPath() == null ? "/" : uri.getPath();
        if (!path.equals("/") && !path.equals("/action/")) {
            webView.loadUrl("https://daredevils-eye.karanjoykundu.workers.dev/action/");
            return;
        }
        moveTaskToBack(true);
    }

}