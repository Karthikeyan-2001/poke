package com.poke.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/**
 * Native vibration with a selectable Android "usage" channel. Each channel follows a
 * different system setting, so the user can pick the one that works on their phone:
 *   default      – untagged, same as Chrome's navigator.vibrate
 *   notification – follows notification vibration
 *   touch        – follows touch / keyboard haptic feedback
 *   media        – follows media vibration
 */
@CapacitorPlugin(name = "PokeHaptics")
public class PokeHapticsPlugin extends Plugin {

    private Vibrator vibrator;

    @Override
    public void load() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vibrator = legacyVibrator(ctx);
        }
    }

    @SuppressWarnings("deprecation")
    private Vibrator legacyVibrator(Context ctx) {
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("hasVibrator", vibrator != null && vibrator.hasVibrator());
        r.put("amplitudeControl", vibrator != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl());
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        call.resolve(r);
    }

    /** { ms, usage } */
    @PluginMethod
    public void pulse(PluginCall call) {
        int ms = Math.max(1, call.getInt("ms", 40));
        String usage = call.getString("usage", "default");
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                play(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE), usage);
            } else {
                legacyVibrate(ms);
            }
        }
        call.resolve();
    }

    /** { pattern: [on, off, on, ...], usage } */
    @PluginMethod
    public void pattern(PluginCall call) {
        JSArray arr = call.getArray("pattern");
        String usage = call.getString("usage", "default");
        if (arr == null || arr.length() == 0 || vibrator == null || !vibrator.hasVibrator()) {
            call.resolve();
            return;
        }
        try {
            long[] timings = new long[arr.length() + 1];
            timings[0] = 0;
            for (int i = 0; i < arr.length(); i++) timings[i + 1] = Math.max(1, arr.getLong(i));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                play(VibrationEffect.createWaveform(timings, -1), usage);
            } else {
                legacyPattern(timings);
            }
        } catch (JSONException ignored) {
            // malformed pattern — skip
        }
        call.resolve();
    }

    private void play(VibrationEffect effect, String usage) {
        if ("default".equals(usage)) {
            vibrator.vibrate(effect);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            int u;
            switch (usage) {
                case "notification": u = VibrationAttributes.USAGE_NOTIFICATION; break;
                case "touch": u = VibrationAttributes.USAGE_TOUCH; break;
                default: u = VibrationAttributes.USAGE_MEDIA;
            }
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(u));
        } else {
            int u;
            switch (usage) {
                case "notification": u = AudioAttributes.USAGE_NOTIFICATION; break;
                case "touch": u = AudioAttributes.USAGE_ASSISTANCE_SONIFICATION; break;
                default: u = AudioAttributes.USAGE_MEDIA;
            }
            vibrator.vibrate(effect, new AudioAttributes.Builder().setUsage(u).build());
        }
    }

    @SuppressWarnings("deprecation")
    private void legacyVibrate(int ms) {
        vibrator.vibrate(ms);
    }

    @SuppressWarnings("deprecation")
    private void legacyPattern(long[] timings) {
        vibrator.vibrate(timings, -1);
    }
}
