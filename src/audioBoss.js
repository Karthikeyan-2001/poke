// The Boss — procedural impact, prop, rage and calm sounds.
import { crinkle, synth } from './audio.js'

const { ready, bus, noise, tone, now, vary, rnd } = synth

// Oscillator voice with a frequency path and an optional (sweeping) filter.
function voice(out, t, { type = 'sine', f0, path = [], gain = 0.3, attack = 0.005, hold = 0, decay = 0.2, filter, detune = 0 }) {
  const ctx = synth.ctx
  const o = ctx.createOscillator()
  o.type = type
  o.detune.value = detune
  o.frequency.setValueAtTime(f0, t)
  path.forEach(([dt, f, lin]) =>
    lin ? o.frequency.linearRampToValueAtTime(f, t + dt) : o.frequency.exponentialRampToValueAtTime(f, t + dt),
  )
  const g = ctx.createGain()
  const end = t + attack + hold + decay
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  if (hold) g.gain.setValueAtTime(gain, t + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, end)
  let node = o
  if (filter) {
    const f = ctx.createBiquadFilter()
    f.type = filter.type
    f.Q.value = filter.q ?? 1
    f.frequency.setValueAtTime(filter.freq, t)
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, end)
    o.connect(f)
    node = f
  }
  node.connect(g).connect(out)
  o.start(t)
  o.stop(end + 0.05)
}

const ok = () => ready() && synth.ctx

// ── Hits ───────────────────────────────────────────────────────
export function thump(f = 1) {
  if (!ok()) return
  const o = bus(0.15), t = now(), k = Math.min(1.4, f)
  tone(o, t, { f0: vary(135, 0.1), f1: vary(52, 0.1), glide: 0.12, gain: 0.55 + 0.35 * k, attack: 0.002, decay: 0.16 + 0.06 * k })
  noise(o, t, { type: 'lowpass', freq: vary(650, 0.2), q: 0.8, gain: 0.55 + 0.35 * k, decay: 0.07 + 0.04 * k })
  noise(o, t, { type: 'bandpass', freq: vary(2000, 0.2), q: 1, gain: 0.22, decay: 0.012 })
  if (f > 0.95) tone(o, t, { f0: 62, f1: 30, glide: 0.3, gain: 0.95, decay: 0.36 })
}

export function bonk(f = 1) {
  if (!ok()) return
  const o = bus(0.15), t = now(), k = Math.min(1.3, f)
  tone(o, t, { type: 'triangle', f0: vary(470, 0.08), f1: vary(250, 0.08), glide: 0.09, gain: 0.42 + 0.2 * k, decay: 0.13 })
  tone(o, t, { f0: vary(940, 0.06), gain: 0.14, decay: 0.05 })
  noise(o, t, { type: 'highpass', freq: 3500, gain: 0.35, decay: 0.006 })
  tone(o, t, { f0: 115, f1: 60, glide: 0.1, gain: 0.45, decay: 0.1 })
}

export function slap(f = 1) {
  if (!ok()) return
  const o = bus(0.25), t = now(), k = Math.min(1.4, f)
  noise(o, t, { type: 'highpass', freq: vary(2600, 0.15), gain: 0.75 + 0.25 * k, decay: 0.028 })
  noise(o, t, { type: 'bandpass', freq: vary(1150, 0.15), q: 1.3, gain: 0.55 + 0.2 * k, decay: 0.05 })
  tone(o, t, { f0: vary(320, 0.1), f1: 110, glide: 0.05, gain: 0.3, decay: 0.05 })
  noise(o, t + 0.012, { type: 'highpass', freq: 6000, gain: 0.22, decay: 0.04 })
}

export function whoosh(s = 1) {
  if (!ok()) return
  const o = bus(0.3), t = now()
  const f = noise(o, t, { type: 'bandpass', freq: 350, q: 1.4, gain: 0.2 * Math.min(1.6, Math.max(0.3, s)), attack: 0.05, decay: 0.14 })
  f.frequency.setValueAtTime(350, t)
  f.frequency.exponentialRampToValueAtTime(vary(2200, 0.2), t + 0.17)
}

export function honk() {
  if (!ok()) return
  const o = bus(0.1), t = now(), f0 = vary(480, 0.06)
  for (const d of [-14, 14]) {
    voice(o, t, {
      type: 'sawtooth',
      f0,
      detune: d,
      path: [
        [0.05, f0 * 1.4, true],
        [0.22, f0 * 1.12, true],
      ],
      gain: 0.2,
      attack: 0.01,
      decay: 0.24,
      filter: { type: 'bandpass', freq: 1400, q: 4 },
    })
  }
}

// ── Props ──────────────────────────────────────────────────────
export function clank() {
  if (!ok()) return
  const o = bus(0.15), t = now(), base = vary(820, 0.08)
  const partials = [
    [1, 0.3, 0.18],
    [1.52, 0.2, 0.14],
    [2.31, 0.14, 0.1],
    [3.4, 0.08, 0.08],
    [4.6, 0.05, 0.05],
  ]
  for (const [r, g, d] of partials) tone(o, t, { f0: base * r, gain: g, decay: d })
  noise(o, t, { type: 'highpass', freq: 4000, gain: 0.7, decay: 0.006 })
  tone(o, t, { f0: 160, f1: 90, glide: 0.07, gain: 0.3, decay: 0.07 })
}

export function shatter() {
  if (!ok()) return
  const o = bus(0.15), t = now()
  noise(o, t, { type: 'highpass', freq: 2500, gain: 0.9, decay: 0.05 })
  noise(o, t, { type: 'bandpass', freq: 4500, q: 1, gain: 0.5, decay: 0.18 })
  tone(o, t, { f0: 220, f1: 90, glide: 0.07, gain: 0.35, decay: 0.08 })
  for (let i = 0; i < 12; i++) tone(o, t + rnd(0, 0.35), { f0: rnd(2600, 7200), gain: rnd(0.03, 0.1), decay: rnd(0.04, 0.14) })
  for (let i = 0; i < 6; i++) noise(o, t + rnd(0.02, 0.3), { type: 'highpass', freq: rnd(5000, 8000), gain: rnd(0.08, 0.2), decay: 0.01 })
}

export function stampThunk() {
  if (!ok()) return
  const o = bus(0.15), t = now()
  tone(o, t, { f0: vary(120, 0.08), f1: 65, glide: 0.08, gain: 0.6, decay: 0.1 })
  noise(o, t, { type: 'lowpass', freq: 900, gain: 0.55, decay: 0.05 })
  noise(o, t + 0.01, { type: 'bandpass', freq: 3200, q: 0.8, gain: 0.22, decay: 0.025 })
}

export function paperHit() {
  if (!ok()) return
  const o = bus(0.2), t = now()
  noise(o, t, { type: 'bandpass', freq: vary(2200, 0.2), q: 0.7, gain: 0.4, decay: 0.035 })
  crinkle()
}

export function chairCrash() {
  if (!ok()) return
  const o = bus(0.08), t = now(), base = vary(240, 0.08)
  tone(o, t, { f0: 75, f1: 26, glide: 0.55, gain: 1.1, decay: 0.6 })
  noise(o, t, { type: 'lowpass', freq: 450, q: 0.7, gain: 1, decay: 0.35 })
  const partials = [
    [1, 0.3, 0.4],
    [2.7, 0.18, 0.3],
    [4.15, 0.1, 0.2],
    [5.9, 0.06, 0.15],
  ]
  for (const [r, g, d] of partials) tone(o, t, { f0: base * r, gain: g, decay: d })
  for (let i = 0; i < 7; i++) noise(o, t + rnd(0.03, 0.35), { type: 'highpass', freq: rnd(3000, 6000), gain: rnd(0.1, 0.3), decay: 0.012 })
  voice(o, t + 0.12, { f0: 1700, path: [[0.18, 2500, true]], gain: 0.05, attack: 0.02, decay: 0.16 })
}

// ── Knockdown cycle ────────────────────────────────────────────
export function floorThud() {
  if (!ok()) return
  const o = bus(0.05), t = now()
  tone(o, t, { f0: 95, f1: 38, glide: 0.18, gain: 0.9, decay: 0.22 })
  noise(o, t, { type: 'lowpass', freq: 380, gain: 0.8, decay: 0.12 })
  noise(o, t, { type: 'bandpass', freq: 1400, gain: 0.2, decay: 0.02 })
}

export function deflate() {
  if (!ok()) return
  const ctx = synth.ctx
  const o = bus(0.05), t = now()
  const s = ctx.createOscillator()
  s.type = 'sawtooth'
  s.frequency.setValueAtTime(vary(150, 0.08), t)
  s.frequency.exponentialRampToValueAtTime(58, t + 0.95)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 2.5
  bp.frequency.setValueAtTime(900, t)
  bp.frequency.exponentialRampToValueAtTime(280, t + 0.95)
  const am = ctx.createGain()
  am.gain.value = 0.55
  const lfo = ctx.createOscillator()
  lfo.type = 'square'
  lfo.frequency.setValueAtTime(30, t)
  lfo.frequency.linearRampToValueAtTime(18, t + 0.95)
  const lg = ctx.createGain()
  lg.gain.value = 0.45
  lfo.connect(lg).connect(am.gain)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.03)
  g.gain.setValueAtTime(0.3, t + 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1)
  s.connect(bp).connect(am).connect(g).connect(o)
  s.start(t)
  lfo.start(t)
  s.stop(t + 1.05)
  lfo.stop(t + 1.05)
  noise(o, t, { type: 'bandpass', freq: 1800, q: 0.8, gain: 0.12, attack: 0.05, decay: 0.8 })
}

export function boing() {
  if (!ok()) return
  const ctx = synth.ctx
  const o = bus(0.1), t = now()
  const s = ctx.createOscillator()
  s.frequency.setValueAtTime(160, t)
  s.frequency.exponentialRampToValueAtTime(330, t + 0.08)
  s.frequency.exponentialRampToValueAtTime(270, t + 0.5)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 17
  const depth = ctx.createGain()
  depth.gain.setValueAtTime(45, t)
  depth.gain.exponentialRampToValueAtTime(2, t + 0.5)
  lfo.connect(depth).connect(s.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  s.connect(g).connect(o)
  s.start(t)
  lfo.start(t)
  s.stop(t + 0.6)
  lfo.stop(t + 0.6)
}

export function reinflate() {
  if (!ok()) return
  const o = bus(0.05), t = now()
  const f = noise(o, t, { type: 'bandpass', freq: 250, q: 1.2, gain: 0.28, attack: 0.45, decay: 0.12 })
  f.frequency.setValueAtTime(250, t)
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.55)
  setTimeout(boing, 480)
}

export function tweet() {
  if (!ok()) return
  const o = bus(0.4)
  for (let i = 0; i < 3; i++) {
    const t = now(i * 0.11 + rnd(0, 0.02))
    voice(o, t, { f0: vary(2600, 0.06), path: [[0.05, vary(3600, 0.06)]], gain: 0.06, decay: 0.05 })
  }
}

// ── Rage ───────────────────────────────────────────────────────
export function boom() {
  if (!ok()) return
  const o = bus(0.02), t = now()
  tone(o, t, { f0: 58, f1: 22, glide: 1.3, gain: 1.3, attack: 0.004, decay: 1.5 })
  const f = noise(o, t, { type: 'lowpass', freq: 4000, q: 0.6, gain: 1.1, attack: 0.003, decay: 1.3 })
  f.frequency.setValueAtTime(4000, t)
  f.frequency.exponentialRampToValueAtTime(120, t + 1.2)
  for (let i = 0; i < 26; i++) noise(o, t + rnd(0.02, 0.9), { type: 'highpass', freq: rnd(2500, 7000), gain: rnd(0.05, 0.25), decay: rnd(0.004, 0.015) })
  ;[1568, 2093, 2637, 3136, 3951].forEach((n, i) => tone(o, t + 0.25 + i * 0.05, { f0: n, gain: 0.06, decay: 0.5 }))
}

// Sustained wind-up for the charged haymaker. Returns { set(level 0..1), stop() }.
export function startCharge() {
  if (!ok()) return null
  const ctx = synth.ctx
  const t = ctx.currentTime
  const o1 = ctx.createOscillator()
  o1.type = 'sawtooth'
  o1.frequency.setValueAtTime(70, t)
  const o2 = ctx.createOscillator()
  o2.type = 'square'
  o2.frequency.setValueAtTime(70.8, t)
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 7
  f.frequency.setValueAtTime(200, t)
  const trem = ctx.createGain()
  trem.gain.value = 0.7
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 8
  const lfoG = ctx.createGain()
  lfoG.gain.value = 0.3
  lfo.connect(lfoG).connect(trem.gain)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.15)
  o1.connect(f)
  o2.connect(f)
  f.connect(trem).connect(g).connect(synth.master)
  for (const x of [o1, o2, lfo]) x.start(t)
  let stopped = false
  return {
    set(level) {
      if (stopped) return
      const n = ctx.currentTime
      o1.frequency.setTargetAtTime(70 + level * 330, n, 0.05)
      o2.frequency.setTargetAtTime(70.8 + level * 334, n, 0.05)
      f.frequency.setTargetAtTime(200 + level * 2800, n, 0.05)
      lfo.frequency.setTargetAtTime(8 + level * 24, n, 0.05)
      g.gain.setTargetAtTime(0.12 + level * 0.16, n, 0.05)
    },
    stop() {
      if (stopped) return
      stopped = true
      const n = ctx.currentTime
      g.gain.cancelScheduledValues(n)
      g.gain.setTargetAtTime(0.0001, n, 0.03)
      for (const x of [o1, o2, lfo]) x.stop(n + 0.25)
    },
  }
}

// ── Calm ───────────────────────────────────────────────────────
// Ambient breathing pad (Fmaj7 voicing). Returns { breathe(inhale, seconds), stop() }.
export function startPad() {
  if (!ok()) return null
  const ctx = synth.ctx
  const t = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, t)
  out.gain.exponentialRampToValueAtTime(0.16, t + 2)
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 0.6
  f.frequency.setValueAtTime(450, t)
  f.connect(out).connect(synth.master)
  const oscs = []
  const notes = [174.61, 220, 261.63, 329.63, 87.31]
  notes.forEach((hz, i) => {
    for (const cents of [-6, 6]) {
      const o = ctx.createOscillator()
      o.type = i === 4 ? 'sine' : 'triangle'
      o.frequency.value = hz
      o.detune.value = cents
      const g = ctx.createGain()
      g.gain.value = i === 4 ? 0.22 : 0.09
      o.connect(g).connect(f)
      o.start(t)
      oscs.push(o)
    }
  })
  return {
    breathe(inhale, secs) {
      const n = ctx.currentTime
      f.frequency.cancelScheduledValues(n)
      f.frequency.setValueAtTime(f.frequency.value, n)
      f.frequency.linearRampToValueAtTime(inhale ? 1500 : 380, n + secs)
      out.gain.cancelScheduledValues(n)
      out.gain.setValueAtTime(out.gain.value, n)
      out.gain.linearRampToValueAtTime(inhale ? 0.24 : 0.12, n + secs)
    },
    stop() {
      const n = ctx.currentTime
      out.gain.cancelScheduledValues(n)
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.0002), n)
      out.gain.exponentialRampToValueAtTime(0.0001, n + 1.6)
      for (const o of oscs) o.stop(n + 1.7)
    },
  }
}

export function chime() {
  if (!ok()) return
  const o = bus(0.1), t = now()
  ;[523.25, 659.25, 783.99, 1046.5].forEach((n, i) => {
    tone(o, t + i * 0.12, { f0: n, gain: 0.12, attack: 0.004, decay: 1.6 })
    tone(o, t + i * 0.12, { f0: n * 2.76, gain: 0.02, decay: 0.6 })
  })
}

// ── Rage levels, fury, new props, voice ───────────────────────
export function tierUp(level = 1) {
  if (!ok()) return
  const o = bus(0.05), t = now()
  const base = [392, 440, 523.25, 587.33][Math.min(3, level)]
  ;[1, 1.25, 1.5, 2].forEach((r, i) => {
    tone(o, t + i * 0.06, { type: 'triangle', f0: base * r, gain: 0.14, decay: 0.32 })
    tone(o, t + i * 0.06, { f0: base * r * 2, gain: 0.04, decay: 0.2 })
  })
  const f = noise(o, t, { type: 'bandpass', freq: 400, q: 1.2, gain: 0.18, attack: 0.12, decay: 0.2 })
  f.frequency.setValueAtTime(400, t)
  f.frequency.exponentialRampToValueAtTime(5000, t + 0.3)
  tone(o, t, { f0: 90, f1: 45, glide: 0.3, gain: 0.5, decay: 0.3 })
}

export function crit() {
  if (!ok()) return
  const o = bus(0.15), t = now()
  ;[1568, 2349, 3136].forEach((n, i) => tone(o, t + i * 0.02, { f0: vary(n, 0.01), gain: 0.09, decay: 0.35 }))
  noise(o, t, { type: 'highpass', freq: 6000, gain: 0.25, decay: 0.12 })
}

export function heartbeat() {
  if (!ok()) return
  const o = bus(0.02), t = now()
  tone(o, t, { f0: 62, f1: 44, glide: 0.1, gain: 0.45, decay: 0.12 })
  tone(o, t + 0.17, { f0: 58, f1: 42, glide: 0.1, gain: 0.32, decay: 0.12 })
}

export function splat() {
  if (!ok()) return
  const o = bus(0.12), t = now()
  noise(o, t, { type: 'lowpass', freq: 1300, gain: 0.9, decay: 0.12 })
  const f = noise(o, t, { type: 'bandpass', freq: 2200, q: 2, gain: 0.5, decay: 0.22 })
  f.frequency.setValueAtTime(2200, t)
  f.frequency.exponentialRampToValueAtTime(380, t + 0.22)
  tone(o, t, { f0: 190, f1: 85, glide: 0.12, gain: 0.35, decay: 0.12 })
  for (let i = 0; i < 6; i++) noise(o, t + rnd(0.05, 0.35), { type: 'bandpass', freq: rnd(1400, 3200), q: 3, gain: rnd(0.06, 0.16), decay: 0.02 })
}

export function keyboardBurst() {
  if (!ok()) return
  const o = bus(0.2), t = now()
  tone(o, t, { f0: 160, f1: 70, glide: 0.08, gain: 0.55, decay: 0.1 })
  noise(o, t, { type: 'lowpass', freq: 900, gain: 0.5, decay: 0.05 })
  for (let i = 0; i < 14; i++) {
    const k = t + rnd(0, 0.32)
    noise(o, k, { type: 'highpass', freq: rnd(3500, 6000), gain: rnd(0.25, 0.6), decay: 0.006 })
    tone(o, k, { f0: rnd(1800, 3600), gain: 0.03, decay: 0.012 })
  }
}

// Animal-Crossing-style gibberish: formant blips, one per syllable, with a question lilt.
export function mumble(text = '', pitch = 1) {
  if (!ok()) return
  const o = bus(0.1)
  const n = Math.max(3, Math.min(16, Math.round(text.length / 2.4)))
  const F = [
    [730, 1090],
    [270, 2290],
    [300, 870],
    [530, 1840],
    [660, 1720],
    [440, 1020],
  ]
  const question = text.trim().endsWith('?')
  const shout = text === text.toUpperCase() && /[A-Z]/.test(text)
  for (let i = 0; i < n; i++) {
    const t = now(i * 0.072 + rnd(0, 0.012))
    const [f1, f2] = F[(Math.random() * F.length) | 0]
    const lilt = question && i > n - 3 ? 1 + (i - (n - 3)) * 0.12 : 1
    const base = vary(132 * pitch * (shout ? 1.35 : 1), 0.1) * lilt
    voice(o, t, { type: 'sawtooth', f0: base, path: [[0.06, base * rnd(0.88, 1.12)]], gain: 0.07, attack: 0.008, decay: 0.055, filter: { type: 'bandpass', freq: f1, q: 5 } })
    voice(o, t, { type: 'sawtooth', f0: base, gain: 0.035, attack: 0.008, decay: 0.05, filter: { type: 'bandpass', freq: f2, q: 7 } })
  }
}

// ── Reaction voices ───────────────────────────────────────────
// One formant "vowel" syllable (used to build laughs, sobs, yawns…).
function syllable(o, t, { f0, f1 = f0, dur = 0.12, gain = 0.09, formants = [730, 1090], breath = 0.04 }) {
  voice(o, t, { type: 'sawtooth', f0, path: [[dur, f1]], gain, attack: 0.012, decay: dur, filter: { type: 'bandpass', freq: formants[0], q: 5 } })
  voice(o, t, { type: 'sawtooth', f0, path: [[dur, f1]], gain: gain * 0.5, attack: 0.012, decay: dur, filter: { type: 'bandpass', freq: formants[1], q: 7 } })
  if (breath) noise(o, t, { type: 'bandpass', freq: 1800, q: 0.8, gain: breath, attack: 0.01, decay: dur * 0.8 })
}

// Mocking "ha-ha-ha-ha".
export function laughVoice() {
  if (!ok()) return
  const o = bus(0.1)
  const n = 5
  for (let i = 0; i < n; i++) {
    const p = vary(220 - i * 12, 0.04)
    syllable(o, now(i * 0.115), { f0: p * 1.08, f1: p * 0.92, dur: 0.08, gain: 0.1, breath: 0.07 })
  }
}

// Wobbly descending sob.
export function sob() {
  if (!ok()) return
  const o = bus(0.08)
  for (let i = 0; i < 3; i++) {
    const t = now(i * 0.32)
    const p = vary(260 - i * 25, 0.05)
    syllable(o, t, { f0: p, f1: p * 0.72, dur: 0.26, gain: 0.08, formants: [500, 950], breath: 0.06 })
  }
}

// Long "aaah-ooo" yawn with a falling pitch.
export function yawn() {
  if (!ok()) return
  const o = bus(0.05), t = now()
  const f = [
    [800, 1150],
    [400, 800],
  ]
  voice(o, t, { type: 'sawtooth', f0: 210, path: [[0.35, 240, true], [1.1, 120]], gain: 0.07, attack: 0.15, hold: 0.5, decay: 0.45, filter: { type: 'bandpass', freq: f[0][0], to: f[1][0], q: 4 } })
  voice(o, t, { type: 'sawtooth', f0: 210, path: [[0.35, 240, true], [1.1, 120]], gain: 0.035, attack: 0.15, hold: 0.5, decay: 0.45, filter: { type: 'bandpass', freq: f[0][1], to: f[1][1], q: 6 } })
  noise(o, t, { type: 'bandpass', freq: 1400, q: 0.7, gain: 0.05, attack: 0.2, decay: 0.9 })
}

// Low frustrated growl.
export function growl() {
  if (!ok()) return
  const o = bus(0.05), t = now()
  voice(o, t, { type: 'sawtooth', f0: 95, path: [[0.5, 80]], gain: 0.14, attack: 0.04, hold: 0.25, decay: 0.25, filter: { type: 'lowpass', freq: 700, q: 3 } })
  for (let i = 0; i < 8; i++) noise(o, t + i * 0.06, { type: 'bandpass', freq: 420, q: 2, gain: 0.08, decay: 0.03 })
}

// Tiny scared "eep!".
export function eep() {
  if (!ok()) return
  const o = bus(0.1), t = now()
  syllable(o, t, { f0: 520, f1: 760, dur: 0.1, gain: 0.08, formants: [300, 2300], breath: 0.02 })
}
