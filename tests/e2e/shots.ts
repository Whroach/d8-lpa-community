import fs from "fs"
import path from "path"
import type { Page } from "@playwright/test"

/**
 * Design-review captures. The three accessibility specs (a11y-member,
 * a11y-signup-onboarding, a11y-admin) already visit every screen, step and
 * dialog; when SHOTS_DIR is set they also save pictures of each one, so the
 * pictures that are looked at are exactly the states axe measured.
 *
 *     $env:SHOTS_DIR = 'docs/screenshots/tmp/round3'; $env:SHOTS_SIZE = 'phone'   # or tablet, desktop
 *     npx playwright test tests/e2e/a11y-
 *     node scripts/contact-sheets.mjs docs/screenshots/tmp/round3
 *
 * In light mode a page longer than the screen is saved as several pictures,
 * one screen-height each (a, b, c ...), so everything below the first screen
 * is seen at full size too. A state with a dialog, menu or list open is one
 * picture of the screen. In dark mode (same layout, different colours) each
 * state is one picture of the first screen.
 *
 * Without SHOTS_DIR nothing here does anything.
 */
const SIZES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
} as const

export type ShotSize = keyof typeof SIZES

export const shotsDir = process.env.SHOTS_DIR ? path.resolve(process.env.SHOTS_DIR) : null
export const shotSize: ShotSize | null =
  shotsDir && process.env.SHOTS_SIZE && process.env.SHOTS_SIZE in SIZES ? (process.env.SHOTS_SIZE as ShotSize) : null

/** The screen size to use for a capture run; undefined in a normal test run. */
export const shotViewport = shotSize ? SIZES[shotSize] : undefined

const MAX_SLICES = 4
const counters = new Map<string, number>()

/** Saves a picture (or several) of what is on screen now. `group` is the spec, `scheme` light or dark. */
export async function shot(page: Page, group: string, scheme: string, name: string) {
  if (!shotsDir || !shotSize) return
  const folder = path.join(shotsDir, `${shotSize}-${scheme}`)
  fs.mkdirSync(folder, { recursive: true })
  const key = `${shotSize}-${scheme}-${group}`
  const n = (counters.get(key) || 0) + 1
  counters.set(key, n)
  const base = `${group}-${String(n).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 70)}`
  const { width, height } = SIZES[shotSize]

  // The Next.js development badge sits on top of the page's own corner; it is not part of the app.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {})
  const { overlay, total } = await page.evaluate(() => ({
    overlay: Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]')),
    total: document.documentElement.scrollHeight,
  }))
  const slices = scheme === "dark" || overlay ? 1 : Math.min(MAX_SLICES, Math.ceil((total - 8) / height))
  if (slices <= 1) {
    await page.screenshot({ path: path.join(folder, `${base}.jpg`), type: "jpeg", quality: 80 })
    return
  }
  for (let i = 0; i < slices; i += 1) {
    const y = i * height
    await page.screenshot({
      path: path.join(folder, `${base}-${"abcdef"[i]}.jpg`),
      type: "jpeg",
      quality: 80,
      fullPage: true,
      clip: { x: 0, y, width, height: Math.min(height, total - y) },
    })
  }
}
