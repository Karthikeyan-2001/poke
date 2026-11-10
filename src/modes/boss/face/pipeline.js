// Photo → cartoon caricature boss head with five expressions. Runs entirely on-device.
import { analyzeFace, loadVision } from './vision.js'
import { outline, toonify } from './toon.js'
import { buildMesh, caricature, decorate, expression, faceMetrics, neutralizeMouth, warpCanvas } from './warp.js'
import * as I from './landmarks.js'

// Visible expressions (studio thumbnails) + 'blink', a hidden frame used for blinking.
export const MOODS = ['smug', 'shocked', 'ouch', 'dizzy', 'defeated', 'angry', 'scared', 'laugh', 'cry', 'gross', 'sleepy']
const ALL_SPRITES = [...MOODS, 'blink']
// Closest existing expression for faces saved before an expression existed.
export const FALLBACK = { angry: 'smug', scared: 'shocked', laugh: 'smug', cry: 'defeated', gross: 'ouch', sleepy: 'defeated', blink: 'smug' }
const N = 512
const frame = () => new Promise((r) => requestAnimationFrame(() => r()))

export { loadVision }

async function decode(file) {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s)
  c.height = Math.round(bmp.height * s)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return c
}

// Flood-fill from seed points over the opaque mask; clear everything not connected (plus a 2px halo).
function keepConnected(ctx, seeds) {
  const img = ctx.getImageData(0, 0, N, N)
  const d = img.data
  const keep = new Uint8Array(N * N)
  const stack = []
  for (const sp of seeds) {
    const x = Math.round(sp.x), y = Math.round(sp.y)
    if (x < 0 || y < 0 || x >= N || y >= N) continue
    const i = y * N + x
    if (!keep[i] && d[i * 4 + 3] > 90) {
      keep[i] = 1
      stack.push(i)
    }
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % N
    const nb = [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, i - N, i + N]
    for (const j of nb) {
      if (j < 0 || j >= N * N || keep[j] || d[j * 4 + 3] <= 90) continue
      keep[j] = 1
      stack.push(j)
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const k2 = keep.slice()
    for (let i = 0; i < N * N; i++) {
      if (keep[i]) continue
      const x = i % N
      if ((x > 0 && keep[i - 1]) || (x < N - 1 && keep[i + 1]) || (i >= N && keep[i - N]) || (i < N * N - N && keep[i + N])) k2[i] = 1
    }
    keep.set(k2)
  }
  for (let i = 0; i < N * N; i++) if (!keep[i]) d[i * 4 + 3] = 0
  ctx.putImageData(img, 0, 0)
}

// Rotate so the eyes are level, centre the face, and crop a square with room for hair.
function alignCrop(src, lm, head) {
  const { eR, eL, F } = faceMetrics(lm)
  const roll = Math.atan2(eL.y - eR.y, eL.x - eR.x)
  const top = lm[I.TOP], chin = lm[I.CHIN]
  const mid = { x: (top.x + chin.x) / 2, y: (top.y + chin.y) / 2 }
  const up = { x: Math.sin(roll), y: -Math.cos(roll) }
  const C = { x: mid.x + up.x * 0.14 * F, y: mid.y + up.y * 0.14 * F }
  const S = 1.95 * F
  const k = N / S
  const cos = Math.cos(-roll), sin = Math.sin(-roll)
  const T = (p) => {
    const dx = p.x - C.x, dy = p.y - C.y
    return { x: N / 2 + k * (dx * cos - dy * sin), y: N / 2 + k * (dx * sin + dy * cos) }
  }
  const place = (ctx) => {
    ctx.translate(N / 2, N / 2)
    ctx.scale(k, k)
    ctx.rotate(-roll)
    ctx.translate(-C.x, -C.y)
  }

  const photo = document.createElement('canvas')
  photo.width = photo.height = N
  const pc = photo.getContext('2d', { willReadFrequently: true })
  pc.save()
  place(pc)
  pc.drawImage(src, 0, 0)
  pc.restore()

  const cl = lm.map(T)

  // Head mask = hair ∪ face-skin (multi-class segmenter): no neck, shoulders or clothes.
  const mc = document.createElement('canvas')
  mc.width = mc.height = N
  const mctx = mc.getContext('2d', { willReadFrequently: true })
  if (head) {
    const m = document.createElement('canvas')
    m.width = head.w
    m.height = head.h
    const img = new ImageData(head.w, head.h)
    for (let i = 0; i < head.data.length; i++) {
      const v = head.data[i]
      const a = v <= 0.35 ? 0 : v >= 0.65 ? 1 : (v - 0.35) / 0.3
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255
      img.data[i * 4 + 3] = a * 255
    }
    m.getContext('2d').putImageData(img, 0, 0)
    mctx.save()
    mctx.imageSmoothingQuality = 'high'
    place(mctx)
    mctx.drawImage(m, 0, 0, src.width, src.height)
    mctx.restore()
  }
  const oval = I.FACE_OVAL.map((i) => cl[i])
  const oc = oval.reduce((a, p) => ({ x: a.x + p.x / oval.length, y: a.y + p.y / oval.length }), { x: 0, y: 0 })
  const ovalPath = (grow) => {
    const p = new Path2D()
    oval.forEach((q, i) => {
      const x = oc.x + (q.x - oc.x) * grow, y = oc.y + (q.y - oc.y) * grow
      i ? p.lineTo(x, y) : p.moveTo(x, y)
    })
    p.closePath()
    return p
  }
  // The face itself is always fully opaque (segmenters can be shy around beards, glasses, shadows).
  mctx.fillStyle = '#fff'
  mctx.fill(ovalPath(1.0))

  // Nothing below the chin (long hair over the shoulders would otherwise bring the shoulders' outline).
  const chinY = cl[I.CHIN].y
  mctx.save()
  mctx.beginPath()
  mctx.rect(0, chinY + 1, N, N)
  mctx.clip()
  mctx.globalCompositeOperation = 'destination-out'
  mctx.fill(new Path2D(`M0 ${chinY + 1} H${N} V${N} H0 Z`))
  mctx.restore()
  mctx.globalCompositeOperation = 'source-over'
  mctx.fill(ovalPath(1.0))

  // Safety oval around the head (generous for big hair).
  {
    const xs = oval.map((q) => q.x), ys = oval.map((q) => q.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const fw = maxX - minX, fh = maxY - minY
    mctx.save()
    mctx.globalCompositeOperation = 'destination-in'
    mctx.translate((minX + maxX) / 2, (minY + maxY) / 2 - fh * 0.16)
    mctx.scale((fw / 2) * 1.7, (fh / 2) * 1.45)
    const g = mctx.createRadialGradient(0, 0, 0.85, 0, 0, 1)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    mctx.fillStyle = g
    mctx.beginPath()
    mctx.arc(0, 0, 1, 0, Math.PI * 2)
    mctx.fill()
    mctx.restore()
    mctx.globalCompositeOperation = 'source-over'
  }

  // Keep only the region connected to THIS face — drops anyone standing next to them.
  keepConnected(mctx, [I.NOSE_TIP, I.FOREHEAD, I.CHEEK_R, I.CHEEK_L, I.TOP].map((i) => cl[i]))

  // Soften the edge a touch.
  const soft = document.createElement('canvas')
  soft.width = soft.height = N
  const sctx = soft.getContext('2d', { willReadFrequently: true })
  sctx.filter = 'blur(1.2px)'
  sctx.drawImage(mc, 0, 0)

  return { photo, mask: soft, lm: cl }
}

function sampleSkin(canvas, lm) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  let r = 0, g = 0, b = 0, n = 0
  for (const i of [I.CHEEK_R, I.CHEEK_L, I.FOREHEAD]) {
    const d = ctx.getImageData(Math.round(lm[i].x) - 3, Math.round(lm[i].y) - 3, 7, 7).data
    for (let k = 0; k < d.length; k += 4) {
      if (d[k + 3] < 200) continue
      r += d[k]; g += d[k + 1]; b += d[k + 2]; n++
    }
  }
  if (!n) return '#f3c9a8'
  const hex = (v) => Math.round(Math.min(255, v / n)).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function headTop(mask) {
  const d = mask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, N, N).data
  for (let y = 0; y < N; y++) {
    let c = 0
    for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 128) c++
    if (c > 6) return y
  }
  return 0
}

/**
 * @param {File|Blob} file
 * @param {(stage: string, data?: any) => void} onStage
 * @param {(boxes: {x,y,w,h}[]) => Promise<number>} [choose] asked to pick a face when there are several
 */
export async function buildFace(file, onStage = () => {}, choose) {
  const src = await decode(file)
  onStage('photo', { canvas: src })
  await frame()
  const res = await analyzeFace(src)
  if (!res.faces.length) throw new Error('noface')
  let idx = 0
  if (res.faces.length > 1 && choose) idx = await choose(res.faces.map((f) => f.box))
  const lm = res.faces[idx].lm
  onStage('points', { lm, w: src.width, h: src.height })
  await frame()

  const crop = alignCrop(src, lm, res.head)
  const { toon, flat } = toonify(crop.photo, crop.mask, crop.lm)
  const skin = sampleSkin(flat, crop.lm)
  onStage('toon', { url: toon.toDataURL('image/png') })
  await frame()

  const base = caricature(neutralizeMouth(crop.lm))
  const { D } = faceMetrics(base)
  const mesh = buildMesh(crop.lm, N, N)
  const sprites = {}
  for (const mood of ALL_SPRITES) {
    sprites[mood] = renderSprite(toon, mesh, base, mood, D, skin)
    if (mood !== 'blink') onStage('expr', { mood, url: sprites[mood] })
    await frame()
  }

  const n = (p) => ({ x: p.x / N, y: p.y / N })
  const eyeR = base[I.IRIS_R] ?? base[I.EYE_R_CORNERS[0]]
  const eyeL = base[I.IRIS_L] ?? base[I.EYE_L_CORNERS[0]]
  const meta = {
    eyeR: n(eyeR),
    eyeL: n(eyeL),
    nose: n(base[I.NOSE_TIP]),
    cheekR: n(base[I.CHEEK_R]),
    cheekL: n(base[I.CHEEK_L]),
    forehead: n(base[I.FOREHEAD]),
    chin: n(base[I.CHIN]),
    center: n({ x: (base[I.SIDE_R].x + base[I.SIDE_L].x) / 2, y: (base[I.TOP].y + base[I.CHIN].y) / 2 }),
    faceW: (base[I.SIDE_L].x - base[I.SIDE_R].x) / N,
    eyeR_D: D / N,
    top: headTop(crop.mask) / N,
  }
  // Keep the cartoon base + landmarks so future expressions can be added without the photo.
  const keep = { toon: toon.toDataURL('image/png'), lm: crop.lm.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]) }
  return { sprites, meta, skin, src: keep, created: Date.now(), v: 3 }
}

function renderSprite(toon, mesh, base, mood, D, skin) {
  const g = expression(base, mood)
  const warped = warpCanvas(toon, mesh, g)
  decorate(warped, g, mood, D, skin)
  return outline(warped, 6).toDataURL('image/png')
}

// Fill in any expressions a saved face doesn't have yet (faces made by an older version).
// Returns the upgraded face, or null if nothing could be done.
export async function completeFace(face) {
  const missing = ALL_SPRITES.filter((m) => !face.sprites[m])
  if (!missing.length || !face.src) return null
  const img = new Image()
  img.src = face.src.toon
  await img.decode()
  const toon = document.createElement('canvas')
  toon.width = toon.height = N
  toon.getContext('2d').drawImage(img, 0, 0)
  const lm = face.src.lm.map(([x, y]) => ({ x, y }))
  const base = caricature(neutralizeMouth(lm))
  const { D } = faceMetrics(base)
  const mesh = buildMesh(lm, N, N)
  const sprites = { ...face.sprites }
  for (const m of missing) {
    sprites[m] = renderSprite(toon, mesh, base, m, D, face.skin)
    await frame()
  }
  return { ...face, sprites }
}

// Where the 512² sprite sits in the boss's 200×340 figure space.
export function headPlacement(meta) {
  const size = 104 / meta.faceW
  return { size, x0: 100 - size * meta.center.x, y0: 152 - size * meta.chin.y }
}
