import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { crinkle, droplet, megaPop, pop, sparkle, swoosh } from '../audio.js'
import { buzz, H } from '../haptics.js'
import { bump, observeSize } from '../store.js'

const TARGET_CELL = 62
const GOLDEN_RATE = 0.05
const GOLDEN_TAPS = 5
const GOLDEN_WINDOW = 650 // ms between taps to keep the combo alive

function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSheet(cols, rows) {
  const occ = Array.from({ length: rows }, () => Array(cols).fill(false))
  const items = []
  const maxMega = Math.max(1, Math.round((cols * rows) / 36))
  let megas = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (occ[r][c]) continue
      const fits = r + 1 < rows && c + 1 < cols && !occ[r][c + 1] && !occ[r + 1][c] && !occ[r + 1][c + 1]
      if (fits && megas < maxMega && Math.random() < 0.045) {
        occ[r][c] = occ[r][c + 1] = occ[r + 1][c] = occ[r + 1][c + 1] = true
        items.push({ id: items.length, r, c, mega: true, golden: false, seed: Math.random() * 1e9 })
        megas++
        continue
      }
      occ[r][c] = true
      items.push({ id: items.length, r, c, mega: false, golden: Math.random() < GOLDEN_RATE, seed: Math.random() * 1e9 })
    }
  }
  return { key: `${Date.now()}-${Math.random()}`, cols, rows, items }
}

// Seeded crease lines so each deflated bubble keeps its own crinkle pattern.
function creases(seed) {
  const r = mulberry32(seed)
  const paths = []
  const n = 3 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    let x = 50 + (r() - 0.5) * 22
    let y = 50 + (r() - 0.5) * 22
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`
    const segs = 2 + Math.floor(r() * 3)
    const len = 14 + r() * 14
    for (let s = 0; s < segs; s++) {
      const aa = a + (r() - 0.5) * 1.2
      x = Math.max(12, Math.min(88, x + Math.cos(aa) * (len / segs) * 1.6))
      y = Math.max(12, Math.min(88, y + Math.sin(aa) * (len / segs) * 1.6))
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    paths.push(d)
  }
  return paths
}

const Bubble = memo(function Bubble({ item, popped, hits }) {
  const controls = useAnimationControls()
  const paths = useMemo(() => (popped ? creases(item.seed) : null), [popped, item.seed])

  useEffect(() => {
    if (popped) controls.start({ scale: [1, 1.12, 0.86, 0.9], rotate: 0, transition: { duration: 0.22, times: [0, 0.25, 0.7, 1] } })
  }, [popped, controls])

  useEffect(() => {
    if (hits > 0 && !popped)
      controls.start({
        scale: [1, 1.06 + hits * 0.02, 1 + hits * 0.025],
        rotate: [0, -7, 6, -3, 0],
        transition: { duration: 0.28 },
      })
  }, [hits, popped, controls])

  return (
    <div
      data-bubble={item.id}
      className="relative flex items-center justify-center"
      style={{ gridColumn: `${item.c + 1} / span ${item.mega ? 2 : 1}`, gridRow: `${item.r + 1} / span ${item.mega ? 2 : 1}` }}
    >
      <motion.div
        animate={controls}
        initial={false}
        className={`bubble ${item.mega ? 'mega' : ''} ${item.golden ? 'golden' : ''} ${popped ? 'popped' : ''}`}
        style={{ '--g': hits }}
      >
        {paths && (
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
            {paths.map((d, i) => (
              <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} stroke="var(--crease-hi)" strokeWidth="2.2" transform="translate(1.2 1.4)" />
                <path d={d} stroke="var(--crease)" strokeWidth="1.6" />
              </g>
            ))}
          </svg>
        )}
      </motion.div>
    </div>
  )
})

function Burst({ x, y, size }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4
        const dist = size * (0.9 + Math.random() * 0.9)
        return { dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, s: 4 + Math.random() * 6, star: i % 3 === 0 }
      }),
    [size],
  )
  return (
    <div className="pointer-events-none absolute" style={{ left: x, top: y }}>
      <motion.div
        className="absolute rounded-full"
        style={{ left: -size / 2, top: -size / 2, width: size, height: size, border: '3px solid #ffcf4a' }}
        initial={{ scale: 0.4, opacity: 0.9 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      {parts.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            width: p.s,
            height: p.s,
            left: -p.s / 2,
            top: -p.s / 2,
            borderRadius: p.star ? 2 : 9999,
            background: p.star ? '#fff3b0' : '#f5b72e',
            boxShadow: '0 0 8px rgba(255,190,40,.8)',
          }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy + 18, scale: 0.2, opacity: 0, rotate: p.star ? 180 : 0 }}
          transition={{ duration: 0.65 + Math.random() * 0.25, ease: [0.15, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

function Sheet({ sheet, cell, onAllPopped }) {
  const [state, setState] = useState(() => sheet.items.map(() => ({ popped: false, hits: 0 })))
  const stRef = useRef(state)
  const lastTap = useRef(new Map())
  const pointers = useRef(new Map())
  const gridRef = useRef(null)
  const [bursts, setBursts] = useState([])

  const write = (id, val) => {
    const next = stRef.current.slice()
    next[id] = val
    stRef.current = next
    setState(next)
    if (val.popped && next.every((s) => s.popped)) onAllPopped()
  }

  const burstAt = (id) => {
    const el = gridRef.current?.querySelector(`[data-bubble="${id}"]`)
    const g = gridRef.current?.getBoundingClientRect()
    if (!el || !g) return
    const r = el.getBoundingClientRect()
    const b = { id: Math.random(), x: r.left - g.left + r.width / 2, y: r.top - g.top + r.height / 2, size: r.width * 0.8 }
    setBursts((bs) => [...bs, b])
    setTimeout(() => setBursts((bs) => bs.filter((x) => x.id !== b.id)), 1000)
  }

  const press = (id, isTap) => {
    const item = sheet.items[id]
    const st = stRef.current[id]
    if (!item) return
    if (st.popped) {
      if (isTap) crinkle()
      return
    }
    if (item.golden) {
      if (!isTap) return // golden bubbles shrug off drags — they need deliberate taps
      const t = performance.now()
      const prev = lastTap.current.get(id) ?? 0
      const hits = t - prev < GOLDEN_WINDOW ? st.hits + 1 : 1
      lastTap.current.set(id, t)
      bump()
      if (hits >= GOLDEN_TAPS) {
        write(id, { popped: true, hits: 0 })
        pop()
        sparkle()
        buzz(H.burst)
        burstAt(id)
      } else {
        write(id, { popped: false, hits })
        droplet(hits)
        buzz(H.golden)
      }
      return
    }
    write(id, { popped: true, hits: 0 })
    bump()
    if (item.mega) {
      megaPop()
      buzz(H.mega)
    } else {
      pop()
      buzz(H.pop)
    }
  }

  const hitTest = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-bubble]')
    return el ? Number(el.dataset.bubble) : null
  }

  const onDown = (e) => {
    const id = hitTest(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, { last: id, x: e.clientX, y: e.clientY })
    if (id !== null) press(id, true)
  }

  const onMove = (e) => {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    // Interpolate between samples so fast swipes don't skip bubbles.
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * 0.33)))
    for (let s = 1; s <= steps; s++) {
      const id = hitTest(p.x + (dx * s) / steps, p.y + (dy * s) / steps)
      if (id !== p.last) {
        p.last = id
        if (id !== null) press(id, false)
      }
    }
    p.x = e.clientX
    p.y = e.clientY
  }

  const onUp = (e) => pointers.current.delete(e.pointerId)

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ y: '108%', rotate: 2 }}
      animate={{ y: 0, rotate: 0 }}
      exit={{ y: '-108%', rotate: -2 }}
      transition={{ type: 'spring', stiffness: 170, damping: 24 }}
    >
      <div
        ref={gridRef}
        data-nopage
        className="relative grid"
        style={{
          gridTemplateColumns: `repeat(${sheet.cols}, ${cell}px)`,
          gridTemplateRows: `repeat(${sheet.rows}, ${cell}px)`,
          touchAction: 'none',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        {sheet.items.map((it) => (
          <Bubble key={it.id} item={it} popped={state[it.id].popped} hits={state[it.id].hits} />
        ))}
        {bursts.map((b) => (
          <Burst key={b.id} {...b} />
        ))}
      </div>
    </motion.div>
  )
}

function NewSheetButton({ onPress, glow }) {
  const [down, setDown] = useState(false)
  return (
    <button
      data-nopage
      aria-label="New sheet"
      onPointerDown={() => {
        setDown(true)
        onPress()
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      className="relative flex h-14 w-14 items-center justify-center rounded-full text-soft"
      style={{
        background: 'var(--bg)',
        boxShadow: down
          ? 'inset 4px 4px 9px var(--lo), inset -4px -4px 9px var(--hi)'
          : '6px 6px 14px var(--lo), -6px -6px 14px var(--hi)',
        transition: 'box-shadow 90ms ease',
      }}
    >
      {glow && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 0 2px var(--accent)' }}
          animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={glow ? 'var(--accent)' : 'currentColor'}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ y: down ? 1 : 0, scale: down ? 0.92 : 1 }}
      >
        <rect x="4" y="6" width="16" height="13" rx="3" />
        <circle cx="9" cy="12.5" r="1.6" />
        <circle cx="15" cy="12.5" r="1.6" />
        <path d="M8 3h8" />
      </motion.svg>
    </button>
  )
}

export default function BubbleWrap({ active }) {
  const areaRef = useRef(null)
  const [dims, setDims] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [done, setDone] = useState(false)
  const motionAsked = useRef(false)

  useLayoutEffect(
    () =>
      observeSize(areaRef.current, (width, height) => {
        if (width < 10 || height < 10) return
        const cols = Math.max(4, Math.min(9, Math.floor(width / TARGET_CELL)))
        const c0 = width / cols
        const rows = Math.max(4, Math.floor(height / c0))
        const cell = Math.floor(Math.min(c0, height / rows))
        setDims((d) => (d && d.cols === cols && d.rows === rows && d.cell === cell ? d : { cols, rows, cell }))
      }),
    [],
  )

  useEffect(() => {
    if (!dims) return
    setSheet((s) => (s && s.cols === dims.cols && s.rows === dims.rows ? s : makeSheet(dims.cols, dims.rows)))
  }, [dims])

  const newSheet = useCallback(() => {
    if (!dims) return
    setSheet(makeSheet(dims.cols, dims.rows))
    setDone(false)
    swoosh()
    buzz(H.sheet)
    bump()
  }, [dims])

  const newSheetRef = useRef(newSheet)
  newSheetRef.current = newSheet

  // Shake-to-refresh.
  useEffect(() => {
    if (!active) return
    let last = null
    let hits = []
    let cooldown = 0
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null) return
      if (last) {
        const delta = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z)
        const t = performance.now()
        if (delta > 24) {
          hits = hits.filter((h) => t - h < 800)
          hits.push(t)
          if (hits.length >= 3 && t > cooldown) {
            cooldown = t + 1400
            hits = []
            newSheetRef.current()
          }
        }
      }
      last = { x: a.x, y: a.y, z: a.z }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [active])

  const onButton = () => {
    // iOS needs an explicit permission request from a user gesture for shake detection.
    if (!motionAsked.current && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      motionAsked.current = true
      DeviceMotionEvent.requestPermission().catch(() => {})
    }
    newSheet()
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={areaRef} className="relative mx-4 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {sheet && dims && <Sheet key={sheet.key} sheet={sheet} cell={dims.cell} onAllPopped={() => setDone(true)} />}
        </AnimatePresence>
      </div>
      <div className="flex h-20 shrink-0 items-center justify-center">
        <NewSheetButton onPress={onButton} glow={done} />
      </div>
    </div>
  )
}
