import { test, expect, type Browser, type Page, type Route } from "@playwright/test"
import { API, ADMIN_EMAIL, DEMO_PASSWORD, authHeaders, createMember, loginApi, signedInContextWith } from "./helpers"

/**
 * The admin panel when things go wrong or are unusual: Undo for every kind of
 * decision, an Undo that fails, lists and dialogs that cannot load, requests
 * that are refused, reports about an admin or a closed account, empty lists,
 * and going back a page. (The everyday paths are in admin.spec.ts.)
 */
type Session = Awaited<ReturnType<typeof loginApi>>

async function adminPage(browser: Browser, admin: Session, tab?: string): Promise<Page> {
  const context = await signedInContextWith(browser, admin)
  const page = await context.newPage()
  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible()
  if (tab) await openTab(page, tab)
  return page
}

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name }).click()
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true")
}

const userRow = (page: Page, email: string) => page.getByTestId("user-row").filter({ hasText: email })
const eventRow = (page: Page, title: string) => page.getByTestId("event-row").filter({ hasText: title })
const toastWith = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text })
const refuse = (message: string) => (route: Route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message }) })
const login = (request: import("@playwright/test").APIRequestContext, email: string, password: string) => request.post(`${API}/auth/login`, { data: { email, password } })

async function findMember(page: Page, email: string) {
  await page.getByLabel("Search members").fill(email)
  await expect(userRow(page, email)).toBeVisible()
  await expect(page.getByTestId("user-row")).toHaveCount(1)
}

test.describe("admin: Undo, failures and unusual cases", () => {
  test("ADM Undo: a warning and a ban can each be undone straight away; an Undo that fails says so and changes nothing", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request, { firstName: `Undo${Date.now()}` })
    const name = `${member.firstName} Example`
    const warnings = async () => {
      const found = await (await request.get(`${API}/admin/users?limit=5&page=1&q=${encodeURIComponent(member.email)}`, { headers: authHeaders(admin.token) })).json()
      return found.users[0].warnings as number
    }
    const page = await adminPage(browser, admin, "Members")
    await findMember(page, member.email)
    const row = userRow(page, member.email)
    const dialog = page.getByRole("alertdialog")

    // A warning, then Undo: the count goes back to nothing.
    await row.getByRole("button", { name: /^Warn / }).click()
    await dialog.getByLabel(`Message to ${member.firstName}`).fill("Please keep messages friendly.")
    await dialog.getByRole("button", { name: "Send warning" }).click()
    const warned = toastWith(page, `${name} has been warned`)
    await expect(warned).toBeVisible()
    await expect(row).toContainText("Warned")
    expect(await warnings()).toBe(1)
    await warned.getByRole("button", { name: "Undo" }).click()
    await expect(page.getByText("Warning removed. The notice already sent stays in their notifications.")).toBeVisible()
    await expect(row).not.toContainText("Warned")
    expect(await warnings()).toBe(0)

    // A ban, then Undo: they can sign in again.
    await row.getByRole("button", { name: /^Ban / }).click()
    await dialog.getByLabel("Reason for the ban").fill("Banned by mistake in a test.")
    await dialog.getByRole("button", { name: `Ban ${member.firstName}` }).click()
    const banned = toastWith(page, `${name} has been banned`)
    await expect(banned).toBeVisible()
    await expect(row).toContainText("Banned")
    expect((await login(request, member.email, member.password)).status()).toBe(403)
    await banned.getByRole("button", { name: "Undo" }).click()
    await expect(page.getByText("Ban lifted - they can sign in again.")).toBeVisible()
    await expect(row).not.toContainText("Banned")
    expect((await login(request, member.email, member.password)).status()).toBe(200)

    // A suspension whose Undo is refused by the server: the admin is told, and the member stays suspended.
    await row.getByRole("button", { name: /^Suspend / }).click()
    await dialog.getByLabel("Reason for the suspension").fill("Cooling-off period.")
    await dialog.getByRole("button", { name: `Suspend ${member.firstName}` }).click()
    const suspended = toastWith(page, `${name} has been suspended`)
    await expect(suspended).toBeVisible()
    await page.route("**/api/admin/users/*/action", refuse("Error performing user action"), { times: 1 })
    await suspended.getByRole("button", { name: "Undo" }).click()
    await expect(toastWith(page, "That could not be undone.")).toBeVisible()
    await expect(row).toContainText("Suspended")
    expect((await login(request, member.email, member.password)).status()).toBe(403)

    await request.post(`${API}/admin/users/${member.id}/action`, { headers: authHeaders(admin.token), data: { action: "unsuspend" } })
    await page.context().close()
  })

  test("ADM lists that cannot load: each tab says so with Try again, and a list that cannot be refreshed keeps what it had", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const context = await signedInContextWith(browser, admin)
    const page = await context.newPage()
    const TABS = [
      { tab: "Reports", url: "**/api/admin/reports?*", what: "the reports", heading: "Member reports" },
      { tab: "Members", url: "**/api/admin/users?*", what: "the members", heading: "Members" },
      { tab: "Events", url: "**/api/events", what: "the events", heading: "Events" },
      { tab: "News", url: "**/api/admin/news", what: "the announcements", heading: "News" },
      { tab: "Activity log", url: "**/api/admin/audit-log?*", what: "the activity log", heading: "Activity log" },
    ]
    for (const item of TABS) {
      const handler = (route: Route) => (route.request().method() === "GET" ? refuse("The server is having trouble")(route) : route.continue())
      await page.route(item.url, handler)
      await page.goto("/admin")
      await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible()
      await openTab(page, item.tab)
      const failed = page.getByRole("tabpanel").getByRole("alert").filter({ hasText: `We could not load ${item.what}` })
      await expect(failed, item.tab).toBeVisible()
      await expect(failed).toContainText("The server is having trouble")
      // A failed load must not read as "there is nothing here".
      await expect(page.getByText(/^No (reports|members|events|announcements)|Nothing has been recorded/)).toHaveCount(0)
      await page.unroute(item.url, handler)
      await failed.getByRole("button", { name: "Try again" }).click()
      await expect(failed).toHaveCount(0)
      await expect(page.getByRole("tabpanel").getByRole("heading", { name: item.heading, level: 2 })).toBeVisible()
      await expect(page.getByRole("tabpanel").getByRole("status").filter({ hasText: /^Loading/ })).toHaveCount(0)
    }

    // Reports, Members and the log: once a list is on screen, a refresh that fails leaves it there with a note.
    await openTab(page, "Members")
    await expect(page.getByTestId("user-row").first()).toBeVisible()
    await page.route("**/api/admin/users?*", refuse("The server is having trouble"), { times: 1 })
    await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /^Active/ }).click()
    await expect(page.getByText("The list could not be refreshed. The server is having trouble")).toBeVisible()
    await expect(page.getByTestId("user-row").first()).toBeVisible()
    await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /^All members/ }).click()
    await expect(page.getByText("The list could not be refreshed.")).toHaveCount(0)

    await openTab(page, "Reports")
    await expect(page.getByTestId("admin-reports").getByRole("status")).toContainText(/reports? found/)
    await page.route("**/api/admin/reports?*", refuse("The server is having trouble"), { times: 1 })
    await page.getByRole("group", { name: "Show" }).getByRole("button", { name: /^All reports/ }).click()
    await expect(page.getByText("The list could not be refreshed. The server is having trouble")).toBeVisible()

    await openTab(page, "Activity log")
    await expect(page.getByRole("tabpanel").getByRole("status")).toContainText(/entr(y|ies) found/)
    await page.route("**/api/admin/audit-log?*", refuse("The server is having trouble"), { times: 1 })
    await page.getByLabel("Show").selectOption({ index: 1 })
    await expect(page.getByText("The log could not be refreshed. The server is having trouble")).toBeVisible()
    await context.close()
  })

  test("ADM notes and news: notes that cannot load do not read as 'no notes'; a withdrawal that fails keeps the announcement", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request, { firstName: `Nell${Date.now()}` })
    await request.post(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token), data: { content: "Spoke on the phone." } })
    const title = `Edge news ${Date.now()}`
    const news = await (await request.post(`${API}/admin/news`, { headers: authHeaders(admin.token), data: { title, message: "A test announcement." } })).json()

    const page = await adminPage(browser, admin, "Members")
    await findMember(page, member.email)
    await page.route("**/api/admin/users/*/notes", refuse("Error fetching notes"), { times: 1 })
    await userRow(page, member.email).getByRole("button", { name: /^Notes/ }).click()
    const notes = page.getByRole("dialog", { name: "Admin notes" })
    await expect(notes.getByRole("alert")).toContainText("The notes could not be loaded. Error fetching notes")
    await expect(notes.getByText("No notes for this member")).toHaveCount(0)
    await page.keyboard.press("Escape")
    // Opening it again (the server is answering now) shows the note.
    await userRow(page, member.email).getByRole("button", { name: /^Notes/ }).click()
    await expect(notes.getByTestId("note")).toContainText("Spoke on the phone.")
    await page.keyboard.press("Escape")

    await openTab(page, "News")
    const item = page.getByTestId("news-row").filter({ hasText: title })
    await item.getByRole("button", { name: /^Withdraw/ }).click()
    const confirm = page.getByRole("alertdialog", { name: `Withdraw "${title}"?` })
    await page.route("**/api/admin/news?*", refuse("Error deleting announcement"), { times: 1 })
    await confirm.getByRole("button", { name: "Withdraw announcement" }).click()
    await expect(confirm.getByRole("alert")).toContainText("The announcement was not withdrawn. Error deleting announcement")
    await confirm.getByRole("button", { name: "Keep it" }).click()
    await expect(item).toBeVisible()
    const listed = await (await request.get(`${API}/admin/news`, { headers: authHeaders(admin.token) })).json()
    expect(listed.some((n: any) => n.id === news.id)).toBe(true)

    await request.delete(`${API}/admin/news?id=${news.id}`, { headers: authHeaders(admin.token) })
    await page.context().close()
  })

  test("ADM events: an attendee's note, a list that cannot load, restore asks first, refused restore and delete, an event under way is not Past, an untouched category survives an edit", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const tag = Date.now()
    const going = await createMember(request, { firstName: `Gwen${tag}` })
    const create = async (data: Record<string, unknown>) => (await (await request.post(`${API}/admin/events`, { headers: authHeaders(admin.token), data: { location: "Testville", ...data } })).json()) as { id: string }
    const title = `Edge picnic ${tag}`
    const event = await create({ title, start_date: new Date(Date.now() + 6 * 86400000).toISOString() })
    const underWay = await create({ title: `Edge under way ${tag}`, start_date: new Date(Date.now() - 3600000).toISOString(), end_date: new Date(Date.now() + 3600000).toISOString() })
    const ended = await create({ title: `Edge ended ${tag}`, start_date: new Date(Date.now() - 7200000).toISOString(), end_date: new Date(Date.now() - 3600000).toISOString() })
    expect((await request.post(`${API}/events/${event.id}/join`, { headers: authHeaders(going.token) })).ok()).toBeTruthy()
    expect((await request.put(`${API}/events/${event.id}/note`, { headers: authHeaders(going.token), data: { note: "I can give two people a lift." } })).ok()).toBeTruthy()
    const stored = async () => ((await (await request.get(`${API}/events`, { headers: authHeaders(admin.token) })).json()) as any[]).find((e) => e.id === event.id)

    const page = await adminPage(browser, admin, "Events")
    const row = eventRow(page, title)
    await expect(row).toBeVisible()

    // Started an hour ago and ends in an hour: not Past. Ended an hour ago: Past.
    await expect(eventRow(page, `Edge under way ${tag}`)).not.toContainText("Past")
    await expect(eventRow(page, `Edge ended ${tag}`)).toContainText("Past")

    // Who is going: the list cannot load -> an error, not "0 attending".
    const attendees = page.getByRole("dialog", { name: "Event Attendees" })
    await page.route("**/api/admin/events/*/attendees", refuse("Error fetching attendees"), { times: 1 })
    await row.getByRole("button", { name: /^Who is going/ }).click()
    await expect(attendees.getByRole("alert")).toContainText("The list could not be loaded. Error fetching attendees")
    await expect(attendees.getByText(/attending|No attendees yet/)).toHaveCount(0)
    await page.keyboard.press("Escape")
    await row.getByRole("button", { name: /^Who is going/ }).click()
    await expect(attendees).toContainText("1 attending")
    await expect(attendees).toContainText(going.email)
    await expect(attendees).toContainText("Their note: I can give two people a lift.")
    await page.keyboard.press("Escape")

    // No category was sent when this event was made, so it has the standard one;
    // opening Edit and saving something else must not change it.
    const category = (await stored()).category
    await row.getByRole("button", { name: /^Edit/ }).click()
    const form = page.getByRole("dialog", { name: "Edit Event" })
    await expect(form.getByRole("combobox", { name: "Category" })).toContainText("Local Chapter Event")
    await form.getByLabel("Description").fill("Bring a chair.")
    await form.getByRole("button", { name: "Save Changes" }).click()
    await expect(form).toBeHidden()
    expect((await stored()).description).toBe("Bring a chair.")
    expect((await stored()).category).toBe(category)

    // Cancel it, then Restore: restoring sends a notice to everyone going, so it asks first.
    const confirm = page.getByRole("alertdialog")
    await row.getByRole("button", { name: /^Cancel event/ }).click()
    await confirm.getByRole("button", { name: "Cancel event" }).click()
    await expect(row).toContainText("Cancelled")
    await row.getByRole("button", { name: /^Restore event/ }).click()
    await expect(confirm.getByRole("heading", { name: `Restore "${title}"?` })).toBeVisible()
    await expect(confirm).toContainText("the 1 member going will be sent a notice")
    await confirm.getByRole("button", { name: "Leave it cancelled" }).click()
    await expect(confirm).toBeHidden()
    expect((await stored()).is_cancelled).toBe(true)
    // Refused by the server: said in the dialog, still cancelled.
    await row.getByRole("button", { name: /^Restore event/ }).click()
    await page.route("**/api/admin/events/*/uncancel", refuse("Error restoring event"), { times: 1 })
    await confirm.getByRole("button", { name: "Restore event" }).click()
    await expect(confirm.getByRole("alert")).toContainText("The event was not restored. Error restoring event")
    expect((await stored()).is_cancelled).toBe(true)
    await confirm.getByRole("button", { name: "Restore event" }).click()
    await expect(toastWith(page, `"${title}" is back on`)).toBeVisible()
    await expect(row).not.toContainText("Cancelled")

    // Delete refused by the server: said in the dialog, the event is still there.
    await row.getByRole("button", { name: /^Delete/ }).click()
    await expect(confirm).toContainText("cancel it instead")
    await page.route("**/api/admin/events/*", (route) => (route.request().method() === "DELETE" ? refuse("Error deleting event")(route) : route.continue()), { times: 1 })
    await confirm.getByRole("button", { name: "Delete event" }).click()
    await expect(confirm.getByRole("alert")).toContainText("The event was not deleted. Error deleting event")
    await confirm.getByRole("button", { name: "Keep event" }).click()
    await expect(row).toBeVisible()
    expect(await stored()).toBeTruthy()

    // Deleting an event that is already cancelled does not suggest cancelling it.
    await row.getByRole("button", { name: /^Cancel event/ }).click()
    await confirm.getByRole("button", { name: "Cancel event" }).click()
    await expect(row).toContainText("Cancelled")
    await row.getByRole("button", { name: /^Delete/ }).click()
    await expect(confirm).toContainText("cannot be brought back")
    await expect(confirm).not.toContainText("cancel it instead")
    await confirm.getByRole("button", { name: "Delete event" }).click()
    await expect(row).toHaveCount(0)

    for (const id of [underWay.id, ended.id]) await request.delete(`${API}/admin/events/${id}`, { headers: authHeaders(admin.token) })
    await page.context().close()
  })

  test("ADM reports: view the profile; no warn, suspend or ban for a report about an admin or a closed account; no warning for a banned member; a refused dismissal changes nothing", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const tag = Date.now()
    const reporter = await createMember(request, { firstName: `Rhea${tag}` })
    const reported = await createMember(request, { firstName: `Sol${tag}` })
    const leaver = await createMember(request, { firstName: `Tam${tag}` })
    const bannedOne = await createMember(request, { firstName: `Uma${tag}` })
    const adminId = String(admin.user.id || admin.user._id)
    const file = async (about: string, details: string) => {
      const res = await request.post(`${API}/browse/${about}/report`, { headers: authHeaders(reporter.token), data: { reason: details, category: "Something else", source: "profile" } })
      expect(res.ok(), details).toBeTruthy()
    }
    await file(reported.id, `Ordinary report ${tag}`)
    await file(adminId, `About an admin ${tag}`)
    await file(leaver.id, `About a closed account ${tag}`)
    await file(bannedOne.id, `About a banned member ${tag}`)
    expect((await request.post(`${API}/settings/delete`, { headers: authHeaders(leaver.token), data: { password: leaver.password, reason: "test" } })).ok()).toBeTruthy()
    expect((await request.post(`${API}/admin/users/${bannedOne.id}/action`, { headers: authHeaders(admin.token), data: { action: "ban", message: "Banned for a test." } })).ok()).toBeTruthy()

    const page = await adminPage(browser, admin)
    await page.getByLabel("Search reports").fill(String(tag))
    const rows = page.getByTestId("report-row")
    await expect(rows).toHaveCount(4)
    const row = (text: string) => rows.filter({ hasText: `${text} ${tag}` })
    const decisions = /^(Warn|Suspend|Ban) /

    // About an admin: can be read and dismissed, never acted on from here.
    await expect(row("About an admin").getByRole("button", { name: decisions })).toHaveCount(0)
    await expect(row("About an admin").getByRole("button", { name: /^Dismiss report/ })).toBeVisible()
    // About an account that has since been closed: no decisions and no profile to open.
    await expect(row("About a closed account")).toContainText("Account closed")
    await expect(row("About a closed account").getByRole("button", { name: decisions })).toHaveCount(0)
    await expect(row("About a closed account").getByRole("link", { name: /^View profile/ })).toHaveCount(0)
    await expect(row("About a closed account").getByRole("button", { name: /^Dismiss report/ })).toBeVisible()
    // About a member who is already banned: a warning would never be read, so it is not offered.
    await expect(row("About a banned member")).toContainText("Currently banned")
    await expect(row("About a banned member").getByRole("button", { name: decisions })).toHaveCount(0)
    await expect(row("About a banned member").getByRole("button", { name: /^Dismiss report/ })).toBeVisible()
    // An ordinary report offers all three.
    await expect(row("Ordinary report").getByRole("button", { name: decisions })).toHaveCount(3)

    // A dismissal the server refuses: the admin is told and the report stays in the queue.
    await page.route("**/api/admin/reports/*", (route) => (route.request().method() === "PUT" ? refuse("Error updating report")(route) : route.continue()), { times: 1 })
    await row("Ordinary report").getByRole("button", { name: /^Dismiss report/ }).click()
    await expect(toastWith(page, "That did not work, and the report was not changed. Error updating report")).toBeVisible()
    await expect(row("Ordinary report")).toBeVisible()
    const waiting = await (await request.get(`${API}/admin/reports?page=1&limit=20&status=pending&q=${tag}`, { headers: authHeaders(admin.token) })).json()
    expect(waiting.total).toBe(4)

    // View profile opens the reported member's profile.
    await row("Ordinary report").getByRole("link", { name: /^View profile/ }).click()
    await expect(page).toHaveURL(new RegExp(`/profile/${reported.id}$`))
    await expect(page.getByRole("heading", { name: new RegExp(reported.firstName), level: 1 })).toBeVisible()

    // Tidy up.
    for (const report of waiting.reports) await request.put(`${API}/admin/reports/${report.id}`, { headers: authHeaders(admin.token), data: { status: "dismissed", action_taken: "none" } })
    await request.post(`${API}/admin/users/${bannedOne.id}/action`, { headers: authHeaders(admin.token), data: { action: "unban" } })
    await page.context().close()
  })

  test("ADM empty lists: 'No reports are waiting' with no badge on the tab, and an empty activity log", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const context = await signedInContextWith(browser, admin)
    const page = await context.newPage()
    // A community with nothing waiting (the answer the server gives then).
    await page.route("**/api/admin/reports?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reports: [], total: 0, page: 1, totalPages: 1, counts: { pending: 0, resolved: 0, dismissed: 0, all: 0 } }) }))
    await page.route("**/api/admin/audit-log?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: [], total: 0, page: 1, totalPages: 1 }) }))
    await page.goto("/admin")
    await expect(page.getByText("No reports are waiting.")).toBeVisible()
    await expect(page.getByTestId("reports-waiting")).toHaveCount(0)
    await expect(page.getByRole("navigation", { name: "Pages of reports" })).toHaveCount(0)
    await openTab(page, "Activity log")
    await expect(page.getByText("Nothing has been recorded yet.")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Pages of entries" })).toHaveCount(0)
    await context.close()
  })

  test("ADM waiting number: a report that arrives while the admin is on another tab shows on the Reports tab at the next tab change", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const tag = Date.now()
    const reporter = await createMember(request, { firstName: `Wren${tag}` })
    const reported = await createMember(request, { firstName: `Xan${tag}` })
    const pending = async () => (await (await request.get(`${API}/admin/reports?page=1&limit=1`, { headers: authHeaders(admin.token) })).json()).counts.pending as number
    const page = await adminPage(browser, admin, "Members")
    await expect(page.getByTestId("user-row").first()).toBeVisible()
    expect((await request.post(`${API}/browse/${reported.id}/report`, { headers: authHeaders(reporter.token), data: { reason: `Badge ${tag}`, category: "Something else", source: "profile" } })).ok()).toBeTruthy()
    const now = await pending()
    await openTab(page, "Events")
    await expect(page.getByTestId("reports-waiting")).toHaveText(`${now} waiting`)
    // Tidy up, and the number follows at the next change of tab.
    const filed = await (await request.get(`${API}/admin/reports?page=1&limit=5&q=${encodeURIComponent(`Badge ${tag}`)}`, { headers: authHeaders(admin.token) })).json()
    await request.put(`${API}/admin/reports/${filed.reports[0].id}`, { headers: authHeaders(admin.token), data: { status: "dismissed", action_taken: "none" } })
    await openTab(page, "News")
    if (now - 1 > 0) await expect(page.getByTestId("reports-waiting")).toHaveText(`${now - 1} waiting`)
    else await expect(page.getByTestId("reports-waiting")).toHaveCount(0)
    await page.context().close()
  })

  test("ADM activity log pages: more than one page of entries, Next and Previous", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request, { firstName: `Page${Date.now()}` })
    // 14 warnings, each removed again: 28 entries about this one member.
    for (let i = 1; i <= 14; i += 1) {
      expect((await request.post(`${API}/admin/users/${member.id}/action`, { headers: authHeaders(admin.token), data: { action: "warn", message: `Warning number ${i}` } })).ok()).toBeTruthy()
      expect((await request.post(`${API}/admin/users/${member.id}/action`, { headers: authHeaders(admin.token), data: { action: "remove_warning", message: `Removal number ${i}` } })).ok()).toBeTruthy()
    }
    const page = await adminPage(browser, admin, "Activity log")
    await page.getByLabel("Search the log").fill(member.email)
    const pager = page.getByRole("navigation", { name: "Pages of entries" })
    const rows = page.getByTestId("activity-row")
    await expect(page.getByTestId("pager-summary")).toHaveText("Showing 1 to 25 of 28 entries")
    await expect(page.getByRole("tabpanel").getByRole("status")).toHaveText("28 entries found")
    await expect(rows).toHaveCount(25)
    await expect(pager).toContainText("Page 1 of 2")
    await expect(pager.getByRole("button", { name: "Previous" })).toBeDisabled()
    // Newest first.
    await expect(rows.first()).toContainText("Reason: Removal number 14")
    await pager.getByRole("button", { name: "Next" }).click()
    await expect(page.getByTestId("pager-summary")).toHaveText("Showing 26 to 28 of 28 entries")
    await expect(rows).toHaveCount(3)
    await expect(rows.last()).toContainText("Reason: Warning number 1")
    await expect(pager.getByRole("button", { name: "Next" })).toBeDisabled()
    await pager.getByRole("button", { name: "Previous" }).click()
    await expect(page.getByTestId("pager-summary")).toHaveText("Showing 1 to 25 of 28 entries")
    await expect(rows.first()).toContainText("Reason: Removal number 14")
    await page.context().close()
  })
})
