import { execFileSync } from "child_process"
import path from "path"
import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test"

/**
 * Production-like smoke tests - see scripts/smoke-prod.mjs for what is real
 * (production build, NODE_ENV=production API, rate limits on) and what is a
 * stand-in (in-memory database, local S3 and Mailgun). Everyone is fictional.
 *
 * Run with:  npm run smoke:prod
 */
const API_ORIGIN = process.env.SMOKE_API_URL!
const API = `${API_ORIGIN}/api`
const WEB = process.env.SMOKE_WEB_URL!
const FAKE = process.env.SMOKE_FAKE_URL!
const BUCKET_HOST = process.env.SMOKE_BUCKET_HOST!
const BUCKET = process.env.SMOKE_BUCKET!
const PASSWORD = "Smoke-Pass-2026!" // test-only, not a real credential

test.skip(!API_ORIGIN || !WEB || !FAKE, "Start these with `npm run smoke:prod`")

let counter = 0
const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${(counter += 1)}@example.test`
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function latestEmail(request: APIRequestContext, to: string, subject?: RegExp) {
  const read = async () =>
    ((await (await request.get(`${FAKE}/__outbox?to=${encodeURIComponent(to)}`)).json()) as { subject: string; text: string; from: string; domain: string }[]).filter(
      (mail) => !subject || subject.test(mail.subject)
    )
  await expect.poll(async () => (await read()).length, { message: `an email to ${to}` }).toBeGreaterThan(0)
  const all = await read()
  return all[all.length - 1]
}

interface Member { email: string; token: string; id: string; firstName: string; user: any; profile: any }

/** Sign up, verify with the emailed code and finish onboarding - through the real API. */
async function createMember(request: APIRequestContext, firstName: string): Promise<Member> {
  const email = uniqueEmail(firstName.toLowerCase())
  const signup = await request.post(`${API}/auth/signup`, { data: { email, password: PASSWORD } })
  expect(signup.status(), await signup.text()).toBe(201)
  const { token, user_id } = await signup.json()
  const code = (await latestEmail(request, email)).text.match(/\b(\d{6})\b/)![1]
  expect((await request.post(`${API}/auth/verify-email`, { data: { email, code } })).ok()).toBeTruthy()
  const onboard = await request.put(`${API}/auth/complete-onboarding`, {
    headers: auth(token),
    data: {
      first_name: firstName, last_name: "Example", birthdate: "1971-03-14", gender: "female",
      location_city: "Testville", location_state: "Oklahoma", district_number: "8",
      bio: "A fictional member created by the smoke test.", interests: ["Gardening", "Cooking"],
      looking_for: ["everyone"], agreed_to_guidelines: true,
    },
  })
  expect(onboard.ok(), await onboard.text()).toBeTruthy()
  await request.put(`${API}/users/profile`, { headers: auth(token), data: { has_seen_tour: true } })
  const me = await (await request.get(`${API}/auth/me`, { headers: auth(token) })).json()
  return { email, token, id: String(user_id), firstName, user: me.user, profile: me.profile }
}

async function signedInPage(browser: Browser, member: Member, target: string): Promise<Page> {
  const context = await browser.newContext()
  const session = {
    state: {
      user: { ...member.user, id: member.user.id || member.user._id }, profile: member.profile, token: member.token,
      sessionTimestamp: Date.now(), isAuthenticated: true, onboardingData: {}, onboardingStep: 1,
    },
    version: 0,
  }
  await context.addInitScript((value) => {
    if (!window.localStorage.getItem("spark-auth")) window.localStorage.setItem("spark-auth", value)
  }, JSON.stringify(session))
  // Photo addresses point at the real S3 host name; serve them from the stand-in.
  await context.route(`https://${BUCKET_HOST}/**`, async (route) => {
    const key = new URL(route.request().url()).pathname
    const res = await context.request.get(`${FAKE}/${BUCKET}${key}`)
    await route.fulfill({ status: res.status(), body: await res.body(), contentType: res.headers()["content-type"] })
  })
  const page = await context.newPage()
  await page.goto(target)
  return page
}

test.describe("production switches", () => {
  test("the API is in production mode: no test routes, no local photo folder, security headers, CORS limited to the site", async ({ request }) => {
    const health = await request.get(`${API}/health`)
    expect(health.ok()).toBeTruthy()
    expect(health.headers()["x-content-type-options"]).toBe("nosniff")
    expect(health.headers()["strict-transport-security"]).toContain("max-age=31536000")
    expect(health.headers()["x-frame-options"]).toBe("DENY")
    expect(health.headers()["x-powered-by"]).toBeUndefined()

    expect((await request.get(`${API}/__test/outbox`)).status()).toBe(404)
    expect((await request.get(`${API_ORIGIN}/local-uploads/demo/dana-1.svg`)).status()).toBe(404)

    const allowed = await request.fetch(`${API}/auth/login`, { method: "OPTIONS", headers: { Origin: WEB, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } })
    expect(allowed.headers()["access-control-allow-origin"]).toBe(WEB)
    const stranger = await request.fetch(`${API}/auth/login`, { method: "OPTIONS", headers: { Origin: "https://elsewhere.example", "Access-Control-Request-Method": "POST" } })
    expect(stranger.headers()["access-control-allow-origin"]).toBeUndefined()
    expect(stranger.status()).toBe(403)

    // Errors do not leak internals.
    const bad = await request.post(`${API}/auth/login`, { data: { email: { $gt: "" }, password: "x" } })
    expect(bad.status()).toBeLessThan(500)
    expect(await bad.text()).not.toMatch(/at .*\.js:\d+|node_modules|Mongo/)
  })

  test("the website is a production build: no development banner, the installable-app files are served", async ({ page, request }) => {
    await page.goto("/login")
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
    await expect(page.getByText("Development Mode")).toHaveCount(0)
    expect((await request.get(`${WEB}/manifest.webmanifest`)).ok() || (await request.get(`${WEB}/manifest.json`)).ok()).toBeTruthy()
    await page.goto("/no-such-page")
    await expect(page.getByRole("link", { name: /log in|home|browse|back/i }).first()).toBeVisible()
  })
})

test.describe("rate limits behind one proxy (trust proxy = 1, the production default)", () => {
  // In production Railway's proxy adds the visitor's address as the LAST entry
  // of X-Forwarded-For. Here the test plays the proxy.
  const from = (address: string) => ({ "X-Forwarded-For": address })

  test("every visitor address has its own allowance; a forged X-Forwarded-For entry does not help", async ({ request }) => {
    const first = await request.get(`${API}/events`, { headers: from("203.0.113.10") })
    expect(first.status()).toBe(401)
    expect(first.headers()["ratelimit-limit"]).toBe("1500")
    const remaining = Number(first.headers()["ratelimit-remaining"])
    expect(remaining).toBe(1499)

    // Same visitor again: one fewer. A different visitor: a fresh allowance.
    const again = await request.get(`${API}/events`, { headers: from("203.0.113.10") })
    expect(Number(again.headers()["ratelimit-remaining"])).toBe(1498)
    const other = await request.get(`${API}/events`, { headers: from("203.0.113.11") })
    expect(Number(other.headers()["ratelimit-remaining"])).toBe(1499)

    // A visitor who invents their own X-Forwarded-For value is still counted
    // by the address the proxy appended.
    const forged = await request.get(`${API}/events`, { headers: from("198.51.100.99, 203.0.113.10") })
    expect(Number(forged.headers()["ratelimit-remaining"])).toBe(1497)

    // The health check is never limited and carries no allowance headers.
    const health = await request.get(`${API}/health`, { headers: from("203.0.113.10") })
    expect(health.headers()["ratelimit-remaining"]).toBeUndefined()
  })

  test("ten wrong passwords for one email from one address are stopped; the same member from another address, and other members from the same address, are not", async ({ request }) => {
    const member = await createMember(request, "Lorna")
    const neighbour = await createMember(request, "Nell")
    const wrong = (email: string, address: string) => request.post(`${API}/auth/login`, { headers: from(address), data: { email, password: "Wrong-Pass-1!" } })

    for (let i = 0; i < 10; i += 1) expect((await wrong(member.email, "203.0.113.20")).status()).toBe(401)
    const blocked = await wrong(member.email, "203.0.113.20")
    expect(blocked.status()).toBe(429)
    expect((await blocked.json()).message).toBe("Too many attempts. Please wait 15 minutes and try again.")

    // Someone else at the same address (a shared home, a chapter meeting) can still sign in...
    const sameHouse = await request.post(`${API}/auth/login`, { headers: from("203.0.113.20"), data: { email: neighbour.email, password: PASSWORD } })
    expect(sameHouse.status()).toBe(200)
    // ...and the member can sign in from somewhere else.
    const elsewhere = await request.post(`${API}/auth/login`, { headers: from("203.0.113.21"), data: { email: member.email, password: PASSWORD } })
    expect(elsewhere.status()).toBe(200)
  })
})

test.describe("core flows on the production build", () => {
  test("sign up in the browser, confirm the emailed code, land in onboarding; unverified sign-in is refused before that", async ({ page, request }) => {
    const email = uniqueEmail("signup")
    await page.goto("/signup")
    await page.locator("#email").fill(email)
    await page.locator("#password").fill(PASSWORD)
    await page.locator("#confirmPassword").fill(PASSWORD)
    await page.locator("#terms").click()
    await page.locator('button[type="submit"]').click()

    const mail = await latestEmail(request, email)
    expect(mail.subject).toMatch(/verify/i)
    expect(mail.domain).toBe("mg.example.test") // went down the Mailgun code path, to the stand-in
    const code = mail.text.match(/\b(\d{6})\b/)![1]
    const boxes = page.locator('input[maxlength="1"]')
    await expect(boxes).toHaveCount(6)
    for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill(code[i])
    const verify = page.getByRole("button", { name: /verify/i })
    if (await verify.isEnabled().catch(() => false)) await verify.click()
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByRole("heading").first()).toBeVisible()
  })

  test("log in with the form, add a photo (S3 code path), like, match and chat live between two browsers, log out", async ({ browser, request }) => {
    const ada = await createMember(request, "Ada")
    const bea = await createMember(request, "Bea")

    // Ada signs in with the real form.
    const context = await browser.newContext()
    await context.route(`https://${BUCKET_HOST}/**`, async (route) => {
      const key = new URL(route.request().url()).pathname
      const res = await context.request.get(`${FAKE}/${BUCKET}${key}`)
      await route.fulfill({ status: res.status(), body: await res.body(), contentType: res.headers()["content-type"] })
    })
    const adaPage = await context.newPage()
    const pageErrors: string[] = []
    adaPage.on("pageerror", (error) => pageErrors.push(error.message))
    await adaPage.goto("/login")
    await adaPage.locator("#email").fill(ada.email)
    await adaPage.locator("#password").fill(PASSWORD)
    await adaPage.locator('button[type="submit"]').click()
    await expect(adaPage).toHaveURL(/\/profile/)
    await expect(adaPage.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Messages" })).toBeVisible()

    // A photo: tips and crop step, then stored through the S3 client.
    await adaPage.getByRole("button", { name: /Add your first photo/ }).click()
    const manager = adaPage.getByRole("dialog", { name: "Manage Photos" })
    const png = Buffer.from(
      (await adaPage.evaluate(() => {
        const canvas = document.createElement("canvas")
        canvas.width = 1200
        canvas.height = 600
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#2f6f4f"
        ctx.fillRect(0, 0, 1200, 600)
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(300, 150, 600, 300)
        return canvas.toDataURL("image/png")
      })).split(",")[1],
      "base64"
    )
    const chooser = adaPage.waitForEvent("filechooser")
    await manager.getByRole("button", { name: "Add Photo" }).click()
    await (await chooser).setFiles({ name: "garden.png", mimeType: "image/png", buffer: png })
    await adaPage.getByRole("dialog", { name: "Position your photo" }).getByRole("button", { name: "Use photo" }).click()
    await expect(adaPage.getByText("Photo added. It is now your main photo.")).toBeVisible()
    const photos = ((await (await request.get(`${API}/auth/me`, { headers: auth(ada.token) })).json()).profile.photos || []) as string[]
    expect(photos).toHaveLength(1)
    expect(photos[0]).toMatch(new RegExp(`^https://${BUCKET_HOST.replace(/\./g, "\\.")}/production/`))
    const stored = (await (await request.get(`${FAKE}/__objects`)).json()) as string[]
    expect(stored).toContain(`${BUCKET}${new URL(photos[0]).pathname}`)
    await expect(manager.getByTestId("managed-photo")).toHaveCount(1)
    const shown = await manager.getByTestId("managed-photo").locator("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    expect(shown).toBe(true)

    // Bea already likes Ada; Ada likes back from Bea's profile: a match.
    await request.post(`${API}/browse/${ada.id}/like`, { headers: auth(bea.token) })
    await adaPage.goto(`/profile/${bea.id}`)
    await adaPage.getByRole("button", { name: "Like Bea" }).click()
    await expect(adaPage.getByText(/It's a match! You and Bea like each other/)).toBeVisible()
    const matches = await (await request.get(`${API}/matches`, { headers: auth(ada.token) })).json()
    const matchId = String((matches[0] || matches.matches?.[0]).id)

    // Chat, live in both directions (Socket.io with the production CORS list).
    await adaPage.goto(`/messages?match=${matchId}`)
    const beaPage = await signedInPage(browser, bea, `/messages?match=${matchId}`)
    await expect(adaPage.getByRole("heading", { name: "Bea" })).toBeVisible()
    await expect(beaPage.getByRole("heading", { name: "Ada" })).toBeVisible()
    await adaPage.locator("#message-box").fill("Hello Bea, from the smoke test")
    await adaPage.getByRole("button", { name: "Send", exact: true }).click()
    await expect(beaPage.getByTestId("message-other").filter({ hasText: "Hello Bea, from the smoke test" })).toBeVisible()
    await beaPage.locator("#message-box").fill("Hello Ada")
    await beaPage.getByRole("button", { name: "Send", exact: true }).click()
    await expect(adaPage.getByTestId("message-other").filter({ hasText: "Hello Ada" })).toBeVisible()
    await expect(beaPage.getByTestId("message-status")).toHaveText("Seen")

    // The main member screens all load on the production build.
    for (const [path, heading] of [["/browse", /Browse/], ["/matches", /Matches/], ["/events", /Events/], ["/notifications", /Notifications/], ["/saved", /Saved/], ["/settings", /Settings/], ["/help", /Help/], ["/safety", /Safety/]] as const) {
      await adaPage.goto(path)
      await expect(adaPage.getByRole("heading", { name: heading }).first()).toBeVisible()
    }

    await adaPage.getByRole("button", { name: "Log Out" }).click()
    await expect(adaPage).toHaveURL(/\/login/)
    expect(pageErrors).toEqual([])
    await context.close()
    await beaPage.context().close()
  })

  test("forgotten password: the emailed link points at the site, sets a new password, and the old one stops working", async ({ page, request }) => {
    const member = await createMember(request, "Cora")
    await page.goto("/forgot-password")
    await page.locator("#email").fill(member.email)
    await page.getByRole("button", { name: "Send Reset Link" }).click()
    const mail = await latestEmail(request, member.email, /reset|password/i)
    const link = mail.text.match(/https?:\/\/\S+reset-password\?token=[a-f0-9]+/)![0]
    expect(link.startsWith(`${WEB}/reset-password`)).toBe(true)
    await page.goto(link)
    await page.locator("#password").fill("Smoke-Pass-2027!")
    await page.locator("#confirmPassword").fill("Smoke-Pass-2027!")
    await page.getByRole("button", { name: "Reset Password" }).click()
    await expect(page.getByRole("heading", { name: "Password reset successfully!" })).toBeVisible()
    expect((await request.post(`${API}/auth/login`, { data: { email: member.email, password: PASSWORD } })).status()).toBe(401)
    expect((await request.post(`${API}/auth/login`, { data: { email: member.email, password: "Smoke-Pass-2027!" } })).status()).toBe(200)
  })

  test("an admin signs in, sees the admin area, creates an event; a member says they are going; a member cannot open admin data", async ({ browser, request }) => {
    const boss = await createMember(request, "Orla")
    // Promote in the throwaway database (there is no way to do this through the API).
    execFileSync(process.execPath, ["src/dev/local-make-admin.js", boss.email], {
      cwd: path.resolve(__dirname, "../../server"),
      env: { ...process.env, MONGODB_URI: process.env.SMOKE_MONGO_URI!, SKIP_DOTENV: "1", NODE_ENV: "development" },
    })
    const login = await request.post(`${API}/auth/login`, { data: { email: boss.email, password: PASSWORD } })
    const admin = await login.json()
    expect(admin.user.role).toBe("admin")

    const member = await createMember(request, "Pia")
    expect((await request.get(`${API}/admin/users`, { headers: auth(member.token) })).status()).toBe(403)

    const adminPage = await signedInPage(browser, { ...boss, token: admin.token, user: admin.user, profile: admin.profile }, "/admin")
    await expect(adminPage.getByRole("heading", { name: /Admin/ }).first()).toBeVisible()
    await expect(adminPage.getByText(member.email).first()).toBeVisible()

    const title = `Smoke Supper ${Date.now()}`
    const start = new Date(Date.now() + 6 * 864e5)
    const created = await request.post(`${API}/admin/events`, {
      headers: auth(admin.token),
      data: { title, description: "A made-up event.", location: "Test Hall, Testville", start_date: start.toISOString(), end_date: new Date(start.getTime() + 2 * 36e5).toISOString(), category: "social" },
    })
    expect(created.status(), await created.text()).toBe(201)

    const memberPage = await signedInPage(browser, member, "/events")
    await memberPage.getByText(title).first().click()
    const dialog = memberPage.getByRole("dialog")
    await dialog.getByRole("button", { name: "I'm going" }).click()
    await expect(memberPage.getByText(`You are going to ${title}`)).toBeVisible()
    await expect(dialog.getByTestId("attendee-list")).toContainText("Pia (you)")
    await adminPage.context().close()
    await memberPage.context().close()
  })

  test("nothing in the API tried to reach the internet", async ({ request }) => {
    expect(await (await request.get(`${FAKE}/__blocked`)).json()).toEqual([])
  })
})
