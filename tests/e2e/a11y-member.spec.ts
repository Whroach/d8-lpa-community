import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { API, authHeaders, createMember, makePng, matchMembers, signedInContext } from "./helpers"
import { shot, shotViewport } from "./shots"

/**
 * axe on every member screen and every dialog on them, in light and dark:
 * the full WCAG 2 A and AA rule sets, not a hand-picked list. Serious and
 * critical findings fail the test.
 */
type Step = { name: string; path: string; open?: (page: Page) => Promise<void> }

async function scan(page: Page, name: string, problems: string[]) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .exclude(".bg-yellow-100") // the development-only banner
    .analyze()
  for (const violation of results.violations) {
    if (violation.impact !== "serious" && violation.impact !== "critical") continue
    for (const node of violation.nodes) problems.push(`${name} [${violation.id}] ${node.target.join(" ")} :: ${node.failureSummary?.split("\n")[1]?.trim() || ""}`)
  }
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`A11Y: every member screen and dialog passes axe (${colorScheme})`, async ({ browser, request }) => {
    test.setTimeout(240_000)
    const me = await createMember(request, { firstName: "Avery", interests: ["Gardening", "Cooking", "Travel"] })
    const friend = await createMember(request, { firstName: "Blair" })
    const liked = await createMember(request, { firstName: "Corey" })
    const matchId = await matchMembers(request, me, friend)
    await request.post(`${API}/messages/${matchId}`, { headers: authHeaders(friend.token), data: { content: "Hello Avery" } })
    await request.post(`${API}/messages/${matchId}`, { headers: authHeaders(me.token), data: { content: "Hello Blair" } })
    await request.post(`${API}/browse/${liked.id}/like`, { headers: authHeaders(me.token) })
    await request.put(`${API}/favorites/${liked.id}`, { headers: authHeaders(me.token) })

    const context = await signedInContext(browser, me, { colorScheme, ...(shotViewport ? { viewport: shotViewport } : {}) })
    const page = await context.newPage()
    await page.goto("/browse")
    for (const member of [me, friend]) {
      for (const colour of ["#2f6f4f", "#8a5a2b"]) {
        await request.post(`${API}/users/photos`, {
          headers: authHeaders(member.token),
          multipart: { photo: { name: "p.png", mimeType: "image/png", buffer: await makePng(page, 240, 300, colour) } },
        })
      }
    }

    const steps: Step[] = [
      { name: "browse", path: "/browse" },
      { name: "browse + filter menu and chip", path: "/browse", open: async (p) => {
        await p.getByRole("group", { name: "Filters" }).getByRole("button", { name: /^District/ }).click()
        await p.getByRole("menuitemcheckbox", { name: "District 8", exact: true }).click()
      } },
      { name: "matches", path: "/matches" },
      { name: "matches + unmatch dialog", path: "/matches", open: async (p) => {
        await p.getByRole("button", { name: "Options for Blair" }).click()
        await p.getByRole("menuitem", { name: "Unmatch" }).click()
      } },
      { name: "matches + report dialog", path: "/matches", open: async (p) => {
        await p.getByRole("button", { name: "Options for Blair" }).click()
        await p.getByRole("menuitem", { name: "Report" }).click()
      } },
      { name: "matches + liked tab + remove-like dialog", path: "/matches", open: async (p) => {
        await p.getByRole("button", { name: "Profiles You Liked" }).click()
        await p.getByRole("button", { name: "Remove like for Corey" }).click()
      } },
      { name: "messages", path: `/messages?match=${matchId}` },
      { name: "messages + options menu", path: `/messages?match=${matchId}`, open: async (p) => { await p.getByTestId("chat-options").click() } },
      { name: "messages + emoji picker", path: `/messages?match=${matchId}`, open: async (p) => { await p.getByRole("button", { name: /Emoji|Add an emoji/ }).click() } },
      { name: "notifications", path: "/notifications" },
      { name: "events", path: "/events" },
      { name: "events + filters", path: "/events", open: async (p) => { await p.getByRole("button", { name: /^Filters/ }).click() } },
      { name: "events + details", path: "/events", open: async (p) => { await p.getByTestId("event-card").first().getByRole("button").click() } },
      { name: "saved", path: "/saved" },
      { name: "my profile", path: "/profile" },
      { name: "my profile + editing", path: "/profile", open: async (p) => { await p.getByRole("button", { name: "Edit", exact: true }).click() } },
      { name: "my profile + discard dialog", path: "/profile", open: async (p) => {
        await p.getByRole("button", { name: "Edit", exact: true }).click()
        await p.getByRole("textbox", { name: "About me", exact: true }).fill("Changed")
        await p.getByRole("button", { name: "Cancel" }).click()
      } },
      { name: "my profile + photo manager", path: "/profile", open: async (p) => { await p.getByRole("button", { name: "Manage Photos", exact: true }).click() } },
      { name: "my profile + crop step", path: "/profile", open: async (p) => {
        await p.getByRole("button", { name: "Manage Photos", exact: true }).click()
        await p.getByTestId("photo-file-input").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: await makePng(p, 800, 600) })
        await expect(p.getByRole("dialog", { name: "Position your photo" })).toBeVisible()
      } },
      { name: "my profile + remove photo dialog", path: "/profile", open: async (p) => {
        await p.getByRole("button", { name: "Manage Photos", exact: true }).click()
        await p.getByRole("button", { name: "Remove photo 1" }).click()
      } },
      { name: "my profile + preview", path: "/profile", open: async (p) => { await p.getByRole("button", { name: "Preview" }).click() } },
      { name: "member profile", path: `/profile/${friend.id}` },
      { name: "member profile + photo viewer", path: `/profile/${friend.id}`, open: async (p) => { await p.getByRole("button", { name: "Open photo 1 of 2" }).click() } },
      { name: "member profile + report dialog", path: `/profile/${friend.id}`, open: async (p) => { await p.getByRole("button", { name: "Report", exact: true }).click() } },
      { name: "member profile + block dialog", path: `/profile/${friend.id}`, open: async (p) => { await p.getByRole("button", { name: "Block", exact: true }).click() } },
      { name: "settings", path: "/settings" },
      { name: "settings + blocked members", path: "/settings", open: async (p) => { await p.getByRole("button", { name: "View Blocked Members" }).click() } },
      { name: "settings + change password", path: "/settings", open: async (p) => { await p.getByRole("button", { name: "Change Password" }).click() } },
      { name: "settings + take a break", path: "/settings", open: async (p) => { await p.getByRole("button", { name: /Take a Break/ }).click() } },
      { name: "settings + delete account", path: "/settings", open: async (p) => { await p.getByRole("button", { name: "Delete Account" }).click() } },
      { name: "settings + terms", path: "/settings", open: async (p) => { await p.getByRole("button", { name: "Terms & Privacy Policy" }).click() } },
    ]

    const problems: string[] = []
    for (const step of steps) {
      await page.goto(step.path)
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached()
      await page.waitForLoadState("networkidle").catch(() => {})
      if (step.open) {
        await step.open(page)
        await page.waitForTimeout(400) // let the open animation finish before measuring contrast
      }
      await scan(page, step.name, problems)
      await shot(page, "member", colorScheme, step.name)
    }
    const unique = [...new Set(problems)]
    expect(unique, unique.join("\n")).toEqual([])
    await context.close()
  })
}
