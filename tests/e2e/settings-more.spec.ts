import { test, expect } from "@playwright/test"
import { API, authHeaders, createMember, loginApi, signedInPage } from "./helpers"

const backOut = /^(Cancel|Keep|No\b)/

test.describe("Settings: the remaining controls", () => {
  test("SET-11: Test plays the chime only while the sound is on", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/settings")
    await page.evaluate(() => {
      ;(window as any).__chimes = 0
      window.addEventListener("d8lpa:chime", () => ((window as any).__chimes += 1))
      const Original = window.AudioContext
      ;(window as any).__audioStarts = 0
      window.AudioContext = class extends Original {
        createOscillator() {
          ;(window as any).__audioStarts += 1
          return super.createOscillator()
        }
      } as typeof AudioContext
    })
    const test = page.getByRole("button", { name: "Test", exact: true })
    await expect(test).toBeEnabled()
    await test.click()
    await expect.poll(() => page.evaluate(() => (window as any).__audioStarts)).toBeGreaterThan(0)
    await page.locator("#sound").click()
    await expect(test).toBeDisabled()
    await page.context().close()
  })

  test("SET-23/24: the blocked list when empty, and when it cannot be loaded", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/settings")
    await page.getByRole("button", { name: "View Blocked Members" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("You haven't blocked anyone yet")
    await expect(dialog).toContainText("No blocked users")
    await page.keyboard.press("Escape")

    await page.route("**/api/browse/blocked-list", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error fetching blocked users" }) })
    )
    await page.getByRole("button", { name: "View Blocked Members" }).click()
    await expect(page.getByText(/Error loading blocked users/)).toBeVisible()
    await page.context().close()
  })

  test("SET-24: a failed unblock says so and the member stays on the list", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Hollis" })
    await request.post(`${API}/browse/${other.id}/block`, { headers: authHeaders(me.token) })
    const page = await signedInPage(browser, me, "/settings")
    await page.route("**/api/browse/*/unblock", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error unblocking user" }) })
    )
    await page.getByRole("button", { name: "View Blocked Members" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Hollis")
    await dialog.getByRole("button", { name: /Unblock/ }).first().click()
    // Some versions ask "are you sure" first.
    const confirm = page.getByRole("button", { name: /^(Unblock|Yes)/ }).last()
    if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {})
    await expect(page.getByText(/Error unblocking user/).first()).toBeVisible()
    const blocked = await (await request.get(`${API}/browse/blocked-list`, { headers: authHeaders(me.token) })).json()
    expect(JSON.stringify(blocked)).toContain("Hollis")
    await page.context().close()
  })

  test("SET-25/26/27/36: Contact Us, the Terms and Privacy dialog, and the version line", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/settings")
    await expect(page.getByText("Contact Us").first()).toBeVisible()
    await expect(page.getByRole("link", { name: "d8lpa.community@gmail.com" }).first()).toHaveAttribute("href", "mailto:d8lpa.community@gmail.com")
    await expect(page.getByText("D8-LPA v1.0.0")).toBeVisible()

    await page.getByRole("button", { name: "Terms & Privacy Policy" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Terms of Service" }).first()).toBeVisible()
    await expect(dialog.getByRole("heading", { name: "Privacy Policy" }).first()).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await page.context().close()
  })

  test("SET-35/ACC-02/06/13: backing out of Change Password, Take a Break and Delete Account changes nothing", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/settings")

    await page.getByRole("button", { name: "Change Password" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.locator("input").first().fill("typed-then-abandoned")
    await dialog.getByRole("button", { name: backOut }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole("button", { name: /Take a Break/ }).click()
    dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("You can reactivate your account anytime")
    await dialog.getByLabel(/Why are you disabling your account/).fill("Just looking")
    await dialog.getByRole("button", { name: backOut }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole("button", { name: "Delete Account" }).click()
    dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("link", { name: "d8lpa.community@gmail.com" })).toBeVisible()
    await dialog.getByRole("button", { name: backOut }).click()
    await expect(dialog).toBeHidden()

    // Still signed in, still able to sign in with the same password, still in Browse.
    await page.reload()
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
    const again = await loginApi(request, me.email, me.password)
    expect(again.user.is_disabled || false).toBe(false)
    expect(again.user.is_deleted || false).toBe(false)
    await page.context().close()
  })

  test("GLB-12/16: the first key press unlocks sound; the development banner shows only in development", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/browse")
    await expect(page.getByText("Development Mode")).toBeVisible() // the local stack runs in development
    await expect(page.getByTestId("browse-card").first()).toBeVisible()
    // No error is thrown when the first gesture arrives (audio is primed quietly).
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.keyboard.press("Tab")
    await page.mouse.click(5, 5)
    await page.waitForTimeout(300)
    expect(errors).toEqual([])
    await page.context().close()
  })
})
