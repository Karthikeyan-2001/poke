import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { chime, startPad } from '../../audioBoss.js'
import { buzz } from '../../haptics.js'

// Guided breathing after a rage release: 3 cycles of inhale 4s · hold 1.5s · exhale 5.5s.
const SEQ = [
  ['in', 4000],
  ['hold', 1500],
  ['out', 5500],
]
const CYCLES = 3
const SCALE = { in: 1, hold: 1, out: 0.55 }

const MOTES = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 61) % 100,
  d: 9 + ((i * 7) % 8),
  s: 3 + (i % 4) * 2,
  delay: (i * 0.73) % 6,
}))

export default function Calm({ onDone }) {
  const [phase, setPhase] = useState('out')
  const [cycle, setCycle] = useState(0)
  const [dur, setDur] = useState(1)
  const born = useRef(performance.now())
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const pad = startPad()
    const timers = []
    let t = 600
    for (let c = 0; c < CYCLES; c++) {
      for (const [ph, d] of SEQ) {
        timers.push(
          setTimeout(() => {
            setPhase(ph)
            setCycle(c)
            setDur(d / 1000)
            if (ph === 'in') {
              pad?.breathe(true, d / 1000)
              buzz(14)
            } else if (ph === 'out') {
              pad?.breathe(false, d / 1000)
              buzz(10)
            }
          }, t),
        )
        t += d
      }
    }
    timers.push(
      setTimeout(() => {
        chime()
        doneRef.current()
      }, t),
    )
    return () => {
      timers.forEach(clearTimeout)
      pad?.stop()
    }
  }, [])

  const exit = () => {
    if (performance.now() - born.current > 3500) {
      chime()
      doneRef.current()
    }
  }

  return (
    <motion.div
      data-nopage
      className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden"
      style={{ background: 'color-mix(in srgb, var(--bg) 78%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9 } }}
      transition={{ duration: 1.2 }}
      onPointerDown={exit}
    >
      {MOTES.map((m, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ left: `${m.x}%`, bottom: -20, width: m.s, height: m.s, background: 'rgba(140,210,200,.45)', filter: 'blur(.5px)' }}
          animate={{ y: [0, -900], opacity: [0, 0.9, 0] }}
          transition={{ duration: m.d, delay: m.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      <div className="relative flex items-center justify-center" style={{ width: 'min(78vw, 340px)', aspectRatio: '1' }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(120,220,205,.45) 0%, rgba(150,140,240,.22) 45%, transparent 70%)' }}
          animate={{ scale: SCALE[phase] * 1.25, opacity: phase === 'out' ? 0.5 : 1 }}
          transition={{ duration: dur, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: '14%',
            background: 'radial-gradient(circle at 35% 30%, #d8fff6 0%, #8fd8cb 40%, #9a92e8 100%)',
            boxShadow: '0 20px 60px rgba(110,170,200,.45), inset 0 -12px 30px rgba(80,60,160,.35), inset 0 10px 24px rgba(255,255,255,.6)',
          }}
          initial={{ scale: 0.55 }}
          animate={{ scale: SCALE[phase] }}
          transition={{ duration: dur, ease: [0.45, 0, 0.55, 1] }}
        />
        <motion.div
          className="absolute rounded-full border-2"
          style={{ inset: '6%', borderColor: 'rgba(140,200,210,.35)' }}
          animate={{ scale: phase === 'hold' ? [1, 1.04, 1] : 1, opacity: phase === 'hold' ? 1 : 0.5 }}
          transition={{ duration: 1.5 }}
        />
      </div>

      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2">
        {Array.from({ length: CYCLES }, (_, i) => (
          <motion.span
            key={i}
            className="block h-2 rounded-full"
            animate={{ width: i === cycle ? 22 : 8, backgroundColor: i <= cycle ? '#8fd8cb' : 'var(--ink-soft)', opacity: i <= cycle ? 1 : 0.35 }}
          />
        ))}
      </div>
    </motion.div>
  )
}
