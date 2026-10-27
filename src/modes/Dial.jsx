import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'framer-motion'
import { ratchet } from '../audio.js'
import { buzz, H } from '../haptics.js'
import { bump, observeSize } from '../store.js'

const STEP = 15 // degrees per detent
const MARKS = 360 / STEP
const NOTCH_PULL = (STEP * 0.34) / (2 * Math.PI) // subtle visual "lingering" in each notch
const FRICTION = 0.9973 // per ms
const MAX_V = 3.2 // deg/ms

export default function Dial() {
  const wrapRef = useRef(null)
  const faceRef = useRef(null)
  const [D, setD] = useState(280)
  const [detent, setDetent] = useState(0)
  const disp = useMotionValue(0)
  const rot = useRef(0)
  const vel = useRef(0)
  const lastIdx = useRef(0)
  const lastTick = useRef(0)
  const lastBuzz = useRef(0)
  const raf = useRef(0)
  const settleAnim = useRef(null)
  const drag = useRef(null)

  useLayoutEffect(
    () =>
      observeSize(wrapRef.current, (w, h) => {
        if (w > 10 && h > 10) setD(Math.round(Math.max(170, Math.min(340, w * 0.68, h * 0.62))))
      }),
    [],
  )

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // Push current rotation to the view and fire a ratchet tick on each detent crossing.
  const apply = () => {
    const r = rot.current
    disp.set(r - NOTCH_PULL * Math.sin((2 * Math.PI * r) / STEP))
    const idx = Math.round(r / STEP)
    if (idx === lastIdx.current) return false
    const n = Math.abs(idx - lastIdx.current)
    lastIdx.current = idx
    const t = performance.now()
    if (t - lastTick.current > 14) {
      ratchet(Math.min(1, Math.abs(vel.current) / 1.5))
      lastTick.current = t
    }
    if (t - lastBuzz.current > 32) {
      buzz(H.detent)
      lastBuzz.current = t
    }
    bump(Math.min(n, 4))
    setDetent(idx)
    return true
  }

  const settle = () => {
    const target = Math.round(rot.current / STEP) * STEP
    settleAnim.current = animate(rot.current, target, {
      type: 'spring',
      stiffness: 520,
      damping: 24,
      onUpdate: (v) => {
        rot.current = v
        apply()
      },
    })
  }

  const spin = () => {
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min(32, now - last)
      last = now
      rot.current += vel.current * dt
      vel.current *= Math.pow(FRICTION, dt)
      if (apply()) vel.current *= 0.99 // each pawl engagement bleeds a little energy
      if (Math.abs(vel.current) < 0.03) return settle()
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  const angleOf = (e, d) => (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI

  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    cancelAnimationFrame(raf.current)
    settleAnim.current?.stop()
    const r = faceRef.current.getBoundingClientRect()
    const d = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, t: performance.now() }
    d.a = angleOf(e, d)
    drag.current = d
    vel.current = 0
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.cx
    const dy = e.clientY - d.cy
    if (dx * dx + dy * dy < 14 * 14) return // too close to the axis — angle is noise
    const a = angleOf(e, d)
    let da = a - d.a
    if (da > 180) da -= 360
    if (da < -180) da += 360
    const now = performance.now()
    const dt = Math.max(1, now - d.t)
    d.a = a
    d.t = now
    rot.current += da
    vel.current = Math.max(-MAX_V, Math.min(MAX_V, vel.current * 0.55 + (da / dt) * 0.45))
    apply()
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (performance.now() - d.t > 70) vel.current = 0 // finger paused before lifting
    if (Math.abs(vel.current) > 0.08) spin()
    else settle()
  }

  const ring = D + 70
  const active = ((detent % MARKS) + MARKS) % MARKS

  return (
    <div ref={wrapRef} className="flex h-full items-center justify-center">
      <div className="neu relative rounded-full" style={{ width: ring, height: ring }}>
        {/* detent marks */}
        {Array.from({ length: MARKS }, (_, i) => (
          <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${i * STEP}deg) translateY(${-ring / 2 + 14}px)` }}>
            <motion.div
              className="-ml-[2px] h-[9px] w-[4px] rounded-full"
              animate={{
                backgroundColor: i === active ? 'var(--accent)' : 'var(--ink-soft)',
                opacity: i === active ? 1 : i % 6 === 0 ? 0.55 : 0.28,
                scaleY: i === active ? 1.35 : 1,
              }}
              transition={{ duration: 0.12 }}
              style={{ boxShadow: i === active ? '0 0 8px var(--accent)' : 'none' }}
            />
          </div>
        ))}

        <div className="neu-in absolute rounded-full" style={{ inset: 26 }} />

        <div
          ref={faceRef}
          data-nopage
          className="absolute rounded-full"
          style={{ width: D, height: D, left: (ring - D) / 2, top: (ring - D) / 2, touchAction: 'none', cursor: 'grab' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <motion.div className="knurl absolute inset-0 rounded-full" style={{ rotate: disp }} />
          <div className="dial-face pointer-events-none absolute rounded-full" style={{ inset: '9%' }} />
          <motion.div className="pointer-events-none absolute inset-0" style={{ rotate: disp }}>
            <div
              className="absolute left-1/2 rounded-full"
              style={{
                top: '13%',
                width: 8,
                height: '16%',
                marginLeft: -4,
                background: 'var(--accent)',
                boxShadow: 'inset 0 2px 3px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.6)',
              }}
            />
            <div
              className="absolute left-1/2 rounded-full"
              style={{ bottom: '20%', width: 14, height: 14, marginLeft: -7, boxShadow: 'inset 0 2px 4px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.6)' }}
            />
          </motion.div>
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: D * 0.2,
              height: D * 0.2,
              transform: 'translate(-50%,-50%)',
              background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,.5), rgba(0,0,0,.12) 70%)',
              boxShadow: 'inset 0 2px 3px rgba(255,255,255,.6), inset 0 -3px 5px rgba(0,0,0,.25), 0 2px 4px rgba(0,0,0,.25)',
            }}
          />
          <div className="dial-gloss pointer-events-none absolute rounded-full" style={{ inset: '9%' }} />
        </div>

        {/* fixed index pointer that pulses with every detent */}
        <motion.div
          key={detent}
          className="absolute left-1/2 h-0 w-0 -translate-x-1/2"
          style={{ top: 2, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid var(--accent)' }}
          initial={{ opacity: 1, y: 2 }}
          animate={{ opacity: 0.55, y: 0 }}
          transition={{ duration: 0.18 }}
        />
      </div>
    </div>
  )
}
