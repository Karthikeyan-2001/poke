import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { buildFace, loadVision, MOODS } from './face/pipeline.js'
import { uiTick } from '../../audio.js'
import { sparkle } from '../../audio.js'
import { buzz } from '../../haptics.js'

const stop = (e) => e.stopPropagation()

function Btn({ onClick, children, accent, danger, label }) {
  return (
    <motion.button
      aria-label={label}
      whileTap={{ scale: 0.92 }}
      onClick={(e) => {
        e.stopPropagation()
        uiTick()
        buzz(10)
        onClick()
      }}
      className="flex h-12 min-w-12 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold"
      style={{
        background: accent ? 'var(--accent)' : danger ? '#e5484d' : 'var(--bg)',
        color: accent || danger ? '#fff' : 'var(--ink)',
        boxShadow: accent || danger ? '0 8px 18px rgba(0,0,0,.18)' : '4px 4px 10px var(--lo), -4px -4px 10px var(--hi)',
      }}
    >
      {children}
    </motion.button>
  )
}

const Icon = {
  camera: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  ),
  lock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
}

// Cycles through the expressions like a little flipbook.
function Flipbook({ sprites, size = 220 }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % MOODS.length), 650)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {MOODS.map((m, k) => (
        <motion.img
          key={m}
          src={sprites[m]}
          alt=""
          className="face-sprite absolute inset-0 h-full w-full"
          draggable={false}
          animate={{ opacity: k === i ? 1 : 0, scale: k === i ? 1 : 0.96, rotate: k === i ? 0 : -2 }}
          transition={{ duration: 0.12 }}
        />
      ))}
    </div>
  )
}

function Thumbs({ sprites }) {
  return (
    <div className="flex max-w-[310px] flex-wrap justify-center gap-1.5">
      {MOODS.map((m, k) =>
        sprites[m] ? (
          <motion.img
            key={m}
            src={sprites[m]}
            alt=""
            draggable={false}
            className="face-sprite neu-in-sm h-[52px] w-[52px] rounded-xl"
            initial={{ scale: 0.3, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 18, delay: k * 0.04 }}
          />
        ) : (
          <div key={m} className="neu-in-sm h-[52px] w-[52px] rounded-xl opacity-50" />
        ),
      )}
    </div>
  )
}

// Live "scanning" view: the photo, a sweeping scan line, and the 478 landmarks popping in.
function Scanner({ photo, points, toon }) {
  const box = 280
  const s = photo ? Math.min(box / photo.w, box / photo.h) : 1
  const w = photo ? photo.w * s : box
  const h = photo ? photo.h * s : box
  return (
    <div className="relative flex items-center justify-center" style={{ width: box, height: box }}>
      {photo && (
        <motion.div className="relative overflow-hidden rounded-2xl" style={{ width: w, height: h }} animate={{ opacity: toon ? 0 : 1, scale: toon ? 0.9 : 1 }} transition={{ duration: 0.5 }}>
          <img src={photo.url} alt="" className="h-full w-full" draggable={false} style={{ filter: 'saturate(.6) brightness(.85)' }} />
          {points && (
            <svg className="absolute inset-0" viewBox={`0 0 ${photo.w} ${photo.h}`} width={w} height={h}>
              {points.map((p, i) =>
                i % 2 === 0 ? (
                  <circle key={i} cx={p.x} cy={p.y} r={photo.w / 260} fill="#5fffd0" className="lm-dot" style={{ animationDelay: `${(i * 2.2) | 0}ms` }} />
                ) : null,
              )}
            </svg>
          )}
          <motion.div
            className="absolute left-0 right-0 h-16"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(95,255,208,.45), transparent)', borderBottom: '2px solid rgba(95,255,208,.9)' }}
            initial={{ top: '-15%' }}
            animate={{ top: ['-15%', '100%'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      )}
      <AnimatePresence>
        {toon && (
          <motion.img
            key="toon"
            src={toon}
            alt=""
            className="absolute"
            style={{ width: box, height: box }}
            initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Group photo: tap the face to turn into the boss.
function FacePicker({ photo, boxes, onPick }) {
  const box = 300
  const s = Math.min(box / photo.w, (box * 1.25) / photo.h)
  const w = photo.w * s
  const h = photo.h * s
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl" style={{ width: w, height: h, boxShadow: '0 12px 30px rgba(0,0,0,.25)' }}>
        <img src={photo.url} alt="" className="h-full w-full" draggable={false} style={{ filter: 'saturate(.75) brightness(.8)' }} />
        {boxes.map((b, i) => {
          const r = Math.max(b.w, b.h) * s * 0.72
          const cx = (b.x + b.w / 2) * s
          const cy = (b.y + b.h / 2) * s
          return (
            <motion.button
              key={i}
              aria-label={`Face ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation()
                onPick(i)
              }}
              className="absolute rounded-full"
              style={{ left: cx - r, top: cy - r, width: r * 2, height: r * 2, border: '3px solid var(--accent)', boxShadow: '0 0 0 2px rgba(255,255,255,.85), 0 0 18px rgba(255,106,61,.6)' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.08, 1], opacity: 1 }}
              transition={{ scale: { duration: 1.4, repeat: Infinity, delay: i * 0.15 }, opacity: { delay: i * 0.08 } }}
              whileTap={{ scale: 0.9 }}
            >
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: 'var(--accent)' }}>
                {i + 1}
              </span>
            </motion.button>
          )
        })}
      </div>
      <p className="text-[13px] font-semibold text-soft">Tap the face to use</p>
    </>
  )
}

/**
 * Photo boss studio: pick a photo → on-device cartoon caricature with 5 expressions.
 * Props: face (saved or null), faceOn, onSave(face), onToggle(on), onDelete(), onClose()
 */
export default function FaceStudio({ face, faceOn, onSave, onToggle, onDelete, onClose }) {
  const inputRef = useRef(null)
  const [phase, setPhase] = useState(face ? 'home' : 'pick')
  const [photo, setPhoto] = useState(null)
  const [points, setPoints] = useState(null)
  const [toon, setToon] = useState(null)
  const [sprites, setSprites] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [choice, setChoice] = useState(null)
  const chooseRef = useRef(null)

  useEffect(() => {
    loadVision().catch(() => {}) // warm up the models while the user picks a photo
  }, [])

  const pick = () => inputRef.current?.click()

  const run = async (file) => {
    setPhase('work')
    setPhoto(null)
    setPoints(null)
    setToon(null)
    setSprites({})
    setError('')
    let t0 = performance.now()
    // Group photo: pause and let the user tap which face to use.
    const choose = (boxes) =>
      new Promise((resolve) => {
        chooseRef.current = (i) => {
          t0 = performance.now()
          resolve(i)
        }
        setChoice(boxes)
        setPhase('choose')
        buzz([10, 40, 10])
      })
    try {
      const r = await buildFace(file, (stage, d) => {
        if (stage === 'photo') setPhoto({ url: d.canvas.toDataURL('image/jpeg', 0.8), w: d.canvas.width, h: d.canvas.height })
        if (stage === 'points') {
          setPoints(d.lm.slice(0, 468))
          buzz(10)
        }
        if (stage === 'toon') setToon(d.url)
        if (stage === 'expr') {
          setSprites((s) => ({ ...s, [d.mood]: d.url }))
          uiTick()
          buzz(8)
        }
      }, choose)
      // Let the scan animation breathe a moment even on fast phones.
      await new Promise((res) => setTimeout(res, Math.max(0, 1600 - (performance.now() - t0))))
      setResult(r)
      setPhase('review')
      sparkle()
      buzz([20, 40, 20])
    } catch (e) {
      setError(e?.message === 'noface' ? 'No face found. Try a clear, front-facing photo.' : 'Something went wrong. Try another photo.')
      setPhase('error')
      buzz([30, 40, 30])
    }
  }

  return (
    <motion.div
      data-nopage
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 px-5"
      style={{ background: 'color-mix(in srgb, var(--bg) 86%, transparent)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) run(f)
        }}
      />

      <div className="absolute right-4 top-3">
        <Btn label="Close" onClick={onClose}>
          {Icon.close}
        </Btn>
      </div>

      {phase === 'pick' && (
        <>
          <motion.button
            aria-label="Choose a photo"
            onClick={(e) => {
              e.stopPropagation()
              uiTick()
              pick()
            }}
            whileTap={{ scale: 0.95 }}
            className="relative flex h-56 w-56 items-center justify-center rounded-full text-soft"
            style={{ background: 'var(--bg)', boxShadow: '10px 10px 24px var(--lo), -10px -10px 24px var(--hi)' }}
          >
            <motion.span
              className="absolute inset-3 rounded-full"
              style={{ border: '2.5px dashed var(--accent)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="9" r="4" />
              <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
              <path d="M19 3v4M17 5h4" stroke="var(--accent)" />
            </svg>
          </motion.button>
          <div className="flex items-center gap-1.5 text-[12px] text-soft">
            {Icon.lock}
            <span>Stays on this phone</span>
          </div>
        </>
      )}

      {phase === 'choose' && photo && choice && (
        <FacePicker
          photo={photo}
          boxes={choice}
          onPick={(i) => {
            uiTick()
            buzz(12)
            setPhase('work')
            const r = chooseRef.current
            chooseRef.current = null
            r?.(i)
          }}
        />
      )}

      {phase === 'work' && (
        <>
          <Scanner photo={photo} points={points} toon={toon} />
          <Thumbs sprites={sprites} />
        </>
      )}

      {phase === 'review' && result && (
        <>
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
            <Flipbook sprites={result.sprites} size={250} />
          </motion.div>
          <Thumbs sprites={result.sprites} />
          <div className="flex gap-3">
            <Btn label="Try another photo" onClick={pick}>
              {Icon.camera}
            </Btn>
            <Btn
              label="Use this face"
              accent
              onClick={() => {
                sparkle()
                onSave(result)
              }}
            >
              {Icon.check}
            </Btn>
          </div>
        </>
      )}

      {phase === 'home' && face && (
        <>
          <Flipbook sprites={face.sprites} size={230} />
          <div className="neu-in-sm flex rounded-full p-1">
            {[
              [true, 'Photo'],
              [false, 'Cartoon'],
            ].map(([v, l]) => (
              <button
                key={l}
                onClick={(e) => {
                  e.stopPropagation()
                  uiTick()
                  buzz(10)
                  onToggle(v)
                }}
                className="h-10 rounded-full px-5 text-[13px] font-semibold"
                style={{
                  background: faceOn === v ? 'var(--bg)' : 'transparent',
                  color: faceOn === v ? 'var(--accent)' : 'var(--ink-soft)',
                  boxShadow: faceOn === v ? '3px 3px 7px var(--lo), -3px -3px 7px var(--hi)' : 'none',
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Btn label="New photo" onClick={pick}>
              {Icon.camera}
            </Btn>
            {confirmDel ? (
              <Btn label="Confirm delete" danger onClick={onDelete}>
                {Icon.trash}
                <span>Delete</span>
              </Btn>
            ) : (
              <Btn label="Delete face" onClick={() => setConfirmDel(true)}>
                {Icon.trash}
              </Btn>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-soft">
            {Icon.lock}
            <span>Stays on this phone</span>
          </div>
        </>
      )}

      {phase === 'error' && (
        <>
          <motion.div
            className="flex h-40 w-40 items-center justify-center rounded-full text-soft"
            style={{ background: 'var(--bg)', boxShadow: 'inset 6px 6px 14px var(--lo), inset -6px -6px 14px var(--hi)' }}
            animate={{ x: [0, -10, 9, -6, 4, 0] }}
            transition={{ duration: 0.45 }}
          >
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 10h.01M15.5 10h.01M8.5 16c2-1.6 5-1.6 7 0" />
            </svg>
          </motion.div>
          <p className="max-w-[240px] text-center text-[13px] text-soft">{error}</p>
          <Btn label="Choose a photo" accent onClick={pick}>
            {Icon.camera}
          </Btn>
        </>
      )}
    </motion.div>
  )
}
