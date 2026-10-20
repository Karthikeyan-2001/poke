// Procedural sound engine — every sound is synthesized live with the Web Audio API.
// Each voice gets small random pitch / gain / pan / timing jitter so repeats never sound robotic.

let ctx = null
let master = null
let noiseBuf = null

const rnd = (a, b) => a + Math.random() * (b - a)
const vary = (v, pct) => v * (1 + rnd(-pct, pct))

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC({ latencyHint: 'interactive' })
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 12
    comp.ratio.value = 4
    comp.attack.value = 0.002
    comp.release.value = 0.12
    master = ctx.createGain()
    master.gain.value = 0.85
    master.connect(comp)
    comp.connect(ctx.destination)

    const len = ctx.sampleRate
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

const ready = () => ctx && ctx.state !== 'closed'

// Per-sound output bus with a slight random stereo position.
function bus(spread = 0.18) {
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = rnd(-spread, spread)
    p.connect(master)
    return p
  }
  return master
}

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function noise(out, t, { type = 'bandpass', freq = 2000, q = 1, gain = 0.5, attack = 0.001, decay = 0.03 }) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = rnd(0.85, 1.15)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  env(g, t, gain, attack, decay)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 0.8)
  src.stop(t + attack + decay + 0.05)
  return f
}

function tone(out, t, { type = 'sine', f0, f1, glide, gain = 0.3, attack = 0.001, decay = 0.05 }) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (glide ?? attack + decay))
  const g = ctx.createGain()
  env(g, t, gain, attack, decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + attack + decay + 0.05)
}

const now = (delay = 0) => ctx.currentTime + 0.002 + delay + rnd(0, 0.003)

// ── Bubble wrap ────────────────────────────────────────────────
export function pop() {
  if (!ready()) return
  const o = bus(), t = now(), v = rnd(0.8, 1)
  noise(o, t, { type: 'highpass', freq: vary(4200, 0.2), gain: 0.5 * v, decay: 0.008 })
  noise(o, t, { type: 'bandpass', freq: vary(1700, 0.3), q: 0.9, gain: 0.9 * v, decay: vary(0.045, 0.25) })
  tone(o, t, { f0: vary(950, 0.22), f1: vary(170, 0.2), glide: 0.045, gain: 0.32 * v, decay: 0.05 })
}

export function megaPop() {
  if (!ready()) return
  const o = bus(0.1), t = now()
  noise(o, t, { type: 'highpass', freq: 3000, gain: 0.45, decay: 0.012 })
  noise(o, t, { type: 'lowpass', freq: vary(900, 0.15), q: 0.7, gain: 1, decay: 0.14 })
  tone(o, t, { f0: vary(170, 0.1), f1: 42, glide: 0.2, gain: 0.95, attack: 0.002, decay: 0.24 })
  tone(o, t, { type: 'triangle', f0: vary(340, 0.1), f1: 90, glide: 0.08, gain: 0.3, decay: 0.08 })
}

// Water droplet "bloop" — used for golden-bubble charging taps.
export function droplet(step = 0) {
  if (!ready()) return
  const o = bus(), t = now()
  const base = vary(520 + step * 140, 0.06)
  tone(o, t, { f0: base, f1: base * vary(2.6, 0.1), glide: 0.05, gain: 0.38, attack: 0.002, decay: 0.08 })
  tone(o, t + 0.045, { f0: base * 1.9, f1: base * 3.1, glide: 0.03, gain: 0.08, decay: 0.04 })
}

export function sparkle() {
  if (!ready()) return
  const o = bus(0.3)
  const notes = [1568, 2093, 2637, 3136, 2349]
  notes.forEach((n, i) => {
    const t = now(i * 0.035 + rnd(0, 0.015))
    tone(o, t, { f0: vary(n, 0.01), gain: 0.14, decay: 0.25 })
    tone(o, t, { type: 'triangle', f0: vary(n * 2.01, 0.01), gain: 0.04, decay: 0.15 })
  })
}

export function crinkle() {
  if (!ready()) return
  const o = bus()
  const n = 3 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) {
    noise(o, now(rnd(0, 0.06)), { type: 'highpass', freq: vary(5000, 0.3), gain: rnd(0.06, 0.16), decay: rnd(0.004, 0.012) })
  }
}

export function swoosh() {
  if (!ready()) return
  const o = bus(0.05), t = now()
  const f = noise(o, t, { type: 'bandpass', freq: 300, q: 1.2, gain: 0.35, attack: 0.08, decay: 0.28 })
  f.frequency.setValueAtTime(300, t)
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.3)
  crinkle()
}

// ── Mechanical keycaps (one profile per row) ───────────────────
export function keyDown(row) {
  if (!ready()) return
  const o = bus(0.25), t = now()
  if (row === 0) {
    // deep linear "thock"
    tone(o, t, { f0: vary(150, 0.08), f1: vary(85, 0.08), glide: 0.07, gain: 0.75, decay: 0.09 })
    noise(o, t, { type: 'lowpass', freq: vary(1300, 0.15), gain: 0.55, decay: 0.03 })
    tone(o, t, { type: 'triangle', f0: vary(430, 0.1), gain: 0.14, decay: 0.025 })
  } else if (row === 1) {
    // tactile bump then bottom-out
    noise(o, t, { type: 'bandpass', freq: vary(2600, 0.15), q: 1.5, gain: 0.45, decay: 0.014 })
    const b = t + rnd(0.01, 0.016)
    tone(o, b, { f0: vary(240, 0.08), f1: vary(150, 0.08), glide: 0.05, gain: 0.5, decay: 0.06 })
    noise(o, b, { type: 'lowpass', freq: vary(2200, 0.15), gain: 0.42, decay: 0.025 })
  } else {
    // clicky jacket
    noise(o, t, { type: 'highpass', freq: vary(4200, 0.12), gain: 0.85, decay: 0.006 })
    tone(o, t, { type: 'square', f0: vary(3300, 0.08), gain: 0.07, decay: 0.008 })
    const b = t + rnd(0.009, 0.013)
    tone(o, b, { f0: vary(320, 0.08), f1: vary(210, 0.08), glide: 0.04, gain: 0.35, decay: 0.05 })
    noise(o, b, { type: 'bandpass', freq: vary(1800, 0.2), gain: 0.25, decay: 0.02 })
  }
}

export function keyUp(row) {
  if (!ready()) return
  const o = bus(0.25), t = now()
  if (row === 0) {
    tone(o, t, { f0: vary(230, 0.08), f1: vary(170, 0.08), glide: 0.04, gain: 0.32, decay: 0.05 })
    noise(o, t, { type: 'bandpass', freq: vary(1500, 0.15), gain: 0.24, decay: 0.018 })
  } else if (row === 1) {
    noise(o, t, { type: 'bandpass', freq: vary(3100, 0.15), q: 1.2, gain: 0.32, decay: 0.012 })
    tone(o, t, { f0: vary(390, 0.08), gain: 0.18, decay: 0.03 })
  } else {
    noise(o, t, { type: 'highpass', freq: vary(5200, 0.12), gain: 0.65, decay: 0.005 })
    tone(o, t, { f0: vary(540, 0.08), gain: 0.14, decay: 0.025 })
  }
}

// ── Heavy toggle / magnetic slider ─────────────────────────────
export function clunk(on) {
  if (!ready()) return
  const o = bus(0.08), t = now(0.03)
  const base = vary(on ? 190 : 165, 0.06)
  const partials = [
    [1, 0.5, 0.35],
    [2.32, 0.28, 0.22],
    [3.87, 0.17, 0.14],
    [5.41, 0.1, 0.09],
    [7.1, 0.05, 0.05],
  ]
  partials.forEach(([r, g, d]) => tone(o, t, { f0: base * r * vary(1, 0.01), gain: g, decay: d }))
  noise(o, t, { type: 'lowpass', freq: vary(380, 0.1), gain: 1, decay: 0.12 })
  noise(o, t, { type: 'bandpass', freq: vary(3200, 0.15), q: 0.8, gain: 0.45, decay: 0.02 })
  tone(o, t, { f0: vary(70, 0.05), f1: 45, glide: 0.1, gain: 0.7, decay: 0.12 })
}

export function magnetSnap(strength = 1) {
  if (!ready()) return
  const o = bus(0.1), t = now(0.04)
  noise(o, t, { type: 'highpass', freq: vary(3200, 0.15), gain: 0.6 * strength, decay: 0.008 })
  tone(o, t, { f0: vary(560, 0.08), f1: vary(260, 0.08), glide: 0.03, gain: 0.42 * strength, decay: 0.04 })
  tone(o, t, { f0: vary(95, 0.06), f1: 60, glide: 0.06, gain: 0.5 * strength, decay: 0.08 })
}

export function softTick() {
  if (!ready()) return
  const o = bus(), t = now()
  noise(o, t, { type: 'bandpass', freq: vary(2400, 0.2), q: 2, gain: 0.18, decay: 0.006 })
}

// ── Rotary dial ratchet ────────────────────────────────────────
export function ratchet(speed = 0) {
  if (!ready()) return
  const o = bus(0.12), t = now()
  const lift = 1 + speed * 0.15
  noise(o, t, { type: 'highpass', freq: vary(3600 * lift, 0.12), q: 0.7, gain: 0.55, decay: 0.006 })
  tone(o, t, { type: 'square', f0: vary(2200 * lift, 0.06), gain: 0.04, decay: 0.006 })
  tone(o, t, { f0: vary(620, 0.08), gain: 0.1, decay: 0.012 })
}

// Synth primitives shared with other sound modules (e.g. audioBoss.js).
export const synth = {
  get ctx() {
    return ctx
  },
  get master() {
    return master
  },
  ready,
  bus,
  noise,
  tone,
  now,
  vary,
  rnd,
}

// ── UI ─────────────────────────────────────────────────────────
export function uiTick() {
  if (!ready()) return
  const o = bus(0.05), t = now()
  noise(o, t, { type: 'bandpass', freq: vary(3000, 0.1), q: 1.5, gain: 0.22, decay: 0.008 })
  tone(o, t, { f0: vary(880, 0.05), gain: 0.06, decay: 0.02 })
}
