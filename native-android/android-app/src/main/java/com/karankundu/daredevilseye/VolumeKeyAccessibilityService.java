package com.karankundu.daredevilseye;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

public class VolumeKeyAccessibilityService extends AccessibilityService {
    public static final String ACTION_VOLUME_ACTION = "com.karankundu.daredevilseye.VOLUME_ACTION";
    public static final String PREFS = "dee_volume_controls";
    public static final String KEY_PENDING_ACTION = "pending_action";
    private static final String CHANNEL_ID = "dee_volume_shortcuts";
    private static final long DOUBLE_PRESS_MS = 360L;
    private static final long SOS_HOLD_MS = 700L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean upDown, downDown, chordConsumed;
    private boolean upPending;
    private long lastUpRelease;
    private Runnable describeRunnable, sosRunnable;

    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() {}

    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        if (event == null) return false;
        final int key = event.getKeyCode();
        if (key != KeyEvent.KEYCODE_VOLUME_UP && key != KeyEvent.KEYCODE_VOLUME_DOWN) return false;
        if (event.getRepeatCount() > 0) return true;

        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            if (key == KeyEvent.KEYCODE_VOLUME_UP) upDown = true;
            if (key == KeyEvent.KEYCODE_VOLUME_DOWN) downDown = true;
            if (upDown && downDown && !chordConsumed) {
                cancelDescribe();
                chordConsumed = true;
                sosRunnable = () -> dispatch("sos");
                handler.postDelayed(sosRunnable, SOS_HOLD_MS);
            }
            return true;
        }

        if (event.getAction() == KeyEvent.ACTION_UP) {
            if (key == KeyEvent.KEYCODE_VOLUME_UP) {
                upDown = false;
                if (!chordConsumed) {
                    long now = System.currentTimeMillis();
                    if (upPending && now - lastUpRelease <= DOUBLE_PRESS_MS) {
                        cancelDescribe();
                        upPending = false;
                        dispatch("repeat");
                    } else {
                        cancelDescribe();
                        upPending = true;
                        lastUpRelease = now;
                        describeRunnable = () -> {
                            if (upPending && !chordConsumed) dispatch("describe");
                            upPending = false;
                        };
                        handler.postDelayed(describeRunnable, DOUBLE_PRESS_MS);
                    }
                }
            } else {
                downDown = false;
                if (!chordConsumed) dispatch("ask");
            }
            if (!upDown && !downDown) {
                if (sosRunnable != null) handler.removeCallbacks(sosRunnable);
                sosRunnable = null;
                chordConsumed = false;
            }
            return true;
        }
        return true;
    }

    private void cancelDescribe() {
        if (describeRunnable != null) handler.removeCallbacks(describeRunnable);
        describeRunnable = null;
    }

    private void dispatch(String action) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString(KEY_PENDING_ACTION, action)
            .putLong("pending_at", System.currentTimeMillis()).apply();

        Intent broadcast = new Intent(ACTION_VOLUME_ACTION);
        broadcast.setPackage(getPackageName());
        broadcast.putExtra("action", action);
        sendBroadcast(broadcast);

        showActionNotification(action);
    }

    private void showActionNotification(String action) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Blind mode button shortcuts", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Shows when a hardware volume-button shortcut needs the app.");
            manager.createNotificationChannel(channel);
        }
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) return;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("dee_volume_action", action);
        PendingIntent pending = PendingIntent.getActivity(this, action.hashCode(), launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String label;
        switch (action) {
            case "describe": label = "Describe is ready"; break;
            case "ask": label = "Ask AI is ready"; break;
            case "repeat": label = "Repeat last answer"; break;
            default: label = "SOS requested — open to confirm"; break;
        }
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Daredevil's Eye")
            .setContentText(label + ". Tap to continue.")
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_RECOMMENDATION)
            .build();
        manager.notify(41, notification);
    }
}
