import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test"

export const API = `http://localhost:${process.env.E2E_API_PORT || "4120"}/api`

// Test-only password that meets the app's rules. Not a real credential.
export const PASSWORD = "E2e-Pass-2026!"
// Seeded by server/src/dev/seed-demo.js (fictional accounts, local only).
export const DEMO_PASSWORD = "Demo-Pass-2026!"
export const ADMIN_EMAIL = "admin@example.test"

export interface Member {
  email: string
  password: string
  token: string
  id: string
  firstName: string
  user: Record<string, unknown>
  profile: Record<string, unknown>
}

let counter = 0
export const uniqueEmail = (prefix = "e2e") => `${prefix}-${Date.now()}-${(counter += 1)}@example.test`

export async function latestEmail(request: APIRequestContext, to: string) {
  await expect
    .poll(async () => (await (await request.get(`${API}/__test/outbox?to=${encodeURIComponent(to)}`)).json()).length, {
      message: `an email to ${to}`,
    })
    .toBeGreaterThan(0)
  const all = await (await request.get(`${API}/__test/outbox?to=${encodeURIComponent(to)}`)).json()
  return all[all.length - 1] as { subject: string; text: string; html: string }
}

export const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

/**
 * Creates a fully set-up fictional member through the real API: sign up,
 * read the verification code from the captured outbox, verify, onboard.
 */
export async function createMember(
  request: APIRequestContext,
  overrides: { firstName?: string; gender?: string; interests?: string[]; seenTour?: boolean } = {}
): Promise<Member> {
  const email = uniqueEmail()
  const firstName = overrides.firstName || `Tester${counter}`
  const signup = await request.post(`${API}/auth/signup`, { data: { email, password: PASSWORD } })
  expect(signup.status()).toBe(201)
  const { token, user_id } = await signup.json()

  const mail = await latestEmail(request, email)
  const code = mail.text.match(/\b(\d{6})\b/)![1]
  expect((await request.post(`${API}/auth/verify-email`, { data: { email, code } })).ok()).toBeTruthy()

  const onboard = await request.put(`${API}/auth/complete-onboarding`, {
    headers: authHeaders(token),
    data: {
      first_name: firstName,
      last_name: "Example",
      birthdate: "1972-05-20",
      gender: overrides.gender || "female",
      location_city: "Testville",
      location_state: "Oklahoma",
      district_number: "8",
      bio: "A fictional member created by an automated test.",
      interests: overrides.interests || ["Gardening", "Cooking"],
      looking_for: ["everyone"],
      agreed_to_guidelines: true,
    },
  })
  expect(onboard.ok()).toBeTruthy()

  if (overrides.seenTour !== false) {
    await request.put(`${API}/users/profile`, { headers: authHeaders(token), data: { has_seen_tour: true } })
  }
  const me = await (await request.get(`${API}/auth/me`, { headers: authHeaders(token) })).json()
  return { email, password: PASSWORD, token, id: String(user_id), firstName, user: me.user, profile: me.profile }
}

export async function loginApi(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } })
  expect(res.ok()).toBeTruthy()
  return (await res.json()) as { token: string; user: Record<string, any>; profile: Record<string, any> }
}

/** Two members who like each other. Returns the match id. */
export async function matchMembers(request: APIRequestContext, a: Member, b: Member): Promise<string> {
  await request.post(`${API}/browse/${b.id}/like`, { headers: authHeaders(a.token) })
  const res = await request.post(`${API}/browse/${a.id}/like`, { headers: authHeaders(b.token) })
  const body = await res.json()
  expect(body.is_match).toBe(true)
  return String(body.match.id)
}

/**
 * Opens a browser context already signed in as `member` (by placing the same
 * session the login form would store). The login form itself is covered by
 * the auth tests.
 */
export async function signedInContext(browser: Browser, member: Pick<Member, "token" | "user" | "profile">): Promise<BrowserContext> {
  const context = await browser.newContext()
  const session = {
    state: {
      user: { ...member.user, id: (member.user as any).id || (member.user as any)._id },
      profile: member.profile,
      token: member.token,
      sessionTimestamp: Date.now(),
      isAuthenticated: true,
      onboardingData: {},
      onboardingStep: 1,
    },
    version: 0,
  }
  await context.addInitScript((value) => {
    if (!window.localStorage.getItem("spark-auth")) {
      window.localStorage.setItem("spark-auth", value)
    }
  }, JSON.stringify(session))
  return context
}

export async function signedInPage(browser: Browser, member: Member, path = "/browse"): Promise<Page> {
  const context = await signedInContext(browser, member)
  const page = await context.newPage()
  await page.goto(path)
  return page
}

/** The "Saved" toast on the settings screen. */
export const savedToast = (page: Page) => page.getByText("Saved", { exact: true }).first()
