// Overlay effects for The Boss: speech bubble, comic hit words, rage-level banner, performance review.
import { forwardRef, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { stampThunk } from '../../audioBoss.js'
import { uiTick } from '../../audio.js'
import { buzz } from '../../haptics.js'
import { pick, TIERS, VERDICTS } from './lines.js'

const COMIC = "'Bangers', Impact, 'Arial Black', system-ui, sans-serif"

// Positioned every frame by the render loop (it follows his wobbling head).
export const SpeechBubble = forwardRef(function SpeechBubble({ speech }, ref) {
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-20" style={{ willChange: 'transform' }}>
      <AnimatePresence mode="wait">
        {speech && (
          <motion.div
            key={speech.key}
            className="relative"
            style={{ transformOrigin: '12% 100%', translateY: '-100%' }}
            initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          >
            <div
              className="max-w-[190px] rounded-[18px] px-3 py-2 text-[13px] font-bold leading-snug"
              style={{
                background: speech.shout ? '#fff3d6' : '#ffffff',
                color: '#1f1f1f',
                border: '2.5px solid #1f1f1f',
                boxShadow: '3px 4px 0 rgba(0,0,0,.18)',
                width: 'max-content',
              }}
            >
              {speech.text}
            </div>
            <svg width="22" height="14" viewBox="0 0 22 14" className="absolute" style={{ left: 14, bottom: -11 }}>
              <path d="M1 0 L8 13 L16 0" fill={speech.shout ? '#fff3d6' : '#fff'} stroke="#1f1f1f" strokeWidth="2.5" strokeLinejoin="round" />
              <rect x="0" y="-2" width="22" height="3.2" fill={speech.shout ? '#fff3d6' : '#fff'} />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export function ComicWords({ words }) {
  return (
    <AnimatePresence>
      {words.map((w) => (
        <motion.div
          key={w.id}
          className="pointer-events-none absolute z-20 whitespace-nowrap"
          style={{
            left: w.x,
            top: w.y,
            fontFamily: COMIC,
            fontSize: w.size,
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: 1,
            color: w.color,
            WebkitTextStroke: '2.5px #1a1a1a',
            paintOrder: 'stroke fill',
            textShadow: '3px 3px 0 rgba(0,0,0,.25)',
            translateX: '-50%',
            translateY: '-50%',
          }}
          initial={{ scale: 0.2, rotate: w.rot * 2, opacity: 0 }}
          animate={{ scale: [0.2, 1.25, 1], rotate: w.rot, opacity: 1, y: -46 }}
          exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
          transition={{ duration: 0.42, y: { duration: 0.8, ease: 'easeOut' } }}
        >
          {w.text}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

export function TierBanner({ banner }) {
  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.key}
          className="pointer-events-none absolute left-0 right-0 z-30 flex justify-center"
          style={{ top: 58 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}
        >
          <motion.div
            className="rounded-xl px-4 py-1.5 text-center"
            style={{ background: TIERS[banner.tier].color, border: '3px solid #1a1a1a', boxShadow: '4px 4px 0 rgba(0,0,0,.25)', color: '#1a1a1a' }}
            initial={{ scale: 2.4, rotate: -12 }}
            animate={{ scale: 1, rotate: -3 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-70">Rage level {banner.tier}</div>
            <div style={{ fontFamily: COMIC, fontSize: 26, fontWeight: 900, fontStyle: 'italic', lineHeight: 1 }}>{TIERS[banner.tier].name}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ label, value, i }) {
  return (
    <motion.div
      className="flex items-baseline justify-between gap-6 border-b border-dashed py-1.5 text-[13px]"
      style={{ borderColor: 'rgba(0,0,0,.15)' }}
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 + i * 0.09 }}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-extrabold tabular-nums">{value}</span>
    </motion.div>
  )
}

// The punchline after a meltdown: the boss's own performance review, with your stats.
export function ReviewCard({ stats, avatar, onDone }) {
  const [verdict] = useState(() => pick(VERDICTS))
  const [stamped, setStamped] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => {
      setStamped(true)
      stampThunk()
      buzz([40, 30, 20])
    }, 1150)
    return () => clearTimeout(t)
  }, [])
  const secs = Math.max(1, Math.round(stats.secs))
  const rows = [
    ['Hits landed', stats.hits],
    ['Best combo', `×${stats.best}`],
    ['Haymakers', stats.haymaker],
    ['Coffees spilled', stats.mug],
    ['Pies delivered', stats.pie],
    ['Memos denied', stats.stamp],
    ['Time to meltdown', secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`],
  ]
  return (
    <motion.div
      data-nopage
      className="absolute inset-0 z-40 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <motion.div
        className="relative w-full max-w-[320px] rounded-2xl px-5 pb-4 pt-4"
        style={{ background: '#fbfaf5', color: '#1f1f1f', boxShadow: '0 30px 60px rgba(0,0,0,.35)', backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 27px, rgba(80,120,200,.08) 27px 28px)' }}
        initial={{ y: 80, rotate: 4, scale: 0.85 }}
        animate={{ y: 0, rotate: -1.5, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full" style={{ border: '2px solid #1f1f1f', background: '#e9e6dc' }}>
            {avatar}
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] opacity-60">Annual</div>
            <div className="text-[19px] font-black leading-tight">Performance Review</div>
          </div>
        </div>
        <div className="mt-3">
          {rows.map(([l, v], i) => (
            <Row key={l} label={l} value={v} i={i} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-[18px] tracking-wider">
            <span style={{ color: '#f2b632' }}>★</span>
            <span className="opacity-25">★★★★</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              uiTick()
              buzz(10)
              onDone()
            }}
            className="rounded-full px-4 py-2 text-[13px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#7fd6c8,#9a92e8)', boxShadow: '0 6px 14px rgba(110,140,200,.4)' }}
          >
            Breathe ›
          </motion.button>
        </div>
        <AnimatePresence>
          {stamped && (
            <motion.div
              className="pointer-events-none absolute right-3 top-14 rounded-md px-2 py-1 text-center font-black uppercase"
              style={{ border: '3.5px solid #d62828', color: '#d62828', fontSize: 15, lineHeight: 1.05, maxWidth: 150, fontFamily: "Impact, 'Arial Black', sans-serif", letterSpacing: 1, background: 'rgba(255,255,255,.4)' }}
              initial={{ scale: 3, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: -14, opacity: 0.92 }}
              transition={{ type: 'spring', stiffness: 700, damping: 18 }}
            >
              {verdict}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
