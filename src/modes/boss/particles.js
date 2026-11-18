// Lightweight canvas particle system for The Boss.
const TAU = Math.PI * 2
const CONFETTI = ['#ff6a3d', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#9b5de5', '#f15bb5', '#fee440']
const R = Math.random
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

export function createParticles() {
  const ps = []
  const add = (p) => {
    if (ps.length > 700) ps.shift()
    p.age = 0
    p.rot ??= 0
    p.vr ??= 0
    ps.push(p)
  }

  function step(dt, floor) {
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.age += dt
      if (p.age >= p.life) {
        ps.splice(i, 1)
        continue
      }
      if (p.g) p.vy += p.g * dt
      if (p.drag) {
        const d = Math.exp(-p.drag * dt)
        p.vx *= d
        p.vy *= d
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      if (p.fs) p.flip += p.fs * dt
      if (p.floor && p.y > floor) {
        p.y = floor
        p.vy *= -0.25
        p.vx *= 0.6
        p.vr *= 0.5
        if (p.fs) p.fs *= 0.6
      }
    }
  }

  function draw(c) {
    for (const p of ps) {
      const k = p.age / p.life
      const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1
      c.globalAlpha = 1
      switch (p.t) {
        case 'burst': {
          const r = p.size * (0.45 + 0.75 * easeOut(Math.min(1, k * 1.6)))
          c.globalAlpha = 1 - k * k
          starburst(c, p.x, p.y, r, p.rot, 12, p.color ?? '#ffe14d', '#1c1c1c', 3)
          starburst(c, p.x, p.y, r * 0.52, p.rot + 0.2, 12, '#ffffff', null, 0)
          break
        }
        case 'spark': {
          c.globalAlpha = 1 - k
          c.strokeStyle = p.color
          c.lineWidth = p.w
          c.lineCap = 'round'
          c.beginPath()
          c.moveTo(p.x, p.y)
          c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
          c.stroke()
          break
        }
        case 'ring': {
          const r = p.size * (0.3 + 1.2 * easeOut(k))
          c.globalAlpha = (1 - k) * 0.85
          c.strokeStyle = p.color
          c.lineWidth = 4 * (1 - k) + 1
          c.beginPath()
          c.arc(p.x, p.y, r, 0, TAU)
          c.stroke()
          break
        }
        case 'conf':
        case 'paper': {
          c.globalAlpha = fade
          c.save()
          c.translate(p.x, p.y)
          c.rotate(p.rot)
          c.scale(1, Math.cos(p.flip))
          c.fillStyle = p.color
          c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          if (p.t === 'paper') {
            c.strokeStyle = 'rgba(120,130,150,.35)'
            c.lineWidth = 1
            c.beginPath()
            c.moveTo(-p.w / 2 + 2, 0)
            c.lineTo(p.w / 2 - 2, 0)
            c.stroke()
          }
          c.restore()
          break
        }
        case 'shard': {
          c.globalAlpha = fade
          c.save()
          c.translate(p.x, p.y)
          c.rotate(p.rot)
          c.fillStyle = p.color
          c.beginPath()
          c.moveTo(p.pts[0], p.pts[1])
          c.lineTo(p.pts[2], p.pts[3])
          c.lineTo(p.pts[4], p.pts[5])
          c.closePath()
          c.fill()
          c.restore()
          break
        }
        case 'drop': {
          c.globalAlpha = fade
          c.fillStyle = p.color
          c.beginPath()
          c.arc(p.x, p.y, p.r, 0, TAU)
          c.fill()
          break
        }
        case 'dust': {
          c.globalAlpha = (1 - k) * 0.35
          c.fillStyle = p.color
          c.beginPath()
          c.arc(p.x, p.y, p.r * (1 + k * 1.2), 0, TAU)
          c.fill()
          break
        }
        case 'star': {
          c.globalAlpha = fade
          star(c, p.x, p.y, p.size, p.rot, p.color)
          break
        }
        case 'key': {
          c.globalAlpha = fade
          c.save()
          c.translate(p.x, p.y)
          c.rotate(p.rot)
          const s = p.size
          c.fillStyle = '#b9b9b2'
          c.beginPath()
          c.roundRect(-s / 2, -s / 2 + 2, s, s, 3)
          c.fill()
          c.fillStyle = '#f2f2ec'
          c.beginPath()
          c.roundRect(-s / 2, -s / 2, s, s - 1, 3)
          c.fill()
          c.fillStyle = '#3a3a3a'
          c.font = `700 ${p.ch.length > 1 ? s * 0.36 : s * 0.55}px system-ui, sans-serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText(p.ch, 0, 0)
          c.restore()
          break
        }
      }
    }
    c.globalAlpha = 1
  }

  return { ps, add, step, draw, clear: () => (ps.length = 0) }
}

function starburst(c, x, y, r, rot, n, fill, stroke, lw) {
  c.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r * 0.55 : r
    const a = rot + (i * Math.PI) / n
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i) c.lineTo(px, py)
    else c.moveTo(px, py)
  }
  c.closePath()
  c.fillStyle = fill
  c.fill()
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = lw
    c.lineJoin = 'round'
    c.stroke()
  }
}

function star(c, x, y, r, rot, fill) {
  c.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i) c.lineTo(px, py)
    else c.moveTo(px, py)
  }
  c.closePath()
  c.fillStyle = fill
  c.fill()
}

// ── Spawners ───────────────────────────────────────────────────
export function burst(sys, x, y, power, color) {
  sys.add({ t: 'burst', x, y, vx: 0, vy: 0, size: 22 + power * 0.06, life: 0.24, rot: R() * TAU, color })
  ring(sys, x, y, 30 + power * 0.08)
  sparks(sys, x, y, Math.round(6 + power / 45), 380 + power * 0.9)
}

export function sparks(sys, x, y, n, speed = 600) {
  for (let i = 0; i < n; i++) {
    const a = R() * TAU
    const v = speed * (0.4 + R() * 0.8)
    sys.add({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.18 + R() * 0.16, drag: 6, color: R() < 0.5 ? '#fff6c2' : '#ffb03b', w: 2 + R() * 2.5 })
  }
}

export function ring(sys, x, y, size, color = 'rgba(255,255,255,.95)') {
  sys.add({ t: 'ring', x, y, vx: 0, vy: 0, size, life: 0.36, color })
}

export function confetti(sys, x, y, n, speed = 950) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.5
    const v = speed * (0.25 + R())
    sys.add({
      t: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 6 + R() * 7, h: 3 + R() * 4, color: CONFETTI[(R() * CONFETTI.length) | 0],
      g: 900, drag: 1.7, vr: (R() - 0.5) * 14, flip: R() * TAU, fs: 8 + R() * 12, life: 2.4 + R() * 1.6, floor: true,
    })
  }
}

export function paperBits(sys, x, y, n, speed = 520) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.7
    const v = speed * (0.3 + R())
    sys.add({
      t: 'paper', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 8 + R() * 9, h: 6 + R() * 7, color: R() < 0.8 ? '#fbfbf7' : '#dfe7f5',
      g: 650, drag: 2.4, vr: (R() - 0.5) * 10, flip: R() * TAU, fs: 5 + R() * 7, life: 2 + R() * 1.4, floor: true,
    })
  }
}

export function shards(sys, x, y, n, palette = ['#f4f1ea', '#f4f1ea', '#f4f1ea', '#d9d3c7']) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.8
    const v = 300 + R() * 650
    const s = 4 + R() * 8
    sys.add({
      t: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1500, drag: 0.5,
      vr: (R() - 0.5) * 22, life: 1.4 + R() * 0.6, floor: true, color: palette[(R() * palette.length) | 0],
      pts: [-s, -s * 0.4, s * (0.4 + R()), -s * R(), -s * 0.2, s * (0.5 + R())],
    })
  }
}

export function drops(sys, x, y, n, palette = ['#5b3a1e', '#7a4f2a'], size = 1) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.6
    const v = 200 + R() * 520
    sys.add({ t: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (1.5 + R() * 3.5) * size, color: palette[(R() * palette.length) | 0], g: 1600, drag: 0.4, life: 1 + R() * 0.5, floor: true })
  }
}

const KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌘', '⇧', '↵', 'Esc', '⌫', '?', '!']
export function keycaps(sys, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.8
    const v = 350 + R() * 650
    sys.add({ t: 'key', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 13 + R() * 5, ch: KEYS[(R() * KEYS.length) | 0], g: 1500, drag: 0.6, vr: (R() - 0.5) * 18, life: 1.6 + R() * 0.6, floor: true })
  }
}

export function dust(sys, x, y, n, color = 'rgb(150,140,130)') {
  for (let i = 0; i < n; i++) {
    sys.add({ t: 'dust', x: x + (R() - 0.5) * 60, y, vx: (R() - 0.5) * 300, vy: -R() * 90, r: 7 + R() * 12, drag: 3, life: 0.7 + R() * 0.5, color })
  }
}

export function stars(sys, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = R() * TAU
    const v = 120 + R() * 260
    sys.add({ t: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, size: 4 + R() * 5, color: R() < 0.7 ? '#ffd84d' : '#ffffff', g: 350, drag: 2.5, vr: (R() - 0.5) * 8, life: 0.7 + R() * 0.4 })
  }
}
