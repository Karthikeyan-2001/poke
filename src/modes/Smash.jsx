import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createParticles, dust, ring, shards, sparks } from './boss/particles.js'
import { shatter, chairCrash } from '../audioBoss.js'
import { pop } from '../audio.js'
import { synth } from '../audio.js'
import { buzz } from '../haptics.js'
import { bump, observeSize, useShake } from '../store.js'

// ── Breakables ─────────────────────────────────────────────────
// Each: SVG art (viewBox 0 0 100 100, resting on y=100), shard palette, and how it breaks.
const ITEMS = {
  plate: {
    shards: ['#ffffff', '#f2f2ee', '#2f6fd6', '#e9e9e2'],
    art: (
      <>
        <ellipse cx="50" cy="52" rx="40" ry="44" fill="#fbfbf7" stroke="#d8d8d0" strokeWidth="2" />
        <ellipse cx="50" cy="52" rx="33" ry="37" fill="none" stroke="#2f6fd6" strokeWidth="4" />
        <ellipse cx="50" cy="52" rx="20" ry="23" fill="#f1f1ec" />
        <path d="M30 30 q8 -8 16 -9" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  mug: {
    shards: ['#ff6a3d', '#e9552c', '#ffffff', '#5b3a1e'],
    art: (
      <>
        <path d="M74 44 h6 a12 12 0 0 1 0 24 h-6" stroke="#e9552c" strokeWidth="7" fill="none" />
        <path d="M20 30 h56 v52 a14 14 0 0 1 -14 14 h-28 a14 14 0 0 1 -14 -14 z" fill="#ff6a3d" />
        <ellipse cx="48" cy="31" rx="28" ry="5" fill="#5b3a1e" />
        <rect x="27" y="40" width="7" height="40" rx="3" fill="rgba(255,255,255,.3)" />
      </>
    ),
  },
  vase: {
    shards: ['#3aa6a0', '#2b7f7a', '#f2e6c9', '#d9a441'],
    art: (
      <>
        <path d="M38 6 h24 v8 q-2 6 6 14 q16 18 10 44 q-4 22 -28 28 q-24 -6 -28 -28 q-6 -26 10 -44 q8 -8 6 -14 z" fill="#3aa6a0" />
        <path d="M24 56 q26 8 52 0 M26 70 q24 8 48 0" stroke="#f2e6c9" strokeWidth="4" fill="none" />
        <path d="M30 60 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" stroke="#d9a441" strokeWidth="2.5" fill="none" />
        <path d="M34 34 q-6 14 -4 30" stroke="rgba(255,255,255,.4)" strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  glass: {
    shards: ['rgba(200,235,255,.9)', 'rgba(255,255,255,.95)', 'rgba(170,215,245,.85)', '#b3122d'],
    glass: true,
    art: (
      <>
        <path d="M28 8 h44 q2 30 -14 40 q-6 4 -6 10 v28 h16 v6 h-36 v-6 h16 v-28 q0 -6 -6 -10 q-16 -10 -14 -40 z" fill="rgba(200,230,255,.35)" stroke="rgba(170,210,240,.9)" strokeWidth="2.5" />
        <path d="M31 24 h38 q-2 14 -12 20 q-7 4 -14 0 q-10 -6 -12 -20 z" fill="#b3122d" opacity=".85" />
        <path d="M34 12 q-2 16 4 26" stroke="rgba(255,255,255,.85)" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  bottle: {
    shards: ['#2f8f4e', '#1f6b38', '#9fdcb0', '#f2e6c9'],
    glass: true,
    art: (
      <>
        <path d="M42 2 h16 v20 q0 8 8 14 q6 5 6 14 v42 a6 6 0 0 1 -6 6 h-32 a6 6 0 0 1 -6 -6 v-42 q0 -9 6 -14 q8 -6 8 -14 z" fill="#2f8f4e" opacity=".92" />
        <rect x="32" y="54" width="36" height="22" rx="3" fill="#f2e6c9" />
        <path d="M38 62 h24 M38 68 h16" stroke="#b08a4a" strokeWidth="2.5" />
        <path d="M34 42 q-2 20 0 40" stroke="rgba(255,255,255,.45)" strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  bulb: {
    shards: ['rgba(255,250,210,.95)', 'rgba(255,255,255,.95)', '#9aa0a8', '#ffd84d'],
    glass: true,
    zap: true,
    art: (
      <>
        <circle cx="50" cy="38" r="30" fill="rgba(255,245,190,.75)" stroke="rgba(230,210,120,.9)" strokeWidth="2.5" />
        <path d="M42 50 l4 -14 l4 10 l4 -10 l4 14" stroke="#e3a21a" strokeWidth="2.5" fill="none" />
        <path d="M38 66 h24 v6 h-24 z M38 74 h24 v6 h-24 z M41 82 h18 v8 a6 6 0 0 1 -6 6 h-6 a6 6 0 0 1 -6 -6 z" fill="#9aa0a8" />
        <path d="M30 26 q4 -10 14 -12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    ),
  },
}
const KINDS = Object.keys(ITEMS)
const randKind = (not) => {
  let k
  do k = KINDS[(Math.random() * KINDS.length) | 0]
  while (k === not)
  return k
}
const ROWS = 2
const COLS = 3
const WORDS = ['SMASH!', 'CRASH!', 'KRAK!', 'SHATTER!', 'BOOM!', 'KSSH!']

// Glassy "tink" when a fresh item lands on the shelf.
function clink() {
  const { ready, bus, tone, now, vary } = synth
  if (!ready()) return
  const o = bus(0.3), t = now()
  tone(o, t, { f0: vary(2600, 0.1), gain: 0.06, decay: 0.18 })
  tone(o, t, { f0: vary(3900, 0.1), gain: 0.03, decay: 0.12 })
  tone(o, t, { f0: 140, f1: 90, glide: 0.06, gain: 0.18, decay: 0.06 })
}

export default function Smash({ active }) {
  const shake = useShake()
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const sys = useRef(null)
  if (!sys.current) sys.current = createParticles()
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [slots, setSlots] = useState(() => Array.from({ length: ROWS * COLS }, (_, i) => ({ id: i, kind: randKind(), alive: true, key: Math.random() })))
  const slotsRef = useRef(slots)
  slotsRef.current = slots
  const [words, setWords] = useState([])
  const [wobble, setWobble] = useState([0, 0])
  const combo = useRef({ n: 0, t: 0 })
  const ptrs = useRef(new Map())

  useLayoutEffect(
    () =>
      observeSize(wrapRef.current, (w, h) => {
        setSize({ w, h })
        const c = canvasRef.current
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
        c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
      }),
    [],
  )

  // Particle loop (only while visible).
  useEffect(() => {
    if (!active || !size.w) return
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      sys.current.step(dt, size.h - 4)
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, size.w, size.h)
      sys.current.draw(ctx)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [active, size])

  const smash = (i) => {
    const s = slotsRef.current[i]
    if (!s?.alive) return
    const el = wrapRef.current.querySelector(`[data-slot="${i}"]`)
    const wr = wrapRef.current.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const x = r.left - wr.left + r.width / 2
    const y = r.top - wr.top + r.height * 0.55
    const def = ITEMS[s.kind]
    const now = performance.now()
    combo.current.n = now - combo.current.t < 900 ? combo.current.n + 1 : 1
    combo.current.t = now
    const big = combo.current.n >= 3
    // Sound, feel, debris.
    shatter()
    if (def.zap) pop()
    if (big) chairCrash()
    buzz(big ? [60, 25, 40] : [40, 20, 25])
    shards(sys.current, x, y, def.glass ? 26 : 20, def.shards)
    if (def.zap) sparks(sys.current, x, y, 22, 900)
    dust(sys.current, x, y + r.height * 0.3, 6, 'rgb(200,195,185)')
    ring(sys.current, x, y, r.width * 0.8, 'rgba(255,255,255,.8)')
    if (big) shake()
    const id = Math.random()
    const text = combo.current.n >= 3 ? `×${combo.current.n}` : WORDS[(Math.random() * WORDS.length) | 0]
    setWords((ws) => [...ws.slice(-3), { id, x, y: y - r.height * 0.5, text, rot: (Math.random() - 0.5) * 30, big }])
    setTimeout(() => setWords((ws) => ws.filter((w) => w.id !== id)), 750)
    // Shelf wobble.
    const row = Math.floor(i / COLS)
    setWobble((w) => w.map((v, k) => (k === row ? Math.random() * 2 + 1 : v)))
    setTimeout(() => setWobble([0, 0]), 220)
    bump()
    // Empty slot, then a fresh item drops in.
    setSlots((ss) => ss.map((q, k) => (k === i ? { ...q, alive: false } : q)))
    setTimeout(() => {
      setSlots((ss) => ss.map((q, k) => (k === i ? { ...q, alive: true, kind: randKind(q.kind), key: Math.random() } : q)))
      setTimeout(clink, 420)
    }, 650 + Math.random() * 300)
  }

  const slotAt = (cx, cy) => {
    const el = document.elementFromPoint(cx, cy)?.closest('[data-slot]')
    return el ? Number(el.dataset.slot) : null
  }
  // Tap to smash, or swipe across several in one stroke.
  const onDown = (e) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* gone */
    }
    const i = slotAt(e.clientX, e.clientY)
    ptrs.current.set(e.pointerId, i)
    if (i !== null) smash(i)
  }
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return
    const i = slotAt(e.clientX, e.clientY)
    if (i !== null && i !== ptrs.current.get(e.pointerId)) {
      ptrs.current.set(e.pointerId, i)
      smash(i)
    }
  }
  const onUp = (e) => ptrs.current.delete(e.pointerId)

  const cell = Math.min((size.w - 32) / COLS, (size.h - 40) / (ROWS * 1.35))

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <div
        data-nopage
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ touchAction: 'none', gap: cell * 0.32 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {Array.from({ length: ROWS }, (_, row) => (
          <motion.div key={row} className="relative" animate={{ rotate: wobble[row] ? [0, -wobble[row], wobble[row] * 0.6, 0] : 0 }} transition={{ duration: 0.22 }}>
            <div className="flex items-end justify-center" style={{ gap: 6 }}>
              {Array.from({ length: COLS }, (_, c) => {
                const i = row * COLS + c
                const s = slots[i]
                return (
                  <div key={i} data-slot={i} className="relative" style={{ width: cell, height: cell }}>
                    <AnimatePresence>
                      {s.alive && (
                        <motion.svg
                          key={s.key}
                          viewBox="0 0 100 100"
                          className="pointer-events-none absolute inset-[6%]"
                          style={{ filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.25))', overflow: 'visible' }}
                          initial={{ y: -size.h * 0.7, rotate: (Math.random() - 0.5) * 30, opacity: 1 }}
                          animate={{ y: 0, rotate: 0, opacity: 1 }}
                          exit={{ scale: 1.15, opacity: 0, transition: { duration: 0.06 } }}
                          transition={{ type: 'spring', stiffness: 260, damping: 13 }}
                        >
                          {ITEMS[s.kind].art}
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
            {/* the wooden shelf */}
            <div
              className="mx-auto rounded-md"
              style={{
                width: cell * COLS + 28,
                height: 16,
                marginTop: -4,
                background: 'linear-gradient(180deg,#b97a45,#8a5328 60%,#6b3e1d)',
                boxShadow: '0 10px 16px rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.25)',
              }}
            />
          </motion.div>
        ))}
      </div>

      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <AnimatePresence>
        {words.map((w) => (
          <motion.div
            key={w.id}
            className="pointer-events-none absolute z-10 whitespace-nowrap font-black italic"
            style={{
              left: w.x,
              top: w.y,
              translateX: '-50%',
              fontSize: w.big ? 38 : 28,
              fontFamily: "'Bangers', Impact, 'Arial Black', sans-serif",
              color: w.big ? '#ff6a3d' : '#ffd23f',
              WebkitTextStroke: '2.5px #1a1a1a',
              paintOrder: 'stroke fill',
              textShadow: '3px 3px 0 rgba(0,0,0,.25)',
            }}
            initial={{ scale: 0.2, rotate: w.rot * 2, opacity: 0 }}
            animate={{ scale: [0.2, 1.25, 1], rotate: w.rot, opacity: 1, y: -40 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.4, y: { duration: 0.75 } }}
          >
            {w.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
