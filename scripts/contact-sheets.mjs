/**
 * Tiles the design-review captures (see tests/e2e/shots.ts) into contact
 * sheets small enough to open, but large enough to read: 8 phone screens,
 * 4 tablet screens or 2 desktop screens per sheet, each with its name.
 *
 *     node scripts/contact-sheets.mjs docs/screenshots/tmp/round3
 *
 * Reads <dir>/<size>-<scheme>/*.jpg, writes <dir>/sheets/<size>-<scheme>-NN.jpg.
 * Local use only; nothing leaves this computer.
 */
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const dir = path.resolve(process.argv[2] || 'docs/screenshots/tmp/round3')
const only = process.argv[3] ? process.argv[3].split(',') : null
const out = path.join(dir, 'sheets')
fs.mkdirSync(out, { recursive: true })

const LAYOUT = {
  phone: { columns: 4, perSheet: 8, tile: 390 },
  tablet: { columns: 2, perSheet: 4, tile: 780 },
  desktop: { columns: 1, perSheet: 2, tile: 1440 },
}

const browser = await chromium.launch()
for (const folder of fs.readdirSync(dir).sort()) {
  const [size, scheme] = folder.split('-')
  const layout = LAYOUT[size]
  if (!layout || !scheme || (only && !only.includes(folder))) continue
  const files = fs.readdirSync(path.join(dir, folder)).filter((f) => f.endsWith('.jpg')).sort()
  for (let i = 0; i < files.length; i += layout.perSheet) {
    const group = files.slice(i, i + layout.perSheet)
    const page = await browser.newPage({ viewport: { width: layout.columns * (layout.tile + 10) + 10, height: 600 } })
    await page.setContent(`<body style="margin:0;padding:10px;background:${scheme === 'dark' ? '#555' : '#888'};font:bold 17px sans-serif;display:grid;grid-template-columns:repeat(${layout.columns},${layout.tile}px);gap:10px">${
      group.map((file) => `<figure style="margin:0"><figcaption style="color:#fff;padding:2px 0">${folder} / ${file.replace('.jpg', '')}</figcaption><img style="width:${layout.tile}px;display:block" src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir, folder, file)).toString('base64')}"></figure>`).join('')
    }</body>`)
    const name = `${folder}-${String(i / layout.perSheet + 1).padStart(2, '0')}.jpg`
    await page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 78, fullPage: true })
    await page.close()
    console.log(name)
  }
}
await browser.close()
