// Generates Android launcher icons from assets/*.png (run assets-src/render.mjs first).
// Usage: node assets-src/android-icons.mjs
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RES = 'android/app/src/main/res'
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const layer = (name, px) => sharp(join('assets', name)).resize(px, px, { kernel: 'lanczos3' }).png({ compressionLevel: 9 })

// Legacy icons show the adaptive "visible" centre (72/108 of the layer).
const crop = Math.round((1024 * 72) / 108)
const off = Math.round((1024 - crop) / 2)
const visible = await sharp('assets/icon-only.png').extract({ left: off, top: off, width: crop, height: crop }).toBuffer()

for (const [d, k] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${d}`)
  const full = Math.round(108 * k) // adaptive layer size
  const legacy = Math.round(48 * k)
  await layer('icon-foreground.png', full).toFile(join(dir, 'ic_launcher_foreground.png'))
  await layer('icon-background.png', full).toFile(join(dir, 'ic_launcher_background.png'))
  await layer('icon-monochrome.png', full).toFile(join(dir, 'ic_launcher_monochrome.png'))
  const sq = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><rect width="${legacy}" height="${legacy}" rx="${legacy * 0.22}"/></svg>`)
  const ci = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`)
  const base = await sharp(visible).resize(legacy, legacy, { kernel: 'lanczos3' }).toBuffer()
  await sharp(base).composite([{ input: sq, blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher.png'))
  await sharp(base).composite([{ input: ci, blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'))
}

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`
writeFileSync(join(RES, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive)
writeFileSync(join(RES, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive)
writeFileSync(
  join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F4F4F0</color>\n</resources>\n`,
)
console.log('android icons written')
