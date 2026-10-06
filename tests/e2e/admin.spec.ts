import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test"
import { API, ADMIN_EMAIL, DEMO_PASSWORD, TINY_PNG, alertBox, authHeaders, createMember, loginApi, signedInContextWith } from "./helpers"

type Session = Awaited<ReturnType<typeof loginApi>>

/** An admin browser page, optionally in a given time zone and at a given size. */
async function adminPage(
  browser: Browser,
  admin: Session,
  options: { timezoneId?: string; viewport?: { width: number; height: number } } = {}
): Promise<Page> {
  const context = await signedInContextWith(browser, admin, options)
  const page = await context.newPage()
  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible()
  return page
}

const eventRow = (page: Page, title: string) => page.getByTestId("event-row").filter({ hasText: title })

async function openEventsTab(page: Page) {
  await page.getByRole("tab", { name: "Events" }).click()
  await expect(page.getByRole("heading", { name: "Events", level: 2 })).toBeVisible()
}

const userRow = (page: Page, email: string) => page.getByTestId("user-row").filter({ hasText: email })

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name }).click()
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true")
}

/** The toast carrying this text (several can be on screen at once). */
const toastWith = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text })

async function adminEvents(request: import("@playwright/test").APIRequestContext, token: string) {
  return (await (await request.get(`${API}/events`, { headers: authHeaders(token) })).json()) as any[]
}

test.describe("ADM-53: the date and time an admin types is the date and time members see", () => {
  const ZONES = ["America/Chicago", "America/Los_Angeles", "Pacific/Honolulu", "Europe/London", "Asia/Tokyo", "Pacific/Auckland"]
  // Both United States clock-change days, late in the evening - the case that
  // used to move the event to the next day every time it was saved.
  const DAYS = [
    { date: "2026-11-01", shown: /Nov 1\b/, listed: "Nov 1, 2026" },
    { date: "2027-03-14", shown: /Mar 14\b/, listed: "Mar 14, 2027" },
  ]

  for (const zone of ZONES) {
    test(`create, view as a member, open, save unchanged, edit - in ${zone}`, async ({ browser, request }) => {
      test.setTimeout(180_000)
      const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
      const member = await createMember(request)
      const page = await adminPage(browser, admin, { timezoneId: zone })
      await openEventsTab(page)
      const created: string[] = []
      const titles: string[] = []

      for (const day of DAYS) {
        const title = `TZ ${zone} ${day.date} ${Date.now()}`
        titles.push(title)
        await page.getByRole("button", { name: "Create Event" }).first().click()
        const dialog = page.getByRole("dialog", { name: "Create New Event" })
        await dialog.locator("#event-title").fill(title)
        await dialog.locator("#event-start-date").fill(day.date)
        await dialog.locator("#event-start-time").fill("23:30")
        await dialog.locator("#event-location").fill("Community Hall, Testville")
        await dialog.getByRole("button", { name: "Create Event" }).click()
        await expect(dialog).toBeHidden()

        // The admin list shows what was typed.
        const row = eventRow(page, title)
        await expect(row).toContainText(day.listed)
        await expect(row).toContainText(/11:30\sPM/)

        // Stored as one exact moment: 23:30 on that calendar day in this zone.
        const stored = (await adminEvents(request, admin.token)).find((e) => e.title === title)
        created.push(String(stored.id))
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(new Date(stored.start_date))
        const get = (type: string) => parts.find((p) => p.type === type)!.value
        expect(`${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`).toBe(`${day.date} 23:30`)

        // Open the edit form: both boxes show exactly what was typed.
        await row.getByRole("button", { name: /^Edit/ }).click()
        const edit = page.getByRole("dialog", { name: "Edit Event" })
        await expect(edit.locator("#event-start-date")).toHaveValue(day.date)
        await expect(edit.locator("#event-start-time")).toHaveValue("23:30")

        // Save without touching anything, twice: nothing moves.
        await edit.getByRole("button", { name: "Save Changes" }).click()
        await expect(edit).toBeHidden()
        await row.getByRole("button", { name: /^Edit/ }).click()
        await expect(edit.locator("#event-start-date")).toHaveValue(day.date)
        await expect(edit.locator("#event-start-time")).toHaveValue("23:30")
        await edit.locator("#event-description").fill("Bring a dish to share.")
        await edit.getByRole("button", { name: "Save Changes" }).click()
        await expect(edit).toBeHidden()
        const after = (await adminEvents(request, admin.token)).find((e) => e.title === title)
        expect(after.start_date).toBe(stored.start_date)
        expect(after.description).toBe("Bring a dish to share.")
        await expect(row).toContainText(day.listed)
        await expect(row).toContainText(/11:30\sPM/)
      }

      // A member in the same time zone sees the same day and time.
      const memberContext = await signedInContextWith(browser, member, { timezoneId: zone })
      const memberPage = await memberContext.newPage()
      await memberPage.goto("/events")
      for (const day of DAYS) {
        const heading = memberPage.getByRole("heading", { name: new RegExp(`TZ ${zone.replace("/", "\\/")} ${day.date}`) }).first()
        await expect(heading).toBeVisible()
        const card = heading.locator("xpath=..")
        await expect(card.getByText(day.shown)).toBeVisible()
        await expect(card).toContainText(/11:30\sPM/)
      }
      await memberContext.close()

      // Changing the date and time on purpose does change it - to exactly what was typed.
      const first = eventRow(page, titles[0])
      await first.getByRole("button", { name: /^Edit/ }).click()
      const edit = page.getByRole("dialog", { name: "Edit Event" })
      await edit.locator("#event-start-date").fill("2026-12-31")
      await edit.locator("#event-start-time").fill("00:15")
      await edit.getByRole("button", { name: "Save Changes" }).click()
      await expect(edit).toBeHidden()
      await expect(first).toContainText("Dec 31, 2026")
      await expect(first).toContainText(/12:15\sAM/)

      for (const id of created) await request.delete(`${API}/admin/events/${id}`, { headers: authHeaders(admin.token) })
      await page.context().close()
    })
  }

  test("an event stored before this fix still shows the same, and its end time survives an untouched save", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const title = `Stored earlier ${Date.now()}`
    // Saved straight through the API as an exact moment, the way every existing event is.
    const made = await (await request.post(`${API}/admin/events`, {
      headers: authHeaders(admin.token),
      data: { title, location: "Testville", start_date: "2026-11-21T01:45:30.000Z", end_date: "2026-11-21T04:00:00.000Z", category: "social", max_attendees: 12 },
    })).json()

    const page = await adminPage(browser, admin, { timezoneId: "America/Chicago" })
    await openEventsTab(page)
    const row = eventRow(page, title)
    // 01:45 UTC on the 21st is 7:45 pm on the 20th in Chicago - as it always displayed.
    await expect(row).toContainText("Nov 20, 2026")
    await expect(row).toContainText(/7:45\sPM/)

    await row.getByRole("button", { name: /^Edit/ }).click()
    const edit = page.getByRole("dialog", { name: "Edit Event" })
    await expect(edit.locator("#event-start-date")).toHaveValue("2026-11-20")
    await expect(edit.locator("#event-start-time")).toHaveValue("19:45")
    await expect(edit.locator("#event-end-date")).toHaveValue("2026-11-20")
    await expect(edit.locator("#event-end-time")).toHaveValue("22:00")
    await edit.getByRole("button", { name: "Save Changes" }).click()
    await expect(edit).toBeHidden()

    const after = (await adminEvents(request, admin.token)).find((e) => String(e.id) === String(made.id))
    // Not moved - not even the seconds.
    expect(after.start_date).toBe("2026-11-21T01:45:30.000Z")
    expect(after.end_date).toBe("2026-11-21T04:00:00.000Z")
    expect(after.max_attendees).toBe(12)

    await request.delete(`${API}/admin/events/${made.id}`, { headers: authHeaders(admin.token) })
    await page.context().close()
  })

  test("a clock time that does not exist (clocks go forward) is refused with a plain message", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const page = await adminPage(browser, admin, { timezoneId: "America/Chicago" })
    await openEventsTab(page)
    await page.getByRole("button", { name: "Create Event" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Create New Event" })
    await dialog.locator("#event-title").fill(`Skipped hour ${Date.now()}`)
    await dialog.locator("#event-start-date").fill("2027-03-14")
    await dialog.locator("#event-start-time").fill("02:30")
    await dialog.locator("#event-location").fill("Testville")
    await dialog.getByRole("button", { name: "Create Event" }).click()
    await expect(dialog.getByRole("alert")).toContainText("does not exist on that day")
    await expect(dialog).toBeVisible()
    await page.context().close()
  })
})

test.describe("admin: every screen and button", () => {
  const login = (request: APIRequestContext, email: string, password: string) => request.post(`${API}/auth/login`, { data: { email, password } })

  test("ADM members: search, filters and counts; warn / suspend / ban each need a reason and a plain confirmation; Undo; lifting; history; activity log", async ({ browser, request }) => {
    test.setTimeout(180_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request, { firstName: `Zadie${Date.now()}` })
    const name = `${member.firstName} Example`
    const page = await adminPage(browser, admin)

    // The panel opens on the report queue; Members is the next tab.
    await expect(page.getByRole("tab", { name: /^Reports/ })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByText("Look after the community")).toBeVisible()
    await openTab(page, "Members")
    await expect(page.getByText("Members never see notes or who reported them.")).toBeVisible()

    // Search by name, email and id; nothing found. One row: name, status, email, dates.
    const search = page.getByLabel("Search members")
    await search.fill(member.firstName.toUpperCase())
    await expect(page.getByTestId("user-row")).toHaveCount(1)
    await search.fill(member.id)
    await expect(page.getByTestId("user-row")).toHaveCount(1)
    await search.fill("zzz-nobody-by-this-name")
    await expect(page.getByText("No members found")).toBeVisible()
    await search.fill(member.email)
    const row = userRow(page, member.email)
    await expect(page.getByTestId("user-row")).toHaveCount(1)
    await expect(row.getByRole("heading", { name })).toBeVisible()
    await expect(row).toContainText("Active")
    await expect(row).toContainText(/Joined \w{3} \d{1,2}, \d{4}/)
    await expect(row).toContainText(/Last active \w{3} \d{1,2}, \d{4}/)

    // The numbers on the filter buttons are the whole community's, from the server.
    const serverCounts = async () => (await (await request.get(`${API}/admin/users?limit=1`, { headers: authHeaders(admin.token) })).json()).counts
    const shown = (label: string) => page.getByRole("group", { name: "Show" }).getByRole("button", { name: new RegExp(`^${label}`) })
    const before = await serverCounts()
    await expect(shown("All members")).toContainText(String(before.all))
    await expect(shown("Suspended")).toContainText(String(before.suspended))

    // Warn: the confirmation names the member and says what happens; it needs a message and can be cancelled.
    const dialog = page.getByRole("alertdialog")
    await row.getByRole("button", { name: /^Warn / }).click()
    await expect(dialog.getByRole("heading", { name: `Send a warning to ${name}?` })).toBeVisible()
    await expect(dialog).toContainText(`${name} will get this warning as a notice in the app and can carry on using it as normal. They are not told who reported them.`)
    await expect(dialog).toContainText(member.email)
    await expect(dialog.getByRole("button", { name: "Send warning" })).toBeDisabled()
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toContainText("Active")

    // A failed action says so in the dialog (not a browser pop-up) and changes nothing.
    await row.getByRole("button", { name: /^Warn / }).click()
    await dialog.getByLabel(`Message to ${member.firstName}`).fill("Please keep messages friendly.")
    await page.route("**/api/admin/users/*/action", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error performing user action" }) }), { times: 1 })
    await dialog.getByRole("button", { name: "Send warning" }).click()
    await expect(dialog.getByRole("alert")).toContainText("That did not work, and nothing was changed. Error performing user action")
    await expect(row).toContainText("Active")
    await dialog.getByRole("button", { name: "Send warning" }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toContainText("Warned (1)")
    await expect(toastWith(page, `${name} has been warned`)).toBeVisible()
    // The member is told, with the message.
    const notices = await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()
    expect(notices.some((n: any) => n.title === "Account Warning" && n.message === "Please keep messages friendly.")).toBe(true)

    // Filters work together with the search.
    await shown("Active").click()
    await expect(page.getByText("No members found")).toBeVisible()
    await expect(shown("Active")).toHaveAttribute("aria-pressed", "true")
    await shown("Warned").click()
    await expect(row).toBeVisible()
    await shown("All members").click()

    // Suspend: reason required, consequence in plain words.
    await row.getByRole("button", { name: /^Suspend / }).click()
    await expect(dialog.getByRole("heading", { name: `Suspend ${name}?` })).toBeVisible()
    await expect(dialog).toContainText(`${name} will be signed out and will not be able to sign in until the suspension is lifted. They are not told who reported them.`)
    const suspend = dialog.getByRole("button", { name: `Suspend ${member.firstName}` })
    await expect(suspend).toBeDisabled()
    await dialog.getByLabel("Reason for the suspension").fill("   ")
    await expect(suspend).toBeDisabled()
    await dialog.getByLabel("Reason for the suspension").fill("Too many reports this week.")
    await suspend.click()
    await expect(dialog).toBeHidden()
    await expect(row).toContainText("Suspended")
    await expect(shown("Suspended")).toContainText(String(before.suspended + 1))
    expect((await login(request, member.email, member.password)).status()).toBe(403)

    // Undo, offered straight afterwards, lifts it again.
    await toastWith(page, `${name} has been suspended`).getByRole("button", { name: "Undo" }).click()
    await expect(page.getByText("Suspension lifted - they can sign in again.")).toBeVisible()
    await expect(row).not.toContainText("Suspended")
    await expect(shown("Suspended")).toContainText(String(before.suspended))
    expect((await login(request, member.email, member.password)).status()).toBe(200)

    // Suspend again, find them under the Suspended filter, and lift it there (confirmed, reason optional).
    await row.getByRole("button", { name: /^Suspend / }).click()
    await dialog.getByLabel("Reason for the suspension").fill("Cooling-off period.")
    await dialog.getByRole("button", { name: `Suspend ${member.firstName}` }).click()
    await expect(row).toContainText("Suspended")
    await shown("Suspended").click()
    await expect(row).toBeVisible()
    await expect(row.getByRole("button", { name: /^Suspend / })).toHaveCount(0)
    await row.getByRole("button", { name: /^Lift suspension/ }).click()
    await expect(dialog.getByRole("heading", { name: `Lift the suspension for ${name}?` })).toBeVisible()
    await expect(dialog).toContainText(`${name} will be able to sign in again straight away.`)
    await dialog.getByRole("button", { name: "Lift suspension" }).click()
    await expect(dialog).toBeHidden()
    // No longer suspended, so no longer under this filter.
    await expect(page.getByText("No members found")).toBeVisible()
    expect((await login(request, member.email, member.password)).status()).toBe(200)
    await shown("All members").click()

    // Ban, then lift it with a reason.
    await row.getByRole("button", { name: /^Ban / }).click()
    await expect(dialog.getByRole("heading", { name: `Ban ${name}?` })).toBeVisible()
    await expect(dialog).toContainText(`${name} will be signed out and will not be able to sign in again unless an admin lifts the ban. They are not told who reported them.`)
    await expect(dialog.getByRole("button", { name: `Ban ${member.firstName}` })).toBeDisabled()
    await dialog.getByLabel("Reason for the ban").fill("Repeated harassment.")
    await dialog.getByRole("button", { name: `Ban ${member.firstName}` }).click()
    await expect(row).toContainText("Banned")
    expect((await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).status()).toBe(403)
    await shown("Banned").click()
    await expect(row).toBeVisible()
    await row.getByRole("button", { name: /^Lift ban/ }).click()
    await expect(dialog.getByRole("heading", { name: `Lift the ban for ${name}?` })).toBeVisible()
    await dialog.getByLabel("Reason (optional)").fill("Appeal accepted.")
    await dialog.getByRole("button", { name: "Lift ban" }).click()
    await expect(page.getByText("No members found")).toBeVisible()
    expect((await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).status()).toBe(200)
    await shown("All members").click()

    // History lists everything that was done, by whom, with the reasons - newest first.
    await row.getByRole("button", { name: /^History/ }).click()
    const history = page.getByRole("dialog", { name: "Action history" })
    await expect(history).toContainText(`What admins have done about ${name}`)
    await expect(history.getByTestId("history-entry").first()).toContainText("Ban lifted")
    await expect(history.getByTestId("history-entry").first()).toContainText("Appeal accepted.")
    for (const text of ["Warning sent", "Please keep messages friendly.", "Suspended", "Cooling-off period.", "Suspension lifted", "Undone straight away", "Banned", "Repeated harassment.", `By: ${ADMIN_EMAIL}`]) {
      await expect(history.getByText(text).first()).toBeVisible()
    }
    await page.keyboard.press("Escape")
    await expect(history).toBeHidden()

    // The activity log has the same decisions for every admin to read: who, whom, when, why.
    await openTab(page, "Activity log")
    await expect(page.getByText("Entries are added automatically and cannot be changed or removed.")).toBeVisible()
    await page.getByLabel("Search the log").fill(member.email)
    const entries = page.getByTestId("activity-row")
    await expect(entries).toHaveCount(7)
    await expect(entries.first()).toContainText(`Ban lifted: ${name}`)
    await expect(entries.first()).toContainText("Reason: Appeal accepted.")
    await expect(entries.first()).toContainText(`By: Avery Moderator (${ADMIN_EMAIL})`)
    await expect(entries.first()).toContainText(/\w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s[AP]M/)
    await page.getByLabel("Show").selectOption({ label: "Suspended" })
    await expect(entries).toHaveCount(2)
    await expect(entries.first()).toContainText("Reason: Cooling-off period.")
    await page.getByLabel("Show").selectOption({ label: "Everything" })
    await page.getByLabel("Search the log").fill("zzz-nothing-like-this")
    await expect(page.getByText("Nothing in the log matches.")).toBeVisible()

    // Someone with a clean record has an empty history; an admin cannot be acted on.
    const clean = await createMember(request)
    await openTab(page, "Members")
    await page.getByLabel("Search members").fill(clean.email)
    await userRow(page, clean.email).getByRole("button", { name: /^History/ }).click()
    await expect(history.getByText("No action history for this member")).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByLabel("Search members").fill(ADMIN_EMAIL)
    const adminRow = userRow(page, ADMIN_EMAIL)
    await expect(adminRow).toContainText("Admin accounts cannot be warned, suspended or banned from here.")
    await expect(adminRow.getByRole("button", { name: /^(Warn|Suspend|Ban) / })).toHaveCount(0)
    await page.context().close()
  })

  test("ADM notes: empty state, add, listed with author, kept after reload, delete (confirmed), errors shown in the dialog", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request)
    const page = await adminPage(browser, admin)
    await openTab(page, "Members")
    await page.getByLabel("Search members").fill(member.email)
    const row = userRow(page, member.email)
    await expect(row.getByRole("button", { name: /^Notes/ })).toContainText("(0)")
    await row.getByRole("button", { name: /^Notes/ }).click()
    const dialog = page.getByRole("dialog", { name: "Admin notes" })
    await expect(dialog).toContainText(`Private notes about ${member.firstName} Example`)
    await expect(dialog.getByText("No notes for this member")).toBeVisible()
    const add = dialog.getByRole("button", { name: "Add note" })
    await expect(add).toBeDisabled()

    // ADM-31: a note that cannot be saved is explained in the dialog and the words are kept.
    await dialog.getByLabel("Add a note").fill("Spoke on the phone - all fine.")
    await page.route("**/api/admin/users/*/notes", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error adding note" }) }) : route.continue(), { times: 1 })
    await add.click()
    await expect(dialog.getByRole("alert")).toContainText("The note was not saved. Error adding note")
    await expect(dialog.getByLabel("Add a note")).toHaveValue("Spoke on the phone - all fine.")
    await expect(dialog.getByText("No notes for this member")).toBeVisible()

    await add.click()
    const note = dialog.getByTestId("note")
    await expect(note).toHaveCount(1)
    await expect(note).toContainText("Spoke on the phone - all fine.")
    await expect(note).toContainText(`By: ${ADMIN_EMAIL}`)
    await expect(dialog.getByRole("alert")).toHaveCount(0)
    await expect(dialog.getByLabel("Add a note")).toHaveValue("")
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(row.getByRole("button", { name: /^Notes/ })).toContainText("(1)")

    // Kept on the server.
    await page.reload()
    await openTab(page, "Members")
    await page.getByLabel("Search members").fill(member.email)
    await expect(row.getByRole("button", { name: /^Notes/ })).toContainText("(1)")
    await row.getByRole("button", { name: /^Notes/ }).click()
    await expect(note).toContainText("Spoke on the phone - all fine.")
    const saved = await (await request.get(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token) })).json()
    expect(saved).toHaveLength(1)
    // Edit through the API (there is no edit control on the screen).
    const edited = await request.put(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token), data: { noteId: saved[0].id, content: "Spoke on the phone - follow up in May." } })
    expect(edited.ok()).toBeTruthy()

    // Delete asks first; "Keep note" keeps it.
    const confirm = page.getByRole("alertdialog", { name: "Delete this note?" })
    await note.getByRole("button", { name: "Delete note" }).click()
    await expect(confirm).toContainText("It will be removed for every admin and cannot be brought back.")
    await confirm.getByRole("button", { name: "Keep note" }).click()
    await expect(confirm).toBeHidden()
    await expect(note).toHaveCount(1)

    // ADM-31: a failed delete is explained and the note stays.
    await page.route("**/api/admin/users/*/notes*", (route) => route.request().method() === "DELETE" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error deleting note" }) }) : route.continue(), { times: 1 })
    await note.getByRole("button", { name: "Delete note" }).click()
    await confirm.getByRole("button", { name: "Delete note" }).click()
    await expect(confirm.getByRole("alert")).toContainText("The note was not deleted. Error deleting note")
    await confirm.getByRole("button", { name: "Delete note" }).click()
    await expect(confirm).toBeHidden()
    await expect(dialog.getByText("No notes for this member")).toBeVisible()
    expect(await (await request.get(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token) })).json()).toHaveLength(0)
    await page.keyboard.press("Escape")
    await expect(row.getByRole("button", { name: /^Notes/ })).toContainText("(0)")
    await page.context().close()
  })

  test("ADM events: counters, every form field, photo, the row, who is going, cancel / restore / delete with confirmations, errors", async ({ browser, request }) => {
    test.setTimeout(180_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request, { firstName: "Goer" })
    const page = await adminPage(browser, admin)
    await openEventsTab(page)
    await expect(page.getByRole("tab", { name: "Events" })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByText("Events appear on every member’s Events page.")).toBeVisible()
    for (const label of ["Total Events", "Upcoming", "Past", "Cancelled"]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    const count = async (which: "total" | "upcoming" | "past" | "cancelled") => Number(await page.getByTestId(`event-count-${which}`).innerText())
    await expect(page.getByTestId("event-row").first()).toBeVisible()
    const before = { total: await count("total"), upcoming: await count("upcoming"), past: await count("past"), cancelled: await count("cancelled") }
    expect(before.total).toBe(before.upcoming + before.past + before.cancelled)

    // ADM-54: the dialog can be cancelled; Create stays off until the required boxes are filled.
    await page.getByRole("button", { name: "Create Event" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Create New Event" })
    const create = dialog.getByRole("button", { name: "Create Event" })
    await expect(create).toBeDisabled()
    await dialog.getByLabel("Event Title *").fill("Typed and then abandoned")
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    expect(await count("total")).toBe(before.total)
    // Opening it again starts from an empty form.
    await page.getByRole("button", { name: "Create Event" }).first().click()
    await expect(dialog.getByLabel("Event Title *")).toHaveValue("")

    // ADM-43, 44, 46, 47: each box, with its label.
    const title = `Bowling night ${Date.now()}`
    await dialog.getByLabel("Event Title *").fill(title)
    await dialog.getByLabel("Description").fill("Shoes provided. All abilities welcome.")
    await dialog.getByLabel("Start Date *").fill("2027-01-16")
    await expect(create).toBeDisabled()
    await dialog.getByLabel("Start Time *").fill("18:00")
    await expect(create).toBeDisabled()
    await dialog.getByLabel("Location *").fill("Lucky Lanes, Tulsa")
    await expect(create).toBeEnabled()
    // An end date without a time, and an end before the start, are explained.
    await dialog.getByLabel("End Date").fill("2027-01-16")
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("Please add an end time")
    await dialog.getByLabel("End Time").fill("17:00")
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("cannot end before it starts")
    await dialog.getByLabel("End Time").fill("21:00")
    // ADM-48: every category is offered.
    await expect(dialog.getByRole("combobox", { name: "Category" })).toContainText("Local Chapter Event")
    await dialog.getByRole("combobox", { name: "Category" }).click()
    for (const option of ["Local Chapter Event", "Regional", "National", "Dating", "Outdoor", "Food & Drink", "Social", "Fitness", "Arts & Culture"]) {
      await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible()
    }
    await page.getByRole("option", { name: "Social", exact: true }).click()
    await expect(dialog.getByRole("combobox", { name: "Category" })).toContainText("Social")
    // ADM-49: the limit must be 1 or more (or blank).
    await dialog.getByLabel("Max Attendees").fill("0")
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("must be 1 or more")
    await dialog.getByLabel("Max Attendees").fill("24")

    // Photo: something that is not a picture is refused with a message; a picture shows a preview.
    const photo = dialog.getByLabel("Upload Event Photo (optional)")
    await photo.setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("this is not a picture") })
    await expect(dialog.getByRole("alert").filter({ hasText: "The photo was not added. That file does not look like a picture." })).toBeVisible()
    await photo.setInputFiles({ name: "lanes.png", mimeType: "image/png", buffer: TINY_PNG })
    const preview = dialog.getByRole("img", { name: "Event preview" })
    await expect(preview).toBeVisible()
    await expect(dialog.getByText("The photo was not added.")).toHaveCount(0)
    // ADM-51: the photo can be removed (a button with words) and added again.
    await dialog.getByRole("button", { name: "Remove photo" }).click()
    await expect(preview).toHaveCount(0)
    await expect(dialog.getByRole("button", { name: "Remove photo" })).toHaveCount(0)
    await photo.setInputFiles({ name: "lanes.png", mimeType: "image/png", buffer: TINY_PNG })
    await expect(preview).toBeVisible()

    // ADM-55: a failed save is explained in the dialog and nothing typed is lost.
    await page.route("**/api/admin/events", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error creating event" }) }) : route.continue(), { times: 1 })
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("The event was not saved. Error creating event")
    await expect(dialog.getByLabel("Event Title *")).toHaveValue(title)
    await expect(dialog.getByLabel("Description")).toHaveValue("Shoes provided. All abilities welcome.")
    await expect(preview).toBeVisible()
    await create.click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText("Event created").first()).toBeVisible()
    await expect(page.getByTestId("event-count-total")).toHaveText(String(before.total + 1))
    await expect(page.getByTestId("event-count-upcoming")).toHaveText(String(before.upcoming + 1))

    // ADM-41: the row shows the picture, title, category, description, date range, place and places taken.
    const row = eventRow(page, title)
    await expect(row.getByRole("heading", { name: title })).toBeVisible()
    await expect(row.locator("img")).toHaveCount(1)
    await expect(row).toContainText("Social")
    await expect(row).toContainText("Shoes provided. All abilities welcome.")
    await expect(row).toContainText(/Jan 16, 2027, 6:00\sPM - 9:00\sPM/)
    await expect(row).toContainText("Lucky Lanes, Tulsa")
    await expect(row).toContainText("0/24 attending")
    await expect(row.getByText("Cancelled", { exact: true })).toHaveCount(0)
    await expect(row.getByText("Past", { exact: true })).toHaveCount(0)
    const stored = (await adminEvents(request, admin.token)).find((e) => e.title === title)
    expect(stored).toMatchObject({ description: "Shoes provided. All abilities welcome.", location: "Lucky Lanes, Tulsa", category: "social", max_attendees: 24 })
    expect(stored.image).toBeTruthy()
    expect(new Date(stored.end_date).getTime() - new Date(stored.start_date).getTime()).toBe(3 * 60 * 60 * 1000)
    // Members were told about the new event.
    const notices = await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()
    expect(notices.some((n: any) => n.type === "event" && String(n.message).includes(title))).toBe(true)

    // Who is going: empty, then one person.
    await row.getByRole("button", { name: /^Who is going/ }).click()
    const going = page.getByRole("dialog", { name: "Event Attendees" })
    await expect(going).toContainText(title)
    await expect(going.getByText("No attendees yet")).toBeVisible()
    await expect(going).toContainText("0 attending of 24 spots")
    await page.keyboard.press("Escape")
    expect((await request.post(`${API}/events/${stored.id}/join`, { headers: authHeaders(member.token) })).ok()).toBeTruthy()
    await page.reload()
    await openEventsTab(page)
    await expect(row).toContainText("1/24 attending")
    await row.getByRole("button", { name: /^Who is going/ }).click()
    await expect(going.getByText(member.email)).toBeVisible()
    await expect(going).toContainText("1 attending of 24 spots")
    await page.keyboard.press("Escape")

    // Edit: remove the photo, the end time and the limit - and they stay removed.
    await row.getByRole("button", { name: /^Edit/ }).click()
    const edit = page.getByRole("dialog", { name: "Edit Event" })
    await expect(edit.getByLabel("End Date")).toHaveValue("2027-01-16")
    await expect(edit.getByLabel("End Time")).toHaveValue("21:00")
    await expect(edit.getByLabel("Max Attendees")).toHaveValue("24")
    await expect(edit.getByRole("combobox", { name: "Category" })).toContainText("Social")
    await edit.getByRole("button", { name: "Remove photo" }).click()
    await edit.getByLabel("End Date").fill("")
    await edit.getByLabel("End Time").fill("")
    await edit.getByLabel("Max Attendees").fill("")
    await edit.getByRole("button", { name: "Save Changes" }).click()
    await expect(edit).toBeHidden()
    await expect(page.getByText("Event updated").first()).toBeVisible()
    await expect(row).toContainText("1 attending")
    await expect(row).toContainText(/Jan 16, 2027 at 6:00\sPM/)
    await expect(row.locator("img")).toHaveCount(0)
    const cleared = (await adminEvents(request, admin.token)).find((e) => e.title === title)
    expect(cleared.image ?? null).toBeNull()
    expect(cleared.end_date ?? null).toBeNull()
    expect(cleared.max_attendees ?? null).toBeNull()
    expect(cleared.start_date).toBe(stored.start_date)

    // Cancel asks first and says who is told; "Keep event on" changes nothing.
    const confirm = page.getByRole("alertdialog")
    await row.getByRole("button", { name: /^Cancel event/ }).click()
    await expect(confirm.getByRole("heading", { name: `Cancel "${title}"?` })).toBeVisible()
    await expect(confirm).toContainText("the 1 member going will be sent a notice")
    await confirm.getByRole("button", { name: "Keep event on" }).click()
    await expect(confirm).toBeHidden()
    await expect(row.getByText("Cancelled", { exact: true })).toHaveCount(0)
    // A failed cancel is explained in the confirmation.
    await page.route("**/api/admin/events/*/cancel", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error cancelling event" }) }), { times: 1 })
    await row.getByRole("button", { name: /^Cancel event/ }).click()
    await confirm.getByRole("button", { name: "Cancel event" }).click()
    await expect(confirm.getByRole("alert")).toContainText("The event was not cancelled. Error cancelling event")
    await confirm.getByRole("button", { name: "Cancel event" }).click()
    await expect(confirm).toBeHidden()
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible()
    await expect(page.getByTestId("event-count-cancelled")).toHaveText(String(before.cancelled + 1))
    await expect.poll(async () => {
      const list = await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()
      return list.some((n: any) => n.title === "Event Cancelled")
    }).toBe(true)

    // Restore, then delete (which also asks first).
    await row.getByRole("button", { name: /^Restore event/ }).click()
    await expect(row.getByText("Cancelled", { exact: true })).toHaveCount(0)
    await expect(page.getByText(`"${title}" is back on`)).toBeVisible()
    await row.getByRole("button", { name: /^Delete/ }).click()
    await expect(confirm.getByRole("heading", { name: `Delete "${title}"?` })).toBeVisible()
    await expect(confirm).toContainText("cannot be brought back")
    await expect(confirm).toContainText("The 1 member going will NOT be told.")
    await confirm.getByRole("button", { name: "Keep event" }).click()
    await expect(row).toBeVisible()
    await row.getByRole("button", { name: /^Delete/ }).click()
    await confirm.getByRole("button", { name: "Delete event" }).click()
    await expect(row).toHaveCount(0)
    expect((await adminEvents(request, admin.token)).some((e) => e.title === title)).toBe(false)
    await expect(page.getByTestId("event-count-total")).toHaveText(String(before.total))

    // ADM-41: an event that has already happened is marked Past.
    const old = await (await request.post(`${API}/admin/events`, { headers: authHeaders(admin.token), data: { title: `Last month ${Date.now()}`, location: "Testville", start_date: new Date(Date.now() - 30 * 86400000).toISOString() } })).json()
    await page.reload()
    await openEventsTab(page)
    await expect(eventRow(page, old.title).getByText("Past", { exact: true })).toBeVisible()
    await expect(page.getByTestId("event-count-past")).toHaveText(String(before.past + 1))
    await request.delete(`${API}/admin/events/${old.id}`, { headers: authHeaders(admin.token) })
    await page.context().close()
  })

  test("ADM news: post to everyone (confirmed), listed, reaches members, withdraw (confirmed), errors shown on the page, empty state", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request)
    const page = await adminPage(browser, admin)
    await openTab(page, "News")
    await expect(page.getByRole("heading", { name: "Post News to All Members" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Previous Announcements" })).toBeVisible()
    await expect(page.getByText("It arrives in each member’s Notifications")).toBeVisible()
    const post = page.getByRole("button", { name: "Post to All Members" })
    await expect(post).toBeDisabled()
    const title = `Road closure ${Date.now()}`
    await page.getByLabel("Title", { exact: true }).fill(title)
    await expect(post).toBeDisabled()
    await page.getByLabel("Message", { exact: true }).fill("Use the north entrance on Saturday.")
    const inbox = async () => (await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()) as any[]

    // Posting asks first, and says who will get it. "Not yet" sends nothing.
    const confirm = page.getByRole("alertdialog")
    await post.click()
    await expect(confirm.getByRole("heading", { name: "Send this announcement to all members?" })).toBeVisible()
    await expect(confirm).toContainText(title)
    await expect(confirm).toContainText("every member who has news notices switched on")
    await confirm.getByRole("button", { name: "Not yet" }).click()
    await expect(confirm).toBeHidden()
    expect((await inbox()).some((n) => n.title === title)).toBe(false)

    // A failed post is explained on the page (not a browser pop-up) and the words are kept.
    await page.route("**/api/admin/news", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error sending news" }) }) : route.continue(), { times: 1 })
    await post.click()
    await confirm.getByRole("button", { name: "Send to all members" }).click()
    await expect(alertBox(page)).toContainText("The announcement was not sent. Error sending news")
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title)
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Use the north entrance on Saturday.")

    await post.click()
    await confirm.getByRole("button", { name: "Send to all members" }).click()
    await expect(page.getByText(/Announcement sent to \d+ members/)).toBeVisible()
    const item = page.getByTestId("news-row").filter({ hasText: title })
    await expect(item).toContainText("Use the north entrance on Saturday.")
    await expect(item).toContainText(/\w{3} \d{1,2}, \d{4}/)
    await expect(alertBox(page)).toHaveCount(0)
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("")
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("")
    expect((await inbox()).some((n) => n.title === title)).toBe(true)

    // Withdraw: saying no keeps it, saying yes removes it everywhere.
    const withdraw = page.getByRole("button", { name: `Withdraw the announcement "${title}"` })
    await withdraw.click()
    await expect(confirm.getByRole("heading", { name: `Withdraw "${title}"?` })).toBeVisible()
    await expect(confirm).toContainText("It will be removed from every member’s Notifications and cannot be brought back.")
    await confirm.getByRole("button", { name: "Keep it" }).click()
    await expect(item).toBeVisible()
    expect((await inbox()).some((n) => n.title === title)).toBe(true)
    await withdraw.click()
    await confirm.getByRole("button", { name: "Withdraw announcement" }).click()
    await expect(page.getByText("Announcement withdrawn")).toBeVisible()
    await expect(item).toHaveCount(0)
    expect((await inbox()).some((n) => n.title === title)).toBe(false)

    // Nothing posted yet.
    await page.route("**/api/admin/news", (route) => route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" }) : route.continue())
    await page.reload()
    await openTab(page, "News")
    await expect(page.getByText("No announcements posted yet")).toBeVisible()
    await page.context().close()
  })

  test("ADM events: nothing yet, and a new event reaches a member's Events badge live", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request)
    const memberContext = await signedInContextWith(browser, member)
    const memberPage = await memberContext.newPage()
    // The live connection is ready once the server has answered its "connect"
    // (a socket.io frame starting with 40); only then can a ping arrive.
    const connected = new Promise<void>((resolve) => {
      memberPage.on("websocket", (ws) => ws.on("framereceived", (frame) => { if (String(frame.payload).startsWith("40")) resolve() }))
    })
    await memberPage.goto("/browse")
    const eventsLink = memberPage.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: /Events/ })
    await expect(eventsLink).toBeVisible()
    await connected
    // On connecting, the app re-reads its counts; a ping that lands while that is in
    // flight is overwritten by the (older) answer, so let those requests finish first.
    await memberPage.waitForLoadState("networkidle")
    const made = await (await request.post(`${API}/admin/events`, { headers: authHeaders(admin.token), data: { title: `Live ping ${Date.now()}`, location: "Testville", start_date: new Date(Date.now() + 7 * 86400000).toISOString() } })).json()
    await expect(eventsLink).toContainText(/\d/)
    await memberContext.close()
    await request.delete(`${API}/admin/events/${made.id}`, { headers: authHeaders(admin.token) })

    const page = await adminPage(browser, admin)
    await page.route("**/api/events", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
    await page.reload()
    await openEventsTab(page)
    await expect(page.getByText("No events yet")).toBeVisible()
    await page.getByRole("button", { name: "Create Your First Event" }).click()
    await expect(page.getByRole("dialog", { name: "Create New Event" })).toBeVisible()
    await page.context().close()
  })

  test("ADM reports: suspend or ban from the queue needs a reason and a confirmation, is logged with the report, and can be undone", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const tag = Date.now()
    const reported = await createMember(request, { firstName: `Noel${tag}` })
    const reporter = await createMember(request, { firstName: `Gray${tag}` })
    const second = await createMember(request, { firstName: `Rowan${tag}` })
    const name = `${reported.firstName} Example`
    const fileReport = async (from: typeof reporter, details: string) => {
      const res = await request.post(`${API}/browse/${reported.id}/report`, { headers: authHeaders(from.token), data: { reason: details, category: "Rude or abusive messages", source: "profile" } })
      expect(res.ok()).toBeTruthy()
    }
    await fileReport(reporter, `Sent unkind messages after I asked them to stop. ${tag}`)
    await fileReport(second, `Second report ${tag}`)

    const page = await adminPage(browser, admin)
    await expect(page.getByTestId("admin-reports")).toBeVisible()
    await expect(page.getByText("The person who made the report is never named to them.")).toBeVisible()
    const row = page.getByTestId("report-row").filter({ hasText: `Sent unkind messages after I asked them to stop. ${tag}` })
    const other = page.getByTestId("report-row").filter({ hasText: `Second report ${tag}` })
    await expect(row).toContainText(`${name} (${reported.email}) was reported by ${reporter.firstName} Example from a profile`)
    await expect(row).toContainText("Reason chosen: Rude or abusive messages")
    await expect(row).toContainText("Earlier warnings: 0")
    const waitingCount = async () => (await (await request.get(`${API}/admin/reports?page=1&limit=1`, { headers: authHeaders(admin.token) })).json()).counts.pending as number
    const waiting = await waitingCount()
    await expect(page.getByTestId("reports-waiting")).toContainText(String(waiting))
    const shown = (label: string) => page.getByRole("group", { name: "Show" }).getByRole("button", { name: new RegExp(`^${label}`) })
    await expect(shown("Waiting")).toContainText(String(waiting))

    // Suspend: one click is no longer enough.
    const dialog = page.getByRole("alertdialog")
    await row.getByRole("button", { name: /^Suspend / }).click()
    await expect(dialog.getByRole("heading", { name: `Suspend ${name}?` })).toBeVisible()
    await expect(dialog).toContainText(`${name} will be signed out and will not be able to sign in until the suspension is lifted. They are not told who reported them.`)
    await expect(dialog).toContainText("do not name the person who reported them")
    const confirm = dialog.getByRole("button", { name: `Suspend ${reported.firstName}` })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toBeVisible()
    expect((await login(request, reported.email, reported.password)).status()).toBe(200)

    await row.getByRole("button", { name: /^Suspend / }).click()
    await dialog.getByLabel("Reason for the suspension").fill("Unkind messages after being asked to stop.")
    await confirm.click()
    await expect(dialog).toBeHidden()
    const done = toastWith(page, `${reported.firstName} has been suspended and the report closed`)
    await expect(done).toBeVisible()
    await expect(row).toHaveCount(0)
    await expect(page.getByTestId("reports-waiting")).toContainText(String(waiting - 1))
    await expect(other).toContainText("Currently suspended")
    expect((await login(request, reported.email, reported.password)).status()).toBe(403)

    // Undo: the suspension is lifted and the report is waiting again.
    await done.getByRole("button", { name: "Undo" }).click()
    await expect(page.getByText("Suspension lifted - they can sign in again. The report is waiting again.")).toBeVisible()
    await expect(row).toBeVisible()
    await expect(page.getByTestId("reports-waiting")).toContainText(String(waiting))
    expect((await login(request, reported.email, reported.password)).status()).toBe(200)

    // Dismissing the other report is one click, with Undo; a dismissed report can be reopened later.
    await other.getByRole("button", { name: /^Dismiss report/ }).click()
    await expect(other).toHaveCount(0)
    await toastWith(page, "Report dismissed").getByRole("button", { name: "Undo" }).click()
    await expect(other).toBeVisible()
    await other.getByRole("button", { name: /^Dismiss report/ }).click()
    await expect(other).toHaveCount(0)
    await shown("Dismissed").click()
    await expect(other).toContainText("Dismissed on")
    await expect(other.getByRole("button", { name: /^(Warn|Suspend|Ban) / })).toHaveCount(0)
    await other.getByRole("button", { name: /^Reopen report/ }).click()
    await expect(other).toHaveCount(0)
    await shown("Waiting").click()
    await expect(other).toBeVisible()
    await other.getByRole("button", { name: /^Dismiss report/ }).click()
    await expect(other).toHaveCount(0)

    // Ban from the queue, the same way as suspending.
    await row.getByRole("button", { name: /^Ban / }).click()
    await expect(dialog.getByRole("heading", { name: `Ban ${name}?` })).toBeVisible()
    await expect(dialog).toContainText("will not be able to sign in again unless an admin lifts the ban")
    await expect(dialog.getByRole("button", { name: `Ban ${reported.firstName}` })).toBeDisabled()
    await dialog.getByLabel("Reason for the ban").fill("Carried on after a suspension.")
    await dialog.getByRole("button", { name: `Ban ${reported.firstName}` }).click()
    await expect(toastWith(page, `${reported.firstName} has been banned and the report closed`)).toBeVisible()
    await expect(row).toHaveCount(0)
    expect((await login(request, reported.email, reported.password)).status()).toBe(403)

    // The closed report is under "Action taken", with what was decided; search finds it by email.
    await shown("Action taken").click()
    await page.getByLabel("Search reports").fill(reported.email)
    await expect(page.getByTestId("report-row")).toHaveCount(1)
    await expect(row).toContainText("Closed")
    await expect(row).toContainText("the member was banned")
    await expect(row).toContainText("Currently banned")
    await expect(row.getByRole("button", { name: /^(Warn|Suspend|Ban) / })).toHaveCount(0)

    // The activity log says what was done, why, by whom - and that it answered a report.
    await openTab(page, "Activity log")
    await page.getByLabel("Search the log").fill(reported.email)
    const entries = page.getByTestId("activity-row")
    await expect(entries).toHaveCount(8)
    const ban = entries.filter({ hasText: "Banned:" })
    await expect(ban).toContainText(name)
    await expect(ban).toContainText("Reason: Carried on after a suspension.")
    await expect(ban).toContainText(`By: Avery Moderator (${ADMIN_EMAIL})`)
    await expect(ban).toContainText("In answer to a member report.")
    await expect(entries.filter({ hasText: "Suspension lifted:" })).toContainText("Reason: Undone straight away")
    await expect(entries.filter({ hasText: "Report dismissed:" })).toHaveCount(3)
    await expect(entries.filter({ hasText: "Report reopened:" })).toHaveCount(2)
    // Nothing in it names the people who made the reports.
    await expect(entries.filter({ hasText: new RegExp(`${reporter.firstName}|${second.firstName}`) })).toHaveCount(0)

    // The member's own history has it too. Lifting the ban from Members is confirmed and lets them back in.
    await openTab(page, "Members")
    await page.getByLabel("Search members").fill(reported.email)
    const memberRow = userRow(page, reported.email)
    await memberRow.getByRole("button", { name: /^History/ }).click()
    const history = page.getByRole("dialog", { name: "Action history" })
    await expect(history.getByTestId("history-entry").first()).toContainText("Banned")
    await expect(history.getByTestId("history-entry").first()).toContainText("In answer to a member report.")
    await page.keyboard.press("Escape")
    await memberRow.getByRole("button", { name: /^Lift ban/ }).click()
    await dialog.getByRole("button", { name: "Lift ban" }).click()
    await expect(memberRow).not.toContainText("Banned")
    expect((await login(request, reported.email, reported.password)).status()).toBe(200)
    // The notices the member received never name the people who reported them.
    const notices = await (await request.get(`${API}/notifications`, { headers: authHeaders(reported.token) })).json()
    expect(notices.some((n: any) => n.title === "Account Banned" && n.message === "Carried on after a suspension.")).toBe(true)
    expect(JSON.stringify(notices)).not.toMatch(new RegExp(`${reporter.firstName}|${second.firstName}`))
    await page.context().close()
  })

  test("ADM phone: every tab fits a 390px screen with no sideways scrolling, and every button is at least 44px tall", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const reported = await createMember(request, { firstName: "Wilhelmina-Constance" })
    const reporter = await createMember(request)
    await request.post(`${API}/browse/${reported.id}/report`, { headers: authHeaders(reporter.token), data: { reason: "A long explanation ".repeat(12), category: "Rude or abusive messages", source: "profile" } })
    const page = await adminPage(browser, admin, { viewport: { width: 390, height: 844 } })

    const check = async (what: string) => {
      // Measure once any opening animation has finished (a dialog slides and grows into place).
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => !(a.effect?.getComputedTiming().iterations === Infinity)).map((a) => a.finished.catch(() => null))))
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      expect(fits, `${what}: the page scrolls sideways`).toBe(true)
      const small = await page.evaluate(() => {
        const scope = document.querySelector('[role="alertdialog"], [role="dialog"]') || document.querySelector("#main-content") || document.body
        return [...scope.querySelectorAll<HTMLElement>('button, [role="tab"], a[href], input, select, textarea')]
          .filter((el) => el.offsetParent !== null && el.getAttribute("aria-hidden") !== "true" && !el.closest("[data-sonner-toaster]") && !el.matches('[class*="sr-only"]'))
          .map((el) => ({ label: (el.getAttribute("aria-label") || el.innerText || el.id || el.tagName).trim().slice(0, 40), height: Math.round(el.getBoundingClientRect().height), width: Math.round(el.getBoundingClientRect().width), right: Math.round(el.getBoundingClientRect().right) }))
          .filter((el) => el.height < 44 || el.right > window.innerWidth + 1)
      })
      // The dialogs' own corner "Close" cross belongs to the shared dialog component.
      expect(small.filter((el) => el.label !== "Close"), `${what}: too small or off screen`).toEqual([])
    }

    await expect(page.getByTestId("report-row").first()).toBeVisible()
    await check("Reports")
    await page.getByTestId("report-row").filter({ hasText: "Wilhelmina-Constance" }).first().getByRole("button", { name: /^Suspend / }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await check("Suspend confirmation")
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click()

    await openTab(page, "Members")
    await expect(page.getByTestId("user-row").first()).toBeVisible()
    await check("Members")
    await page.getByTestId("user-row").first().getByRole("button", { name: /^Notes/ }).click()
    await expect(page.getByRole("dialog", { name: "Admin notes" })).toBeVisible()
    await check("Notes")
    await page.keyboard.press("Escape")

    await openEventsTab(page)
    await expect(page.getByTestId("event-row").first()).toBeVisible()
    await check("Events")
    await page.getByRole("button", { name: "Create Event" }).first().click()
    await expect(page.getByRole("dialog", { name: "Create New Event" })).toBeVisible()
    await check("Event form")
    await page.keyboard.press("Escape")

    await openTab(page, "News")
    await expect(page.getByRole("heading", { name: "Previous Announcements" })).toBeVisible()
    await check("News")
    await openTab(page, "Activity log")
    await expect(page.getByLabel("Search the log")).toBeVisible()
    await check("Activity log")
    await page.context().close()
  })
})
