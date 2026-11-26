package com.karankundu.daredevilseye;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VolumeControls")
public class VolumeControlsPlugin extends Plugin {
    private BroadcastReceiver receiver;

    @Override
    public void load() {
        super.load();
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                String action = intent == null ? "" : intent.getStringExtra("action");
                if (action == null || action.isEmpty()) return;
                JSObject payload = new JSObject();
                payload.put("action", action);
                notifyListeners("volumeAction", payload);
            }
        };
        IntentFilter filter = new IntentFilter(VolumeKeyAccessibilityService.ACTION_VOLUME_ACTION);
        ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @PluginMethod
    public void getPendingAction(PluginCall call) {
        String action = getContext().getSharedPreferences(VolumeKeyAccessibilityService.PREFS, Context.MODE_PRIVATE)
            .getString(VolumeKeyAccessibilityService.KEY_PENDING_ACTION, "");
        JSObject result = new JSObject();
        result.put("action", action == null ? "" : action);
        if (action != null && !action.isEmpty()) {
            getContext().getSharedPreferences(VolumeKeyAccessibilityService.PREFS, Context.MODE_PRIVATE)
                .edit().remove(VolumeKeyAccessibilityService.KEY_PENDING_ACTION).apply();
        }
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void isAccessibilityEnabled(PluginCall call) {
        String expected = getContext().getPackageName() + "/" + VolumeKeyAccessibilityService.class.getName();
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        JSObject result = new JSObject();
        result.put("enabled", !TextUtils.isEmpty(enabled) && enabled.toLowerCase().contains(expected.toLowerCase()));
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            receiver = null;
        }
        super.handleOnDestroy();
    }
}
