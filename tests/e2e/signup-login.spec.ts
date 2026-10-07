import { test, expect, type Page } from "@playwright/test"
import { ADMIN_EMAIL, API, DEMO_PASSWORD, PASSWORD, alertBox, authHeaders, createMember, latestEmail, loginApi, signedInContextWith, uniqueEmail } from "./helpers"

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

test.describe("sign up: every part of the form", () => {
  test("SIGN: heading, live checks, show/hide, password rules, disabled until complete, links", async ({ page }) => {
    await page.goto("/signup")
    await expect(page.getByRole("heading", { name: "Create your account", level: 1 })).toBeVisible()
    await expect(page.getByText("Join D8-LPA and find your perfect match")).toBeVisible()
    await expect(page.getByText("D8-LPA", { exact: true })).toBeVisible()
    const submit = page.getByRole("button", { name: "Create Account" })
    await expect(submit).toBeDisabled()

    await page.locator("#email").fill("not-an-email")
    await expect(page.getByText("Please enter a valid email address")).toBeVisible()
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true")
    await page.locator("#email").fill(uniqueEmail("form"))
    await expect(page.getByText("Please enter a valid email address")).toBeHidden()

    // The five rules tick off one at a time.
    const rules = page.getByRole("list", { name: "Password rules" })
    const rule = (text: string) => rules.getByRole("listitem").filter({ hasText: text })
    await page.locator("#password").fill("a")
    await expect(rule("Contains lowercase letter")).toContainText("done")
    await expect(rule("At least 8 characters")).toContainText("not yet")
    await page.locator("#password").fill("aB")
    await expect(rule("Contains uppercase letter")).toContainText("done")
    await page.locator("#password").fill("aB3")
    await expect(rule("Contains a number")).toContainText("done")
    await page.locator("#password").fill("aB3!")
    await expect(rule("Contains a special character")).toContainText("done")
    await page.locator("#password").fill(PASSWORD)
    await expect(rule("At least 8 characters")).toContainText("done")

    // Show / Hide on both password boxes, with words.
    const toggles = page.getByRole("button", { name: "Show password" })
    await expect(toggles).toHaveCount(2)
    await toggles.first().click()
    await expect(page.locator("#password")).toHaveAttribute("type", "text")
    await page.getByRole("button", { name: "Hide password" }).click()
    await expect(page.locator("#password")).toHaveAttribute("type", "password")

    await page.locator("#confirmPassword").fill("Different-1!")
    await expect(page.getByText("Passwords do not match")).toBeVisible()
    await expect(submit).toBeDisabled()
    await page.locator("#confirmPassword").fill(PASSWORD)
    await expect(page.getByText("Passwords match")).toBeVisible()
    // Still needs the agreement.
    await expect(submit).toBeDisabled()
    await page.locator("#terms").click()
    await expect(submit).toBeEnabled()
    await page.locator("#terms").click()
    await expect(submit).toBeDisabled()

    await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms")
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy")
    await page.getByRole("link", { name: "Privacy Policy" }).click()
    await expect(page.getByRole("heading", { name: /Privacy Policy/i }).first()).toBeVisible()
    await page.goto("/signup")
    await expect(page.getByText("Already have an account?")).toBeVisible()
    await page.getByRole("link", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("SIGN: a server error is shown, and a sign-up that needs no code goes straight to onboarding", async ({ page }) => {
    await page.goto("/signup")
    await fillSignup(page, uniqueEmail("err"))
    await page.route("**/api/auth/signup", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "We could not create your account just now. Please try again." }) }), { times: 1 })
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(alertBox(page)).toContainText("We could not create your account just now")
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()

    // Verification switched off on the server: no code screen for a code that was never sent.
    await page.route("**/api/auth/signup", async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...(await response.json()), requiresVerification: false } })
    }, { times: 1 })
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByRole("heading", { name: "Personal Info" })).toBeVisible()
  })

  test("VER: code boxes (typing, Backspace, paste), wrong and expired codes, resend with its wait, help text", async ({ page, request }) => {
    const email = uniqueEmail("code")
    await page.goto("/signup")
    await fillSignup(page, email)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page.getByRole("heading", { name: "Verify your email", level: 1 })).toBeVisible()
    await expect(page.getByText("We sent a 6-digit code to")).toBeVisible()
    await expect(page.getByText("Check your spam folder")).toBeVisible()
    await expect(page.getByText(/Make sure you entered the correct email/)).toBeVisible()
    await expect(page.getByText("Try requesting a new code above")).toBeVisible()

    const boxes = page.locator('input[maxlength="1"]')
    const verify = page.getByRole("button", { name: "Verify Code" })
    await expect(boxes.nth(0)).toBeFocused()
    await expect(boxes.nth(0)).toHaveAccessibleName("Digit 1 of 6")
    await expect(verify).toBeDisabled()
    // Typing moves forward; letters are ignored; Backspace moves back.
    await page.keyboard.type("1")
    await expect(boxes.nth(1)).toBeFocused()
    await page.keyboard.type("x")
    await expect(boxes.nth(1)).toHaveValue("")
    await page.keyboard.type("2")
    await expect(boxes.nth(2)).toBeFocused()
    await page.keyboard.press("Backspace")
    await expect(boxes.nth(1)).toBeFocused()

    const real = codeIn(await latestEmail(request, email))
    const wrong = real === "000000" ? "111111" : "000000"
    // Pasting a whole code fills every box.
    await boxes.nth(0).focus()
    await page.evaluate((text) => {
      const data = new DataTransfer()
      data.setData("text", text)
      document.activeElement!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
    }, wrong)
    for (let i = 0; i < 6; i += 1) await expect(boxes.nth(i)).toHaveValue(wrong[i])
    await expect(verify).toBeEnabled()
    await verify.click()
    await expect(alertBox(page)).toContainText("Invalid verification code")

    // An expired code has its own message.
    await page.route("**/api/auth/verify-email", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Verification code expired" }) }), { times: 1 })
    await verify.click()
    await expect(alertBox(page)).toContainText("Verification code expired")

    // Resend: a second email, a confirmation, and a one-minute wait before the next.
    await page.getByRole("button", { name: "Resend Code" }).click()
    await expect(page.getByText("A new code is on its way")).toBeVisible()
    await expect(page.getByText(/Resend code in/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Resend Code" })).toHaveCount(0)
    await expect(page.getByText(/Try requesting a new code in \d+s/)).toBeVisible()
    for (let i = 0; i < 6; i += 1) await expect(boxes.nth(i)).toHaveValue("")
    await expect.poll(async () => (await outbox(request, email)).length).toBe(2)
    const fresh = codeIn((await outbox(request, email))[1])

    // Enter in the last box submits.
    await typeCode(page, fresh)
    await boxes.nth(5).press("Enter")
    await expect(page).toHaveURL(/\/onboarding/)
  })
})

test.describe("log in and log out", () => {
  test("AUTH: remember my email, links, session notice, landing page", async ({ page, request }) => {
    const member = await createMember(request)
    await page.goto("/login")
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password")
    await expect(page.getByText("Don't have an account?")).toBeVisible()
    await page.getByRole("link", { name: "Sign up" }).click()
    await expect(page).toHaveURL(/\/signup/)
    await page.goto("/login")

    await page.locator("#email").fill(member.email)
    await page.locator("#password").fill(member.password)
    await page.getByRole("checkbox", { name: "Remember my email" }).click()
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/profile/)
    // Only the email is remembered - never the password.
    expect(await page.evaluate(() => window.localStorage.getItem("db-lpa-remember-me"))).toBe(JSON.stringify({ email: member.email }))

    await page.getByRole("button", { name: "Log Out" }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator("#email")).toHaveValue(member.email)
    await expect(page.getByRole("checkbox", { name: "Remember my email" })).toBeChecked()
    await expect(page.locator("#password")).toHaveValue("")

    // Unticking forgets it.
    await page.locator("#password").fill(member.password)
    await page.getByRole("checkbox", { name: "Remember my email" }).click()
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/profile/)
    expect(await page.evaluate(() => window.localStorage.getItem("db-lpa-remember-me"))).toBeNull()

    // The front door: signed in goes to Browse, signed out goes to log in.
    await page.goto("/")
    await expect(page).toHaveURL(/\/browse/)
    await page.evaluate(() => window.localStorage.removeItem("spark-auth"))
    await page.goto("/")
    await expect(page.getByText("D8-LPA", { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator("#email")).toHaveValue("")
  })

  test("AUTH: banned, suspended and deleted accounts are told why at log in; server errors are shown", async ({ page, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const act = (id: string, action: string) => request.post(`${API}/admin/users/${id}/action`, { headers: authHeaders(admin.token), data: { action, message: "Test" } })
    const banned = await createMember(request)
    const suspended = await createMember(request)
    expect((await act(banned.id, "ban")).ok()).toBeTruthy()
    expect((await act(suspended.id, "suspend")).ok()).toBeTruthy()

    await page.goto("/login")
    for (const who of [banned, suspended]) {
      await page.locator("#email").fill(who.email)
      await page.locator("#password").fill(who.password)
      await page.getByRole("button", { name: "Sign In" }).click()
      await expect(alertBox(page)).toContainText("Your account has been suspended or banned. Please contact d8lpa.community@gmail.com")
      await expect(page).toHaveURL(/\/login/)
      expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem("spark-auth") || "{}")?.state?.token ?? null)).toBeNull()
    }
    // Lifting the ban lets them back in.
    expect((await act(banned.id, "unban")).ok()).toBeTruthy()
    await page.locator("#email").fill(banned.email)
    await page.locator("#password").fill(banned.password)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/profile/)
    await page.getByRole("button", { name: "Log Out" }).click()

    const gone = await createMember(request)
    expect((await request.post(`${API}/settings/delete`, { headers: authHeaders(gone.token), data: { reason: "test", password: gone.password } })).ok()).toBeTruthy()
    await page.locator("#email").fill(gone.email)
    await page.locator("#password").fill(gone.password)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(alertBox(page)).toContainText(/deleted|not right/)

    await page.route("**/api/auth/login", (route) => route.abort(), { times: 1 })
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(alertBox(page)).toContainText("We can't reach D8-LPA right now")
  })

  test("AUTH/GLB: phone log out, eight-hour time-out, and a session ended elsewhere", async ({ browser, request }) => {
    const member = await createMember(request)
    const context = await signedInContextWith(browser, member, { viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await page.goto("/browse")
    await page.getByRole("navigation", { name: "Main" }).last().getByRole("button", { name: /More/ }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Log Out" }).click()
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem("spark-auth") || "{}")?.state?.token ?? null)).toBeNull()
    await context.close()

    // A session untouched for more than eight hours is ended with an explanation.
    const stale = await browser.newContext()
    await stale.addInitScript((value) => {
      // Seed once per tab: a session last used nine hours ago.
      if (window.sessionStorage.getItem("seeded")) return
      window.sessionStorage.setItem("seeded", "1")
      const saved = JSON.parse(value)
      saved.state.sessionTimestamp = Date.now() - 9 * 60 * 60 * 1000
      window.localStorage.setItem("spark-auth", JSON.stringify(saved))
    }, JSON.stringify({
      state: { user: member.user, profile: member.profile, token: member.token, isAuthenticated: true, onboardingData: {}, onboardingStep: 1 },
      version: 0,
    }))
    const stalePage = await stale.newPage()
    await stalePage.goto("/browse")
    await expect(stalePage).toHaveURL(/\/login\?expired=1/)
    expect(await stalePage.evaluate(() => JSON.parse(window.localStorage.getItem("spark-auth") || "{}")?.state?.token ?? null)).toBeNull()
    await expect(stalePage.getByRole("status").filter({ hasText: "signed out" })).toContainText("For your security you were signed out after a while")
    await stale.close()

    // Taking a break on one device ends the session on another.
    const other = await createMember(request)
    const second = await signedInContextWith(browser, other)
    const secondPage = await second.newPage()
    await secondPage.goto("/browse")
    await expect(secondPage.getByRole("navigation", { name: "Main" }).first()).toBeVisible()
    expect((await request.post(`${API}/settings/disable`, { headers: authHeaders(other.token), data: { reason: "test", password: other.password } })).ok()).toBeTruthy()
    // The redirect can cut this navigation short, which is the point.
    await secondPage.goto("/settings").catch(() => {})
    await expect(secondPage).toHaveURL(/\/login/)
    await second.close()
  })
})

test.describe("forgotten password: the rest of the screens", () => {
  test("PWD: links, errors, try again, and reset links that are missing or no longer valid", async ({ page, request }) => {
    await page.goto("/forgot-password")
    await expect(page.getByRole("heading", { name: "Forgot password?" })).toBeVisible()
    await page.getByRole("link", { name: "Back to login" }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.getByRole("link", { name: "Forgot password?" }).click()
    await expect(page).toHaveURL(/\/forgot-password/)

    const send = page.getByRole("button", { name: "Send Reset Link" })
    await expect(send).toBeDisabled()
    await page.locator("#email").fill("nope")
    await expect(page.getByText("Please enter a valid email address")).toBeVisible()
    const member = await createMember(request)
    await page.locator("#email").fill(member.email)

    await page.route("**/api/auth/forgot-password", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error processing request" }) }), { times: 1 })
    await send.click()
    await expect(alertBox(page)).toContainText("Error processing request")

    await send.click()
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
    await expect(page.getByText(member.email)).toBeVisible()
    await page.getByRole("button", { name: "try again" }).click()
    await expect(page.getByRole("heading", { name: "Forgot password?" })).toBeVisible()
    await expect(page.locator("#email")).toHaveValue(member.email)
    await send.click()
    await page.getByRole("button", { name: "Back to login" }).click()
    await expect(page).toHaveURL(/\/login/)

    // An address with no account gets the same screen and no email.
    const nobody = uniqueEmail("nobody")
    await page.goto("/forgot-password")
    await page.locator("#email").fill(nobody)
    await send.click()
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
    expect(await outbox(request, nobody)).toHaveLength(0)

    // No token in the link.
    await page.goto("/reset-password")
    await expect(page.getByText("Invalid or expired reset link. Please request a new password reset.")).toBeVisible()
    await page.getByRole("button", { name: "Request New Reset Link" }).click()
    await expect(page).toHaveURL(/\/forgot-password/)

    // A made-up token.
    await page.goto(`/reset-password?token=${"a".repeat(64)}`)
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible()
    await page.locator("#password").fill("short")
    await expect(page.getByText(/Use at least 8 characters/)).toBeVisible()
    await page.locator("#password").fill("Reset-Pass-2026!")
    await page.locator("#confirmPassword").fill("Reset-Pass-2026?")
    await expect(page.getByText("Passwords do not match")).toBeVisible()
    await expect(page.getByRole("button", { name: "Reset Password" })).toBeDisabled()
    await page.locator("#confirmPassword").fill("Reset-Pass-2026!")
    await page.getByRole("button", { name: "Reset Password" }).click()
    await expect(alertBox(page)).toContainText("This reset link has been used already or is more than an hour old")

    // A real link works once; the success message shows before the move to log in.
    const link = (await latestEmail(request, member.email)).text.match(/https?:\/\/\S+reset-password\?token=[a-f0-9]+/)![0]
    await page.goto(new URL(link).pathname + new URL(link).search)
    await page.locator("#password").fill("Reset-Pass-2026!")
    await page.locator("#confirmPassword").fill("Reset-Pass-2026!")
    await page.getByRole("button", { name: "Reset Password" }).click()
    await expect(page.getByRole("heading", { name: "Password reset successfully!" })).toBeVisible()
    await expect(page.getByText("Redirecting to login...")).toBeVisible()
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    await page.goto(new URL(link).pathname + new URL(link).search)
    await page.locator("#password").fill("Reset-Pass-2027!")
    await page.locator("#confirmPassword").fill("Reset-Pass-2027!")
    await page.getByRole("button", { name: "Reset Password" }).click()
    await expect(alertBox(page)).toContainText("This reset link has been used already or is more than an hour old")
  })
})

test.describe("navigation and global", () => {
  test("NAV: the Admin link is there for admins only - computer and phone", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request)

    for (const [who, isAdmin] of [[admin, true], [member, false]] as const) {
      const desktop = await signedInContextWith(browser, who)
      const page = await desktop.newPage()
      await page.goto("/browse")
      const nav = page.getByRole("navigation", { name: "Help and settings" })
      await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible()
      await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(isAdmin ? 1 : 0)
      if (isAdmin) {
        await nav.getByRole("link", { name: "Admin" }).click()
        await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible()
        await expect(nav.getByRole("link", { name: "Admin" })).toHaveAttribute("aria-current", "page")
      } else {
        // Typing the address does not help: the screen refuses, with a way back.
        await page.goto("/admin")
        await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible()
        await expect(page.getByText("You don't have admin privileges.")).toBeVisible()
        await page.getByRole("button", { name: "Return to Browse" }).click()
        await expect(page).toHaveURL(/\/browse/)
      }
      await desktop.close()

      const phone = await signedInContextWith(browser, who, { viewport: { width: 390, height: 844 } })
      const phonePage = await phone.newPage()
      await phonePage.goto("/browse")
      await phonePage.getByRole("navigation", { name: "Main" }).last().getByRole("button", { name: /More/ }).click()
      const sheet = phonePage.getByRole("dialog")
      await expect(sheet.getByRole("link", { name: "Settings" })).toBeVisible()
      await expect(sheet.getByRole("link", { name: "Admin" })).toHaveCount(isAdmin ? 1 : 0)
      if (isAdmin) {
        await sheet.getByRole("link", { name: "Admin" }).click()
        await expect(phonePage.getByRole("heading", { name: "Admin Panel" })).toBeVisible()
      }
      await phone.close()
    }
  })

  test("GLB: sound is unlocked by the first tap, and the development banner shows only in development", async ({ browser, request }) => {
    const member = await createMember(request)
    const context = await signedInContextWith(browser, member)
    await context.addInitScript(() => {
      // Count how often the app prepares its sound: it may only do so after
      // a tap or key press (browsers refuse sound before that).
      const Original = window.AudioContext
      ;(window as any).__resumes = 0
      window.AudioContext = class extends Original {
        constructor() {
          super()
          ;(window as any).__resumes += 1
        }
      } as typeof AudioContext
    })
    const page = await context.newPage()
    await page.goto("/help")
    await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeVisible()
    await page.waitForTimeout(500)
    const before = await page.evaluate(() => (window as any).__resumes)
    await page.getByRole("heading").first().click()
    await expect.poll(() => page.evaluate(() => (window as any).__resumes)).toBeGreaterThan(before)
    // The local test stack runs in development mode, where the banner is shown.
    await expect(page.getByText("Development Mode")).toBeVisible()
    await context.close()
  })

  test("NEW-20: the app can be installed - manifest, icons, service worker and offline page are served and valid", async ({ page, request, baseURL }) => {
    const manifestResponse = await request.get(`${baseURL}/manifest.webmanifest`)
    expect(manifestResponse.ok()).toBeTruthy()
    const manifest = await manifestResponse.json()
    expect(manifest.name).toBe("D8-LPA Community")
    expect(manifest.short_name).toBe("D8-LPA")
    expect(manifest.display).toBe("standalone")
    expect(manifest.start_url).toBe("/browse")
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
    const sizes = manifest.icons.map((icon: any) => icon.sizes)
    expect(sizes).toContain("192x192")
    expect(sizes).toContain("512x512")
    expect(manifest.icons.some((icon: any) => icon.purpose === "maskable")).toBe(true)

    // Every icon is a real PNG of the size it claims.
    for (const icon of manifest.icons) {
      const res = await request.get(`${baseURL}${icon.src}`)
      expect(res.ok(), icon.src).toBeTruthy()
      const body = await res.body()
      expect(body.subarray(1, 4).toString()).toBe("PNG")
      const [w, h] = icon.sizes.split("x").map(Number)
      expect(body.readUInt32BE(16)).toBe(w)
      expect(body.readUInt32BE(20)).toBe(h)
    }
    for (const shortcut of manifest.shortcuts || []) expect(shortcut.url).toMatch(/^\//)
    for (const extra of ["/apple-icon.png", "/icon.png"]) expect((await request.get(`${baseURL}${extra}`)).ok(), extra).toBeTruthy()

    // The page links the manifest and sets the phone status-bar colour.
    await page.goto("/login")
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest")
    // GLB-17: a proper browser-tab title.
    await expect(page).toHaveTitle(/D8-LPA/)
    expect(await page.title()).not.toMatch(/v0|generator/i)
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", /.+/)

    // The service worker is served as JavaScript, parses, and knows the offline page.
    const sw = await request.get(`${baseURL}/sw.js`)
    expect(sw.ok()).toBeTruthy()
    expect(sw.headers()["content-type"]).toMatch(/javascript/)
    const source = await sw.text()
    expect(source).toContain("/offline.html")
    expect(source).toMatch(/addEventListener\(\s*["']fetch["']/)
    expect(() => new Function(source)).not.toThrow()
    // It registers and takes control in a real browser.
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready
      return { scope: registration.scope, active: !!registration.active }
    })
    expect(state.active).toBe(true)
    expect(state.scope).toMatch(/\/$/)

    // The offline page stands on its own: a title, plain words, a way to retry, nothing loaded from the network.
    await page.goto("/offline.html")
    await expect(page).toHaveTitle(/.+/)
    await expect(page.getByRole("heading").first()).toBeVisible()
    await expect(page.locator("a, button").first()).toBeVisible()
    const offline = await (await request.get(`${baseURL}/offline.html`)).text()
    expect(offline).not.toMatch(/<script[^>]+src=|<link[^>]+href="http/)
    await page.evaluate(async () => {
      for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()
    })
  })
})
