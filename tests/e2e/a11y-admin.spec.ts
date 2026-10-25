import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { API, ADMIN_EMAIL, DEMO_PASSWORD, TINY_PNG, authHeaders, createMember, loginApi, signedInContext } from "./helpers"
import { shot, shotSize, shotViewport } from "./shots"

/**
 * axe on every admin tab and every admin dialog, in light and dark, on a
 * desktop and on a phone-sized screen: the full WCAG 2.0 / 2.1 A and AA rule
 * sets, not a hand-picked list. Serious and critical findings fail the test.
 * (Same approach as a11y-member.spec.ts.)
 */
type Step = { name: string; tab: string; open?: (page: Page) => Promise<void>; allow?: string[] }

async function scan(page: Page, name: string, problems: string[], allow: string[] = []) {
  // Measure once opening animations have finished, so contrast is not read mid-fade.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => null))
    )
  )
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .exclude(".bg-yellow-100") // the development-only banner
    .analyze()
  for (const violation of results.violations) {
    if (allow.includes(violation.id)) continue
    if (violation.impact !== "serious" && violation.impact !== "critical") continue
    for (const node of violation.nodes) problems.push(`${name} [${violation.id}] ${node.target.join(" ")} :: ${node.failureSummary?.split("\n")[1]?.trim() || ""}`)
  }
}

for (const colorScheme of ["light", "dark"] as const) {
  // A capture run (see shots.ts) uses the one size asked for instead.
  const sizes = shotViewport && shotSize ? [{ label: shotSize as string, ...shotViewport }] : [{ label: "desktop", width: 1280, height: 900 }, { label: "phone", width: 390, height: 844 }]
  for (const size of sizes) {
    test(`A11Y admin: every admin tab and dialog passes axe (${colorScheme}, ${size.label})`, async ({ browser, request }) => {
      test.setTimeout(240_000)
      const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
      const tag = `${Date.now()}`
      // A member with every kind of badge and record: warned, with a note, reported twice.
      const member = await createMember(request, { firstName: `Axel${tag}` })
      const reporter = await createMember(request, { firstName: `Blythe${tag}` })
      const second = await createMember(request, { firstName: `Carys${tag}` })
      const act = (id: string, data: Record<string, unknown>) => request.post(`${API}/admin/users/${id}/action`, { headers: authHeaders(admin.token), data })
      await act(member.id, { action: "warn", message: "Please keep messages friendly." })
      await request.post(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token), data: { content: "Spoke on the phone." } })
      for (const from of [reporter, second]) {
        await request.post(`${API}/browse/${member.id}/report`, { headers: authHeaders(from.token), data: { reason: `Unkind words ${tag}`, category: "Rude or abusive messages", source: "profile" } })
      }
      // Someone suspended and someone banned, so those badges and "Lift" buttons are on screen.
      const suspended = await createMember(request, { firstName: `Dee${tag}` })
      const banned = await createMember(request, { firstName: `Emlyn${tag}` })
      // A closed and a dismissed report, so those rows are on screen too.
      await request.post(`${API}/browse/${suspended.id}/report`, { headers: authHeaders(reporter.token), data: { reason: `Closed case ${tag}`, category: "Rude or abusive messages", source: "chat" } })
      await request.post(`${API}/browse/${banned.id}/report`, { headers: authHeaders(reporter.token), data: { reason: `Dismissed case ${tag}`, category: "Something else", source: "browse" } })
      const filed = await (await request.get(`${API}/admin/reports?page=1&limit=20&q=${encodeURIComponent(`case ${tag}`)}`, { headers: authHeaders(admin.token) })).json()
      const closedCase = filed.reports.find((r: any) => r.reason === `Closed case ${tag}`)
      const dismissedCase = filed.reports.find((r: any) => r.reason === `Dismissed case ${tag}`)
      expect((await act(suspended.id, { action: "suspend", message: "Cooling-off period.", report_id: closedCase.id })).ok()).toBeTruthy()
      await request.put(`${API}/admin/reports/${dismissedCase.id}`, { headers: authHeaders(admin.token), data: { status: "dismissed", action_taken: "none" } })
      expect((await act(banned.id, { action: "ban", message: "Repeated harassment." })).ok()).toBeTruthy()
      // An event with a photo, someone going, and a cancelled one; an announcement.
      const photo = await (await request.post(`${API}/admin/events/photo`, { headers: authHeaders(admin.token), multipart: { photo: { name: "e.png", mimeType: "image/png", buffer: TINY_PNG } } })).json()
      const event = await (await request.post(`${API}/admin/events`, { headers: authHeaders(admin.token), data: { title: `Axe picnic ${tag}`, description: "Bring a dish to share.", location: "Testville", start_date: new Date(Date.now() + 5 * 86400000).toISOString(), max_attendees: 20, category: "social", image: photo.url } })).json()
      await request.post(`${API}/events/${event.id}/join`, { headers: authHeaders(reporter.token) })
      const past = await (await request.post(`${API}/admin/events`, { headers: authHeaders(admin.token), data: { title: `Axe past ${tag}`, location: "Testville", start_date: new Date(Date.now() - 5 * 86400000).toISOString() } })).json()
      const news = await (await request.post(`${API}/admin/news`, { headers: authHeaders(admin.token), data: { title: `Axe news ${tag}`, message: "The picnic has moved to Sunday." } })).json()

      const context = await signedInContext(browser, admin, { colorScheme, viewport: { width: size.width, height: size.height } })
      const page = await context.newPage()

      const memberRow = (p: Page, who = member) => p.getByTestId("user-row").filter({ hasText: who.email })
      const findMember = async (p: Page, who = member) => {
        await p.getByLabel("Search members").fill(who.email)
        await expect(memberRow(p, who)).toBeVisible()
      }
      const reportRow = (p: Page) => p.getByTestId("report-row").filter({ hasText: `Unkind words ${tag}` }).first()
      const eventRow = (p: Page) => p.getByTestId("event-row").filter({ hasText: `Axe picnic ${tag}` })

      const steps: Step[] = [
        { name: "reports (waiting)", tab: "Reports", open: async (p) => { await expect(reportRow(p)).toBeVisible() } },
        { name: "reports + warn dialog", tab: "Reports", open: async (p) => { await reportRow(p).getByRole("button", { name: /^Warn / }).click() } },
        { name: "reports + suspend dialog", tab: "Reports", open: async (p) => { await reportRow(p).getByRole("button", { name: /^Suspend / }).click() } },
        { name: "reports + ban dialog, with an error", tab: "Reports", open: async (p) => {
          await reportRow(p).getByRole("button", { name: /^Ban / }).click()
          await p.getByLabel("Reason for the ban").fill("Reason")
          await p.route("**/api/admin/users/*/action", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error performing user action" }) }), { times: 1 })
          await p.getByRole("alertdialog").getByRole("button", { name: /^Ban / }).click()
          await expect(p.getByRole("alertdialog").getByRole("alert")).toBeVisible()
        } },
        { name: "reports (all, with closed ones)", tab: "Reports", open: async (p) => {
          await p.getByRole("group", { name: "Show" }).getByRole("button", { name: /^All reports/ }).click()
          await p.getByLabel("Search reports").fill(tag)
          await expect(p.getByTestId("report-row")).toHaveCount(4)
          await expect(p.getByTestId("report-row").filter({ hasText: "Closed on" })).toBeVisible()
          await expect(p.getByTestId("report-row").filter({ hasText: "Dismissed on" })).toBeVisible()
        } },
        { name: "reports (nothing found)", tab: "Reports", open: async (p) => {
          await p.getByLabel("Search reports").fill("zzz-no-such-report")
          await expect(p.getByText("No reports found.")).toBeVisible()
        } },
        { name: "members", tab: "Members", open: async (p) => { await expect(p.getByTestId("user-row").first()).toBeVisible() } },
        { name: "members (warned member)", tab: "Members", open: async (p) => { await findMember(p) } },
        { name: "members (suspended filter)", tab: "Members", open: async (p) => {
          await p.getByRole("group", { name: "Show" }).getByRole("button", { name: /^Suspended/ }).click()
          await expect(p.getByTestId("user-row").first()).toContainText("Suspended")
        } },
        { name: "members (banned filter)", tab: "Members", open: async (p) => {
          await p.getByRole("group", { name: "Show" }).getByRole("button", { name: /^Banned/ }).click()
          await expect(p.getByTestId("user-row").first()).toContainText("Banned")
        } },
        { name: "members (nothing found)", tab: "Members", open: async (p) => {
          await p.getByLabel("Search members").fill("zzz-nobody")
          await expect(p.getByText("No members found")).toBeVisible()
        } },
        { name: "members + warn dialog", tab: "Members", open: async (p) => { await findMember(p); await memberRow(p).getByRole("button", { name: /^Warn / }).click() } },
        { name: "members + suspend dialog", tab: "Members", open: async (p) => { await findMember(p); await memberRow(p).getByRole("button", { name: /^Suspend / }).click() } },
        { name: "members + ban dialog", tab: "Members", open: async (p) => { await findMember(p); await memberRow(p).getByRole("button", { name: /^Ban / }).click() } },
        { name: "members + lift suspension dialog", tab: "Members", open: async (p) => { await findMember(p, suspended); await memberRow(p, suspended).getByRole("button", { name: /^Lift suspension/ }).click() } },
        { name: "members + lift ban dialog", tab: "Members", open: async (p) => { await findMember(p, banned); await memberRow(p, banned).getByRole("button", { name: /^Lift ban/ }).click() } },
        { name: "members + notes dialog", tab: "Members", open: async (p) => {
          await findMember(p)
          await memberRow(p).getByRole("button", { name: /^Notes/ }).click()
          await expect(p.getByTestId("note")).toBeVisible()
        } },
        { name: "members + notes dialog, empty, with an error", tab: "Members", open: async (p) => {
          await findMember(p, suspended)
          await memberRow(p, suspended).getByRole("button", { name: /^Notes/ }).click()
          await p.getByLabel("Add a note").fill("A note")
          await p.route("**/api/admin/users/*/notes", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error adding note" }) }) : route.continue(), { times: 1 })
          await p.getByRole("button", { name: "Add note" }).click()
          await expect(p.getByRole("dialog").getByRole("alert")).toBeVisible()
        } },
        { name: "members + delete-note confirmation", tab: "Members", open: async (p) => {
          await findMember(p)
          await memberRow(p).getByRole("button", { name: /^Notes/ }).click()
          await p.getByTestId("note").getByRole("button", { name: "Delete note" }).click()
          await expect(p.getByRole("alertdialog", { name: "Delete this note?" })).toBeVisible()
        } },
        { name: "members + history dialog", tab: "Members", open: async (p) => {
          await findMember(p)
          await memberRow(p).getByRole("button", { name: /^History/ }).click()
          await expect(p.getByTestId("history-entry").first()).toBeVisible()
        } },
        { name: "members + history dialog, empty", tab: "Members", open: async (p) => {
          await findMember(p, reporter)
          await memberRow(p, reporter).getByRole("button", { name: /^History/ }).click()
          await expect(p.getByText("No action history for this member")).toBeVisible()
        } },
        { name: "events", tab: "Events", open: async (p) => { await expect(eventRow(p)).toBeVisible() } },
        { name: "events + create dialog", tab: "Events", open: async (p) => { await p.getByRole("button", { name: "Create Event" }).first().click() } },
        { name: "events + create dialog with a photo and an error", tab: "Events", open: async (p) => {
          await p.getByRole("button", { name: "Create Event" }).first().click()
          const dialog = p.getByRole("dialog", { name: "Create New Event" })
          await dialog.getByLabel("Event Title *").fill("Axe")
          await dialog.getByLabel("Start Date *").fill("2027-01-16")
          await dialog.getByLabel("Start Time *").fill("18:00")
          await dialog.getByLabel("Location *").fill("Testville")
          await dialog.getByLabel("End Date").fill("2027-01-16")
          await dialog.getByLabel("Upload Event Photo (optional)").setInputFiles({ name: "e.png", mimeType: "image/png", buffer: TINY_PNG })
          await expect(dialog.getByRole("img", { name: "Event preview" })).toBeVisible()
          await dialog.getByRole("button", { name: "Create Event" }).click()
          await expect(dialog.getByRole("alert")).toBeVisible()
        } },
        { name: "events + category list", tab: "Events", open: async (p) => {
          await p.getByRole("button", { name: "Create Event" }).first().click()
          await p.getByRole("combobox", { name: "Category" }).click()
          await expect(p.getByRole("option", { name: "Social", exact: true })).toBeVisible()
          // One rule is set aside for this state only: axe wants a scrolling area
          // to hold something reachable with Tab, but a list of options is moved
          // through with the arrow keys (checked on the next line), not Tab.
          await p.keyboard.press("End")
          await expect(p.getByRole("option").last()).toBeFocused()
        }, allow: ["scrollable-region-focusable"] },
        { name: "events + edit dialog", tab: "Events", open: async (p) => {
          await eventRow(p).getByRole("button", { name: /^Edit/ }).click()
          await expect(p.getByRole("dialog", { name: "Edit Event" }).getByRole("img", { name: "Event preview" })).toBeVisible()
        } },
        { name: "events + attendee list", tab: "Events", open: async (p) => {
          await eventRow(p).getByRole("button", { name: /^Who is going/ }).click()
          await expect(p.getByRole("dialog", { name: "Event Attendees" }).getByText(reporter.email)).toBeVisible()
        } },
        { name: "events + cancel confirmation", tab: "Events", open: async (p) => { await eventRow(p).getByRole("button", { name: /^Cancel event/ }).click() } },
        { name: "events + delete confirmation", tab: "Events", open: async (p) => { await eventRow(p).getByRole("button", { name: /^Delete/ }).click() } },
        { name: "news", tab: "News", open: async (p) => { await expect(p.getByTestId("news-row").first()).toBeVisible() } },
        { name: "news + post confirmation", tab: "News", open: async (p) => {
          await p.getByLabel("Title", { exact: true }).fill("A title")
          await p.getByLabel("Message", { exact: true }).fill("A message")
          await p.getByRole("button", { name: "Post to All Members" }).click()
        } },
        { name: "news + post error", tab: "News", open: async (p) => {
          await p.getByLabel("Title", { exact: true }).fill("A title")
          await p.getByLabel("Message", { exact: true }).fill("A message")
          await p.route("**/api/admin/news", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error sending news" }) }) : route.continue(), { times: 1 })
          await p.getByRole("button", { name: "Post to All Members" }).click()
          await p.getByRole("alertdialog").getByRole("button", { name: "Send to all members" }).click()
          await expect(p.getByText("The announcement was not sent.")).toBeVisible()
        } },
        { name: "news + withdraw confirmation", tab: "News", open: async (p) => { await p.getByRole("button", { name: `Withdraw the announcement "Axe news ${tag}"` }).click() } },
        { name: "activity log", tab: "Activity log", open: async (p) => { await expect(p.getByTestId("activity-row").first()).toBeVisible() } },
        { name: "activity log (nothing found)", tab: "Activity log", open: async (p) => {
          await p.getByLabel("Search the log").fill("zzz-nothing")
          await expect(p.getByText("Nothing in the log matches.")).toBeVisible()
        } },
      ]

      const problems: string[] = []
      for (const step of steps) {
        await page.goto("/admin")
        await expect(page.getByRole("heading", { name: "Admin Panel", level: 1 })).toBeVisible()
        await page.getByRole("tab", { name: step.tab }).click()
        await expect(page.getByRole("tabpanel").getByRole("heading", { level: 2 })).toBeVisible()
        await page.waitForLoadState("networkidle").catch(() => {})
        if (step.open) await step.open(page)
        if (/dialog|confirmation|list/.test(step.name)) {
          await expect(page.locator('[role="dialog"], [role="alertdialog"], [role="listbox"]').first()).toBeVisible()
        }
        await scan(page, step.name, problems, step.allow)
        await shot(page, "admin", colorScheme, step.name)
      }

      // A toast with Undo (the one shown after a suspension).
      await page.goto("/admin")
      await page.getByRole("tab", { name: "Members" }).click()
      await findMember(page, reporter)
      await memberRow(page, reporter).getByRole("button", { name: /^Suspend / }).click()
      await page.getByLabel("Reason for the suspension").fill("Axe test.")
      await page.getByRole("alertdialog").getByRole("button", { name: /^Suspend / }).click()
      const toast = page.locator("[data-sonner-toast]").filter({ hasText: "has been suspended" })
      await expect(toast).toBeVisible()
      await scan(page, "members + toast with Undo", problems)
      await shot(page, "admin", colorScheme, "members + toast with Undo")
      await toast.getByRole("button", { name: "Undo" }).click()
      await expect(memberRow(page, reporter)).not.toContainText("Suspended")

      const unique = [...new Set(problems)]
      expect(unique, unique.join("\n")).toEqual([])
      await context.close()

      // Tidy up, so the queue and the lists do not grow with every run.
      await request.delete(`${API}/admin/events/${event.id}`, { headers: authHeaders(admin.token) })
      await request.delete(`${API}/admin/events/${past.id}`, { headers: authHeaders(admin.token) })
      await request.delete(`${API}/admin/news?id=${news.id}`, { headers: authHeaders(admin.token) })
      const open = await (await request.get(`${API}/admin/reports?page=1&limit=100&q=${encodeURIComponent(`Unkind words ${tag}`)}`, { headers: authHeaders(admin.token) })).json()
      for (const report of open.reports) {
        await request.put(`${API}/admin/reports/${report.id}`, { headers: authHeaders(admin.token), data: { status: "dismissed", action_taken: "none" } })
      }
      await act(suspended.id, { action: "unsuspend" })
      await act(banned.id, { action: "unban" })
    })
  }
}
