import { test, expect, type Page } from "@playwright/test"
import { API, createMember, signedInPage, authHeaders, loginApi, PASSWORD, type Member } from "./helpers"

const getSettings = async (request: any, member: Member) =>
  (await request.get(`${API}/settings`, { headers: authHeaders(member.token) })).json()

test.describe("settings", () => {
  let member: Member
  let page: Page

  test.beforeEach(async ({ browser, request }) => {
    member = await createMember(request)
    page = await signedInPage(browser, member, "/settings")
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
    await expect(page.locator("#matches")).toBeVisible()
  })
  test.afterEach(async () => {
    await page.context().close()
  })

  // [switch id, where it is stored, value after one click]
  const TOGGLES: [string, "notifications" | "privacy", string, boolean][] = [
    ["matches", "notifications", "matches", false],
    ["messages", "notifications", "messages", false],
    ["likes", "notifications", "likes", false],
    ["events", "notifications", "events", false],
    ["admin_news", "notifications", "admin_news", false],
    ["sound", "notifications", "sound", false],
    ["quiet_hours_enabled", "notifications", "quiet_hours_enabled", true],
    ["email_digest", "notifications", "email_digest", true],
    ["profileVisible", "privacy", "profileVisible", false],
    ["selectiveMode", "privacy", "selectiveMode", true],
    ["showOnline", "privacy", "showOnline", false],
    ["readReceipts", "privacy", "readReceipts", false],
  ]

  for (const [id, group, key, expected] of TOGGLES) {
    test(`SET: the "${id}" switch saves by itself and is still set after a reload`, async ({ request }) => {
      const toggle = page.locator(`#${id}`)
      await expect(toggle).toHaveAttribute("aria-checked", String(!expected))
      await toggle.click()
      await expect(toggle).toHaveAttribute("aria-checked", String(expected))
      // Saved without pressing anything else.
      await expect.poll(async () => (await getSettings(request, member))[group][key]).toBe(expected)
      await page.reload()
      await expect(page.locator(`#${id}`)).toHaveAttribute("aria-checked", String(expected))
      // No other switch moved.
      const after = await getSettings(request, member)
      for (const [, otherGroup, otherKey, otherExpected] of TOGGLES) {
        if (otherKey !== key) expect(after[otherGroup][otherKey], otherKey).toBe(!otherExpected)
      }
    })
  }

  test("SET: hiding my profile really removes me from other members' Browse, and showing it brings me back", async ({ request }) => {
    const viewer = await createMember(request)
    const seen = async () =>
      ((await (await request.get(`${API}/browse`, { headers: authHeaders(viewer.token) })).json()) as any[]).some(
        (p) => String(p.id) === member.id
      )
    expect(await seen()).toBe(true)
    await page.locator("#profileVisible").click()
    await expect.poll(seen).toBe(false)
    await page.locator("#profileVisible").click()
    await expect.poll(seen).toBe(true)
  })

  test("SET: who I want to meet and the age range are saved; the age boxes can be typed in normally", async ({ request }) => {
    await page.getByLabel("Women").click()
    await page.getByLabel("Non-binary").click()
    await expect.poll(async () => (await getSettings(request, member)).lookingFor).toEqual(["female", "non_binary"])

    await page.locator("#ageMin").fill("45")
    await page.locator("#ageMax").fill("70")
    await page.locator("#ageMax").blur()
    await expect.poll(async () => {
      const s = await getSettings(request, member)
      return [s.agePreferenceMin, s.agePreferenceMax]
    }).toEqual([45, 70])
    await page.reload()
    await expect(page.locator("#ageMin")).toHaveValue("45")
    await expect(page.locator("#ageMax")).toHaveValue("70")
    await expect(page.getByLabel("Women")).toBeChecked()
  })

  test("SET: quiet hours times are saved", async ({ request }) => {
    await page.locator("#quiet_hours_enabled").click()
    await page.locator("#quiet_hours_start").fill("22:30")
    await page.locator("#quiet_hours_end").fill("07:15")
    await expect.poll(async () => {
      const n = (await getSettings(request, member)).notifications
      return [n.quiet_hours_enabled, n.quiet_hours_start, n.quiet_hours_end]
    }).toEqual([true, "22:30", "07:15"])
    await page.reload()
    await expect(page.locator("#quiet_hours_start")).toHaveValue("22:30")
  })

  test("THM/SET: dark and light screen colours, and text size, apply at once and are remembered", async () => {
    const html = page.locator("html")
    await page.getByLabel("Dark", { exact: true }).check()
    await expect(html).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.getByLabel("Light", { exact: true }).check()
    await expect(page.locator("html")).not.toHaveClass(/dark/)

    const sizeOf = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
    expect(await sizeOf()).toBe(18) // default: larger than the browser's 16px
    await page.getByLabel(/Extra large/).check()
    await expect(html).toHaveAttribute("data-text-size", "xlarge")
    expect(await sizeOf()).toBeGreaterThan(22)
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge")
    await page.getByLabel(/Comfortable/).check()
    expect(await sizeOf()).toBe(18)
  })

  test("SET: a settings load failure shows an error instead of defaults that could be saved over the real ones", async ({ request }) => {
    await request.put(`${API}/settings`, { headers: authHeaders(member.token), data: { notifications: { likes: false } } })
    await page.route("**/api/settings", (route) => (route.request().method() === "GET" ? route.abort() : route.continue()))
    await page.reload()
    await expect(page.getByText("We could not load your settings")).toBeVisible()
    await expect(page.locator("#likes")).toHaveCount(0)
    await page.unroute("**/api/settings")
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(page.locator("#likes")).toHaveAttribute("aria-checked", "false")
    expect((await getSettings(request, member)).notifications.likes).toBe(false)
  })

  test("SET: blocked members are listed and can be unblocked", async ({ request }) => {
    const other = await createMember(request, { firstName: "Jordan" })
    await request.post(`${API}/browse/${other.id}/block`, { headers: authHeaders(member.token) })
    await page.getByRole("button", { name: "View Blocked Members" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Jordan")).toBeVisible()
    await dialog.getByRole("button", { name: "Unblock" }).click()
    await expect(page.getByText("Jordan is no longer blocked")).toBeVisible()
    const list = await (await request.get(`${API}/browse/blocked-list`, { headers: authHeaders(member.token) })).json()
    expect(list).toHaveLength(0)
  })

  test("ACC: change password - a wrong current password keeps me signed in; the new password then works", async ({ request }) => {
    await page.getByRole("button", { name: /Change Password/i }).first().click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("#current-password").fill("Wrong-Pass-1!")
    await dialog.locator("#new-password").fill("Changed-Pass-2026!")
    await dialog.locator("#confirm-password").fill("Changed-Pass-2026!")
    await dialog.getByRole("button", { name: /Change Password|Update Password|Save/i }).last().click()
    await expect(dialog.getByText(/current password is not right/i)).toBeVisible()
    await expect(page).toHaveURL(/\/settings/) // not thrown out to the login page

    await dialog.locator("#current-password").fill(PASSWORD)
    await dialog.getByRole("button", { name: /Change Password|Update Password|Save/i }).last().click()
    await expect.poll(async () => (await request.post(`${API}/auth/login`, { data: { email: member.email, password: "Changed-Pass-2026!" } })).status()).toBe(200)
  })

  test("ACC: take a break pauses the account until the next log in", async ({ request }) => {
    await page.getByText("Take a Break (Disable Account)").click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("#disable-password").fill(PASSWORD)
    await dialog.locator("#disable-confirm").click()
    await dialog.getByRole("button", { name: /disable|take a break|pause/i }).last().click()
    await expect(page).toHaveURL(/\/login/)
    expect((await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).status()).toBe(403)
    // Logging in again brings the account back.
    await loginApi(request, member.email, PASSWORD)
    expect((await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).status()).toBe(200)
  })

  test("ACC: delete account - a wrong password keeps the dialog open; the right one closes the account", async ({ request }) => {
    await page.getByText("Delete Account", { exact: true }).first().click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("#delete-password").fill("Wrong-Pass-1!")
    await dialog.locator("#delete-confirm").click()
    await dialog.getByRole("button", { name: /Delete Account Permanently/i }).click()
    await expect(page.getByText(/password is not right/i)).toBeVisible()
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/settings/)

    await dialog.locator("#delete-password").fill(PASSWORD)
    await dialog.getByRole("button", { name: /Delete Account Permanently/i }).click()
    await expect(page).toHaveURL(/\/login/)
    expect((await request.post(`${API}/auth/login`, { data: { email: member.email, password: PASSWORD } })).status()).toBe(403)
  })
})
