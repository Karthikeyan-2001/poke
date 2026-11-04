import { memo } from 'react'
import { motion } from 'framer-motion'
import { FALLBACK } from './face/pipeline.js'

// Head body-language per expression (photo boss): springs between poses; dizzy wobbles.
const POSE = {
  smug: { rotate: -4, scale: 1, y: 0 },
  shocked: { rotate: 0, scale: 1.07, y: -7 },
  ouch: { rotate: 8, scale: 0.94, y: 3 },
  dizzy: { rotate: [-9, 7, -9], scale: 1, y: 2, transition: { rotate: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } } },
  defeated: { rotate: 11, scale: 0.97, y: 9 },
  angry: { rotate: 0, scale: [1.04, 1.07, 1.04], y: -3, transition: { scale: { duration: 0.5, repeat: Infinity } } },
  scared: { rotate: [-2, 2, -2], scale: 0.95, y: 4, transition: { rotate: { duration: 0.12, repeat: Infinity } } },
  laugh: { rotate: [-6, 6, -6], scale: 1.03, y: [0, -5, 0], transition: { rotate: { duration: 0.5, repeat: Infinity }, y: { duration: 0.25, repeat: Infinity } } },
  cry: { rotate: 7, scale: 0.98, y: [6, 9, 6], transition: { y: { duration: 0.6, repeat: Infinity } } },
  gross: { rotate: -11, scale: 0.98, y: 2, x: -4 },
  sleepy: { rotate: 15, scale: 0.98, y: 7, transition: { duration: 1.6 } },
}
const poseFor = (expr) => POSE[expr === 'blink' ? 'smug' : expr] ?? POSE.smug

// Effect overlays per expression (shared by the cartoon and photo heads).
function MoodFx({ expr, eyes, top, half, mouth }) {
  if (expr === 'angry')
    return (
      <g>
        <g transform={`translate(${top.x + half * 0.55} ${top.y + half * 0.38})`}>
          <g className="fx-throb">
            <path d="M-9 -3 q4 -2 3 -7 M3 -9 q2 4 7 3 M9 3 q-4 2 -3 7 M-3 9 q-2 -4 -7 -3" stroke="#e5233a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          </g>
        </g>
        {[-1, 1].map((sd) => (
          <g key={sd} transform={`translate(${top.x + sd * half * 1.08} ${eyes[0].y + half * 0.05})`}>
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={sd * 4} cy="0" r={6 + i * 2} fill="#f1f1f1" stroke="#cfcfcf" strokeWidth="1" className="fx-steam" style={{ animationDelay: `${i * 0.25}s`, '--sx': `${sd * 10}px` }} />
            ))}
          </g>
        ))}
      </g>
    )
  if (expr === 'cry')
    return (
      <g>
        {eyes.map((e, i) => (
          <g key={i}>
            <path d={`M${e.x - 2} ${e.y + 4} q-6 ${half * 0.35} 2 ${half * 0.7} t-2 ${half * 0.5}`} stroke="#7cc8ff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".85" className="fx-tear" />
            <path d={`M${e.x + 6} ${e.y + 4} q8 ${half * 0.3} 0 ${half * 0.6}`} stroke="#a8dbff" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity=".7" className="fx-tear" style={{ animationDelay: '.2s' }} />
          </g>
        ))}
      </g>
    )
  if (expr === 'sleepy')
    return (
      <g>
        {[0, 1, 2].map((i) => (
          <text key={i} x={top.x + half * 0.8 + i * 9} y={top.y + 4 - i * 12} fontSize={14 + i * 5} fontWeight="900" fill="#7a86ff" stroke="#fff" strokeWidth="1.2" paintOrder="stroke" className="fx-zzz" style={{ animationDelay: `${i * 0.5}s` }}>
            Z
          </text>
        ))}
      </g>
    )
  if (expr === 'gross')
    return (
      <g>
        <ellipse cx={mouth.x} cy={mouth.y - half * 0.12} rx={half * 0.8} ry={half * 0.5} fill="#7bd36b" opacity=".3" />
        <path d={`M${top.x - 14} ${top.y - 4} q4 -6 8 0 t8 0 t8 0`} stroke="#5fae4e" strokeWidth="2.5" fill="none" strokeLinecap="round" className="fx-throb" />
      </g>
    )
  if (expr === 'scared')
    return (
      <g>
        {[-1, 1].map((sd) => (
          <g key={sd}>
            <path d={`M${top.x + sd * half * 0.95} ${eyes[0].y - half * 0.3} q6 9 0 14 q-6 -5 0 -14 z`} fill="#8fd3ff" stroke="#4aa8e0" strokeWidth="1" className="fx-drip" />
            <path d={`M${top.x + sd * half * 1.18} ${eyes[0].y} q${sd * 5} 6 0 12 M${top.x + sd * half * 1.3} ${eyes[0].y - 4} q${sd * 6} 9 0 18`} stroke="#9aa3b5" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </g>
    )
  if (expr === 'laugh')
    return (
      <g>
        {eyes.map((e, i) => (
          <path key={i} d={`M${e.x + (i ? 12 : -12)} ${e.y + 2} q4 6 0 9 q-4 -3 0 -9 z`} fill="#8fd3ff" stroke="#4aa8e0" strokeWidth="1" className="fx-drip" />
        ))}
      </g>
    )
  return null
}

const SKIN = '#F3C9A8'
const SKIN_D = '#E2A784'
const HAIR = '#3b2a20'
const INK = '#2a1d17'

const brow = { stroke: HAIR, strokeWidth: 4.5, strokeLinecap: 'round', fill: 'none' }
const line = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }

const spiral = (cx, cy) => `M${cx} ${cy} m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -6 0 a5 5 0 1 1 10 0 a7 7 0 1 1 -14 0`

const STAR = (() => {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3.2 : 7.5
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)} `
  }
  return d + 'Z'
})()

function Hair({ level, strandsOnly }) {
  const s = { stroke: HAIR, strokeWidth: 4, strokeLinecap: 'round', fill: 'none' }
  return (
    <g>
      {!strandsOnly && (
        <>
          <path d="M48 94 C 46 58, 80 40, 108 42 C 138 44, 158 62, 153 92 C 147 76, 128 64, 104 62 C 84 61, 62 72, 48 94 Z" fill={HAIR} />
          <path d="M152 88 C 158 98, 158 110, 153 118 L 148 98 Z" fill={HAIR} />
          <path d="M49 90 C 44 100, 44 112, 48 120 L 53 98 Z" fill={HAIR} />
        </>
      )}
      {level >= 1 && (
        <g {...s}>
          <path d="M76 50 q-8 -12 2 -22" />
          <path d="M122 46 q10 -10 4 -22" />
        </g>
      )}
      {level >= 2 && (
        <g {...s}>
          <path d="M98 42 q-4 -16 8 -24" />
          <path d="M58 70 q-16 -4 -20 -16" />
        </g>
      )}
      {level >= 3 && (
        <g {...s}>
          <path d="M142 62 q16 -8 16 -22" />
          <path d="M86 44 q-12 -8 -10 -24" />
          <path d="M112 40 q14 -14 26 -10" />
        </g>
      )}
    </g>
  )
}

function Face({ face, set }) {
  if (face === 'ouch')
    return (
      <g>
        <path d="M64 93 L82 100 L64 107" {...line} strokeWidth="4" />
        <path d="M136 93 L118 100 L136 107" {...line} strokeWidth="4" />
        <path d="M60 82 L86 90" {...brow} />
        <path d="M140 82 L114 90" {...brow} />
        <rect x="83" y="125" width="34" height="15" rx="6" fill="#fff" stroke="#5a1f1f" strokeWidth="2.6" />
        <path d="M91 126 v13 M100 126 v13 M109 126 v13 M84 132.5 h32" stroke="#5a1f1f" strokeWidth="1.6" />
      </g>
    )
  if (face === 'shocked')
    return (
      <g>
        <ellipse cx="74" cy="100" rx="10.5" ry="12" fill="#fff" />
        <ellipse cx="126" cy="100" rx="10.5" ry="12" fill="#fff" />
        <circle ref={set('pupilL')} cx="74" cy="101" r="3.3" fill="#161616" />
        <circle ref={set('pupilR')} cx="126" cy="101" r="3.3" fill="#161616" />
        <path d="M60 78 Q74 68 88 78" {...brow} />
        <path d="M112 78 Q126 68 140 78" {...brow} />
        <ellipse cx="100" cy="136" rx="8" ry="10" fill="#5a1f1f" />
        <ellipse cx="100" cy="142" rx="5" ry="3" fill="#e57a7a" />
      </g>
    )
  if (face === 'dizzy')
    return (
      <g>
        <g ref={set('spiralL')}>
          <path d={spiral(74, 101)} {...line} strokeWidth="2.4" />
        </g>
        <g ref={set('spiralR')}>
          <path d={spiral(126, 101)} {...line} strokeWidth="2.4" />
        </g>
        <path d="M62 84 Q74 80 86 86" {...brow} />
        <path d="M114 86 Q126 80 138 84" {...brow} />
        <path d="M82 134 q4.5 -6 9 0 t9 0 t9 0 t9 0" {...line} />
        <path d="M104 136 q6 0 6 7 q0 6 -6 5 q-5 -1 -4 -7 z" fill="#ef7f8f" />
      </g>
    )
  if (face === 'defeated')
    return (
      <g>
        <ellipse cx="74" cy="101" rx="9" ry="6.5" fill="#fff" />
        <ellipse cx="126" cy="101" rx="9" ry="6.5" fill="#fff" />
        <circle ref={set('pupilL')} cx="74" cy="104" r="3.2" fill="#161616" />
        <circle ref={set('pupilR')} cx="126" cy="104" r="3.2" fill="#161616" />
        <rect x="61" y="86" width="26" height="15" fill={SKIN} />
        <rect x="113" y="86" width="26" height="15" fill={SKIN} />
        <path d="M63 101 L85 101 M115 101 L137 101" {...line} strokeWidth="2.6" />
        <path d="M62 90 L86 82" {...brow} />
        <path d="M138 90 L114 82" {...brow} />
        <path d="M86 140 Q100 128 114 140" {...line} />
      </g>
    )
  if (face === 'angry')
    return (
      <g>
        <ellipse cx="74" cy="101" rx="9.5" ry="5.5" fill="#fff" />
        <ellipse cx="126" cy="101" rx="9.5" ry="5.5" fill="#fff" />
        <circle ref={set('pupilL')} cx="74" cy="101" r="3.4" fill="#161616" />
        <circle ref={set('pupilR')} cx="126" cy="101" r="3.4" fill="#161616" />
        <path d="M58 82 L88 95" {...brow} strokeWidth="6" />
        <path d="M142 82 L112 95" {...brow} strokeWidth="6" />
        <rect x="84" y="127" width="32" height="13" rx="4" fill="#fff" stroke="#5a1f1f" strokeWidth="2.6" />
        <path d="M92 128 v11 M100 128 v11 M108 128 v11 M85 133.5 h30" stroke="#5a1f1f" strokeWidth="1.5" />
        <path d="M82 139 l3 -4 M118 139 l-3 -4" {...line} />
      </g>
    )
  if (face === 'scared')
    return (
      <g>
        <ellipse cx="74" cy="100" rx="11" ry="13" fill="#fff" />
        <ellipse cx="126" cy="100" rx="11" ry="13" fill="#fff" />
        <circle ref={set('pupilL')} cx="74" cy="101" r="2.4" fill="#161616" />
        <circle ref={set('pupilR')} cx="126" cy="101" r="2.4" fill="#161616" />
        <path d="M60 84 L86 72" {...brow} />
        <path d="M140 84 L114 72" {...brow} />
        <rect x="82" y="128" width="36" height="11" rx="5" fill="#fff" stroke="#5a1f1f" strokeWidth="2.4" />
        <path d="M82 133.5 q4.5 -3 9 0 t9 0 t9 0 t9 0" stroke="#5a1f1f" strokeWidth="1.6" fill="none" />
      </g>
    )
  if (face === 'laugh')
    return (
      <g>
        <path d="M64 103 Q74 91 84 103" {...line} strokeWidth="4" />
        <path d="M116 103 Q126 91 136 103" {...line} strokeWidth="4" />
        <path d="M60 80 Q73 72 88 78" {...brow} />
        <path d="M112 78 Q127 72 140 80" {...brow} />
        <path d="M78 124 Q100 162 122 124 Z" fill="#5a1f1f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M81 125 L119 125 L116 131 L84 131 Z" fill="#fff" />
        <ellipse cx="100" cy="144" rx="10" ry="5.5" fill="#e57a7a" />
      </g>
    )
  if (face === 'cry')
    return (
      <g>
        <path d="M64 100 Q74 107 84 100" {...line} strokeWidth="4" />
        <path d="M116 100 Q126 107 136 100" {...line} strokeWidth="4" />
        <path d="M62 88 L86 79" {...brow} />
        <path d="M138 88 L114 79" {...brow} />
        <ellipse cx="100" cy="138" rx="13" ry="10" fill="#5a1f1f" />
        <ellipse cx="100" cy="144" rx="8" ry="4" fill="#e57a7a" />
      </g>
    )
  if (face === 'gross')
    return (
      <g>
        <path d="M64 101 L84 99" {...line} strokeWidth="3.5" />
        <ellipse cx="126" cy="100" rx="10" ry="9" fill="#fff" />
        <circle ref={set('pupilR')} cx="126" cy="101" r="3.2" fill="#161616" />
        <path d="M60 92 L86 88" {...brow} />
        <path d="M112 78 Q126 68 140 76" {...brow} />
        <path d="M93 109 q3 -2 6 0 M101 109 q3 -2 6 0" stroke="rgba(90,40,30,.55)" strokeWidth="1.5" fill="none" />
        <path d="M84 132 q5 -4 10 0 t10 0 t10 0" {...line} />
        <path d="M100 133 q2 14 9 13 q7 -1 5 -13 z" fill="#e06a7d" stroke={INK} strokeWidth="2" />
      </g>
    )
  if (face === 'sleepy')
    return (
      <g>
        <ellipse cx="74" cy="101" rx="9" ry="6" fill="#fff" />
        <ellipse cx="126" cy="101" rx="9" ry="6" fill="#fff" />
        <circle cx="74" cy="104" r="3" fill="#161616" />
        <circle cx="126" cy="104" r="3" fill="#161616" />
        <rect x="61" y="86" width="26" height="17" fill={SKIN} />
        <rect x="113" y="86" width="26" height="17" fill={SKIN} />
        <path d="M63 103 Q74 105 85 103 M115 103 Q126 105 137 103" {...line} strokeWidth="2.6" />
        <path d="M62 86 Q74 82 86 86" {...brow} />
        <path d="M114 86 Q126 82 138 86" {...brow} />
        <ellipse cx="100" cy="137" rx="9" ry="13" fill="#5a1f1f" />
        <ellipse cx="100" cy="144" rx="6" ry="3.5" fill="#e57a7a" />
      </g>
    )
  if (face === 'blink')
    return (
      <g>
        <path d="M63 101 Q74 104 85 101 M115 101 Q126 104 137 101" {...line} strokeWidth="3" />
        <path d="M60 82 Q73 72 88 80" {...brow} />
        <path d="M112 88 Q126 84 140 86" {...brow} />
        <path d="M84 134 Q98 140 116 128" {...line} />
        <path d="M116 128 l4 -2" {...line} strokeWidth="2.4" />
      </g>
    )
  // smug
  return (
    <g>
      <ellipse cx="74" cy="101" rx="9.5" ry="7" fill="#fff" />
      <ellipse cx="126" cy="101" rx="9.5" ry="7" fill="#fff" />
      <circle ref={set('pupilL')} cx="74" cy="102" r="3.6" fill="#161616" />
      <circle ref={set('pupilR')} cx="126" cy="102" r="3.6" fill="#161616" />
      <rect x="61" y="86" width="26" height="13" fill={SKIN} />
      <rect x="113" y="86" width="26" height="13" fill={SKIN} />
      <path d="M63 99 L85 99 M115 99 L137 99" {...line} strokeWidth="2.6" />
      <path d="M60 82 Q73 72 88 80" {...brow} />
      <path d="M112 88 Q126 84 140 86" {...brow} />
      <path d="M84 134 Q98 140 116 128" {...line} />
      <path d="M116 128 l4 -2" {...line} strokeWidth="2.4" />
    </g>
  )
}

const FLUSH = { smug: 0.08, shocked: 0.28, dizzy: 0.48, defeated: 0.6 }

// Irregular cream blob (deterministic wobble so it doesn't jitter between renders).
const BLOB = [1.05, 0.92, 1.12, 0.98, 1.08, 0.9, 1.1, 1.0, 0.94, 1.14, 0.96, 1.06, 0.9, 1.1]
function blobPath(cx, cy, r) {
  const pts = BLOB.map((k, i) => {
    const a = (i / BLOB.length) * Math.PI * 2
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.92]
  })
  let d = ''
  pts.forEach((p, i) => {
    const n = pts[(i + 1) % pts.length]
    const m = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2]
    d += i ? `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)} ` : `M${m[0].toFixed(1)} ${m[1].toFixed(1)} `
  })
  return d + 'Z'
}

// Cream pie in the face: drips, a cherry, and two eyes blinking out of the cream. Slides off over time.
function PieSplat({ cx, cy, r, eyes, k }) {
  const er = r * 0.13
  return (
    <g key={k} className="pie-splat">
      <path d={blobPath(cx, cy, r)} fill="#fffaf0" stroke="#e8d9c2" strokeWidth="2" />
      {[-0.45, -0.05, 0.35].map((o, i) => (
        <path key={i} d={`M${cx + o * r - 6} ${cy + r * 0.8} q6 ${r * (0.35 + i * 0.12)} 12 0`} fill="#fffaf0" stroke="#e8d9c2" strokeWidth="1.5" className="pie-drip" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      <path d={`M${cx - r * 0.5} ${cy - r * 0.35} q${r * 0.25} ${-r * 0.2} ${r * 0.5} 0 M${cx + r * 0.05} ${cy + r * 0.45} q${r * 0.25} ${-r * 0.18} ${r * 0.5} 0`} stroke="#efe2cc" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx={cx + r * 0.25} cy={cy - r * 0.78} r={r * 0.14} fill="#d7263d" />
      <circle cx={cx + r * 0.2} cy={cy - r * 0.83} r={r * 0.04} fill="#fff" opacity=".7" />
      {eyes.map((e, i) => (
        <g key={i}>
          <ellipse cx={e.x} cy={e.y} rx={er * 1.25} ry={er} fill="#fff" stroke="#2a1d17" strokeWidth="1.6">
            <animate attributeName="ry" values={`${er};${er};${er * 0.1};${er}`} keyTimes="0;0.9;0.95;1" dur="2.6s" repeatCount="indefinite" />
          </ellipse>
          <circle cx={e.x + er * 0.25} cy={e.y} r={er * 0.45} fill="#1d1d1d" />
        </g>
      ))}
    </g>
  )
}

function mixHex(hex, to, t) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const m = c.map((v, i) => Math.round(v + (to[i] - v) * t))
  return `rgb(${m[0]},${m[1]},${m[2]})`
}

// Devil horns: drawn *behind* the photo sprite so they look like they sprout from the hair.
// Glow red when he's angry or cackling.
const HORN = 'M30 100 C 27 62, 44 26, 80 2 C 67 33, 65 63, 73 100 Z'
function Horns({ cx, topY, half, expr }) {
  const s = (half * 0.88) / 100
  const hot = expr === 'angry' || expr === 'laugh'
  return (
    <g className={hot ? 'horn-glow' : undefined}>
      {[-1, 1].map((sd) => (
        <g key={sd} transform={`translate(${(cx + sd * half * 0.55).toFixed(1)} ${(topY + half * 0.4).toFixed(1)}) rotate(${sd * 20}) scale(${(sd * s).toFixed(4)} ${s.toFixed(4)}) translate(-51 -100)`}>
          <path d={HORN} fill="url(#bHorn)" stroke="#3a0707" strokeWidth={4} strokeLinejoin="round" />
          <path d="M40 92 C 38 62, 50 34, 72 12" stroke="rgba(255,190,170,.75)" strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
      ))}
    </g>
  )
}

// The user's cartoon-caricature head (pre-rendered sprites, one per expression) + gag overlays.
function PhotoHead({ face, place, expr, mood, worried, noseRed, cos, set, refs }) {
  const { size, x0, y0 } = place
  const m = face.meta
  const P = (p) => ({ x: x0 + p.x * size, y: y0 + p.y * size })
  const eL = P(m.eyeL), eR = P(m.eyeR), nose = P(m.nose), fh = P(m.forehead), cen = P(m.center)
  const ckL = P(m.cheekL), ckR = P(m.cheekR)
  const topY = y0 + m.top * size
  const halfW = (m.faceW * size) / 2
  const eyeR = Math.max(5, m.eyeR_D * size * 0.32)
  // Tell the render loop where to spin spirals, orbit stars and pivot head-spins.
  refs.current.geo = { eyeL: eL, eyeRp: eR, orbit: { cx: cen.x, cy: topY + 6, rx: halfW * 1.1 }, spin: cen }
  // Faces saved by older versions may lack newer expressions: show the closest one.
  const shown = face.sprites[expr] ? expr : face.sprites[FALLBACK[expr]] ? FALLBACK[expr] : 'smug'
  return (
    <motion.g
      style={{ transformBox: 'view-box', originX: `${cen.x}px`, originY: `${(cen.y + halfW).toFixed(1)}px` }}
      animate={poseFor(expr)}
      transition={{ type: 'spring', stiffness: 320, damping: 14 }}
    >
      <Horns cx={cen.x} topY={topY} half={halfW} expr={expr} />
      {Object.keys(face.sprites).map((k) => (
        <image key={k} className="face-sprite" href={face.sprites[k]} x={x0} y={y0} width={size} height={size} opacity={k === shown ? 1 : 0} />
      ))}
      <ellipse cx={ckR.x} cy={ckR.y} rx={halfW * 0.22} ry={halfW * 0.12} fill="#ff4d4d" opacity={(FLUSH[mood] ?? 0.1) * 0.8} />
      <ellipse cx={ckL.x} cy={ckL.y} rx={halfW * 0.22} ry={halfW * 0.12} fill="#ff4d4d" opacity={(FLUSH[mood] ?? 0.1) * 0.8} />
      {noseRed && <circle cx={nose.x} cy={nose.y} r={halfW * 0.17} fill="#ff2020" opacity=".6" />}
      {cos.pie > 0 && <PieSplat k={cos.pie} cx={cen.x} cy={(eL.y + nose.y) / 2 + halfW * 0.08} r={halfW * 0.95} eyes={[eR, eL]} />}
      {cos.cracked && <ellipse cx={eL.x} cy={eL.y} rx={eyeR * 2.1} ry={eyeR * 1.7} fill="#5b2f86" opacity=".4" />}
      {cos.hair > 0 && (
        <g transform={`translate(${cen.x - 100} ${topY - 40})`}>
          <Hair level={cos.hair} strandsOnly />
        </g>
      )}
      {mood === 'dizzy' &&
        [
          ['spiralL', eL],
          ['spiralR', eR],
        ].map(([k, p]) => (
          <g key={k}>
            <circle cx={p.x} cy={p.y} r={eyeR * 1.5} fill="#fff" stroke="#2a1d17" strokeWidth="1.5" />
            <g ref={set(k)}>
              <path d={spiral(p.x, p.y)} transform={`translate(${p.x} ${p.y}) scale(${(eyeR * 1.3) / 9}) translate(${-p.x} ${-p.y})`} {...line} strokeWidth={2.4} />
            </g>
          </g>
        ))}
      {cos.stapler && (
        <g transform={`translate(${fh.x + 2} ${topY + 6}) rotate(-20)`}>
          <rect x="0" y="0" width="36" height="9" rx="3" fill="#bfc4cb" />
          <rect x="2" y="-7" width="32" height="8" rx="3.5" fill="#d23c3c" />
        </g>
      )}
      {mood === 'defeated' && (
        <g transform={`translate(${fh.x - halfW * 0.4} ${fh.y - 4}) rotate(-25)`}>
          <rect x="-15" y="-4.5" width="30" height="9" rx="3" fill="#f2d7a6" />
          <rect x="-4.5" y="-15" width="9" height="30" rx="3" fill="#f2d7a6" />
          <rect x="-3.5" y="-3.5" width="7" height="7" fill="#e3bf86" />
        </g>
      )}
      {(mood === 'defeated' || worried) && (
        <path d={`M${cen.x + halfW * 0.9} ${eL.y - 18} q7 10 0 15 q-7 -5 0 -15 z`} fill="#8fd3ff" stroke="#4aa8e0" strokeWidth="1" />
      )}
      {mood === 'dizzy' &&
        [0, 1, 2].map((i) => (
          <g key={i} ref={set('star' + i)}>
            <path d={STAR} fill="#ffd84d" stroke="#c99a12" strokeWidth="1" />
          </g>
        ))}
      <MoodFx expr={expr} eyes={[eR, eL]} top={{ x: cen.x, y: topY }} half={halfW} mouth={{ x: cen.x, y: nose.y + halfW * 0.45 }} />
    </motion.g>
  )
}

export const BossFigure = memo(function BossFigure({ mood, ouch, worried, noseRed, cos, refs, photo, react, blink }) {
  const set = (k) => (el) => {
    refs.current[k] = el
  }
  // Priority: a hit's flinch > a reaction (laugh, scared, angry…) > blinking > damage mood.
  const face = ouch ? 'ouch' : react || (blink && mood === 'smug' ? 'blink' : mood)
  if (!photo) refs.current.geo = null
  const skin = photo ? [mixHex(photo.face.skin, [255, 255, 255], 0.25), photo.face.skin, mixHex(photo.face.skin, [0, 0, 0], 0.2)] : ['#FBDCC3', SKIN, SKIN_D]
  return (
    <svg viewBox="0 0 200 340" width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id="bSkin" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={skin[0]} />
          <stop offset=".7" stopColor={skin[1]} />
          <stop offset="1" stopColor={skin[2]} />
        </radialGradient>
        <linearGradient id="bSuit" x1="0" x2="1">
          <stop offset="0" stopColor="#3d4e74" />
          <stop offset=".5" stopColor="#2b3856" />
          <stop offset="1" stopColor="#1b2440" />
        </linearGradient>
        <radialGradient id="bBase" cx="40%" cy="20%" r="90%">
          <stop offset="0" stopColor="#ff7a4a" />
          <stop offset=".55" stopColor="#c43d1c" />
          <stop offset="1" stopColor="#6e1f0e" />
        </radialGradient>
        <linearGradient id="bHorn" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7a0c0c" />
          <stop offset=".45" stopColor="#d81f1f" />
          <stop offset="1" stopColor="#ff5a3c" />
        </linearGradient>
        <pattern id="bTie" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
          <rect width="8" height="8" fill="#cf3a2b" />
          <rect width="8" height="2.2" fill="rgba(255,214,110,.6)" />
        </pattern>
      </defs>

      {/* weighted base */}
      <path d="M26 332 Q26 286 100 282 Q174 286 174 332 Q100 346 26 332 Z" fill="url(#bBase)" />
      <path d="M44 300 Q70 288 100 287" stroke="rgba(255,255,255,.45)" strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* arms */}
      <g ref={set('armL')}>
        <ellipse cx="42" cy="214" rx="15" ry="34" transform="rotate(16 42 214)" fill="url(#bSuit)" />
        <circle cx="33" cy="247" r="12" fill="url(#bSkin)" />
      </g>
      <g ref={set('armR')}>
        <ellipse cx="158" cy="214" rx="15" ry="34" transform="rotate(-16 158 214)" fill="url(#bSuit)" />
        <circle cx="167" cy="247" r="12" fill="url(#bSkin)" />
      </g>

      {/* inflatable suit body */}
      <path d="M100 150 C 150 150 172 200 168 250 C 165 290 140 300 100 300 C 60 300 35 290 32 250 C 28 200 50 150 100 150 Z" fill="url(#bSuit)" />
      <path d="M78 152 L100 208 L122 152 Z" fill="#f4f4ef" />
      <path d="M78 152 L100 208 L90 152 Z" fill="#e4e4dd" />
      <path d="M78 151 L92 170 L86 150 Z M122 151 L108 170 L114 150 Z" fill="#fff" />
      <path d="M76 154 L100 210 L91 215 L66 166 Z" fill="#232e48" />
      <path d="M124 154 L100 210 L109 215 L134 166 Z" fill="#232e48" />
      <circle cx="100" cy="238" r="3.2" fill="#141a2c" />
      <circle cx="100" cy="260" r="3.2" fill="#141a2c" />
      <path d="M128 188 l14 -4 l-2 8 z" fill="#ffd166" />
      <ellipse cx="62" cy="206" rx="9" ry="32" transform="rotate(14 62 206)" fill="rgba(255,255,255,.13)" />

      {/* tie */}
      <g transform={`rotate(${cos.tie} 100 158)`}>
        <path d="M94 154 L106 154 L103 166 L97 166 Z" fill="#a8261a" />
        <path d="M97 166 L103 166 L109 214 L100 226 L91 214 Z" fill="url(#bTie)" />
      </g>

      {/* coffee stain */}
      {cos.stain > 0 && (
        <g transform={`translate(118 240) scale(${cos.stain})`} opacity=".88">
          <path d="M0 -14 C 10 -15 16 -6 14 2 C 13 10 4 16 -4 14 C -14 12 -16 2 -12 -6 C -9 -12 -5 -13 0 -14 Z" fill="#6b4226" />
          <path d="M-2 13 q2 10 -1 16 q-3 -6 1 -16" fill="#6b4226" />
          <circle cx="16" cy="-12" r="2.6" fill="#6b4226" />
          <circle cx="-16" cy="8" r="2" fill="#6b4226" />
        </g>
      )}

      <rect x="86" y="138" width="28" height="18" rx="6" fill={skin[2]} />

      {/* head — transform driven per-frame */}
      {photo ? (
        <g ref={set('head')}>
          <PhotoHead face={photo.face} place={photo.place} expr={face} mood={mood} worried={worried} noseRed={noseRed} cos={cos} set={set} refs={refs} />
        </g>
      ) : (
      <g ref={set('head')}>
        <motion.g style={{ transformBox: 'view-box', originX: '100px', originY: '150px' }} animate={poseFor(face)} transition={{ type: 'spring', stiffness: 320, damping: 14 }}>
        <Horns cx={100} topY={44} half={52} expr={face} />
        <circle cx="45" cy="104" r="11" fill={SKIN_D} />
        <circle cx="155" cy="104" r="11" fill={SKIN_D} />
        <ellipse cx="100" cy="100" rx="55" ry="54" fill="url(#bSkin)" />
        <Hair level={cos.hair} />
        <ellipse cx="60" cy="123" rx="10" ry="5.5" fill="#ff6b6b" opacity={FLUSH[mood] ?? 0.1} />
        <ellipse cx="140" cy="123" rx="10" ry="5.5" fill="#ff6b6b" opacity={FLUSH[mood] ?? 0.1} />
        <Face face={face} set={set} />
        <ellipse cx="100" cy="117" rx="8.5" ry="6.5" fill={noseRed ? '#ff3b3b' : '#E39A79'} />
        <circle cx="97" cy="114.5" r="2" fill="rgba(255,255,255,.6)" />
        <g fill="rgba(190,225,255,.14)" stroke="#1d1d1d" strokeWidth="3.2">
          <rect x="58" y="87" width="32" height="26" rx="8" />
          <rect x="110" y="87" width="32" height="26" rx="8" />
        </g>
        <path d="M90 98 Q100 92 110 98" stroke="#1d1d1d" strokeWidth="3" fill="none" />
        <path d="M58 96 L46 100 M142 96 L154 100" stroke="#1d1d1d" strokeWidth="3" strokeLinecap="round" />
        <path d="M63 92 l7 -2 M115 92 l7 -2" stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeLinecap="round" />
        {cos.cracked && (
          <path d="M82 88 l-6 8 l6 4 l-8 11 M76 96 l-12 3 M82 100 l6 7 M128 88 l3 9 l-6 5" stroke="#fff" strokeWidth="1.4" fill="none" opacity=".95" />
        )}
        {cos.stapler && (
          <g transform="translate(106 50) rotate(-20)">
            <rect x="0" y="0" width="36" height="9" rx="3" fill="#bfc4cb" />
            <rect x="2" y="-7" width="32" height="8" rx="3.5" fill="#d23c3c" />
            <rect x="2" y="-2" width="30" height="2" fill="rgba(0,0,0,.25)" />
          </g>
        )}
        {mood === 'defeated' && (
          <g transform="translate(70 66) rotate(-25)">
            <rect x="-15" y="-4.5" width="30" height="9" rx="3" fill="#f2d7a6" />
            <rect x="-4.5" y="-15" width="9" height="30" rx="3" fill="#f2d7a6" />
            <rect x="-3.5" y="-3.5" width="7" height="7" fill="#e3bf86" />
          </g>
        )}
        {(mood === 'defeated' || worried) && <path d="M150 72 q7 10 0 15 q-7 -5 0 -15 z" fill="#8fd3ff" stroke="#4aa8e0" strokeWidth="1" />}
        {cos.pie > 0 && <PieSplat k={cos.pie} cx={100} cy={108} r={50} eyes={[{ x: 76, y: 100 }, { x: 124, y: 100 }]} />}
        {mood === 'dizzy' &&
          [0, 1, 2].map((i) => (
            <g key={i} ref={set('star' + i)}>
              <path d={STAR} fill="#ffd84d" stroke="#c99a12" strokeWidth="1" />
            </g>
          ))}
        <MoodFx expr={face} eyes={[{ x: 76, y: 100 }, { x: 124, y: 100 }]} top={{ x: 100, y: 46 }} half={52} mouth={{ x: 100, y: 134 }} />
        </motion.g>
      </g>
      )}

      {/* DENIED stamps */}
      {cos.stamps.map((s) => (
        <g key={s.id} transform={`translate(${s.x} ${s.y}) rotate(${s.r})`} opacity=".9">
          <rect x="-28" y="-10.5" width="56" height="21" rx="3" fill="none" stroke="#d62828" strokeWidth="2.6" />
          <text y="4.5" textAnchor="middle" fontSize="12.5" fontWeight="900" fill="#d62828" letterSpacing="1.2" fontFamily="Impact, 'Arial Black', sans-serif">
            DENIED
          </text>
        </g>
      ))}
    </svg>
  )
})

export function PropIcon({ type, size = 40 }) {
  const common = { width: size, height: size, viewBox: '0 0 48 48', style: { display: 'block', overflow: 'visible' } }
  switch (type) {
    case 'paper':
      return (
        <svg {...common}>
          <path d="M10 22 L16 10 L28 8 L38 14 L40 27 L34 38 L20 40 L10 33 Z" fill="#fbfbf6" stroke="#c9c9bf" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 10 L22 24 L10 22 M28 8 L22 24 L38 14 M40 27 L22 24 L34 38 M20 40 L22 24 L10 33" stroke="#d3d3c8" strokeWidth="1.3" fill="none" />
        </svg>
      )
    case 'stapler':
      return (
        <svg {...common}>
          <rect x="5" y="31" width="38" height="8" rx="3" fill="#2f3237" />
          <path d="M7 30 L38 21 Q44 20 43 26 L42 29 L7 32 Z" fill="#d23c3c" />
          <path d="M9 29 L38 22" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" />
          <rect x="34" y="27" width="9" height="5" rx="2" fill="#bfc4cb" />
        </svg>
      )
    case 'mug':
      return (
        <svg {...common}>
          <path d="M18 10 q-2 -3 0 -6 M24 10 q-2 -3 0 -6 M30 10 q-2 -3 0 -6" stroke="#b9b2a6" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M34 18 h3 a5 5 0 0 1 0 10 h-3" stroke="#d8d1c4" strokeWidth="3.4" fill="none" />
          <path d="M12 14 h22 v20 a6 6 0 0 1 -6 6 h-10 a6 6 0 0 1 -6 -6 z" fill="#f4f1ea" stroke="#cfc8bb" strokeWidth="1.5" />
          <ellipse cx="23" cy="15" rx="11" ry="2.6" fill="#6b4226" />
          <rect x="15" y="23" width="16" height="4" rx="2" fill="#ff6a3d" />
        </svg>
      )
    case 'stamp':
      return (
        <svg {...common}>
          <circle cx="24" cy="10" r="7" fill="#8a5a35" />
          <circle cx="22" cy="8" r="2" fill="rgba(255,255,255,.35)" />
          <rect x="21" y="15" width="6" height="12" fill="#a06a40" />
          <rect x="11" y="26" width="26" height="8" rx="2" fill="#5b3a22" />
          <rect x="10" y="34" width="28" height="5" rx="1.5" fill="#d62828" />
        </svg>
      )
    case 'pie':
      return (
        <svg {...common}>
          <path d="M6 28 L42 28 L38 38 L10 38 Z" fill="#c98b4a" />
          <path d="M6 28 L42 28 L40.5 31 L7.5 31 Z" fill="#a8703a" />
          <path d="M8 28 q2 -10 8 -9 q2 -6 8 -5 q6 -2 8 4 q8 0 8 10 z" fill="#fffaf0" stroke="#e6d6bd" strokeWidth="1.2" />
          <path d="M14 24 q4 -3 8 0 M24 22 q4 -3 8 0" stroke="#efe2cc" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="25" cy="12" r="4" fill="#d7263d" />
          <circle cx="23.8" cy="10.8" r="1.2" fill="#fff" opacity=".7" />
          <path d="M25 8 q2 -4 5 -5" stroke="#3d7a2c" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'keyboard':
      return (
        <svg {...common}>
          <rect x="3" y="15" width="42" height="20" rx="3.5" fill="#3a3d44" />
          <rect x="3" y="15" width="42" height="18" rx="3.5" fill="#4a4e57" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4, 5].map((c) => <rect key={`${r}${c}`} x={6.2 + c * 6.2 + (r === 1 ? 1.5 : 0)} y={18 + r * 4.6} width="5" height="3.6" rx="0.8" fill="#e9e9e4" />),
          )}
          <rect x="13" y="31.5" width="22" height="2.5" rx="0.8" fill="#e9e9e4" />
        </svg>
      )
    case 'chair':
      return (
        <svg {...common}>
          <path d="M14 4 h20 a4 4 0 0 1 4 4 v15 h-28 v-15 a4 4 0 0 1 4 -4 z" fill="#2b2f36" />
          <path d="M16 7 h8 v13 h-10 v-11 a2 2 0 0 1 2 -2z" fill="rgba(255,255,255,.08)" />
          <rect x="9" y="23" width="30" height="7" rx="3.5" fill="#3a3f48" />
          <rect x="22" y="30" width="4" height="8" fill="#9aa0a8" />
          <path d="M9 41 L24 37 L39 41" stroke="#9aa0a8" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="9" cy="43" r="2.8" fill="#1b1d21" />
          <circle cx="24" cy="42" r="2.8" fill="#1b1d21" />
          <circle cx="39" cy="43" r="2.8" fill="#1b1d21" />
        </svg>
      )
    default:
      return null
  }
}
