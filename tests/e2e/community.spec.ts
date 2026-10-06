import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import {
  API,
  ADMIN_EMAIL,
  DEMO_PASSWORD,
  createMember,
  loginApi,
  matchMembers,
  signedInContext,
  signedInPage,
  authHeaders,
} from "./helpers"

const future = (days: number, hour = 18) => {
  const d = new Date(Date.now() + days * 86400000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

test.describe("browse, like, match, save", () => {
  test("BRW/MAT: liking someone who already likes me makes a match, shown on Matches and Messages", async ({ browser, request }) => {
    const me = await createMember(request, { firstName: "Casey" })
    const other = await createMember(request, { firstName: "Devon" })
    await request.post(`${API}/browse/${me.id}/like`, { headers: authHeaders(other.token) })

    const page = await signedInPage(browser, me, `/profile/${other.id}`)
    await expect(page.getByRole("heading", { name: "Devon", level: 1 })).toBeVisible()
    await expect(page.getByTestId("verified-badge")).toHaveText(/Email confirmed/)
    await expect(page.getByTestId("in-common")).toContainText("Gardening")

    await page.getByRole("button", { name: "Like Devon" }).click()
    await expect(page.getByText(/It's a match! You and Devon like each other/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Message Devon" })).toBeVisible()

    await page.goto("/matches")
    await expect(page.getByText("Devon").first()).toBeVisible()
    await page.goto("/messages")
    await expect(page.getByTestId("conversation-item").filter({ hasText: "Devon" })).toBeVisible()
    await page.context().close()
  })

  test("BRW: Browse lists other members and a Like there is saved", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Emerson" })
    const page = await signedInPage(browser, me, "/browse")
    const card = page.locator("div", { has: page.getByText("Emerson", { exact: false }) }).filter({ has: page.getByRole("button", { name: "Like" }) }).last()
    await expect(card).toBeVisible()
    await card.getByRole("button", { name: "Like" }).click()
    await expect
      .poll(async () => ((await (await request.get(`${API}/browse/liked`, { headers: authHeaders(me.token) })).json()) as any[]).map((p) => String(p.id)))
      .toContain(other.id)
    await page.context().close()
  })

  test("FAV: save a profile, find it under Saved, remove it with Undo", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Finley" })
    const page = await signedInPage(browser, me, `/profile/${other.id}`)
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByText("Finley saved")).toBeVisible()
    await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Saved" }).click()
    await expect(page.getByRole("heading", { name: /Finley/ })).toBeVisible()
    await page.getByRole("button", { name: "Remove" }).click()
    await expect(page.getByText("Nothing saved yet")).toBeVisible()
    await page.getByRole("button", { name: "Undo" }).click()
    await expect(page.getByRole("heading", { name: /Finley/ })).toBeVisible()
    // The other person was never told.
    const theirs = await (await request.get(`${API}/notifications`, { headers: authHeaders(other.token) })).json()
    expect(theirs).toHaveLength(0)
    await page.context().close()
  })

  test("SAFE/ADM: report from a profile reaches the admin queue; the admin warns the member", async ({ browser, request }) => {
    const me = await createMember(request, { firstName: "Gray" })
    const other = await createMember(request, { firstName: "Harper" })
    const page = await signedInPage(browser, me, `/profile/${other.id}`)
    await page.getByRole("button", { name: "Report", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Asked me for money, gift cards or crypto").check()
    await dialog.getByLabel(/Anything else/).fill("Asked for a loan in the second message.")
    await dialog.getByRole("button", { name: "Send report" }).click()
    await expect(page.getByText("Your report has been sent")).toBeVisible()
    await page.context().close()

    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const adminContext = await signedInContext(browser, admin)
    const adminPage = await adminContext.newPage()
    await adminPage.goto("/admin")
    const row = adminPage.getByTestId("report-row").filter({ hasText: "Harper" })
    await expect(row).toContainText("was reported by Gray")
    await expect(row).toContainText("Asked me for money, gift cards or crypto")
    await expect(row).toContainText("Asked for a loan in the second message.")
    await row.getByRole("button", { name: "Warn" }).click()
    await expect(adminPage.getByText("Harper has been warned and the report closed")).toBeVisible()
    await expect(adminPage.getByTestId("report-row").filter({ hasText: "Harper" })).toHaveCount(0)
    await adminContext.close()

    const notices = await (await request.get(`${API}/notifications`, { headers: authHeaders(other.token) })).json()
    expect(notices.some((n: any) => n.title === "Account Warning")).toBe(true)
  })

  test("SAFE: block from a profile takes me back to Browse and hides the member", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Indigo" })
    const page = await signedInPage(browser, me, `/profile/${other.id}`)
    await page.getByRole("button", { name: "Block", exact: true }).click()
    await expect(page.getByRole("dialog")).toContainText("they are not told that you blocked them")
    await page.getByRole("dialog").getByRole("button", { name: "Block Indigo" }).click()
    await expect(page).toHaveURL(/\/browse/)
    await page.goto(`/profile/${other.id}`)
    await expect(page.getByText("This profile is not available")).toBeVisible()
    await page.context().close()
  })
})

test.describe("events", () => {
  test("EVT/ADM: an admin's new event appears for members, who can RSVP, add a note, see who's going and add it to a calendar", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const title = `Test Supper ${Date.now()}`
    const created = await request.post(`${API}/admin/events`, {
      headers: authHeaders(admin.token),
      data: { title, description: "A made-up event.", location: "Test Hall, Testville", start_date: future(6), end_date: future(6, 20), category: "social" },
    })
    expect(created.status()).toBe(201)
    const eventId = (await created.json()).id

    const first = await createMember(request, { firstName: "Jules" })
    await request.post(`${API}/events/${eventId}/join`, { headers: authHeaders(first.token) })
    await request.put(`${API}/events/${eventId}/note`, { headers: authHeaders(first.token), data: { note: "Two seats free from Tulsa" } })

    const me = await createMember(request, { firstName: "Kit" })
    const page = await signedInPage(browser, me, "/events")
    await page.getByText(title).first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByTestId("attendee-list")).toContainText("Jules")
    await expect(dialog.getByTestId("attendee-list")).toContainText("Two seats free from Tulsa")

    await dialog.getByRole("button", { name: "I'm going" }).click()
    await expect(page.getByText(`You are going to ${title}`)).toBeVisible()
    await expect(dialog.getByTestId("attendee-list")).toContainText("Kit (you)")

    await dialog.getByLabel(/Add a note for other members/).fill("First time - say hello")
    await dialog.getByRole("button", { name: "Save note" }).click()
    await expect(page.getByText("Note saved")).toBeVisible()
    const going = await (await request.get(`${API}/events/${eventId}/attendees`, { headers: authHeaders(first.token) })).json()
    expect(going.find((p: any) => p.first_name === "Kit").note).toBe("First time - say hello")

    const download = page.waitForEvent("download")
    await dialog.getByRole("button", { name: "Add to my calendar" }).click()
    expect((await download).suggestedFilename()).toMatch(/test-supper.*\.ics$/)
    await expect(dialog.getByRole("link", { name: "Add to Google Calendar" })).toHaveAttribute("href", /calendar\.google\.com/)

    await dialog.getByRole("button", { name: "I can't go" }).click()
    await expect(dialog.getByRole("button", { name: "I'm going" })).toBeVisible()
    await expect(dialog.getByTestId("attendee-list")).not.toContainText("Kit (you)")
    await page.context().close()
  })

  test("EVT: the type filter narrows the list instead of hiding everything", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/events")
    await expect(page.getByText("District 8 Fall Picnic").first()).toBeVisible()
    const events = await (await request.get(`${API}/events`, { headers: authHeaders(me.token) })).json()
    expect(events.filter((e: any) => e.category === "regional").length).toBeGreaterThan(0)
    await page.context().close()
  })
})

test.describe("notifications", () => {
  test("NOT: a new match shows in Notifications with a badge in the menu", async ({ browser, request }) => {
    const me = await createMember(request, { firstName: "Lane" })
    const other = await createMember(request, { firstName: "Morgan" })
    const page = await signedInPage(browser, me, "/browse")
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible()
    await matchMembers(request, me, other)
    // Arrives live: the Matches badge appears without a reload.
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Matches/ })).toContainText("1")
    await page.goto("/notifications")
    await expect(page.getByText(/You and Morgan matched/)).toBeVisible()
    await page.context().close()
  })
})

test.describe("admin", () => {
  test("ADM: an announcement reaches members and can be withdrawn", async ({ browser, request }) => {
    const member = await createMember(request)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const title = `Notice ${Date.now()}`
    const sent = await (await request.post(`${API}/admin/news`, { headers: authHeaders(admin.token), data: { title, message: "The picnic has moved to Sunday." } })).json()

    const page = await signedInPage(browser, member, "/notifications")
    await expect(page.getByText(title)).toBeVisible()
    await page.context().close()

    const adminContext = await signedInContext(browser, admin)
    const adminPage = await adminContext.newPage()
    await adminPage.goto("/admin")
    await expect(adminPage.getByTestId("admin-reports")).toBeVisible()
    await adminContext.close()

    expect((await request.delete(`${API}/admin/news?id=${sent.id}`, { headers: authHeaders(admin.token) })).ok()).toBeTruthy()
    const after = await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()
    expect(after.some((n: any) => n.title === title)).toBe(false)
  })

  test("ADM: suspending a member signs them out of the app", async ({ browser, request }) => {
    const member = await createMember(request, { firstName: "Noel" })
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const page = await signedInPage(browser, member, "/browse")
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible()
    await request.post(`${API}/admin/users/${member.id}/action`, { headers: authHeaders(admin.token), data: { action: "suspend", message: "Test suspension" } })
    await page.goto("/messages")
    const notice = page.getByRole("alertdialog", { name: "Account Suspended or Banned" })
    await expect(notice).toBeVisible()
    // The explanation has to stay until the member has read it. (It used to
    // be replaced by the login screen a moment later - sometimes before it
    // was ever painted - which is why this test failed about one run in four.)
    await page.waitForTimeout(1500)
    await expect(notice).toBeVisible()
    await expect(page).toHaveURL(/\/messages/)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("spark-auth") || "{}")?.state?.token ?? null)).toBeNull()
    await notice.getByRole("button", { name: "Go to Login" }).click()
    await expect(page).toHaveURL(/\/login/)
    await request.post(`${API}/admin/users/${member.id}/action`, { headers: authHeaders(admin.token), data: { action: "unsuspend" } })
    await page.context().close()
  })
})

test.describe("help, safety and accessibility", () => {
  test("HELP/SAFE: the Help and Safety pages are reachable from the menu and explain the essentials", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/browse")
    await page.getByRole("link", { name: "Safety" }).click()
    await expect(page.getByRole("heading", { name: "Safety Centre" })).toBeVisible()
    await expect(page.getByText("Never send money, gift cards or crypto to someone you met online.")).toBeVisible()
    await page.getByRole("link", { name: "Open privacy settings" }).click()
    await expect(page).toHaveURL(/\/settings#privacy/)

    await page.getByRole("link", { name: "Help" }).click()
    await page.getByRole("button", { name: "How do I make the text bigger?" }).click()
    await expect(page.getByText("Under “Display”, choose Large or Extra large.")).toBeVisible()
    await page.context().close()
  })

  test("NAV: phone layout has a labelled bottom bar and a More menu with everything else", async ({ browser, request }) => {
    const me = await createMember(request)
    const context = await signedInContext(browser, me)
    const page = await context.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/browse")
    const bar = page.getByRole("navigation", { name: "Main" }).last()
    for (const label of ["Browse", "Matches", "Messages", "Profile", "More"]) {
      await expect(bar.getByText(label, { exact: true })).toBeVisible()
    }
    await bar.getByRole("button", { name: /More/ }).click()
    for (const label of ["Events", "Notifications", "Saved", "Safety", "Help", "Settings", "Log Out"]) {
      await expect(page.getByRole("dialog").getByText(label, { exact: true })).toBeVisible()
    }
    await page.getByRole("dialog").getByRole("link", { name: "Events" }).click()
    await expect(page).toHaveURL(/\/events/)
    // No sideways scrolling on a phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await context.close()
  })

  for (const scheme of ["light", "dark"] as const) {
    test(`A11Y: no colour-contrast or labelling failures on the main screens (${scheme})`, async ({ browser, request }) => {
      const me = await createMember(request, { firstName: "Quinn" })
      const other = await createMember(request, { firstName: "Reese" })
      const matchId = await matchMembers(request, me, other)
      await request.post(`${API}/messages/${matchId}`, { headers: authHeaders(other.token), data: { content: "Hello Quinn" } })

      const context = await signedInContext(browser, me)
      const page = await context.newPage()
      await page.emulateMedia({ colorScheme: scheme })
      const problems: string[] = []
      for (const path of [`/messages?match=${matchId}`, "/settings", "/help", "/safety", "/saved", `/profile/${other.id}`]) {
        await page.goto(path)
        await page.waitForLoadState("networkidle")
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .withRules(["color-contrast", "button-name", "link-name", "label", "image-alt", "aria-required-attr", "aria-valid-attr-value"])
          .exclude("nextjs-portal")
          .exclude(".bg-yellow-100") // the development-only banner
          .analyze()
        for (const violation of results.violations) {
          for (const node of violation.nodes) problems.push(`${path} [${violation.id}] ${node.target.join(" ")}`)
        }
      }
      expect(problems, problems.join("\n")).toEqual([])
      await context.close()
    })
  }
})
