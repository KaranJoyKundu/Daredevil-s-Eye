package com.karankundu.daredevilseye;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.provider.Settings;
import android.text.TextUtils;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VolumeControls")
public class VolumeControlsPlugin extends Plugin {
    private BroadcastReceiver receiver;

    @Override
    public void load() {
        super.load();
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String action = intent.getStringExtra("action");
                String eventId = intent.getStringExtra("eventId");
                if (action == null || action.isEmpty()) return;
                org.json.JSONObject payload = new org.json.JSONObject();
                try {
                    payload.put("action", action);
                    payload.put("eventId", eventId == null ? "" : eventId);
                    getBridge().triggerJSEvent("deeVolumeAction", "window", payload.toString());
                } catch (Exception ignored) {}
            }
        };
        IntentFilter filter = new IntentFilter(VolumeKeyAccessibilityService.ACTION_VOLUME_ACTION);
        ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }




    @PluginMethod
    public void getPendingAction(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(VolumeKeyAccessibilityService.PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("action", prefs.getString(VolumeKeyAccessibilityService.KEY_PENDING_ACTION, ""));
        result.put("eventId", prefs.getString("pending_event_id", ""));
        call.resolve(result);
    }

    @PluginMethod
    public void ackPendingAction(PluginCall call) {
        String eventId = call.getString("eventId", "");
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(VolumeKeyAccessibilityService.PREFS, Context.MODE_PRIVATE);
        if (!eventId.isEmpty() && eventId.equals(prefs.getString("pending_event_id", ""))) {
            prefs.edit().remove(VolumeKeyAccessibilityService.KEY_PENDING_ACTION).remove("pending_event_id").remove("pending_at").apply();
        }
        call.resolve();
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


    @PluginMethod
    public void getShortcutSettings(PluginCall call) {
        android.content.SharedPreferences foreground = getContext().getSharedPreferences("dee_native_setup", Context.MODE_PRIVATE);
        android.content.SharedPreferences global = getContext().getSharedPreferences(VolumeKeyAccessibilityService.PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("foregroundEnabled", foreground.getBoolean("foreground_shortcuts_enabled", true));
        result.put("globalEnabled", global.getBoolean("global_shortcuts_enabled", true));
        String expected = getContext().getPackageName() + "/" + VolumeKeyAccessibilityService.class.getName();
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        result.put("accessibilityEnabled", !TextUtils.isEmpty(enabled) && enabled.toLowerCase().contains(expected.toLowerCase()));
        call.resolve(result);
    }

    @PluginMethod
    public void setForegroundShortcutsEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        getContext().getSharedPreferences("dee_native_setup", Context.MODE_PRIVATE).edit().putBoolean("foreground_shortcuts_enabled", enabled).apply();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void setGlobalShortcutsEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        getContext().getSharedPreferences(VolumeKeyAccessibilityService.PREFS, Context.MODE_PRIVATE).edit().putBoolean("global_shortcuts_enabled", enabled).apply();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
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
