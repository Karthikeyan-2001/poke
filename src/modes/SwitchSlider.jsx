import { useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { clunk, magnetSnap, softTick } from '../audio.js'
import { buzz, H } from '../haptics.js'
import { bump, observeSize, useShake } from '../store.js'

// ── Heavy industrial toggle ─────────────────────────────────────
const T = 62 // knob travel from the pivot

function HeavyToggle({ s }) {
  const shake = useShake()
  const y = useMotionValue(T) // +T = down = OFF, -T = up = ON
  const onRef = useRef(false)
  const [on, setOn] = useState(false)
  const drag = useRef(null)
  const anim = useRef(null)

  const shaftTop = useTransform(y, (v) => Math.min(v, 0))
  const shaftH = useTransform(y, (v) => Math.abs(v))
  const knobScale = useTransform(y, [-T, 0, T], [1.1, 0.88, 1.1])
  const knobShadow = useTransform(
    y,
    (v) =>
      `0 ${8 + Math.abs(v) * 0.16}px ${12 + Math.abs(v) * 0.2}px rgba(0,0,0,.38), inset 0 -4px 8px rgba(0,0,0,.28), inset 0 3px 5px rgba(255,255,255,.75)`,
  )

  const flip = () => {
    const next = !onRef.current
    onRef.current = next
    setOn(next)
    anim.current?.stop()
    anim.current = animate(y, next ? -T : T, { type: 'spring', stiffness: 1300, damping: 32, mass: 1.4 })
    clunk(next)
    setTimeout(shake, 30)
    buzz(H.clunk)
    bump()
  }

  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    anim.current?.stop()
    drag.current = { y0: e.clientY, start: onRef.current ? -T : T, moved: false, flipped: false }
  }
  const move = (e) => {
    const d = drag.current
    if (!d || d.flipped) return
    const dy = (e.clientY - d.y0) / s
    if (Math.abs(dy) > 5) d.moved = true
    const dir = onRef.current ? 1 : -1 // direction the knob must travel to flip
    const along = dy * dir
    // Heavy over-center spring: knob lags the finger, then snaps once past the detent.
    const disp = d.start + dir * (along > 0 ? along * 0.5 : along * 0.08)
    y.set(Math.max(-T - 6, Math.min(T + 6, disp)))
    if (along * 0.5 > T * 0.88) {
      d.flipped = true
      flip()
    }
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d || d.flipped) return
    if (!d.moved) flip()
    else anim.current = animate(y, onRef.current ? -T : T, { type: 'spring', stiffness: 900, damping: 24 })
  }

  return (
    <div
      data-nopage
      className="steel relative rounded-[26px]"
      style={{ width: 180, height: 250, touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {[
        [14, 14],
        [14, 152],
        [222, 14],
        [222, 152],
      ].map(([t, l], i) => (
        <span key={i} className="screw" style={{ top: t, left: l, '--r': `${20 + i * 37}deg` }} />
      ))}

      {/* status LED */}
      <div className="absolute left-1/2 top-[18px] -translate-x-1/2">
        <motion.div
          className="h-[10px] w-[10px] rounded-full"
          animate={{
            backgroundColor: on ? '#5dff9a' : '#3a2a22',
            boxShadow: on
              ? '0 0 10px 3px rgba(80,255,150,.7), inset 0 1px 1px rgba(255,255,255,.8)'
              : 'inset 0 1px 2px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.3)',
          }}
          transition={{ duration: 0.12 }}
        />
      </div>

      {/* engraved I / O glyphs */}
      <span className="absolute left-1/2 top-[44px] h-[14px] w-[3px] -translate-x-1/2 rounded-full" style={{ background: 'rgba(0,0,0,.28)', boxShadow: '0 1px 0 rgba(255,255,255,.45)' }} />
      <span className="absolute bottom-[38px] left-1/2 h-[14px] w-[14px] -translate-x-1/2 rounded-full" style={{ border: '3px solid rgba(0,0,0,.28)', boxShadow: '0 1px 0 rgba(255,255,255,.45)' }} />

      <div className="absolute left-1/2 top-1/2">
        <div className="absolute rounded-full" style={{ width: 92, height: 92, left: -46, top: -46, boxShadow: 'inset 0 4px 8px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.5)', background: 'rgba(0,0,0,.08)' }} />
        <div className="nut absolute" style={{ width: 74, height: 66, left: -37, top: -33 }} />
        <motion.div className="shaft absolute" style={{ left: -10, width: 20, top: shaftTop, height: shaftH }} />
        <motion.div className="knob absolute" style={{ left: -27, top: -27, width: 54, height: 54, y, scale: knobScale, boxShadow: knobShadow }} />
      </div>
    </div>
  )
}

// ── Two-piece magnetic slider ───────────────────────────────────
const R = 58 // plate travel from center
const RESIST = 0.62 // strength of the center hump

function MagSlider({ s }) {
  const y = useMotionValue(R)
  const side = useRef(1)
  const drag = useRef(null)
  const anim = useRef(null)
  const plateShadow = useTransform(y, (v) => `0 ${12 + (v / R) * 4}px 22px rgba(0,0,0,.4), inset 0 2px 1px rgba(255,255,255,.45), inset 0 -3px 3px rgba(0,0,0,.3)`)

  const shape = (raw) => {
    let t = (raw + R) / (2 * R)
    if (t < 0) return -R + t * 2 * R * 0.18 // rubber-band beyond the ends
    if (t > 1) return R + (t - 1) * 2 * R * 0.18
    t = t + (RESIST * Math.sin(2 * Math.PI * t)) / (2 * Math.PI) // slows near center, eager near ends
    return t * 2 * R - R
  }

  const snapTo = (target, strength) => {
    side.current = Math.sign(target)
    anim.current = animate(y, target, { type: 'spring', stiffness: 950, damping: 30, mass: 0.8 })
    magnetSnap(strength)
    setTimeout(() => buzz(H.snap), 40)
    bump()
  }

  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    anim.current?.stop()
    drag.current = { y0: e.clientY, start: y.get(), t: performance.now(), last: e.clientY, v: 0, moved: false, sign: Math.sign(y.get()) }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const dy = (e.clientY - d.y0) / s
    if (Math.abs(dy) > 4) d.moved = true
    const pos = shape(d.start + dy)
    y.set(pos)
    const now = performance.now()
    const dt = Math.max(1, now - d.t)
    d.v = d.v * 0.5 + (((e.clientY - d.last) / s) / dt) * 0.5
    d.t = now
    d.last = e.clientY
    const sg = Math.sign(pos)
    if (sg !== 0 && sg !== d.sign) {
      d.sign = sg
      softTick()
      buzz(H.tick)
    }
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) return snapTo(-side.current * R, 1)
    const proj = y.get() + d.v * 90
    const target = proj < 0 ? -R : R
    snapTo(target, target === Math.sign(d.start) * R ? 0.55 : 1)
  }

  return (
    <div
      data-nopage
      className="magbase relative rounded-[36px]"
      style={{ width: 128, height: 268, touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="absolute left-1/2 top-[22px] bottom-[22px] w-[10px] -translate-x-1/2 rounded-full" style={{ background: 'rgba(0,0,0,.55)', boxShadow: 'inset 0 2px 3px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.12)' }} />
      <span className="magnet absolute left-1/2 top-[30px] h-[26px] w-[26px] -translate-x-1/2 rounded-full" />
      <span className="magnet absolute bottom-[30px] left-1/2 h-[26px] w-[26px] -translate-x-1/2 rounded-full" />
      <motion.div
        className="magplate absolute left-[-6px] right-[-6px] rounded-[30px]"
        style={{ height: 136, top: 'calc(50% - 68px)', y, boxShadow: plateShadow }}
      >
        <span className="absolute left-1/2 top-1/2 h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle at 40% 35%, rgba(0,0,0,.25), rgba(0,0,0,.05) 70%)', boxShadow: 'inset 0 3px 5px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.4)' }} />
      </motion.div>
    </div>
  )
}

export default function SwitchSlider() {
  const ref = useRef(null)
  const [s, setS] = useState(1)

  useLayoutEffect(
    () =>
      observeSize(ref.current, (w, h) => {
        if (w > 10 && h > 10) setS(Math.max(0.55, Math.min(1.15, h / 640, w / 340)))
      }),
    [],
  )

  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div style={{ transform: `scale(${s})` }}>
          <HeavyToggle s={s} />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div style={{ transform: `scale(${s})` }}>
          <MagSlider s={s} />
        </div>
      </div>
    </div>
  )
}
