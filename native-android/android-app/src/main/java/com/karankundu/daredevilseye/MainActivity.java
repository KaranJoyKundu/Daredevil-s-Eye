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
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 8401);
        }
        dispatchPendingAction();
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
    }

    private void showAccessibilitySetupOnce() {
        SharedPreferences prefs = getSharedPreferences("dee_native_setup", MODE_PRIVATE);
        if (prefs.getBoolean("accessibility_prompt_shown", false)) return;
        prefs.edit().putBoolean("accessibility_prompt_shown", true).apply();
        new AlertDialog.Builder(this)
            .setTitle("Enable volume-button shortcuts?")
            .setMessage("Optional: enable Daredevil's Eye in Android Accessibility settings to use the volume buttons while another app is open. The service only observes Volume Up and Volume Down. It does not read screen content. TalkBack compatibility must be tested on this phone.")
            .setPositiveButton("Open settings", (dialog, which) -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)))
            .setNegativeButton("Not now", null)
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
}
