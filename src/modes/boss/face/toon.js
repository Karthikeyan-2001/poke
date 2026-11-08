// Photo → cartoon: Kuwahara paint-flattening, soft cel bands, XDoG ink lines, sticker outline.
import * as I from './landmarks.js'

const INK = [42, 26, 22]

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b

// Kuwahara filter via summed-area tables: each pixel takes the mean colour of its
// least-varied quadrant, which flattens skin into paint-like regions but keeps edges sharp.
function kuwahara(rgb, W, H, r) {
  const W1 = W + 1
  const n = W1 * (H + 1)
  const SR = new Float64Array(n), SG = new Float64Array(n), SB = new Float64Array(n), SL = new Float64Array(n), SL2 = new Float64Array(n)
  for (let y = 0; y < H; y++) {
    let ar = 0, ag = 0, ab = 0, al = 0, al2 = 0
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      const R = rgb[i], G = rgb[i + 1], B = rgb[i + 2], L = lum(R, G, B)
      ar += R; ag += G; ab += B; al += L; al2 += L * L
      const o = (y + 1) * W1 + x + 1, u = y * W1 + x + 1
      SR[o] = SR[u] + ar; SG[o] = SG[u] + ag; SB[o] = SB[u] + ab; SL[o] = SL[u] + al; SL2[o] = SL2[u] + al2
    }
  }
  const out = new Float32Array(rgb.length)
  const box = (S, x0, y0, x1, y1) => S[(y1 + 1) * W1 + x1 + 1] - S[y0 * W1 + x1 + 1] - S[(y1 + 1) * W1 + x0] + S[y0 * W1 + x0]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = Infinity, br = 0, bg = 0, bb = 0
      for (let q = 0; q < 4; q++) {
        const x0 = q & 1 ? x : Math.max(0, x - r)
        const x1 = q & 1 ? Math.min(W - 1, x + r) : x
        const y0 = q & 2 ? y : Math.max(0, y - r)
        const y1 = q & 2 ? Math.min(H - 1, y + r) : y
        const cnt = (x1 - x0 + 1) * (y1 - y0 + 1)
        const m = box(SL, x0, y0, x1, y1) / cnt
        const v = box(SL2, x0, y0, x1, y1) / cnt - m * m
        if (v < best) {
          best = v
          br = box(SR, x0, y0, x1, y1) / cnt
          bg = box(SG, x0, y0, x1, y1) / cnt
          bb = box(SB, x0, y0, x1, y1) / cnt
        }
      }
      const i = (y * W + x) * 3
      out[i] = br; out[i + 1] = bg; out[i + 2] = bb
    }
  }
  return out
}

function gaussian(src, W, H, sigma) {
  const rad = Math.ceil(sigma * 3)
  const k = new Float32Array(rad * 2 + 1)
  let sum = 0
  for (let i = -rad; i <= rad; i++) sum += k[i + rad] = Math.exp(-(i * i) / (2 * sigma * sigma))
  for (let i = 0; i < k.length; i++) k[i] /= sum
  const tmp = new Float32Array(W * H)
  const out = new Float32Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0
      for (let i = -rad; i <= rad; i++) a += src[y * W + Math.min(W - 1, Math.max(0, x + i))] * k[i + rad]
      tmp[y * W + x] = a
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0
      for (let i = -rad; i <= rad; i++) a += tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x] * k[i + rad]
      out[y * W + x] = a
    }
  return out
}

/**
 * @param {HTMLCanvasElement} photo aligned head crop (RGB)
 * @param {HTMLCanvasElement} maskCanvas same size, alpha = head mask
 * @returns {{ canvas: HTMLCanvasElement, flat: HTMLCanvasElement }} cartoon with outline, and the un-inked flat colours
 */
// Skin region from landmarks: face oval minus eyes, brows, lips and nostrils, heavily feathered.
function skinMask(W, H, lm) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const poly = (idx, grow = 1) => {
    let cx = 0, cy = 0
    for (const i of idx) {
      cx += lm[i].x / idx.length
      cy += lm[i].y / idx.length
    }
    ctx.beginPath()
    idx.forEach((i, k) => {
      const x = cx + (lm[i].x - cx) * grow, y = cy + (lm[i].y - cy) * grow
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
  }
  const D = Math.hypot(lm[I.IRIS_L].x - lm[I.IRIS_R].x, lm[I.IRIS_L].y - lm[I.IRIS_R].y)
  ctx.fillStyle = '#fff'
  poly(I.FACE_OVAL, 0.97)
  ctx.globalCompositeOperation = 'destination-out'
  poly(I.EYE_R_RING, 1.7)
  poly(I.EYE_L_RING, 1.7)
  poly([...I.BROW_R.slice(0, 5), ...I.BROW_R.slice(5).reverse()], 1.35)
  poly([...I.BROW_L.slice(0, 5), ...I.BROW_L.slice(5).reverse()], 1.35)
  poly([...I.LIP_UPPER_OUTER, ...I.LIP_LOWER_OUTER.slice(1, -1).reverse()], 1.18)
  ctx.beginPath()
  ctx.ellipse(lm[I.NOSE_BOTTOM].x, lm[I.NOSE_BOTTOM].y - D * 0.04, D * 0.3, D * 0.14, 0, 0, Math.PI * 2)
  ctx.fill()
  const f = document.createElement('canvas')
  f.width = W
  f.height = H
  const fc = f.getContext('2d', { willReadFrequently: true })
  fc.filter = `blur(${Math.max(3, D * 0.06)}px)`
  fc.drawImage(c, 0, 0)
  const d = fc.getImageData(0, 0, W, H).data
  const m = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) m[p] = d[p * 4 + 3] / 255
  return m
}

export function toonify(photo, maskCanvas, lm) {
  const W = photo.width, H = photo.height
  const px = photo.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data
  const ma = maskCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data

  let rgb = new Float32Array(W * H * 3)
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2]
  }
  rgb = kuwahara(rgb, W, H, 5)
  rgb = kuwahara(rgb, W, H, 3)

  // Clean cartoon skin: blend skin areas toward a heavily smoothed copy; features stay crisp.
  if (lm) {
    const sk = skinMask(W, H, lm)
    const ch = [0, 1, 2].map((c) => {
      const a = new Float32Array(W * H)
      for (let p = 0; p < W * H; p++) a[p] = rgb[p * 3 + c]
      return gaussian(a, W, H, 5)
    })
    for (let p = 0; p < W * H; p++) {
      const w = sk[p] * 0.85
      if (!w) continue
      for (let c = 0; c < 3; c++) rgb[p * 3 + c] = rgb[p * 3 + c] * (1 - w) + ch[c][p] * w
    }
  }

  // Ink lines from a difference of Gaussians on luminance (dark creases, eyes, brows, lips, hair).
  const L = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) L[p] = lum(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]) / 255
  const g1 = gaussian(L, W, H, 0.9)
  const g2 = gaussian(L, W, H, 1.8)

  const out = new ImageData(W, H)
  const flat = new ImageData(W, H)
  const o = out.data
  const f = flat.data
  const LEVELS = 6
  for (let p = 0; p < W * H; p++) {
    let r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2]
    // Soft cel bands on luminance, preserving hue.
    const l = lum(r, g, b)
    const q = (Math.round((l / 255) * (LEVELS - 1)) / (LEVELS - 1)) * 255
    const lq = l * 0.62 + q * 0.38
    const k = (lq + 1) / (l + 1)
    r *= k; g *= k; b *= k
    // Slightly punchier cartoon palette (kept close to true skin tone for likeness).
    const gray = lum(r, g, b)
    r = gray + (r - gray) * 1.12 + 2
    g = gray + (g - gray) * 1.12
    b = gray + (b - gray) * 1.12 - 2
    const a = ma[p * 4 + 3]
    f[p * 4] = r; f[p * 4 + 1] = g; f[p * 4 + 2] = b; f[p * 4 + 3] = a
    const d = g1[p] - g2[p]
    const s = Math.min(1, Math.max(0, (-d - 0.011) * 45)) * 0.9
    o[p * 4] = r * (1 - s) + INK[0] * s
    o[p * 4 + 1] = g * (1 - s) + INK[1] * s
    o[p * 4 + 2] = b * (1 - s) + INK[2] * s
    o[p * 4 + 3] = a
  }

  const toon = document.createElement('canvas')
  toon.width = W
  toon.height = H
  toon.getContext('2d').putImageData(out, 0, 0)
  const flatC = document.createElement('canvas')
  flatC.width = W
  flatC.height = H
  flatC.getContext('2d').putImageData(flat, 0, 0)
  return { toon, flat: flatC }
}

// Bold sticker outline around the cut-out head.
export function outline(canvas, px = 5) {
  const W = canvas.width, H = canvas.height
  const sil = document.createElement('canvas')
  sil.width = W
  sil.height = H
  const sc = sil.getContext('2d', { willReadFrequently: true })
  sc.filter = `blur(${px * 0.6}px)`
  sc.drawImage(canvas, 0, 0)
  sc.filter = 'none'
  const img = sc.getImageData(0, 0, W, H)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] > 14 ? 255 : 0
    d[i] = INK[0]; d[i + 1] = INK[1]; d[i + 2] = INK[2]; d[i + 3] = a
  }
  sc.putImageData(img, 0, 0)
  // Grow the silhouette by stamping it in a small ring.
  const res = document.createElement('canvas')
  res.width = W
  res.height = H
  const rc = res.getContext('2d')
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) rc.drawImage(sil, Math.cos(a) * px * 0.5, Math.sin(a) * px * 0.5)
  rc.drawImage(canvas, 0, 0)
  return res
}
