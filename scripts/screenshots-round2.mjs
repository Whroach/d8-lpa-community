/**
 * Round-2 design review captures: the screens and dialogs changed in round 2,
 * at phone (390), tablet (820) and desktop (1440) widths, light and dark, tiled
 * into contact sheets (one per width and theme).
 *
 *     $env:WEB_URL='http://localhost:3000'; $env:API_URL='http://localhost:5001/api'
 *     node scripts/screenshots-round2.mjs docs/screenshots/round2
 *
 * Uses the fictional demo account from the local seed. Local use only.
 */
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const WEB = process.env.WEB_URL || 'http://localhost:3000'
const API = process.env.API_URL || 'http://localhost:5001/api'
const out = path.resolve(process.argv[2] || 'docs/screenshots/tmp/round2')
const only = process.argv[3] ? process.argv[3].split(',') : null // e.g. "phone-light,desktop-dark"
fs.mkdirSync(out, { recursive: true })

const login = await (await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'dana@example.test', password: 'Demo-Pass-2026!' }),
})).json()
if (!login.token) throw new Error('Could not sign in to the local demo account. Is the local stack running?')
const session = JSON.stringify({
  state: {
    user: { ...login.user, id: login.user.id || login.user._id }, profile: login.profile, token: login.token,
    sessionTimestamp: Date.now(), isAuthenticated: true, onboardingData: {}, onboardingStep: 1,
  },
  version: 0,
})

const png = (page) => page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 900; c.height = 700
  const g = c.getContext('2d'); g.fillStyle = '#2f6f4f'; g.fillRect(0, 0, 900, 700)
  g.fillStyle = '#f2e9d8'; g.beginPath(); g.arc(450, 320, 180, 0, 7); g.fill()
  return c.toDataURL('image/png').split(',')[1]
})

const STATES = [
  ['browse', '/browse'],
  ['browse-filter', '/browse', async (p) => {
    await p.getByRole('group', { name: 'Filters' }).getByRole('button', { name: /^State/ }).click()
    await p.getByRole('menuitemcheckbox').first().click(); await p.keyboard.press('Escape')
  }],
  ['matches', '/matches'],
  ['matches-unmatch', '/matches', async (p) => {
    await p.getByRole('button', { name: /^Options for/ }).first().click()
    await p.getByRole('menuitem', { name: 'Unmatch' }).click()
  }],
  ['notifications', '/notifications'],
  ['events', '/events'],
  ['events-filters', '/events', async (p) => { await p.getByRole('button', { name: /^Filters/ }).click() }],
  ['events-details', '/events', async (p) => { await p.getByTestId('event-card').first().getByRole('button').click() }],
  ['my-profile', '/profile'],
  ['my-profile-edit', '/profile', async (p) => { await p.getByRole('button', { name: 'Edit', exact: true }).click() }],
  ['photo-manager', '/profile', async (p) => { await p.getByRole('button', { name: 'Manage Photos', exact: true }).click() }],
  ['photo-crop', '/profile', async (p) => {
    await p.getByRole('button', { name: 'Manage Photos', exact: true }).click()
    await p.getByTestId('photo-file-input').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(await png(p), 'base64') })
    await p.getByRole('dialog', { name: 'Position your photo' }).waitFor()
  }],
]
const SIZES = { phone: [390, 844], tablet: [820, 1180], desktop: [1440, 900] }

const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  for (const [sizeName, [width, height]] of Object.entries(SIZES)) {
    if (only && !only.includes(`${sizeName}-${scheme}`)) continue
    const shots = []
    for (const [name, url, act] of STATES) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme })
      await context.addInitScript((value) => localStorage.setItem('spark-auth', value), session)
      const page = await context.newPage()
      await page.goto(WEB + url)
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(500)
      try { if (act) { await act(page); await page.waitForTimeout(500) } } catch (error) { console.log(`${name} ${sizeName} ${scheme}: ${error.message.split('\n')[0]}`) }
      shots.push([name, (await page.screenshot({ type: 'jpeg', quality: 70 })).toString('base64')])
      await context.close()
    }
    // One sheet per width and theme.
    const columns = sizeName === 'phone' ? 6 : sizeName === 'tablet' ? 4 : 3
    const tile = sizeName === 'phone' ? 300 : sizeName === 'tablet' ? 440 : 620
    const sheet = await browser.newPage({ viewport: { width: columns * (tile + 12) + 12, height: 800 } })
    await sheet.setContent(`<body style="margin:0;padding:12px;background:#777;font:14px sans-serif;display:grid;grid-template-columns:repeat(${columns},${tile}px);gap:12px">${
      shots.map(([name, data]) => `<figure style="margin:0"><figcaption style="color:#fff;padding:2px 0">${name}</figcaption><img style="width:${tile}px;display:block" src="data:image/jpeg;base64,${data}"></figure>`).join('')
    }</body>`)
    await sheet.screenshot({ path: path.join(out, `round2-${sizeName}-${scheme}.jpg`), type: 'jpeg', quality: 62, fullPage: true })
    await sheet.close()
    console.log(`round2-${sizeName}-${scheme}.jpg`)
  }
}
await browser.close()
