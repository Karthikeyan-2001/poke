import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate, AnimatePresence, motion } from 'framer-motion'
import { BossFigure, PropIcon } from './boss/art.jsx'
import Calm from './boss/Calm.jsx'
import FaceStudio from './boss/FaceStudio.jsx'
import { completeFace, headPlacement } from './boss/face/pipeline.js'
import { kvDel, kvGet, kvSet } from './boss/face/store.js'
import { burst, confetti, createParticles, drops, dust, keycaps, paperBits, ring, shards, sparks, stars } from './boss/particles.js'
import { ComicWords, ReviewCard, SpeechBubble, TierBanner } from './boss/fx.jsx'
import { MOOD_LINES, MORNING, OUCH, pick, PROP_LINES, REACT_LINES, TAUNTS, TIERS, WORDS } from './boss/lines.js'
import * as A from '../audioBoss.js'
import { uiTick } from '../audio.js'
import { buzz } from '../haptics.js'
import { bump, observeSize, useShake } from '../store.js'

// ── Tuning ──────────────────────────────────────────────────────
const METER_H = 46
const TRAY_H = 96
const K_SPRING = 115 // wobble stiffness (deg/s² per deg)
const C_DAMP = 2.6 // wobble damping
const KNOCK_ANGLE = 74
const SOFT_STOP = 62
// Rage pacing: ~3x slower than before. Variety fills faster, spamming one move fills slower.
const RAGE_SCALE = 0.34
const RAGE_DECAY = 1.4 // per second, after a pause; never below the current level's floor
const CRIT_CHANCE = 0.22

const PROPS = [
  { type: 'paper', r: 13, g: 1500, power: 70, dmg: 1.5, rage: 2.4, flight: 0.36 },
  { type: 'stapler', r: 18, g: 1700, power: 170, dmg: 5, rage: 5, flight: 0.45 },
  { type: 'mug', r: 19, g: 1700, power: 210, dmg: 7, rage: 7, flight: 0.45 },
  { type: 'stamp', r: 18, g: 1700, power: 130, dmg: 4, rage: 5, flight: 0.45 },
  { type: 'pie', r: 20, g: 1600, power: 120, dmg: 4, rage: 7, flight: 0.45 },
  { type: 'keyboard', r: 24, g: 1700, power: 190, dmg: 6, rage: 6, flight: 0.47 },
  { type: 'chair', r: 34, g: 1900, power: 780, dmg: 22, rage: 16, flight: 0.62, cooldown: 5000 },
]
const PROP = Object.fromEntries(PROPS.map((p) => [p.type, p]))

const BH = {
  punch: 28,
  bonk: 22,
  slap: [38],
  haymaker: [70, 30, 120],
  floor: [90],
  paper: 12,
  stapler: 30,
  mug: [40, 20, 25],
  stamp: 30,
  chair: [90, 30, 140],
  pie: [35, 25, 20],
  keyboard: [12, 18, 12, 18, 20],
  tier: [20, 30, 40],
  crit: [50, 20, 35],
  beat: [12, 110, 16],
  boom: [160, 60, 240, 80, 300],
  honk: [15, 30, 15],
  miss: 8,
}

const fresh = () => ({ hair: 0, cracked: false, tie: 0, stain: 0, stamps: [], stapler: false, headHits: 0, pie: 0 })
const freshStats = () => ({ hits: 0, best: 0, haymaker: 0, mug: 0, pie: 0, stamp: 0, startT: 0 })
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const capture = (e) => {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* pointer already gone */
  }
}
const sxOf = (s) => (1 + (1 - s.sy) * 0.6) * s.dx
const moodFor = (d) => (d >= 92 ? 'cry' : d >= 80 ? 'defeated' : d >= 50 ? 'dizzy' : d >= 18 ? 'shocked' : 'smug')

// Hit zones in the figure's own 200×340 SVG space. GEO follows the active head (cartoon or photo).
const CARTOON_GEO = { hx: 100, hy: 100, rx: 57, ry: 56, nx: 100, ny: 117, nr: 11 }
let GEO = CARTOON_GEO
function photoGeo(photo) {
  const { size, x0, y0 } = photo.place
  const m = photo.face.meta
  const rx = m.faceW * size * 0.6
  return { hx: x0 + m.center.x * size, hy: y0 + m.center.y * size, rx, ry: rx * 1.3, nx: x0 + m.nose.x * size, ny: y0 + m.nose.y * size, nr: rx * 0.2 }
}
function hitZone(x, y, pad = 0) {
  const G = GEO
  if (Math.hypot(x - G.nx, y - G.ny) < G.nr + pad) return 'nose'
  if (((x - G.hx) / (G.rx + pad)) ** 2 + ((y - G.hy) / (G.ry + pad)) ** 2 <= 1) return 'head'
  if (((x - 100) / (72 + pad)) ** 2 + ((y - 228) / (80 + pad)) ** 2 <= 1) return 'body'
  if (((x - 100) / (74 + pad)) ** 2 + ((y - 312) / (30 + pad)) ** 2 <= 1) return 'base'
  return null
}

export default function Boss({ active }) {
  const shake = useShake()
  const arenaRef = useRef(null)
  const canvasRef = useRef(null)
  const bossRef = useRef(null)
  const shadowRef = useRef(null)
  const fillRef = useRef(null)
  const trackRef = useRef(null)
  const vignetteRef = useRef(null)
  const flashRef = useRef(null)
  const ringRef = useRef(null)
  const fig = useRef({})
  const projEls = useRef(new Map())
  const particles = useRef(null)
  if (!particles.current) particles.current = createParticles()

  const L = useRef(null)
  const [layout, setLayout] = useState(null)
  const [mood, setMood] = useState('smug')
  const [ouch, setOuch] = useState(false)
  const [worried, setWorried] = useState(false)
  const [react, setReact] = useState(null) // transient expression: laugh, scared, angry, gross, sleepy
  const [blink, setBlink] = useState(false)
  const [noseRed, setNoseRed] = useState(false)
  const [cos, setCos] = useState(fresh)
  const [projs, setProjs] = useState([])
  const [combo, setCombo] = useState(null)
  const [calm, setCalm] = useState(false)
  const [cool, setCool] = useState(0)
  const [speech, setSpeech] = useState(null)
  const [words, setWords] = useState([])
  const [banner, setBanner] = useState(null)
  const [tier, setTier] = useState(0)
  const [review, setReview] = useState(null)
  const speechRef = useRef(null)
  const calmRef = useRef(false)
  calmRef.current = calm
  // Photo boss (on-device caricature). Stored in IndexedDB; the toggle is a per-device preference.
  const [face, setFace] = useState(null)
  const [faceOn, setFaceOn] = useState(() => {
    try {
      return localStorage.getItem('poke-face-on') !== '0'
    } catch {
      return true
    }
  })
  const [studio, setStudio] = useState(false)
  const studioRef = useRef(false)
  studioRef.current = studio
  useEffect(() => {
    kvGet('face').then(async (f) => {
      if (!f?.sprites) return
      setFace(f)
      // Faces saved before new expressions existed: render the missing ones in the background.
      const upgraded = await completeFace(f).catch(() => null)
      if (upgraded) {
        setFace(upgraded)
        kvSet('face', upgraded).catch(() => {})
      }
    })
  }, [])
  const photo = useMemo(() => (face && faceOn ? { face, place: headPlacement(face.meta) } : null), [face, faceOn])
  useEffect(() => {
    GEO = photo ? photoGeo(photo) : CARTOON_GEO
  }, [photo])
  const setFaceOnSaved = (v) => {
    setFaceOn(v)
    try {
      localStorage.setItem('poke-face-on', v ? '1' : '0')
    } catch {
      /* private mode */
    }
  }
  const timers = useRef({})

  const S = useRef({
    th: 0, om: 0, lean: 0, sy: 1, syv: 0, dx: 1, dxv: 0, ph: 0, phv: 0,
    spinT0: 0, spinDir: 1,
    state: 'up', stateT: 0, downDir: 1, landed: false,
    damage: 0, rage: 0, lastHit: 0, freezeUntil: 0, slowUntil: 0,
    comboN: 0, comboT: 0, eye: { x: 100, y: 130 }, lastPtr: 0,
    starA: 0, spiralA: 0, mood: 'smug',
    pointers: new Map(), charge: null, projs: new Map(), held: new Map(), nextId: 1,
    releasing: false, coolUntil: 0, lastChargeBuzz: 0, knockUntil: 0,
    kinds: [], tier: 0, lastSay: 0, speechUntil: 0, speechPrio: 0, nextTaunt: performance.now() + 4000, lastBeat: 0,
    reactExpr: null, nextBlink: performance.now() + 2500, lastLaugh: 0, sleeping: false, angryArmed: false, lastTear: 0, look: 0,
    stats: freshStats(),
  })

  // ── Layout ────────────────────────────────────────────────────
  useLayoutEffect(
    () =>
      observeSize(arenaRef.current, (w, h) => {
        if (w < 10 || h < 10) return
        const py = h - TRAY_H - 6
        const avail = py - METER_H - 10
        const bossH = Math.min(avail * 0.9, 420)
        const scale = bossH / 340
        const l = { w, h, py, px: w / 2, scale, bossH, bossW: 200 * scale }
        L.current = l
        setLayout(l)
        const c = canvasRef.current
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
        c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
      }),
    [],
  )

  // ── Coordinate transforms (arena px ⇄ figure space) ────────────
  const toLocal = (x, y) => {
    const l = L.current, s = S.current
    const dx = x - l.px, dy = y - l.py
    const a = (-s.th * Math.PI) / 180
    const c = Math.cos(a), sn = Math.sin(a)
    const sx = sxOf(s)
    return { x: 100 + (dx * c - dy * sn) / (l.scale * sx), y: 340 + (dx * sn + dy * c) / (l.scale * s.sy) }
  }
  const toStage = (lx, ly) => {
    const l = L.current, s = S.current
    const sx = sxOf(s)
    const rx = (lx - 100) * l.scale * sx, ry = (ly - 340) * l.scale * s.sy
    const a = (s.th * Math.PI) / 180
    return { x: l.px + rx * Math.cos(a) - ry * Math.sin(a), y: l.py + rx * Math.sin(a) + ry * Math.cos(a) }
  }

  // ── Feedback helpers ──────────────────────────────────────────
  const flash = (a) => {
    if (flashRef.current) animate(flashRef.current, { opacity: [a, 0] }, { duration: 0.45, ease: 'easeOut' })
  }
  const later = (key, ms, fn) => {
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(fn, ms)
  }
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  const updateMood = () => {
    const s = S.current
    const m = moodFor(s.damage)
    if (m !== s.mood) {
      if (m === 'dizzy') A.tweet()
      if (m === 'cry') A.sob()
      const ml = m === 'cry' ? REACT_LINES.cry : MOOD_LINES[m]
      if (ml && !s.releasing) setTimeout(() => say(pick(ml), { prio: 1, ms: 2600 }), 300)
      s.mood = m
      setMood(m)
    }
  }

  // ── Personality: speech, comic words, rage levels ─────────────
  const say = (text, { ms = 2300, prio = 0 } = {}) => {
    const s = S.current
    const now = performance.now()
    if (now < s.speechUntil && prio <= s.speechPrio) return
    s.speechUntil = now + ms
    s.speechPrio = prio
    s.lastSay = now
    setSpeech({ text, key: now, shout: /!$/.test(text) && text === text.toUpperCase() })
    A.mumble(text, 1)
    later('speech', ms, () => setSpeech(null))
  }

  const word = (x, y, kind, { force = false, crit = false, color } = {}) => {
    const list = crit ? ['CRIT!'] : WORDS[kind]
    if (!list) return
    const id = Math.random()
    const w = { id, x, y, text: pick(list), rot: (Math.random() - 0.5) * 28, size: crit ? 40 : force ? 36 : 30, color: color || (crit ? '#ffd23f' : pick(['#ffd23f', '#ff8a3d', '#5fd3ff', '#ff6b9a'])) }
    setWords((ws) => [...ws.slice(-4), w])
    setTimeout(() => setWords((ws) => ws.filter((q) => q.id !== id)), 850)
  }

  const levelUp = (t) => {
    const s = S.current
    s.tier = t
    setTier(t)
    if (t >= 4) return
    setBanner({ tier: t, key: performance.now() })
    later('banner', 1500, () => setBanner(null))
    A.tierUp(t)
    buzz(BH.tier)
    const tr = trackRef.current?.getBoundingClientRect()
    const ar = arenaRef.current?.getBoundingClientRect()
    if (tr && ar) {
      const x = tr.left - ar.left + tr.width * (t * 0.25), y = tr.top - ar.top + tr.height / 2
      ring(particles.current, x, y, 60, TIERS[t].color)
      sparks(particles.current, x, y, 14, 500)
    }
    if (TIERS[t].line) setTimeout(() => say(TIERS[t].line, { prio: 2 }), 450)
  }

  // Transient reaction faces (laugh, scared, angry, gross, sleepy) layered over the damage mood.
  const reactTo = (expr, ms) => {
    const s = S.current
    s.reactExpr = expr
    setReact(expr)
    later('react', ms, () => {
      s.reactExpr = null
      setReact(null)
    })
  }
  const clearReact = () => {
    S.current.reactExpr = null
    clearTimeout(timers.current.react)
    setReact(null)
  }
  const wake = () => {
    const s = S.current
    if (!s.sleeping) return
    s.sleeping = false
    clearReact()
    if (Math.random() < 0.6) say(pick(REACT_LINES.wake), { prio: 2 })
  }

  // Core hit pipeline shared by fists, slaps and props.
  const hit = (o) => {
    const s = S.current
    const now = performance.now()
    s.lastHit = now
    wake()
    if (s.reactExpr === 'laugh' || s.reactExpr === 'angry') clearReact()
    s.comboN = now - s.comboT < 750 ? s.comboN + 1 : 1
    s.comboT = now
    if (s.comboN >= 3) setCombo({ n: s.comboN, key: now })
    // Fury (LIVID and above): critical hits.
    const crit = s.tier >= 3 && o.kind !== 'paper' && Math.random() < CRIT_CHANCE
    let P = o.power * (1 + Math.min(s.comboN, 25) * 0.025)
    if (crit) {
      P *= 1.7
      A.crit()
      buzz(BH.crit)
      stars(particles.current, o.x, o.y, 12)
      ring(particles.current, o.x, o.y, 70, '#ffd23f')
    }
    // Variety: distinct moves in the last 6 hits boost rage; spamming one move dampens it.
    s.kinds.push(o.kind)
    if (s.kinds.length > 6) s.kinds.shift()
    let variety = 0.55 + new Set(s.kinds).size * 0.2
    const prev = s.kinds.slice(-4, -1)
    if (prev.length === 3 && prev.every((k) => k === o.kind)) variety *= 0.55
    // Stats for the performance review.
    const st = s.stats
    if (!st.startT) st.startT = now
    st.hits++
    st.best = Math.max(st.best, s.comboN)
    if (s.comboN >= 6) s.angryArmed = true
    if (o.kind in st) st[o.kind]++
    if (o.knockout) s.knockUntil = now + 900
    if (s.state === 'up') {
      s.om += o.dir * P * 0.8
      s.syv -= P / 260
      s.phv += o.dir * P * (o.zone === 'head' || o.zone === 'nose' ? 1.7 : 0.45)
    } else {
      s.syv -= P / 600
    }
    if (P >= 300) s.freezeUntil = now + Math.min(110, P / 7)
    s.damage = Math.min(100, s.damage + (o.dmg ?? P / 45))
    if (!s.releasing) {
      s.rage = Math.min(100, s.rage + (o.rage ?? P / 40) * RAGE_SCALE * variety * (crit ? 1.4 : 1))
      const t = Math.min(4, Math.floor(s.rage / 25))
      if (t > s.tier) levelUp(t)
    }
    burst(particles.current, o.x, o.y, P, crit ? '#ffd23f' : o.color)
    // Comic words on big hits, crits, combo milestones and the occasional regular hit.
    const big = P >= 330 || o.kind === 'haymaker' || o.kind === 'chair' || o.kind === 'pie'
    if (crit || big || (s.comboN > 0 && s.comboN % 5 === 0) || Math.random() < 0.16) word(o.x, o.y - 30, o.kind, { force: big, crit })
    // He talks back.
    const lines = PROP_LINES[o.kind]
    if (lines && Math.random() < 0.6) say(pick(lines), { prio: 1 })
    else if (now - s.lastSay > 1600 && Math.random() < 0.3) say(pick(OUCH))
    setOuch(true)
    later('ouch', 200, () => setOuch(false))
    bump()
    updateMood()
    if (o.zone === 'head') {
      setCos((c) => {
        const headHits = c.headHits + 1
        return { ...c, headHits, hair: Math.min(3, Math.floor(headHits / 5)), cracked: c.cracked || headHits >= 9 }
      })
    }
  }

  // ── Fists ─────────────────────────────────────────────────────
  const punchAt = (x, y) => {
    const l = toLocal(x, y)
    const z = hitZone(l.x, l.y)
    if (!z) {
      A.whoosh(0.5)
      buzz(BH.miss)
      const s = S.current
      const t = performance.now()
      if (s.state === 'up' && !s.releasing && !s.charge && t - s.lastLaugh > 2500 && Math.random() < 0.5) {
        s.lastLaugh = t
        reactTo('laugh', 1500)
        A.laughVoice()
        say(pick(REACT_LINES.miss), { prio: 1 })
      }
      ring(particles.current, x, y, 22, 'rgba(140,140,140,.55)')
      return
    }
    const dir = l.x < 100 ? 1 : -1
    if (z === 'nose') {
      A.honk()
      buzz(BH.honk)
      setNoseRed(true)
      later('nose', 520, () => setNoseRed(false))
      stars(particles.current, x, y, 5)
      hit({ x, y, zone: z, dir, power: 90, dmg: 2, rage: 4, color: '#ff8fa3', kind: 'nose' })
      return
    }
    const power = (z === 'head' ? 200 : 170) + Math.random() * 70
    if (z === 'head') {
      A.bonk(power / 220)
      buzz(BH.bonk)
    } else {
      A.thump(power / 240)
      buzz(BH.punch)
    }
    hit({ x, y, zone: z === 'base' ? 'body' : z, dir, power, kind: z === 'head' ? 'bonk' : 'punch' })
  }

  const slapAt = (pt, dir, v) => {
    const s = S.current
    const power = clamp(v * 260, 180, 650)
    A.slap(power / 400)
    buzz(BH.slap)
    if ((pt.z === 'head' || pt.z === 'nose') && v > 0.9 && s.state === 'up') {
      s.spinT0 = performance.now()
      s.spinDir = dir
    }
    setCos((c) => ({ ...c, tie: clamp(c.tie + dir * 9, -38, 38) }))
    sparks(particles.current, pt.x, pt.y, 10, 700)
    hit({ x: pt.x, y: pt.y, zone: pt.z === 'nose' ? 'head' : pt.z, dir, power, dmg: power / 40, rage: power / 34, kind: 'slap' })
  }

  const startCharge = (p) => {
    const s = S.current
    if (s.charge || s.releasing) return
    const last = p.path[p.path.length - 1]
    s.charge = { p, level: 0, t0: performance.now(), x: last.x, y: last.y, snd: A.startCharge() }
    setWorried(true)
    reactTo('scared', 60000)
    A.eep()
    if (Math.random() < 0.75) say(pick(REACT_LINES.scared), { prio: 1 })
  }

  const releaseCharge = () => {
    const s = S.current
    const c = s.charge
    s.charge = null
    c.snd?.stop()
    s.lean = 0
    setWorried(false)
    clearReact()
    if (c.level < 0.15) return
    const l = toLocal(c.x, c.y)
    const z = hitZone(l.x, l.y, 12)
    A.whoosh(1.4)
    if (!z) return
    const dir = l.x < 100 ? 1 : -1
    const power = 380 + c.level * 1000
    A.thump(1.5)
    if (z === 'head' || z === 'nose') A.bonk(1.3)
    A.slap(1)
    buzz(BH.haymaker)
    s.slowUntil = performance.now() + 420
    flash(0.2 + 0.5 * c.level)
    shake()
    if (c.level > 0.7) setTimeout(shake, 130)
    const sys = particles.current
    sparks(sys, c.x, c.y, 24, 1100)
    ring(sys, c.x, c.y, 90 + c.level * 60, 'rgba(255,200,80,.9)')
    stars(sys, c.x, c.y, 10)
    hit({ x: c.x, y: c.y, zone: z === 'nose' || z === 'head' ? 'head' : 'body', dir, power, dmg: 12 + c.level * 22, rage: 10 + c.level * 16, color: '#ffb03b', knockout: c.level > 0.55, kind: 'haymaker' })
  }

  // ── Arena gestures ────────────────────────────────────────────
  const arenaPoint = (e, rect) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top })

  const onDown = (e) => {
    const s = S.current
    if (calmRef.current || studioRef.current || s.releasing || !L.current) return
    const rect = arenaRef.current.getBoundingClientRect()
    const { x, y } = arenaPoint(e, rect)
    if (y > L.current.h - TRAY_H || y < METER_H) return
    capture(e)
    wake()
    const t = performance.now()
    const p = { id: e.pointerId, x0: x, y0: y, t0: t, path: [{ x, y, t }], slapped: false, rect, timer: 0 }
    s.pointers.set(e.pointerId, p)
    s.eye = toLocal(x, y)
    s.lastPtr = t
    punchAt(x, y)
    p.timer = setTimeout(() => startCharge(p), 260)
  }

  const onMove = (e) => {
    const s = S.current
    const p = s.pointers.get(e.pointerId)
    if (!p) return
    const { x, y } = arenaPoint(e, p.rect)
    const t = performance.now()
    p.path.push({ x, y, t })
    if (p.path.length > 14) p.path.shift()
    s.eye = toLocal(x, y)
    s.lastPtr = t
    if (s.charge && s.charge.p === p) {
      s.charge.x = x
      s.charge.y = y
      return
    }
    if (Math.hypot(x - p.x0, y - p.y0) > 14) clearTimeout(p.timer)
    if (p.slapped) return
    const first = p.path.find((q) => t - q.t < 140) ?? p.path[0]
    const dx = x - first.x, dy = y - first.y
    const dist = Math.hypot(dx, dy)
    const v = dist / Math.max(1, t - first.t)
    if (dist > 45 && v > 0.55) {
      p.slapped = true
      for (let i = 0; i <= 10; i++) {
        const k = i / 10
        const sx = first.x + dx * k, sy = first.y + dy * k
        const l = toLocal(sx, sy)
        const z = hitZone(l.x, l.y)
        if (z && z !== 'base') return slapAt({ x: sx, y: sy, z }, Math.sign(dx) || 1, v)
      }
      A.whoosh(v)
    }
  }

  const onUp = (e) => {
    const s = S.current
    const p = s.pointers.get(e.pointerId)
    if (!p) return
    clearTimeout(p.timer)
    s.pointers.delete(e.pointerId)
    if (s.charge && s.charge.p === p) releaseCharge()
  }

  // ── Props ─────────────────────────────────────────────────────
  const removeProj = (id) => {
    S.current.projs.delete(id)
    projEls.current.delete(id)
    setProjs((list) => list.filter((q) => q.id !== id))
  }

  const trayDown = (e, type) => {
    e.stopPropagation()
    const s = S.current
    if (calmRef.current || s.releasing || !L.current) return
    const def = PROP[type]
    const t = performance.now()
    if (def.cooldown && t < s.coolUntil) {
      buzz(8)
      uiTick()
      return
    }
    capture(e)
    const rect = arenaRef.current.getBoundingClientRect()
    const { x, y } = arenaPoint(e, rect)
    const id = s.nextId++
    s.projs.set(id, { id, type, x, y, x0: x, y0: y, vx: 0, vy: 0, rot: 0, vr: 0, held: true, spent: false, born: t, samples: [{ x, y, t }], rect })
    s.held.set(e.pointerId, id)
    setProjs((list) => [...list, { id, type }])
    uiTick()
    buzz(8)
  }

  const trayMove = (e) => {
    e.stopPropagation()
    const s = S.current
    const p = s.projs.get(s.held.get(e.pointerId))
    if (!p) return
    const { x, y } = arenaPoint(e, p.rect)
    p.x = x
    p.y = y
    p.samples.push({ x, y, t: performance.now() })
    if (p.samples.length > 8) p.samples.shift()
  }

  const trayUp = (e) => {
    e.stopPropagation()
    const s = S.current
    const id = s.held.get(e.pointerId)
    s.held.delete(e.pointerId)
    const p = s.projs.get(id)
    if (!p) return
    p.held = false
    p.born = performance.now()
    const def = PROP[p.type]
    const t = performance.now()
    const first = p.samples.find((q) => t - q.t < 90) ?? p.samples[0]
    const dt = Math.max(0.016, (t - first.t) / 1000)
    let vx = (p.x - first.x) / dt
    let vy = (p.y - first.y) / dt
    const moved = Math.hypot(p.x - p.x0, p.y - p.y0)
    const speed = Math.hypot(vx, vy)
    if (moved < 18) {
      // Tap = auto-aim a ballistic arc at his head.
      const tgt = toStage(GEO.hx + (Math.random() - 0.5) * GEO.rx * 0.5, GEO.hy + (Math.random() - 0.5) * GEO.ry * 0.4)
      const T = def.flight
      vx = (tgt.x - p.x) / T
      vy = (tgt.y - p.y) / T - 0.5 * def.g * T
      // Props fly "into" the screen, so they can't collide until they reach his depth.
      p.armAt = t + T * 1000 * 0.82
    } else if (speed < 250) {
      p.cancel = true
      p.fade = 1
      return
    } else {
      const k = Math.min(1.15, 3200 / speed)
      vx *= k
      vy *= k
      p.armAt = t + 220
    }
    p.vx = vx
    p.vy = vy
    p.vr = clamp(vx * (p.type === 'chair' ? 0.25 : 0.7), -900, 900)
    A.whoosh(Math.hypot(vx, vy) / 1400)
    if (def.cooldown) {
      s.coolUntil = t + def.cooldown
      setCool(s.coolUntil)
    }
  }

  const bounce = (p, k = 0.3) => {
    p.spent = true
    p.vx = -p.vx * k
    p.vy = -Math.abs(p.vy) * 0.2 - 320
    p.vr *= -1.5
    p.fade = 1
  }

  const propHit = (p, z, l) => {
    const s = S.current
    const def = PROP[p.type]
    const sys = particles.current
    const dir = Math.sign(p.vx) || 1
    const sp = Math.hypot(p.vx, p.vy)
    const zone = z === 'nose' ? 'head' : z === 'base' ? 'body' : z
    const o = { x: p.x, y: p.y, zone, dir, power: def.power * (0.7 + (Math.min(sp, 2600) / 2600) * 0.6), dmg: def.dmg, rage: def.rage, kind: p.type }
    switch (p.type) {
      case 'paper':
        A.paperHit()
        buzz(BH.paper)
        paperBits(sys, p.x, p.y, 9, 380)
        bounce(p)
        break
      case 'stapler':
        A.clank()
        buzz(BH.stapler)
        sparks(sys, p.x, p.y, 12, 650)
        if (zone === 'head') {
          setCos((c) => ({ ...c, stapler: true }))
          later('stapler', 7000, () => setCos((c) => ({ ...c, stapler: false })))
          p.spent = true
          p.fade = 0
        } else bounce(p)
        break
      case 'mug':
        if (Math.random() < 0.45) reactTo('gross', 1400)
        A.shatter()
        buzz(BH.mug)
        shards(sys, p.x, p.y, 18)
        drops(sys, p.x, p.y, 28)
        setCos((c) => ({ ...c, stain: c.stain ? Math.min(1.9, c.stain + 0.35) : 0.9 }))
        p.spent = true
        p.fade = 0
        o.color = '#ffe3b0'
        break
      case 'stamp': {
        A.stampThunk()
        buzz(BH.stamp)
        const stamp = { x: clamp(l.x, 50, 150), y: clamp(l.y, 60, 290), r: (Math.random() - 0.5) * 50, id: Math.random() }
        setCos((c) => ({ ...c, stamps: [...c.stamps.slice(-6), stamp] }))
        p.spent = true
        p.fade = 0
        o.color = '#ff6b6b'
        break
      }
      case 'pie':
        reactTo('gross', 1900)
        A.splat()
        buzz(BH.pie)
        drops(sys, p.x, p.y, 30, ['#fffaf0', '#fff1d6', '#f5e6cc'], 1.6)
        drops(sys, p.x, p.y, 4, ['#d7263d'], 1.4)
        if (zone === 'head') {
          setCos((c) => ({ ...c, pie: Date.now() }))
          later('pie', 7000, () => setCos((c) => ({ ...c, pie: 0 })))
        }
        p.spent = true
        p.fade = 0
        o.color = '#fffaf0'
        break
      case 'keyboard':
        A.keyboardBurst()
        buzz(BH.keyboard)
        keycaps(sys, p.x, p.y, 22)
        bounce(p, 0.35)
        break
      case 'chair':
        A.chairCrash()
        buzz(BH.chair)
        shake()
        setTimeout(shake, 150)
        flash(0.35)
        s.slowUntil = performance.now() + 320
        dust(sys, p.x, p.y, 10)
        sparks(sys, p.x, p.y, 20, 900)
        bounce(p, 0.45)
        o.knockout = true
        break
    }
    hit(o)
  }

  // ── Rage release & new day ────────────────────────────────────
  const triggerRelease = () => {
    const s = S.current
    s.releasing = true
    if (s.charge) {
      s.charge.snd?.stop()
      s.charge = null
      setWorried(false)
    }
    clearReact()
    s.sleeping = false
    const now = performance.now()
    s.freezeUntil = now + 260
    s.slowUntil = now + 700
    const c = toStage(100, 200)
    const sys = particles.current
    A.boom()
    buzz(BH.boom)
    flash(0.95)
    shake()
    setTimeout(shake, 180)
    setTimeout(shake, 380)
    confetti(sys, c.x, c.y, 220)
    paperBits(sys, c.x, c.y, 70, 900)
    sparks(sys, c.x, c.y, 40, 1300)
    burst(sys, c.x, c.y, 900, '#ff6a3d')
    ;[0, 120, 260].forEach((d, i) => setTimeout(() => ring(sys, c.x, c.y, 140 + i * 90, ['#ffd166', '#ff6a3d', '#ef476f'][i]), d))
    s.knockUntil = now + 1500
    if (s.state === 'up') s.om += (Math.random() < 0.5 ? -1 : 1) * 1500
    s.damage = 100
    updateMood()
    const st = s.stats
    setReview({ ...st, secs: st.startT ? (now - st.startT) / 1000 : 0 })
    setSpeech(null)
    setTimeout(() => say('NOOOOO!', { prio: 3, ms: 1500 }), 120)
  }

  const newDay = useCallback((sound = true) => {
    const s = S.current
    Object.assign(s, { tier: 0, kinds: [], stats: freshStats(), nextTaunt: performance.now() + 6000, damage: 0, rage: 0, releasing: false, th: 0, om: 0, lean: 0, sy: 0.25, syv: 0, dx: 1, dxv: 0, ph: 0, phv: 0, spinT0: 0, state: 'reinflate', stateT: performance.now(), comboN: 0, mood: 'smug', sleeping: false, angryArmed: false, reactExpr: null })
    setMood('smug')
    setCos(fresh())
    setCalm(false)
    setCombo(null)
    setTier(0)
    setReview(null)
    if (sound) {
      A.reinflate()
      setTimeout(() => say(pick(MORNING), { prio: 1 }), 1100)
    }
  }, [])

  // ── Simulation ────────────────────────────────────────────────
  const stepBoss = (dt, now) => {
    const s = S.current
    if (now - s.lastHit > 1500) s.damage = Math.max(0, s.damage - 6 * dt)
    if (now - s.lastHit > 3500 && !s.releasing) s.rage = Math.max(Math.min(s.tier, 3) * 25, s.rage - RAGE_DECAY * dt)
    const free = !s.releasing && !calmRef.current && !studioRef.current && s.state === 'up' && !s.charge
    // Pause after a big combo → he gets angry.
    if (s.angryArmed && now - s.lastHit > 900) {
      s.angryArmed = false
      if (free && Math.random() < 0.6) {
        reactTo('angry', 1900)
        A.growl()
        say(pick(REACT_LINES.angry), { prio: 1 })
      }
    }
    // Left alone long enough → he dozes off (any touch wakes him).
    if (free && !s.sleeping && now - s.lastHit > 15000 && now - s.lastPtr > 15000) {
      s.sleeping = true
      reactTo('sleepy', 10 * 60 * 1000)
      A.yawn()
      say(pick(REACT_LINES.sleepy), { ms: 2800 })
    }
    // Blinking.
    if (now > s.nextBlink) {
      s.nextBlink = now + 2200 + Math.random() * 3200
      setBlink(true)
      later('blink', 140, () => setBlink(false))
    }
    // Tears while crying.
    if ((s.mood === 'cry' || s.reactExpr === 'cry') && now - s.lastTear > 110 && !s.releasing) {
      s.lastTear = now
      const geo = fig.current.geo
      for (const e of geo ? [geo.eyeL, geo.eyeRp] : [{ x: 76, y: 100 }, { x: 124, y: 100 }]) {
        const q = toStage(e.x + (Math.random() - 0.5) * 8, e.y + 6)
        particles.current.add({ t: 'drop', x: q.x, y: q.y, vx: (Math.random() - 0.5) * 60, vy: 30, r: 2 + Math.random() * 1.5, color: Math.random() < 0.5 ? '#8fd3ff' : '#bfe6ff', g: 900, drag: 0.3, life: 0.9, floor: true })
      }
    }
    // Idle taunts.
    if (!s.sleeping && !s.releasing && !calmRef.current && !studioRef.current && s.state === 'up' && now - s.lastHit > 5000 && now > s.nextTaunt) {
      s.nextTaunt = now + 6500 + Math.random() * 4000
      say(pick(TAUNTS), { ms: 2600 })
    }
    // Fury heartbeat while you're actively at LIVID.
    if (s.tier === 3 && !s.releasing && now - s.lastHit < 3000 && now - s.lastBeat > 860) {
      s.lastBeat = now
      A.heartbeat()
      buzz(BH.beat)
    }
    updateMood()
    if (s.rage >= 100 && !s.releasing) triggerRelease()

    if (s.charge) {
      const c = s.charge
      c.level = clamp((now - c.t0) / 1100, 0, 1)
      c.snd?.set(c.level)
      const l = toLocal(c.x, c.y)
      s.lean = (l.x < 100 ? 1 : -1) * c.level * 14
      if (now - s.lastChargeBuzz > 110) {
        s.lastChargeBuzz = now
        buzz(Math.round(8 + c.level * 24))
      }
    }
    if (now - s.lastPtr > 1600) {
      s.eye.x += (100 - s.eye.x) * 0.05
      s.eye.y += (150 - s.eye.y) * 0.05
    }

    // Gentle idle breathing.
    const breathe = s.state === 'up' && now - s.lastHit > 1200 ? 1 + 0.014 * Math.sin(now / 620) : 1
    const sub = Math.max(1, Math.ceil(dt / 0.006))
    const h = dt / sub
    for (let i = 0; i < sub; i++) {
      const omPrev = s.om
      if (s.state === 'up') {
        s.om += (-(s.th - s.lean) * K_SPRING - s.om * C_DAMP) * h
        s.th += s.om * h
        // Ordinary hits rebound off a soft stop; only knockout blows (haymaker, chair, rage) topple him.
        if (now > s.knockUntil && Math.abs(s.th) > SOFT_STOP) {
          s.th = Math.sign(s.th) * SOFT_STOP
          if (Math.sign(s.om) === Math.sign(s.th)) s.om = -s.om * 0.45
        }
        if (Math.abs(s.th) > KNOCK_ANGLE) {
          s.state = 'down'
          s.downDir = Math.sign(s.th)
          s.stateT = now
          s.landed = false
        }
      } else if (s.state === 'down' || s.state === 'deflate') {
        const target = s.downDir * 86
        s.om += (-(s.th - target) * 160 - s.om * 16) * h
        s.th += s.om * h
        if (Math.abs(s.th) > 90) {
          // The floor stops him.
          s.th = s.downDir * 90
          s.om = -s.om * 0.3
        }
      } else if (s.state === 'reinflate') {
        s.om += (-s.th * 90 - s.om * 9) * h
        s.th += s.om * h
      }
      const syT = breathe
      // Deflating flattens his thickness (local x), so lying down he goes flat on the floor.
      const dxT = s.state === 'deflate' ? 0.3 : 1
      s.dxv += (-(s.dx - dxT) * 300 - s.dxv * 14) * h
      s.dx = clamp(s.dx + s.dxv * h, 0.2, 1.3)
      s.syv += (-(s.sy - syT) * 420 - s.syv * 13) * h
      s.sy = clamp(s.sy + s.syv * h, 0.2, 1.4)
      const acc = h > 0 ? (s.om - omPrev) / h : 0
      s.phv += (-s.ph * 260 - s.phv * 8 - acc * 0.3) * h
      s.ph = clamp(s.ph + s.phv * h, -50, 50)
    }

    if (s.state === 'down') {
      if (!s.landed && Math.abs(s.th - s.downDir * 86) < 7) {
        s.landed = true
        A.floorThud()
        buzz(BH.floor)
        const head = toStage(100, 100)
        dust(particles.current, head.x, L.current.py - 4, 12)
        shake()
      }
      if (now - s.stateT > 1300) {
        s.state = 'deflate'
        s.stateT = now
        A.deflate()
      }
    } else if (s.state === 'deflate' && now - s.stateT > 1000) {
      s.state = 'reinflate'
      s.stateT = now
      A.reinflate()
    } else if (s.state === 'reinflate' && now - s.stateT > 350 && Math.abs(s.th) < 8) {
      s.state = 'up'
      if (!s.releasing && !calmRef.current && s.damage > 25) {
        reactTo('angry', 1900)
        A.growl()
        say(pick(REACT_LINES.angry), { prio: 2 })
      }
    }
  }

  const stepProjectiles = (dt, now) => {
    const s = S.current
    const l = L.current
    for (const p of s.projs.values()) {
      if (p.held) continue
      if (p.cancel) {
        p.fade -= dt * 6
        if (p.fade <= 0) removeProj(p.id)
        continue
      }
      const def = PROP[p.type]
      p.vy += def.g * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      if (!p.spent && now >= (p.armAt ?? 0)) {
        const lc = toLocal(p.x, p.y)
        const z = hitZone(lc.x, lc.y, def.r / l.scale)
        if (z) propHit(p, z, lc)
      } else {
        p.fade -= dt * 1.4
      }
      if (p.y > l.h + 60 || p.x < -90 || p.x > l.w + 90 || (p.spent && p.fade <= 0) || now - p.born > 6000) removeProj(p.id)
    }
  }

  const render = (now, dt) => {
    const s = S.current
    const l = L.current
    const f = fig.current
    const sx = sxOf(s)
    if (bossRef.current) bossRef.current.style.transform = `rotate(${s.th.toFixed(2)}deg) scale(${sx.toFixed(3)},${s.sy.toFixed(3)})`
    let spin = 0
    if (s.spinT0) {
      const k = (now - s.spinT0) / 650
      if (k >= 1) s.spinT0 = 0
      else spin = s.spinDir * 360 * easeOut(k)
    }
    const geo = f.geo
    const sc = geo ? geo.spin : { x: 100, y: 100 }
    if (speechRef.current) {
      const a = toStage(GEO.hx + GEO.rx * 0.45, GEO.hy - GEO.ry * 0.95)
      const x = clamp(a.x, 8, l.w - 200)
      speechRef.current.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(METER_H + 70, a.y).toFixed(1)}px)`
    }
    const lookT = now - s.lastPtr < 2500 && !s.sleeping ? clamp((s.eye.x - 100) * 0.09, -8, 8) : 0
    s.look += (lookT - s.look) * 0.08
    f.head?.setAttribute('transform', `rotate(${(s.ph + s.look).toFixed(2)} 100 150) rotate(${spin.toFixed(1)} ${sc.x.toFixed(1)} ${sc.y.toFixed(1)})`)
    const arm = clamp(-s.om * 0.07, -55, 55)
    const sway = Math.sin(now / 180) * 2
    f.armL?.setAttribute('transform', `rotate(${(arm + sway).toFixed(1)} 52 182)`)
    f.armR?.setAttribute('transform', `rotate(${(arm - sway).toFixed(1)} 148 182)`)
    const ex = clamp((s.eye.x - 100) / 40, -1, 1) * 2.6
    const ey = clamp((s.eye.y - 100) / 60, -1, 1) * 2.2
    const pt = `translate(${ex.toFixed(2)} ${ey.toFixed(2)})`
    f.pupilL?.setAttribute('transform', pt)
    f.pupilR?.setAttribute('transform', pt)
    if (s.mood === 'dizzy') {
      s.starA += dt * 4.2
      s.spiralA += dt * 420
      for (let i = 0; i < 3; i++) {
        const a = s.starA + (i * Math.PI * 2) / 3
        const o = geo ? geo.orbit : { cx: 100, cy: 42, rx: 54 }
        f['star' + i]?.setAttribute('transform', `translate(${(o.cx + Math.cos(a) * o.rx).toFixed(1)} ${(o.cy + Math.sin(a) * 12).toFixed(1)}) scale(${(0.8 + Math.sin(a) * 0.3).toFixed(2)})`)
      }
      const eL = geo ? geo.eyeL : { x: 74, y: 101 }
      const eR = geo ? geo.eyeRp : { x: 126, y: 101 }
      f.spiralL?.setAttribute('transform', `rotate(${s.spiralA.toFixed(0)} ${eL.x.toFixed(1)} ${eL.y.toFixed(1)})`)
      f.spiralR?.setAttribute('transform', `rotate(${(-s.spiralA).toFixed(0)} ${eR.x.toFixed(1)} ${eR.y.toFixed(1)})`)
    }
    if (shadowRef.current) {
      const lean = Math.abs(Math.sin((s.th * Math.PI) / 180))
      shadowRef.current.style.transform = `translate(-50%,-50%) translateX(${(Math.sin((s.th * Math.PI) / 180) * l.bossH * 0.35).toFixed(1)}px) scaleX(${(1 + lean * 1.6).toFixed(2)})`
      shadowRef.current.style.opacity = (0.55 - lean * 0.15).toFixed(2)
    }
    if (fillRef.current) {
      fillRef.current.style.width = `${s.rage.toFixed(1)}%`
      trackRef.current.dataset.hot = s.tier >= 3 ? '1' : '0'
    }
    if (ringRef.current) {
      if (s.charge) {
        const c = s.charge
        ringRef.current.style.opacity = '1'
        ringRef.current.style.transform = `translate(${c.x}px,${c.y}px) scale(${(0.35 + c.level * 0.95).toFixed(3)}) rotate(${(now / 4) % 360}deg)`
        ringRef.current.style.borderColor = `hsl(${40 - c.level * 40} 100% 55%)`
      } else ringRef.current.style.opacity = '0'
    }
    if (vignetteRef.current) {
      const beat = Math.exp(-((now - s.lastBeat) % 860) / 160)
      const v = s.charge ? s.charge.level * 0.6 : s.tier >= 3 && !s.releasing ? 0.08 + beat * 0.16 : 0
      vignetteRef.current.style.opacity = v.toFixed(3)
    }
    for (const p of s.projs.values()) {
      const el = projEls.current.get(p.id)
      if (!el) continue
      // Depth: props start big (near the viewer) and shrink as they fly toward him.
      const depth = p.held ? 1.18 : p.cancel ? 1 : 1 + Math.max(0, 0.42 - (now - p.born) / 1000) * 1.5
      el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%) rotate(${p.rot.toFixed(1)}deg) scale(${depth.toFixed(3)})`
      el.style.opacity = String(p.fade ?? 1)
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, l.w, l.h)
      particles.current.draw(ctx)
    }
  }

  // Main loop — runs only while this page is visible.
  useEffect(() => {
    if (!active || !layout) return
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const s = S.current
      const slow = now < s.slowUntil ? 0.3 : 1
      stepBoss(now < s.freezeUntil ? 0 : dt * slow, now)
      stepProjectiles(dt * slow, now)
      particles.current.step(dt * slow, L.current.py)
      render(now, dt * slow)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      const s = S.current
      if (s.charge) {
        s.charge.snd?.stop()
        s.charge = null
        setWorried(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, layout])

  useEffect(() => {
    if (!combo) return
    const t = setTimeout(() => setCombo(null), 900)
    return () => clearTimeout(t)
  }, [combo])

  const comboColor = !combo ? '' : combo.n >= 20 ? '#f15bb5' : combo.n >= 10 ? '#ff3d3d' : '#ff8a3d'
  const coolingDown = cool > performance.now()

  return (
    <div
      ref={arenaRef}
      data-nopage
      className="relative h-full w-full overflow-hidden"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* rage meter */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center gap-3 px-5" style={{ height: METER_H }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff6a3d">
          <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" />
        </svg>
        <div ref={trackRef} className="rage-track neu-in-sm relative h-3.5 flex-1 overflow-hidden rounded-full" data-hot="0">
          <div ref={fillRef} className="rage-fill absolute inset-y-0 left-0 rounded-full" style={{ width: '0%', background: 'linear-gradient(90deg,#ffd166,#ff8a3d 55%,#ff3d3d)' }} />
          {[1, 2, 3].map((t) => (
            <motion.span
              key={t}
              className="absolute inset-y-0 w-[3px] -translate-x-1/2"
              style={{ left: `${t * 25}%`, background: tier >= t ? TIERS[t].color : 'var(--ink-soft)' }}
              animate={{ opacity: tier >= t ? 1 : 0.35, scaleY: tier >= t ? [1, 1.8, 1] : 1 }}
              transition={{ duration: 0.35 }}
            />
          ))}
        </div>
        <FaceButton
          face={face}
          on={!!photo}
          onTap={() => {
            if (calmRef.current) return
            if (!face) return setStudio(true)
            A.whoosh(0.6)
            buzz(12)
            setFaceOnSaved(!faceOn)
          }}
          onLong={() => !calmRef.current && setStudio(true)}
        />
        <button
          aria-label="New day"
          onPointerDown={(e) => {
            e.stopPropagation()
            if (calmRef.current) return
            uiTick()
            buzz(10)
            newDay()
          }}
          className="neu-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-soft"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 17a7 7 0 0 1 14 0M3 20h18M12 4v3M5.6 8.6l1.6 1.6M18.4 8.6l-1.6 1.6" />
          </svg>
        </button>
      </div>

      {/* ground shadow */}
      {layout && (
        <div
          ref={shadowRef}
          className="pointer-events-none absolute rounded-full"
          style={{ left: layout.px, top: layout.py + 2, width: layout.bossW * 0.8, height: 18, background: 'radial-gradient(ellipse, rgba(0,0,0,.35), transparent 70%)', filter: 'blur(2px)' }}
        />
      )}

      {/* the boss */}
      {layout && (
        <div
          ref={bossRef}
          className="pointer-events-none absolute"
          style={{ left: layout.px - layout.bossW / 2, top: layout.py - layout.bossH, width: layout.bossW, height: layout.bossH, transformOrigin: '50% 100%', willChange: 'transform' }}
        >
          <BossFigure mood={mood} ouch={ouch} worried={worried} noseRed={noseRed} cos={cos} refs={fig} photo={photo} react={react} blink={blink} />
        </div>
      )}

      {/* charge reticle */}
      <div
        ref={ringRef}
        className="pointer-events-none absolute left-0 top-0 rounded-full"
        style={{
          width: 120, height: 120, marginLeft: -60, marginTop: -60, opacity: 0,
          border: '4px dashed #ffb03b',
          background: 'radial-gradient(circle, rgba(255,120,60,.35), rgba(255,60,40,.08) 60%, transparent 70%)',
          boxShadow: '0 0 30px rgba(255,90,40,.5)',
        }}
      />

      {/* thrown props */}
      {projs.map((p) => (
        <div
          key={p.id}
          ref={(el) => (el ? projEls.current.set(p.id, el) : projEls.current.delete(p.id))}
          className="pointer-events-none absolute left-0 top-0 z-10"
          style={{ filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.3))' }}
        >
          <PropIcon type={p.type} size={PROP[p.type].r * 2.5} />
        </div>
      ))}

      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full" />

      <div ref={vignetteRef} className="pointer-events-none absolute inset-0 z-10" style={{ opacity: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(255,40,20,.85) 100%)' }} />
      <div ref={flashRef} className="pointer-events-none absolute inset-0 z-30 bg-white" style={{ opacity: 0 }} />

      {/* combo */}
      <AnimatePresence>
        {combo && (
          <motion.div
            key={combo.key}
            className="pointer-events-none absolute z-20 font-black italic"
            style={{ top: METER_H + 8, right: 26, paddingRight: 6, transformOrigin: '100% 50%', fontSize: 46 + Math.min(combo.n, 30), color: comboColor, textShadow: '3px 3px 0 rgba(0,0,0,.22), 0 0 18px ' + comboColor + '66', fontFamily: "Impact, 'Arial Black', system-ui, sans-serif" }}
            initial={{ scale: 1.7, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 700, damping: 18 }}
          >
            ×{combo.n}
          </motion.div>
        )}
      </AnimatePresence>

      {/* prop tray */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-[7px] px-2" style={{ height: TRAY_H }}>
        {PROPS.map((p) => (
          <div
            key={p.type}
            role="button"
            aria-label={p.type}
            className="neu relative flex h-[46px] w-[46px] items-center justify-center rounded-[14px]"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => trayDown(e, p.type)}
            onPointerMove={trayMove}
            onPointerUp={trayUp}
            onPointerCancel={trayUp}
          >
            <PropIcon type={p.type} size={p.type === 'chair' || p.type === 'keyboard' ? 33 : 30} />
            {p.cooldown && coolingDown && (
              <motion.div
                key={cool}
                className="absolute inset-0 rounded-[14px]"
                style={{ background: 'rgba(0,0,0,.38)', transformOrigin: '50% 100%' }}
                initial={{ scaleY: 1 }}
                animate={{ scaleY: 0 }}
                transition={{ duration: p.cooldown / 1000, ease: 'linear' }}
                onAnimationComplete={() => setCool(0)}
              />
            )}
          </div>
        ))}
      </div>

      <SpeechBubble ref={speechRef} speech={speech} />
      <ComicWords words={words} />
      <TierBanner banner={banner} />
      <AnimatePresence>
        {review && (
          <ReviewCard
            key="review"
            stats={review}
            avatar={
              photo ? (
                <img src={photo.face.sprites.defeated} alt="" className="h-[170%] w-[170%] max-w-none" style={{ margin: '-12% 0 0 -35%' }} />
              ) : (
                <svg viewBox="40 40 120 120" className="h-full w-full"><ellipse cx="100" cy="100" rx="55" ry="54" fill="#F3C9A8" /><path d="M48 94 C 46 58, 80 40, 108 42 C 138 44, 158 62, 153 92 C 147 76, 128 64, 104 62 C 84 61, 62 72, 48 94 Z" fill="#3b2a20" /><path d="M64 101 L84 101 M116 101 L136 101" stroke="#2a1d17" strokeWidth="4" strokeLinecap="round" /><path d="M86 138 Q100 128 114 138" stroke="#2a1d17" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
              )
            }
            onDone={() => {
              setReview(null)
              setCalm(true)
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{calm && <Calm key="calm" onDone={() => newDay(true)} />}</AnimatePresence>
      <AnimatePresence>
        {studio && (
          <FaceStudio
            key="studio"
            face={face}
            faceOn={faceOn}
            onClose={() => setStudio(false)}
            onToggle={(v) => setFaceOnSaved(v)}
            onSave={(f) => {
              setFace(f)
              setFaceOnSaved(true)
              kvSet('face', f).catch(() => {})
              setStudio(false)
              newDay(true)
            }}
            onDelete={() => {
              kvDel('face').catch(() => {})
              setFace(null)
              setStudio(false)
              newDay(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Meter-row button: shows the photo boss thumbnail when active. Tap swaps photo <-> cartoon instantly
// (handy if someone glances at your screen); long-press opens the photo studio.
function FaceButton({ face, on, onTap, onLong }) {
  const t = useRef(0)
  const fired = useRef(false)
  return (
    <button
      aria-label="Photo boss"
      onPointerDown={(e) => {
        e.stopPropagation()
        fired.current = false
        clearTimeout(t.current)
        t.current = setTimeout(() => {
          fired.current = true
          buzz(20)
          onLong()
        }, 480)
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        clearTimeout(t.current)
        if (!fired.current) onTap()
      }}
      onPointerLeave={() => clearTimeout(t.current)}
      onPointerCancel={() => clearTimeout(t.current)}
      className="neu-sm relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-soft"
      style={on ? { boxShadow: '0 0 0 2px var(--accent), 3px 3px 7px var(--lo), -3px -3px 7px var(--hi)' } : undefined}
    >
      {face && on ? (
        <img src={face.sprites.smug} alt="" draggable={false} className="h-[150%] w-[150%] max-w-none" style={{ marginTop: '10%' }} />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="9" r="4" />
          <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
        </svg>
      )}
    </button>
  )
}
