/**
 * Captures every main screen at phone, tablet and desktop widths, in light and
 * dark, for design review:
 *
 *     npm run dev:local        (in one terminal)
 *     node scripts/screenshots.mjs [outputDir]
 *
 * Uses the fictional demo account from the local seed. Local use only.
 */
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const WEB = process.env.WEB_URL || 'http://localhost:3000'
const API = process.env.API_URL || 'http://localhost:5001/api'
const out = path.resolve(process.argv[2] || 'docs/screenshots/tmp')
fs.mkdirSync(out, { recursive: true })

const login = await (await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'dana@example.test', password: 'Demo-Pass-2026!' }),
})).json()
if (!login.token) throw new Error('Could not sign in to the local demo account. Is `npm run dev:local` running?')

const session = JSON.stringify({
  state: {
    user: { ...login.user, id: login.user.id || login.user._id },
    profile: login.profile, token: login.token, sessionTimestamp: Date.now(), isAuthenticated: true,
    onboardingData: {}, onboardingStep: 1,
  },
  version: 0,
})

const headers = { Authorization: `Bearer ${login.token}` }
const conversations = await (await fetch(`${API}/messages`, { headers })).json()
const browse = await (await fetch(`${API}/browse`, { headers })).json()

const SCREENS = [
  ['login', '/login', false],
  ['signup', '/signup', false],
  ['browse', '/browse', true],
  ['profile-other', `/profile/${browse[0]?.id}`, true],
  ['matches', '/matches', true],
  ['messages', `/messages?match=${conversations[0]?.match_id}`, true],
  ['events', '/events', true],
  ['notifications', '/notifications', true],
  ['saved', '/saved', true],
  ['my-profile', '/profile', true],
  ['settings', '/settings', true],
  ['safety', '/safety', true],
  ['help', '/help', true],
]
const SIZES = { phone: [390, 844], tablet: [820, 1180], desktop: [1440, 900] }

const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  for (const [sizeName, [width, height]] of Object.entries(SIZES)) {
    for (const [name, url, needsLogin] of SCREENS) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme })
      if (needsLogin) await context.addInitScript((value) => localStorage.setItem('spark-auth', value), session)
      const page = await context.newPage()
      await page.goto(WEB + url)
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(600)
      await page.screenshot({ path: path.join(out, `${name}-${sizeName}-${scheme}.jpg`), type: 'jpeg', quality: 60 })
      await context.close()
    }
  }
}
await browser.close()
console.log(`Saved ${SCREENS.length * 6} screenshots to ${out}`)
