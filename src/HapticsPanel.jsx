import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { buzz, ENGINES, getHaptics, H, hapticsInfo, LENGTHS, setHaptics } from './haptics.js'
import { pop } from './audio.js'

const ENGINE_LABEL = { media: 'Media', notification: 'Alert', default: 'System', touch: 'Touch', web: 'Web' }
const LENGTH_LABEL = { short: 'Short', medium: 'Medium', long: 'Long' }

function Chip({ active, onPress, children }) {
  return (
    <button
      onPointerDown={onPress}
      className="h-9 rounded-full px-3 text-[13px] font-semibold"
      style={{
        background: 'var(--bg)',
        color: active ? 'var(--accent)' : 'var(--ink-soft)',
        boxShadow: active
          ? 'inset 3px 3px 7px var(--lo), inset -3px -3px 7px var(--hi)'
          : '3px 3px 7px var(--lo), -3px -3px 7px var(--hi)',
      }}
    >
      {children}
    </button>
  )
}

// Hidden diagnostics: long-press the counter. Pick the channel + length you can feel; it's remembered.
export default function HapticsPanel({ open, onClose }) {
  const [cfg, setCfg] = useState(getHaptics())
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (open) {
      setCfg(getHaptics())
      hapticsInfo().then(setInfo)
    }
  }, [open])

  const update = (patch) => {
    setHaptics(patch)
    const next = getHaptics()
    setCfg(next)
    if (next.on) {
      buzz(H.pop)
      pop()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-nopage
          className="fixed inset-0 z-30 flex items-start justify-center px-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 58px)', background: 'rgba(0,0,0,.18)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="neu w-full max-w-sm rounded-3xl p-4"
            initial={{ y: -16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-soft">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="7" y="3" width="10" height="18" rx="2.5" />
                  <path d="M3 9v6M21 9v6" />
                </svg>
              </div>
              <Chip active={cfg.on} onPress={() => update({ on: !cfg.on })}>
                {cfg.on ? 'On' : 'Off'}
              </Chip>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {ENGINES.map((e) => (
                <Chip key={e} active={cfg.engine === e} onPress={() => update({ engine: e })}>
                  {ENGINE_LABEL[e]}
                </Chip>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <Chip key={l} active={cfg.length === l} onPress={() => update({ length: l })}>
                  {LENGTH_LABEL[l]}
                </Chip>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] text-soft">
                {info ? `${info.model} · API ${info.sdk} · ${info.hasVibrator ? 'motor ok' : 'no motor'}` : ''}
              </span>
              <Chip active={false} onPress={() => update({})}>
                Test
              </Chip>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
