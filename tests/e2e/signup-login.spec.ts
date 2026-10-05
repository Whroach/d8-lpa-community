import { test, expect, type Page } from "@playwright/test"
import { API, PASSWORD, alertBox, authHeaders, createMember, latestEmail, uniqueEmail } from "./helpers"

async function fillSignup(page: Page, email: string, password = PASSWORD) {
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.locator("#confirmPassword").fill(password)
  if (!(await page.locator("#terms").isChecked())) await page.locator("#terms").click()
}

async function outbox(request: import("@playwright/test").APIRequestContext, to: string) {
  return (await (await request.get(`${API}/__test/outbox?to=${encodeURIComponent(to)}`)).json()) as { subject: string; text: string }[]
}

const codeIn = (mail: { text: string }) => mail.text.match(/\b(\d{6})\b/)![1]

async function typeCode(page: Page, code: string) {
  const boxes = page.locator('input[maxlength="1"]')
  await expect(boxes).toHaveCount(6)
  for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill(code[i])
}

test.describe("VER-07: leaving the code screen is never a dead end", () => {
  test("Back to signup keeps the email; creating the account again returns to the code screen with a fresh code", async ({ page, request }) => {
    const email = uniqueEmail("back")
    await page.goto("/signup")
    await fillSignup(page, email)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
    const firstCode = codeIn(await latestEmail(request, email))

    await page.getByRole("button", { name: "Back to signup" }).click()
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    // The entered email is still there, with a hint about what to do next.
    await expect(page.locator("#email")).toHaveValue(email)
    await expect(page.getByRole("status")).toContainText("We will send a new code")

    await page.getByRole("button", { name: "Create Account" }).click()
    // No "Email already registered" dead end: back on the code screen.
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible()
    await expect(page.getByText("We have emailed you a new code")).toBeVisible()
    await expect.poll(async () => (await outbox(request, email)).length).toBe(2)
    const mails = await outbox(request, email)
    const freshCode = codeIn(mails[1])

    if (freshCode !== firstCode) {
      // The earlier code no longer works.
      await typeCode(page, firstCode)
      await page.getByRole("button", { name: "Verify Code" }).click()
      await expect(alertBox(page)).toContainText("Invalid verification code")
    }
    await typeCode(page, freshCode)
    await page.getByRole("button", { name: "Verify Code" }).click()
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByRole("heading", { name: "Personal Info" })).toBeVisible()
  })

  test("reloading the code screen and signing up again also returns to the code screen", async ({ page, request }) => {
    const email = uniqueEmail("reload")
    await page.goto("/signup")
    await fillSignup(page, email)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    await fillSignup(page, email)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible()
    await expect.poll(async () => (await outbox(request, email)).length).toBe(2)
    await typeCode(page, codeIn((await outbox(request, email))[1]))
    await page.getByRole("button", { name: "Verify Code" }).click()
    await expect(page).toHaveURL(/\/onboarding/)
  })

  test("going back and correcting a mistyped email creates the right account", async ({ page, request }) => {
    const wrong = uniqueEmail("typo")
    const right = uniqueEmail("right")
    await page.goto("/signup")
    await fillSignup(page, wrong)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible()
    await page.getByRole("button", { name: "Back to signup" }).click()
    await page.locator("#email").fill(right)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible()
    await expect(page.getByText(right)).toBeVisible()
    await typeCode(page, codeIn(await latestEmail(request, right)))
    await page.getByRole("button", { name: "Verify Code" }).click()
    await expect(page).toHaveURL(/\/onboarding/)
  })

  test("a different password, or an account that is already set up, gets the ordinary answer and no email", async ({ page, request }) => {
    // Unverified account, but not this person's password.
    const email = uniqueEmail("stranger")
    expect((await request.post(`${API}/auth/signup`, { data: { email, password: PASSWORD } })).status()).toBe(201)
    await latestEmail(request, email)
    await page.goto("/signup")
    await fillSignup(page, email, "Another-Pass-77!")
    await page.getByRole("button", { name: "Create Account" }).click()
    const alert = alertBox(page)
    await expect(alert).toContainText("Email already registered")
    // ...with a way forward for someone who does own the account.
    await expect(alert.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login")
    await expect(alert.getByRole("link", { name: "reset your password" })).toHaveAttribute("href", "/forgot-password")
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    expect(await outbox(request, email)).toHaveLength(1)

    // A real member's email with their real password is not "resumed" either.
    const member = await createMember(request)
    const before = (await outbox(request, member.email)).length
    await fillSignup(page, member.email, member.password)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(alertBox(page)).toContainText("Email already registered")
    expect((await outbox(request, member.email)).length).toBe(before)
    const me = await (await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).json()
    expect(me.user.email_verified).toBe(true)
  })
})
