import { Capacitor, registerPlugin } from '@capacitor/core'

// Haptic patterns tuned per interaction (ms, or [on, off, on, ...]).
export const H = {
  tick: 10,
  pop: 25,
  mega: [45],
  golden: 12,
  burst: [30, 40, 25, 40, 60],
  key: 14,
  keyClicky: 9,
  keyUp: 5,
  clunk: [38, 25, 18],
  snap: 20,
  detent: 8,
  sheet: [10, 30, 10],
}

// Native plugin: android/app/src/main/java/com/poke/app/PokeHapticsPlugin.java
const PokeHaptics = registerPlugin('PokeHaptics')
export const isNative = Capacitor.isNativePlatform()
const quiet = () => {}

// Engines: 'web' = navigator.vibrate; the rest are native Android channels.
// 'media' is the default: Android 13+ relabels short untagged vibrations as TOUCH, which is
// silenced whenever the user turns off touch/keyboard haptics. MEDIA plays at full strength.
export const ENGINES = isNative ? ['media', 'notification', 'default', 'touch', 'web'] : ['web']
export const LENGTHS = ['short', 'medium', 'long']

const KEY = 'poke-haptics-v2'
let cfg = { engine: isNative ? 'media' : 'web', length: 'medium', on: true }
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
  if (saved && ENGINES.includes(saved.engine) && LENGTHS.includes(saved.length)) cfg = { ...cfg, ...saved }
} catch {
  /* private mode */
}

export const getHaptics = () => cfg
export function setHaptics(patch) {
  cfg = { ...cfg, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg))
  } catch {
    /* private mode */
  }
}

// Many phone motors can't render very short pulses; stretch "on" segments per chosen length.
// Long pulses (rumbles, explosions) are left as-is so they don't balloon.
function stretch(ms) {
  if (cfg.length === 'short') return ms
  if (cfg.length === 'medium') return Math.max(ms, Math.min(80, Math.max(40, Math.round(ms * 2.5))))
  return Math.max(ms, Math.min(150, Math.max(90, ms * 5)))
}

function shape(pattern) {
  const arr = Array.isArray(pattern) ? pattern : [pattern]
  return arr.map((ms, i) => (i % 2 === 0 ? stretch(ms) : Math.max(ms, 30)))
}

export function buzz(pattern) {
  if (!cfg.on) return
  const p = shape(pattern)
  if (cfg.engine === 'web' || !isNative) {
    try {
      if (navigator.vibrate) navigator.vibrate(p.length === 1 ? p[0] : p)
    } catch {
      /* unsupported (e.g. iOS Safari) */
    }
    return
  }
  const call = p.length === 1 ? PokeHaptics.pulse({ ms: p[0], usage: cfg.engine }) : PokeHaptics.pattern({ pattern: p, usage: cfg.engine })
  call?.catch?.(quiet)
}

export function hapticsInfo() {
  return isNative ? PokeHaptics.info().catch(() => null) : Promise.resolve(null)
}
