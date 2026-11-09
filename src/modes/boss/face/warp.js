// Caricature + expression geometry, and a Delaunay mesh warp to render it.
import Delaunator from 'delaunator'
import { CANONICAL } from './canonical.js'
import * as I from './landmarks.js'

const N_MESH = 468
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const avg = (lm, idx) => {
  let x = 0, y = 0
  for (const i of idx) {
    x += lm[i].x
    y += lm[i].y
  }
  return { x: x / idx.length, y: y / idx.length }
}
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const clone = (lm) => lm.map((p) => ({ x: p.x, y: p.y }))

export function faceMetrics(lm) {
  const eR = lm[I.IRIS_R] ?? avg(lm, I.EYE_R_RING)
  const eL = lm[I.IRIS_L] ?? avg(lm, I.EYE_L_RING)
  return { eR, eL, D: dist(eR, eL), F: dist(lm[I.TOP], lm[I.CHIN]) }
}

// ── Caricature ────────────────────────────────────────────────────
// Fit the average face to this face (similarity Procrustes), then push every
// landmark further along its deviation from average — the caricaturist's trick.
export function caricature(lm, strength = 0.42) {
  const n = N_MESH
  let mx = 0, my = 0, lx = 0, ly = 0
  for (let i = 0; i < n; i++) {
    mx += CANONICAL[i * 2]; my += CANONICAL[i * 2 + 1]
    lx += lm[i].x; ly += lm[i].y
  }
  mx /= n; my /= n; lx /= n; ly /= n
  let a = 0, b = 0, nn = 0
  for (let i = 0; i < n; i++) {
    const px = CANONICAL[i * 2] - mx, py = CANONICAL[i * 2 + 1] - my
    const qx = lm[i].x - lx, qy = lm[i].y - ly
    a += px * qx + py * qy
    b += px * qy - py * qx
    nn += px * px + py * py
  }
  const sc = a / nn, ss = b / nn
  const { D, eR, eL } = faceMetrics(lm)
  // Turned faces deviate because of pose, not identity — exaggerate less.
  const yaw = (lm[I.NOSE_TIP].x - (eR.x + eL.x) / 2) / D
  const k = strength * Math.min(1, Math.max(0.15, 1 - Math.abs(yaw) * 2.5))
  const cap = 0.12 * D
  const out = clone(lm)
  for (let i = 0; i < n; i++) {
    const px = CANONICAL[i * 2] - mx, py = CANONICAL[i * 2 + 1] - my
    const ax = lx + sc * px - ss * py
    const ay = ly + ss * px + sc * py
    let dx = (lm[i].x - ax) * k, dy = (lm[i].y - ay) * k
    const m = Math.hypot(dx, dy)
    if (m > cap) {
      dx *= cap / m
      dy *= cap / m
    }
    out[i].x += dx
    out[i].y += dy
  }
  return out
}

// Close an open/smiling photo mouth into a relaxed one so every expression starts neutral.
export function neutralizeMouth(lm) {
  const out = clone(lm)
  const up = I.LIP_UPPER_INNER, lo = I.LIP_LOWER_INNER
  let gap = 0
  for (let i = 1; i < up.length - 1; i++) gap += lm[lo[i]].y - lm[up[i]].y
  gap /= up.length - 2
  const { D } = faceMetrics(lm)
  if (gap > 0.02 * D) {
    // Lower lip and jaw rise to meet the upper lip.
    const close = gap * 0.97
    const top = lm[13].y
    for (let i = 0; i < N_MESH; i++) {
      const w = I.LOWER_LIP.has(i) ? 1 : smooth(top, top + 0.35 * D, lm[i].y) * jawFalloff(lm, i, D)
      out[i].y -= close * w
    }
  }
  // De-smile: pull the corners back toward the lip centre line.
  const mid = (lm[13].y + lm[14].y) / 2
  for (const c of [I.MOUTH_R, I.MOUTH_L]) {
    const lift = mid - lm[c].y
    if (lift > 0) rbf(out, lm, lm[c], 0.28 * D, 0, lift * 0.8, mouthOnly(lm, D))
  }
  return out
}

// ── Expression primitives (operate on `g`, read rest pose `b`) ─────
function jawFalloff(b, i, D) {
  const cx = (b[I.MOUTH_R].x + b[I.MOUTH_L].x) / 2
  const half = dist(b[I.SIDE_R], b[I.SIDE_L]) / 2
  return 1 - 0.65 * smooth(0.2 * half, half, Math.abs(b[i].x - cx))
}
const mouthOnly = (b, D) => {
  const noseY = b[I.NOSE_BOTTOM].y
  return (i) => smooth(noseY - 0.05 * D, noseY + 0.15 * D, b[i].y)
}

function rbf(g, b, c, r, dx, dy, gate) {
  for (let i = 0; i < N_MESH; i++) {
    const w = Math.exp(-((b[i].x - c.x) ** 2 + (b[i].y - c.y) ** 2) / (r * r)) * (gate ? gate(i) : 1)
    g[i].x += dx * w
    g[i].y += dy * w
  }
}

function jawDrop(g, b, D, a) {
  if (!a) return
  const top = b[13].y
  for (let i = 0; i < N_MESH; i++) {
    const w = I.LOWER_LIP.has(i) ? 1 : smooth(top, top + 0.3 * D, b[i].y) * jawFalloff(b, i, D)
    g[i].y += a * D * w
  }
}

function eyeClose(g, b, upper, lower, s) {
  for (let k = 0; k < upper.length; k++) {
    const u = b[upper[k]], l = b[lower[k]]
    g[upper[k]].x += (l.x - u.x) * s * 0.85
    g[upper[k]].y += (l.y - u.y) * s * 0.85
    g[lower[k]].y += (u.y - l.y) * s * 0.15
  }
}

function eyeWiden(g, b, upper, lower, D, w) {
  for (const i of upper) g[i].y -= w * 0.09 * D
  for (const i of lower) g[i].y += w * 0.03 * D
}

// Move a brow: dyInner at the nose end, dyOuter at the temple end (+ forehead skin follows).
function brow(g, b, idx, D, dyInner, dyOuter, dxInner = 0, eyeSet) {
  const outer = b[idx[0]], inner = b[idx[4]]
  for (const i of idx) {
    const t = Math.min(1, Math.max(0, (b[i].x - outer.x) / (inner.x - outer.x || 1)))
    g[i].y += (dyOuter + (dyInner - dyOuter) * t) * D
    g[i].x += dxInner * t * D
  }
  const c = avg(b, idx)
  const dy = ((dyInner + dyOuter) / 2) * D
  const browY = c.y
  rbf(g, b, { x: c.x, y: c.y - 0.15 * D }, 0.32 * D, 0, dy * 0.6, (i) => (eyeSet.has(i) || idx.includes(i) ? 0 : smooth(browY + 0.05 * D, browY - 0.1 * D, b[i].y)))
}

const EYES = new Set([...I.EYE_R_RING, ...I.EYE_L_RING])

// Build the target geometry for each mood from the caricatured, neutral base.
// Cartoon proportions: slightly bigger eyes read as "cartoon" without hurting likeness.
function bigEyes(g, b, k) {
  for (const ring of [I.EYE_R_RING, I.EYE_L_RING]) {
    const c = avg(b, ring)
    for (const i of ring) {
      g[i].x += (b[i].x - c.x) * (k - 1)
      g[i].y += (b[i].y - c.y) * (k - 1)
    }
  }
}

export function expression(base, mood) {
  const g = clone(base)
  const b = base
  const { D } = faceMetrics(b)
  bigEyes(g, b, mood === 'shocked' ? 1.22 : 1.12)
  const gate = mouthOnly(b, D)
  const corner = (c, dx, dy, r = 0.24) => rbf(g, b, b[c], r * D, dx * D, dy * D, gate)
  switch (mood) {
    case 'smug':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.38)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 0.38)
      brow(g, b, I.BROW_R, D, 0.04, 0.03, 0, EYES)
      brow(g, b, I.BROW_L, D, -0.12, -0.16, 0, EYES)
      corner(I.MOUTH_L, 0.05, -0.1)
      corner(I.MOUTH_R, -0.01, 0.015)
      break
    case 'shocked':
      eyeWiden(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, D, 1)
      eyeWiden(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, D, 1)
      brow(g, b, I.BROW_R, D, -0.2, -0.15, 0, EYES)
      brow(g, b, I.BROW_L, D, -0.2, -0.15, 0, EYES)
      jawDrop(g, b, D, 0.42)
      corner(I.MOUTH_R, 0.07, 0.04, 0.2)
      corner(I.MOUTH_L, -0.07, 0.04, 0.2)
      break
    case 'ouch':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 1)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 1)
      brow(g, b, I.BROW_R, D, 0.1, -0.02, 0.05, EYES)
      brow(g, b, I.BROW_L, D, 0.1, -0.02, -0.05, EYES)
      jawDrop(g, b, D, 0.16)
      corner(I.MOUTH_R, -0.12, 0.03)
      corner(I.MOUTH_L, 0.12, 0.03)
      break
    case 'dizzy':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.15)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 0.15)
      brow(g, b, I.BROW_R, D, -0.1, -0.05, 0, EYES)
      brow(g, b, I.BROW_L, D, 0.02, 0.04, 0, EYES)
      jawDrop(g, b, D, 0.2)
      corner(I.MOUTH_L, 0.02, 0.06)
      break
    case 'defeated':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.55)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 0.55)
      brow(g, b, I.BROW_R, D, -0.12, 0.06, 0.02, EYES)
      brow(g, b, I.BROW_L, D, -0.12, 0.06, -0.02, EYES)
      corner(I.MOUTH_R, -0.01, 0.13)
      corner(I.MOUTH_L, 0.01, 0.13)
      rbf(g, b, b[0], 0.18 * D, 0, -0.03 * D, gate) // upper lip pouts up into a frown arc
      break
    case 'angry':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.35)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 0.35)
      brow(g, b, I.BROW_R, D, 0.15, -0.03, 0.07, EYES)
      brow(g, b, I.BROW_L, D, 0.15, -0.03, -0.07, EYES)
      jawDrop(g, b, D, 0.11)
      corner(I.MOUTH_R, -0.06, 0.06)
      corner(I.MOUTH_L, 0.06, 0.06)
      rbf(g, b, b[I.NOSE_BOTTOM], 0.22 * D, 0, -0.02 * D, (i) => (EYES.has(i) ? 0 : 1)) // nostril flare / snarl
      break
    case 'scared':
      eyeWiden(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, D, 0.9)
      eyeWiden(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, D, 0.9)
      brow(g, b, I.BROW_R, D, -0.21, -0.04, 0.05, EYES)
      brow(g, b, I.BROW_L, D, -0.21, -0.04, -0.05, EYES)
      jawDrop(g, b, D, 0.12)
      corner(I.MOUTH_R, -0.1, 0.05)
      corner(I.MOUTH_L, 0.1, 0.05)
      break
    case 'laugh':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.92)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 0.92)
      brow(g, b, I.BROW_R, D, -0.08, -0.1, 0, EYES)
      brow(g, b, I.BROW_L, D, -0.08, -0.1, 0, EYES)
      jawDrop(g, b, D, 0.34)
      corner(I.MOUTH_R, -0.1, -0.13)
      corner(I.MOUTH_L, 0.1, -0.13)
      for (const c of [I.CHEEK_R, I.CHEEK_L]) rbf(g, b, b[c], 0.32 * D, 0, -0.05 * D, (i) => (EYES.has(i) ? 0 : 1))
      break
    case 'cry':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.92)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 0.92)
      brow(g, b, I.BROW_R, D, -0.17, 0.07, 0.04, EYES)
      brow(g, b, I.BROW_L, D, -0.17, 0.07, -0.04, EYES)
      jawDrop(g, b, D, 0.26)
      corner(I.MOUTH_R, -0.03, 0.14)
      corner(I.MOUTH_L, 0.03, 0.14)
      break
    case 'gross':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.72)
      eyeWiden(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, D, 0.35)
      brow(g, b, I.BROW_R, D, 0.09, 0.07, 0.02, EYES)
      brow(g, b, I.BROW_L, D, -0.13, -0.15, 0, EYES)
      rbf(g, b, b[I.NOSE_BOTTOM], 0.26 * D, 0, -0.045 * D, (i) => (EYES.has(i) ? 0 : 1)) // nose wrinkle
      jawDrop(g, b, D, 0.14)
      corner(I.MOUTH_R, 0.03, 0.08)
      corner(I.MOUTH_L, -0.02, -0.04)
      break
    case 'sleepy':
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 0.74)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 0.74)
      brow(g, b, I.BROW_R, D, -0.05, -0.02, 0, EYES)
      brow(g, b, I.BROW_L, D, -0.05, -0.02, 0, EYES)
      jawDrop(g, b, D, 0.52)
      corner(I.MOUTH_R, 0.12, 0.06, 0.2)
      corner(I.MOUTH_L, -0.12, 0.06, 0.2)
      break
    case 'blink':
      // The resting (smug) face with eyes closed — swapped in for a split second.
      eyeClose(g, b, I.EYE_R_UPPER, I.EYE_R_LOWER, 1)
      eyeClose(g, b, I.EYE_L_UPPER, I.EYE_L_LOWER, 1)
      brow(g, b, I.BROW_R, D, 0.04, 0.03, 0, EYES)
      brow(g, b, I.BROW_L, D, -0.12, -0.16, 0, EYES)
      corner(I.MOUTH_L, 0.05, -0.1)
      corner(I.MOUTH_R, -0.01, 0.015)
      break
  }
  return g
}

// ── Mesh warp ────────────────────────────────────────────────────
// Source points: mesh landmarks + a fixed ring around the face + the canvas border.
export function buildMesh(src, W, H) {
  const pts = []
  for (let i = 0; i < N_MESH; i++) pts.push(src[i].x, src[i].y)
  const c = avg(src, I.FACE_OVAL)
  for (const i of I.FACE_OVAL) {
    pts.push(c.x + (src[i].x - c.x) * 1.4, c.y + (src[i].y - c.y) * 1.4)
  }
  const steps = 8
  for (let s = 0; s < steps; s++) {
    const t = (s / steps) * W
    pts.push(t, 0, W, t, W - t, H, 0, H - t)
  }
  const tri = new Delaunator(pts).triangles
  return { pts, tri, extra: pts.length / 2 - N_MESH }
}

export function warpCanvas(img, mesh, dst) {
  const W = img.width, H = img.height
  const { pts, tri } = mesh
  const Q = pts.slice()
  for (let i = 0; i < N_MESH; i++) {
    Q[i * 2] = dst[i].x
    Q[i * 2 + 1] = dst[i].y
  }
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const moved = []
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t + 1], c = tri[t + 2]
    let m = false
    for (const v of [a, b, c]) if (Math.abs(Q[v * 2] - pts[v * 2]) + Math.abs(Q[v * 2 + 1] - pts[v * 2 + 1]) > 0.25) m = true
    if (m) moved.push(a, b, c)
  }
  // Clear the moved region (its outline is fixed, so source and destination areas match)…
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  for (let t = 0; t < moved.length; t += 3) {
    const a = moved[t], b = moved[t + 1], c = moved[t + 2]
    ctx.moveTo(Q[a * 2], Q[a * 2 + 1])
    ctx.lineTo(Q[b * 2], Q[b * 2 + 1])
    ctx.lineTo(Q[c * 2], Q[c * 2 + 1])
    ctx.closePath()
  }
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  // …then paint each moved triangle with its affine-mapped texture.
  for (let t = 0; t < moved.length; t += 3) {
    const a = moved[t], b = moved[t + 1], c = moved[t + 2]
    const x0 = pts[a * 2], y0 = pts[a * 2 + 1], x1 = pts[b * 2], y1 = pts[b * 2 + 1], x2 = pts[c * 2], y2 = pts[c * 2 + 1]
    const u0 = Q[a * 2], v0 = Q[a * 2 + 1], u1 = Q[b * 2], v1 = Q[b * 2 + 1], u2 = Q[c * 2], v2 = Q[c * 2 + 1]
    const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1)
    if (Math.abs(den) < 1e-6) continue
    const A = (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den
    const C = (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den
    const E = (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den
    const B = (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den
    const Dd = (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den
    const F = (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den
    // Expand the clip a hair to hide anti-aliasing seams.
    const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3
    const grow = (x, y) => {
      const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1
      return [x + (dx / l) * 0.7, y + (dy / l) * 0.7]
    }
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(...grow(u0, v0))
    ctx.lineTo(...grow(u1, v1))
    ctx.lineTo(...grow(u2, v2))
    ctx.closePath()
    ctx.clip()
    ctx.setTransform(A, B, C, Dd, E, F)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }
  return out
}

// ── Cartoon finishing touches drawn on the warped face ────────────
const path = (ctx, g, idx, close) => {
  ctx.beginPath()
  idx.forEach((i, k) => (k ? ctx.lineTo(g[i].x, g[i].y) : ctx.moveTo(g[i].x, g[i].y)))
  if (close) ctx.closePath()
}

const CLOSED = new Set(['ouch', 'cry', 'blink', 'laugh'])
const CREASED = new Set(['ouch', 'cry', 'laugh'])
const TEETH = new Set(['ouch', 'angry', 'scared'])

function shade(hex, k) {
  const n = parseInt((hex || '#e0a882').slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, v * k)))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export function decorate(canvas, g, mood, D, skin) {
  const ctx = canvas.getContext('2d')
  const ink = 'rgb(42,26,22)'

  // Closed eyes: paint real lids in their skin tone (a squashed photo eye looks odd).
  if (CLOSED.has(mood)) {
    for (const ring of [I.EYE_R_RING, I.EYE_L_RING]) {
      ctx.save()
      ctx.fillStyle = shade(skin, 0.93)
      ctx.strokeStyle = shade(skin, 0.93)
      ctx.lineWidth = Math.max(3, D * 0.06)
      ctx.lineJoin = 'round'
      path(ctx, g, ring, true)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }
  if (CREASED.has(mood)) {
    // Scrunch creases at the outer corners.
    ctx.strokeStyle = 'rgba(60,30,25,.55)'
    ctx.lineWidth = Math.max(1.5, D * 0.018)
    ctx.lineCap = 'round'
    for (const [o, i, s] of [
      [I.EYE_R_CORNERS[0], I.EYE_R_CORNERS[1], -1],
      [I.EYE_L_CORNERS[0], I.EYE_L_CORNERS[1], 1],
    ]) {
      const p = g[o]
      const dir = Math.sign(g[o].x - g[i].x) || s
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath()
        ctx.moveTo(p.x + dir * D * 0.06, p.y + k * D * 0.05)
        ctx.lineTo(p.x + dir * D * 0.15, p.y + k * D * 0.09)
        ctx.stroke()
      }
    }
  }
  const gap = (() => {
    let s = 0
    for (let i = 1; i < I.LIP_UPPER_INNER.length - 1; i++) s += g[I.LIP_LOWER_INNER[i]].y - g[I.LIP_UPPER_INNER[i]].y
    return s / (I.LIP_UPPER_INNER.length - 2)
  })()

  // Open mouth: paint the inside.
  if (gap > 0.05 * D) {
    ctx.save()
    path(ctx, g, I.LIP_INNER_RING, true)
    ctx.clip()
    if (TEETH.has(mood)) {
      ctx.fillStyle = '#fbf7ee'
      ctx.fill()
      ctx.strokeStyle = 'rgba(90,40,30,.7)'
      ctx.lineWidth = Math.max(1.5, D * 0.018)
      const l = g[I.MOUTH_R], r = g[I.MOUTH_L]
      const midY = (g[13].y + g[14].y) / 2
      ctx.beginPath()
      ctx.moveTo(l.x, midY)
      ctx.lineTo(r.x, midY)
      for (let k = 1; k < 8; k++) {
        const x = l.x + ((r.x - l.x) * k) / 8
        ctx.moveTo(x, midY - gap)
        ctx.lineTo(x, midY + gap)
      }
      ctx.stroke()
    } else {
      ctx.fillStyle = '#3a0f12'
      ctx.fill()
      const bot = g[14], w = dist(g[I.MOUTH_R], g[I.MOUTH_L])
      ctx.fillStyle = '#d65a6d'
      ctx.beginPath()
      ctx.ellipse(bot.x + (mood === 'dizzy' ? w * 0.1 : 0), bot.y, w * 0.28, gap * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
      if (mood === 'shocked' || mood === 'laugh') {
        // Upper teeth peeking under the top lip.
        ctx.fillStyle = '#fbf7ee'
        ctx.beginPath()
        ctx.ellipse(g[13].x, g[13].y, w * (mood === 'laugh' ? 0.4 : 0.26), gap * (mood === 'laugh' ? 0.2 : 0.12), 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
    ctx.strokeStyle = ink
    ctx.lineWidth = Math.max(2, D * 0.03)
    ctx.lineJoin = 'round'
    path(ctx, g, I.LIP_INNER_RING, true)
    ctx.stroke()
    if (mood === 'gross') {
      // Tongue out, over the lower lip.
      const bot = g[17], w = dist(g[I.MOUTH_R], g[I.MOUTH_L])
      ctx.fillStyle = '#e06a7d'
      ctx.strokeStyle = ink
      ctx.lineWidth = Math.max(1.5, D * 0.022)
      ctx.beginPath()
      ctx.ellipse(bot.x + w * 0.06, bot.y + w * 0.06, w * 0.2, w * 0.24, 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(bot.x + w * 0.06, bot.y - w * 0.05)
      ctx.lineTo(bot.x + w * 0.08, bot.y + w * 0.14)
      ctx.strokeStyle = 'rgba(120,30,45,.6)'
      ctx.stroke()
    }
  } else {
    // Closed mouth: seal any leftover sliver of photo teeth, then a crisp cartoon lip line.
    ctx.fillStyle = 'rgb(96,42,38)'
    path(ctx, g, I.LIP_INNER_RING, true)
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = Math.max(2, D * 0.028)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    path(ctx, g, I.LIP_UPPER_INNER, false)
    ctx.stroke()
  }

  // Lash lines make eyes read as cartoon; closed eyes become a single bold arc.
  const lash = (corners, upper) => {
    ctx.strokeStyle = ink
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, D * (CLOSED.has(mood) ? 0.05 : 0.032))
    path(ctx, g, [corners[0], ...upper, corners[1]], false)
    ctx.stroke()
  }
  lash(I.EYE_R_CORNERS, I.EYE_R_UPPER)
  lash(I.EYE_L_CORNERS, I.EYE_L_UPPER)
}
