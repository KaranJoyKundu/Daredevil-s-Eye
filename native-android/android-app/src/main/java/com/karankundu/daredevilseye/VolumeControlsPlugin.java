package com.karankundu.daredevilseye;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.net.Uri;
import android.content.ContentValues;
import android.os.Environment;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import java.util.Locale;
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
    private TextToSpeech textToSpeech;
    private volatile boolean ttsReady = false;

    @Override
    public void load() {
        super.load();
        textToSpeech = new TextToSpeech(getContext(), status -> ttsReady = status == TextToSpeech.SUCCESS);
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





    @PluginMethod public void speakText(PluginCall call) {
        String text=call.getString("text",""), language=call.getString("language","en-US");
        Double rateValue=call.getDouble("rate",1.0), pitchValue=call.getDouble("pitch",1.0);\n        float rate=rateValue==null?1.0f:rateValue.floatValue(), pitch=pitchValue==null?1.0f:pitchValue.floatValue();
        if(text.trim().isEmpty()){call.reject("No text to speak.");return;}
        if(!ttsReady||textToSpeech==null){call.reject("Android speech engine is still starting. Try again shortly.");return;}
        Locale locale=language.toLowerCase().startsWith("bn")?new Locale("bn","BD"):Locale.US;
        int availability=textToSpeech.setLanguage(locale);
        if(availability==TextToSpeech.LANG_MISSING_DATA||availability==TextToSpeech.LANG_NOT_SUPPORTED){
          if(language.toLowerCase().startsWith("bn")){call.reject("Bengali speech data is not installed. Install Bengali voice data in Android Text-to-Speech settings.");return;}
          textToSpeech.setLanguage(Locale.US);
        }
        textToSpeech.setSpeechRate(Math.max(.65f,Math.min(1.5f,rate)));textToSpeech.setPitch(Math.max(.65f,Math.min(1.5f,pitch)));
        if(textToSpeech.speak(text,TextToSpeech.QUEUE_ADD,null,"dee-"+System.currentTimeMillis())==TextToSpeech.ERROR)call.reject("Android could not start speech.");else call.resolve();
    }
    @PluginMethod public void stopSpeech(PluginCall call){if(textToSpeech!=null)textToSpeech.stop();call.resolve();}
    @PluginMethod public void saveImage(PluginCall call){
      String dataUrl=call.getString("dataUrl",""),filename=call.getString("filename","daredevils-eye-photo.jpg");
      try{int comma=dataUrl.indexOf(',');if(comma<0)throw new IllegalArgumentException("Invalid image data.");
        byte[] bytes=Base64.decode(dataUrl.substring(comma+1),Base64.DEFAULT);if(bytes.length==0)throw new IllegalArgumentException("Photo is empty.");
        ContentValues values=new ContentValues();values.put(MediaStore.Images.Media.DISPLAY_NAME,filename);values.put(MediaStore.Images.Media.MIME_TYPE,"image/jpeg");
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q)values.put(MediaStore.Images.Media.RELATIVE_PATH,Environment.DIRECTORY_PICTURES+"/Daredevils Eye");
        Uri uri=getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);if(uri==null)throw new IllegalStateException("Could not create Pictures entry.");
        try(java.io.OutputStream out=getContext().getContentResolver().openOutputStream(uri)){if(out==null)throw new IllegalStateException("Could not open photo destination.");out.write(bytes);}
        JSObject result=new JSObject();result.put("message","Photo saved in Pictures/Daredevils Eye.");result.put("uri",uri.toString());call.resolve(result);
      }catch(Exception error){call.reject("Could not save photo: "+error.getMessage(),error);}
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
        if(textToSpeech!=null){textToSpeech.stop();textToSpeech.shutdown();textToSpeech=null;}
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            receiver = null;
        }
        super.handleOnDestroy();
    }
}
