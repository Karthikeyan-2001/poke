import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import BubbleWrap from './modes/BubbleWrap.jsx'
import Keycaps from './modes/Keycaps.jsx'
import SwitchSlider from './modes/SwitchSlider.jsx'
import Dial from './modes/Dial.jsx'
import Boss from './modes/Boss.jsx'
import HapticsPanel from './HapticsPanel.jsx'
import { ShakeContext, useCount } from './store.js'
import { uiTick } from './audio.js'
import { buzz, H } from './haptics.js'

const MODES = [BubbleWrap, Keycaps, SwitchSlider, Dial, Boss]

function Counter({ onLongPress }) {
  const count = useCount()
  const timer = useRef(0)
  const start = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(onLongPress, 650)
  }
  const cancel = () => clearTimeout(timer.current)
  return (
    <div
      data-nopage
      className="fixed left-1/2 z-20 -translate-x-1/2"
      style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      <div className="neu-sm flex h-8 min-w-[52px] items-center justify-center rounded-full px-3">
        <motion.span
          key={count}
          initial={{ y: -5, opacity: 0.35 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
          className="text-[13px] font-semibold tabular-nums tracking-wide text-soft"
        >
          {count}
        </motion.span>
      </div>
    </div>
  )
}

function ThemeToggle({ dark, onToggle }) {
  return (
    <motion.button
      data-nopage
      aria-label="Toggle theme"
      onPointerDown={onToggle}
      whileTap={{ scale: 0.88 }}
      className="neu-sm fixed z-20 flex h-8 w-8 items-center justify-center rounded-full text-soft"
      style={{ top: 'calc(env(safe-area-inset-top) + 14px)', right: 16 }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        )}
      </svg>
    </motion.button>
  )
}

const SITE = 'https://karthikeyanj.com'

// In the Android app, navigating to an outside site hands it to the phone's browser
// (the app stays open behind it); on the web it opens a new tab.
function openSite() {
  if (Capacitor.isNativePlatform()) window.location.href = SITE
  else window.open(SITE, '_blank', 'noopener')
}

function Credit() {
  return (
    <a
      href={SITE}
      target="_blank"
      rel="noopener"
      onClick={(e) => {
        e.preventDefault()
        uiTick()
        buzz(H.tick)
        openSite()
      }}
      className="fixed z-20 flex h-8 flex-col justify-center text-[10px] leading-[1.25] tracking-wide text-soft no-underline opacity-75 active:opacity-100"
      style={{ top: 'calc(env(safe-area-inset-top) + 14px)', left: 16, touchAction: 'manipulation' }}
    >
      <span>made for fun by</span>
      <span className="font-semibold">Karthikeyan J</span>
    </a>
  )
}

function Dots({ index, go }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-center justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="neu-in-sm flex items-center gap-1 rounded-full px-2 py-2">
        {MODES.map((_, i) => (
          <button key={i} aria-label={`Mode ${i + 1}`} onPointerDown={() => go(i)} className="flex h-8 items-center justify-center px-1.5">
            <motion.span
              className="block h-2 rounded-full"
              animate={{ width: i === index ? 22 : 8, backgroundColor: i === index ? 'var(--accent)' : 'var(--ink-soft)', opacity: i === index ? 1 : 0.45 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [index, setIndex] = useState(0)
  const [panel, setPanel] = useState(false)
  const [w, setW] = useState(window.innerWidth)
  const x = useMotionValue(0)
  const shakeX = useMotionValue(0)
  const shakeY = useMotionValue(0)
  const idxRef = useRef(0)
  const drag = useRef(null)

  useEffect(() => {
    const r = () => setW(window.innerWidth)
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    idxRef.current = index
    animate(x, -index * w, { type: 'spring', stiffness: 320, damping: 36 })
  }, [index, w, x])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#161618' : '#F4F4F0')
    try {
      localStorage.setItem('poke-theme', dark ? 'dark' : 'light')
    } catch {
      /* private mode */
    }
  }, [dark])

  const go = useCallback((i) => {
    const n = Math.max(0, Math.min(MODES.length - 1, i))
    if (n !== idxRef.current) {
      uiTick()
      buzz(H.tick)
    }
    idxRef.current = n
    setIndex(n)
  }, [])

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'ArrowRight') go(idxRef.current + 1)
      if (e.key === 'ArrowLeft') go(idxRef.current - 1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [go])

  const shake = useCallback(() => {
    animate(shakeX, [0, -7, 6, -4, 3, -1, 0], { duration: 0.32, ease: 'easeOut' })
    animate(shakeY, [0, 3, -2, 1, 0], { duration: 0.26, ease: 'easeOut' })
  }, [shakeX, shakeY])

  // Page swipe: only starts on surfaces that are not themselves interactive (data-nopage).
  const onDown = (e) => {
    if (e.target.closest('[data-nopage]')) return
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), active: false }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x0
    if (!d.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.clientY - d.y0)) {
        d.active = true
        e.currentTarget.setPointerCapture(e.pointerId)
      } else return
    }
    const i = idxRef.current
    const edge = (i === 0 && dx > 0) || (i === MODES.length - 1 && dx < 0)
    x.set(-i * w + (edge ? dx * 0.28 : dx))
  }
  const onUp = (e) => {
    const d = drag.current
    drag.current = null
    if (!d || !d.active || d.id !== e.pointerId) return
    const dx = e.clientX - d.x0
    const v = dx / Math.max(1, performance.now() - d.t0)
    const i = idxRef.current
    let n = i
    if (dx < -w * 0.22 || v < -0.45) n = i + 1
    else if (dx > w * 0.22 || v > 0.45) n = i - 1
    n = Math.max(0, Math.min(MODES.length - 1, n))
    if (n === i) animate(x, -i * w, { type: 'spring', stiffness: 380, damping: 34 })
    else go(n)
  }

  const toggleTheme = () => {
    uiTick()
    buzz(H.tick)
    setDark((d) => !d)
  }

  return (
    <ShakeContext.Provider value={shake}>
      <motion.div
        className="fixed inset-0 overflow-hidden bg-bg"
        style={{ x: shakeX, y: shakeY }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <motion.div className="flex h-full" style={{ x, width: w * MODES.length }}>
          {MODES.map((Mode, i) => (
            <section
              key={i}
              className="relative h-full shrink-0"
              style={{
                width: w,
                paddingTop: 'calc(env(safe-area-inset-top) + 60px)',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)',
              }}
            >
              <Mode active={i === index} />
            </section>
          ))}
        </motion.div>
      </motion.div>
      <Counter onLongPress={() => setPanel(true)} />
      <Credit />
      <ThemeToggle dark={dark} onToggle={toggleTheme} />
      <HapticsPanel open={panel} onClose={() => setPanel(false)} />
      <Dots index={index} go={go} />
    </ShakeContext.Provider>
  )
}
