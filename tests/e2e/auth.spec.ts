import { test, expect } from "@playwright/test"
import { API, PASSWORD, createMember, latestEmail, uniqueEmail, signedInPage, authHeaders } from "./helpers"

test.describe("sign up, verify email, log in, log out", () => {
  test("SIGN/VER: a new person signs up, enters the emailed code and reaches onboarding", async ({ page, request }) => {
    const email = uniqueEmail("signup")
    await page.goto("/signup")
    await page.locator("#email").fill(email)
    await page.locator("#password").fill(PASSWORD)
    await page.locator("#confirmPassword").fill(PASSWORD)
    await page.locator("#terms").click()
    await page.locator('button[type="submit"]').click()

    // The code arrives by (captured) email.
    const mail = await latestEmail(request, email)
    expect(mail.subject).toMatch(/verify/i)
    const code = mail.text.match(/\b(\d{6})\b/)![1]
    const boxes = page.locator('input[maxlength="1"]')
    await expect(boxes).toHaveCount(6)
    for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill(code[i])
    const verify = page.getByRole("button", { name: /verify/i })
    if (await verify.isEnabled().catch(() => false)) await verify.click()

    await expect(page).toHaveURL(/\/onboarding/)
    // No developer hint is shown to members any more.
    await expect(page.getByText(/development mode, check the terminal/i)).toHaveCount(0)
  })

  test("SIGN: the terms link on the sign-up form opens a real page", async ({ page }) => {
    await page.goto("/signup")
    await page.getByRole("link", { name: /terms/i }).first().click()
    await expect(page.getByRole("heading", { name: /Terms of Service and Privacy Policy/i })).toBeVisible()
  })

  test("AUTH: log in with the form, see the app, log out", async ({ page, request }) => {
    const member = await createMember(request)
    await page.goto("/login")
    await page.locator("#email").fill(member.email)
    await page.locator("#password").fill(member.password)
    // Show / hide password
    await page.getByRole("button", { name: "Show password" }).click()
    await expect(page.locator("#password")).toHaveAttribute("type", "text")
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Messages" })).toBeVisible()

    await page.getByRole("button", { name: "Log Out" }).click()
    await expect(page).toHaveURL(/\/login/)
    // Signed out for real: a protected page sends you back to log in.
    await page.goto("/messages")
    await expect(page).toHaveURL(/\/login/)
  })

  test("AUTH: a wrong password shows one clear message and does not say whether the email exists", async ({ page, request }) => {
    const member = await createMember(request)
    await page.goto("/login")
    await page.locator("#email").fill(member.email)
    await page.locator("#password").fill("Wrong-Pass-1!")
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText(/email or password is not right/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("AUTH: someone who is not signed in is sent to the login page", async ({ page }) => {
    for (const path of ["/browse", "/messages", "/settings", "/admin", "/saved"]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test("AUTH: an ordinary member cannot use the admin page's data", async ({ request }) => {
    const member = await createMember(request)
    const res = await request.get(`${API}/admin/users`, { headers: authHeaders(member.token) })
    expect(res.status()).toBe(403)
  })
})

test.describe("forgotten password", () => {
  test("PWD: ask for a reset link, choose a new password, log in with it", async ({ page, request }) => {
    const member = await createMember(request)
    await page.goto("/forgot-password")
    await page.locator("#email").fill(member.email)
    await page.locator('button[type="submit"]').click()

    const mail = await latestEmail(request, member.email)
    expect(mail.subject).toMatch(/reset/i)
    const link = mail.text.match(/https?:\/\/\S+reset-password\?token=[a-f0-9]+/)![0].replace(/\.$/, "")
    await page.goto(new URL(link).pathname + new URL(link).search)

    const newPassword = "Reset-Pass-2026!"
    // A password the server would refuse is refused by the form first.
    await page.locator("#password").fill("weakpass")
    await page.locator("#confirmPassword").fill("weakpass")
    await expect(page.locator('button[type="submit"]')).toBeDisabled()

    await page.locator("#password").fill(newPassword)
    await page.locator("#confirmPassword").fill(newPassword)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })

    await page.locator("#email").fill(member.email)
    await page.locator("#password").fill(newPassword)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/profile/)
  })
})

test.describe("first sign-in", () => {
  test("TOUR: the welcome tour appears once, can be finished, and can be replayed from Help", async ({ browser, request }) => {
    const member = await createMember(request, { seenTour: false })
    const page = await signedInPage(browser, member, "/browse")

    const tour = page.getByTestId("welcome-tour")
    await expect(tour).toBeVisible()
    await expect(tour.getByText("Step 1 of 7")).toBeVisible()
    for (let i = 0; i < 6; i += 1) await tour.getByRole("button", { name: "Next" }).click()
    await tour.getByRole("button", { name: "Finish" }).click()
    await expect(tour).toBeHidden()

    // Remembered on the server: it does not come back on the next visit.
    await expect
      .poll(async () => (await (await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).json()).user.has_seen_tour)
      .toBe(true)
    await page.reload()
    await expect(page.getByTestId("welcome-tour")).toBeHidden()

    await page.goto("/help")
    await page.getByRole("button", { name: "Take the tour" }).click()
    await expect(page.getByTestId("welcome-tour")).toBeVisible()
    await page.getByRole("button", { name: "Skip the tour" }).click()
    await expect(page.getByTestId("welcome-tour")).toBeHidden()
    await page.context().close()
  })

  test("ONB: someone who has not finished their profile is taken back to onboarding", async ({ browser, request }) => {
    const email = uniqueEmail("unfinished")
    const signup = await (await request.post(`${API}/auth/signup`, { data: { email, password: PASSWORD } })).json()
    const me = await (await request.get(`${API}/auth/me`, { headers: authHeaders(signup.token) })).json()
    const page = await signedInPage(browser, { ...me, token: signup.token } as any, "/browse")
    await expect(page).toHaveURL(/\/onboarding/)
    await page.context().close()
  })
})
