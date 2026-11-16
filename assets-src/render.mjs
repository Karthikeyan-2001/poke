// Renders the icon SVG layers to PNG for @capacitor/assets, plus a launcher-mask preview sheet.
// Usage: node assets-src/render.mjs [previewDir]
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = 'assets-src'
const out = 'assets'
mkdirSync(out, { recursive: true })
const png = (name, size = 1024) => sharp(join(src, name), { density: 288 }).resize(size, size).png()

await png('icon-background.svg').toFile(join(out, 'icon-background.png'))
await png('icon-foreground.svg').toFile(join(out, 'icon-foreground.png'))
await png('icon-monochrome.svg').toFile(join(out, 'icon-monochrome.png'))
// Legacy (pre-adaptive) icon: both layers flattened.
const fg = await png('icon-foreground.svg').toBuffer()
await png('icon-background.svg').composite([{ input: fg }]).toFile(join(out, 'icon-only.png'))
console.log('rendered assets/*.png')

// Preview: how launchers will mask it (circle, squircle, rounded square) + small sizes + themed.
const preview = process.argv[2]
if (preview) {
  const flat = await sharp(join(out, 'icon-only.png')).toBuffer()
  // Adaptive icons show the centre 72/108 of the layers.
  const crop = Math.round((1024 * 72) / 108)
  const off = Math.round((1024 - crop) / 2)
  const visible = await sharp(flat).extract({ left: off, top: off, width: crop, height: crop }).resize(240, 240).toBuffer()
  const masks = {
    circle: '<circle cx="120" cy="120" r="120"/>',
    squircle: '<path d="M120 0C210 0 240 30 240 120S210 240 120 240 0 210 0 120 30 0 120 0Z"/>',
    rounded: '<rect width="240" height="240" rx="54"/>',
  }
  const tiles = []
  for (const shape of Object.values(masks)) {
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">${shape}</svg>`)
    tiles.push(await sharp(visible).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer())
  }
  const small = await sharp(visible).resize(48, 48).png().toBuffer()
  const mono = await sharp(join(out, 'icon-monochrome.png')).extract({ left: off, top: off, width: crop, height: crop }).resize(240, 240).toBuffer()
  const themedBg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><circle cx="120" cy="120" r="120" fill="#2d3a2c"/></svg>')
  const themed = await sharp(themedBg).composite([{ input: await sharp(mono).tint('#cfe8c4').toBuffer() }]).png().toBuffer()
  const W = 4 * 260 + 20
  for (const [bg, file] of [
    ['#ECECE6', 'icon-preview-light.png'],
    ['#161618', 'icon-preview-dark.png'],
  ]) {
    await sharp({ create: { width: W, height: 340, channels: 4, background: bg } })
      .composite([
        ...tiles.map((t, i) => ({ input: t, left: 20 + i * 260, top: 20 })),
        { input: themed, left: 20 + 3 * 260, top: 20 },
        { input: small, left: 20, top: 280 },
        { input: await sharp(visible).resize(72, 72).png().toBuffer(), left: 90, top: 266 },
      ])
      .png()
      .toFile(join(preview, file))
  }
  console.log('preview written')
}
