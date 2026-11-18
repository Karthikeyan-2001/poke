# Poke

A hyper-minimalist, tactile fidget toy for your phone. No instructions, no ads, no menus — just things to press, pop, flick and spin, with procedurally synthesized sound and haptics.

Built with React, Tailwind CSS and Framer Motion, packaged for Android with Capacitor.

## Fidget modes

Swipe or tap the dots to move between surfaces.

1. **Bubble wrap** — tap or drag-to-pop glossy bubbles. Golden bubbles need 5 rapid taps (particle burst), 2×2 mega bubbles pop with a bass thump. Shake the phone or press the button for a fresh sheet.
2. **Mechanical keycaps** — a 3×3 grid of chunky switches with separate down/up strokes and a different "thock / tactile / clicky" profile per row.
3. **Heavy switch & magnetic slider** — an industrial toggle that needs a deliberate drag and shakes the screen, plus a two-piece magnetic slider with center resistance and spring snapping.
4. **Notched rotary dial** — a knurled knob with momentum and a ratchet tick every 15°.
5. **The Boss** — a stress-relief punching bag in a suit:
   - tap to punch, swipe to slap, hold to charge a slow-motion haymaker, tap the nose to honk
   - throw props from the tray: paper, stapler, coffee, DENIED stamp, cream pie, keyboard, office chair
   - a rage meter with levels, fury-mode crits and comic hit words; fill it for a confetti meltdown, a "performance review", then a guided breathing cool-down
   - he talks back, laughs when you miss, panics when you wind up, sulks, cries, dozes off — 11 expressions in all
   - **Photo boss:** pick a photo and Poke turns that face into a cartoon caricature with every expression (and devil horns). It runs entirely on the device with MediaPipe — the photo never leaves your phone.

Long-press the counter at the top for haptics settings.

## How it works

- **Sound:** every effect is synthesized live with the Web Audio API (`src/audio.js`, `src/audioBoss.js`) — no audio files, with random pitch/velocity jitter so nothing repeats exactly.
- **Haptics:** a small native Capacitor plugin (`PokeHapticsPlugin.java`) labels vibrations as *media*, because Android 13+ silently drops short unlabeled vibrations when touch feedback is turned off.
- **Photo caricature:** MediaPipe Face Landmarker (478 points) + multi-class segmentation (hair / face-skin only) → Kuwahara paint filter, cel bands and ink lines → Procrustes-based caricature exaggeration → Delaunay mesh warping into each expression (`src/modes/boss/face/`).

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN for phone testing)
```

## Build the Android APK

Requires Android Studio (SDK) and a JDK 21.

```powershell
.\build-apk.ps1    # builds web → syncs Capacitor → assembles a debug APK
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

## Credits

Made for fun by [Karthikeyan J](https://karthikeyanj.com).
Face models: [MediaPipe](https://ai.google.dev/edge/mediapipe) (Apache 2.0).
