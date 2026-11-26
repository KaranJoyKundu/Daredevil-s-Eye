package com.karankundu.daredevilseye;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

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

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            receiver = null;
        }
        super.handleOnDestroy();
    }
}
