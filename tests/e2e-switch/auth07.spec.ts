import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

/**
 * AUTH-07: with NEXT_PUBLIC_DISABLE_EMAIL_VERIFICATION=true baked into the
 * build, "Forgot password?" on the login screen is a button that explains the
 * feature is switched off, instead of a link to the reset form.
 *
 * Run with `npm run test:e2e:switches` (see playwright.switches.config.ts).
 */
async function openLogin(page: Page) {
  await page.goto("/login")
  const forgot = page.getByRole("button", { name: "Forgot password?" })
  await expect(forgot).toBeVisible()
  // The button is drawn by the server first; wait until the page has attached
  // its click handlers (React marks hydrated elements with a __react* key).
  await expect
    .poll(() => forgot.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))))
    .toBe(true)
  return forgot
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`AUTH-07: Forgot password explains that it is switched off (${colorScheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme })
    const page = await context.newPage()
    const forgot = await openLogin(page)

    // In this mode it is a button, not the link to the reset form.
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveCount(0)

    // Opened with the keyboard.
    await forgot.focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog", { name: "Password reset is switched off" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAccessibleDescription(/Resetting a password by email is switched off for now\. Please email d8lpa\.community@gmail\.com/)
    await expect(dialog.getByRole("link", { name: "d8lpa.community@gmail.com" })).toHaveAttribute("href", "mailto:d8lpa.community@gmail.com")
    await expect(page).toHaveURL(/\/login$/)
    // Focus is inside the dialog, and Tab stays inside it.
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("Tab")
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }

    // Full WCAG 2.0 / 2.1 A and AA rule sets on the open dialog.
    // Let the opening animation finish, so contrast is measured on the final colours.
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)).then(() => undefined))
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("nextjs-portal")
      .exclude(".bg-yellow-100") // the development-only banner
      .analyze()
    const problems = results.violations.flatMap((v) => v.nodes.map((n) => `[${v.id}] ${v.impact} ${n.target.join(" ")}`))
    expect(problems, problems.join("\n")).toEqual([])

    // The Close button closes it and focus goes back to "Forgot password?".
    await dialog.getByRole("button", { name: "Close", exact: true }).first().click()
    await expect(dialog).toBeHidden()
    await expect(forgot).toBeFocused()

    // Escape closes it.
    await forgot.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(forgot).toBeFocused()

    // So does the X in the corner.
    await forgot.click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Close", exact: true }).last().click()
    await expect(dialog).toBeHidden()
    await expect(forgot).toBeFocused()

    // The rest of the login form is unchanged.
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled()
    await context.close()
  })
}

test("AUTH-07: the login screen itself passes axe in this mode", async ({ page }) => {
  await openLogin(page)
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .exclude(".bg-yellow-100")
    .analyze()
  const problems = results.violations.flatMap((v) => v.nodes.map((n) => `[${v.id}] ${v.impact} ${n.target.join(" ")}`))
  expect(problems, problems.join("\n")).toEqual([])
})
