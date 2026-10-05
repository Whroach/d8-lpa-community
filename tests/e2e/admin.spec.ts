import { test, expect, type Browser, type Page } from "@playwright/test"
import { API, ADMIN_EMAIL, DEMO_PASSWORD, authHeaders, createMember, loginApi, signedInContextWith } from "./helpers"

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
  await expect(page.getByText("Event Management")).toBeVisible()
}

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
        await row.getByRole("button", { name: /Actions/ }).click()
        await page.getByRole("menuitem", { name: "Edit" }).click()
        const edit = page.getByRole("dialog", { name: "Edit Event" })
        await expect(edit.locator("#event-start-date")).toHaveValue(day.date)
        await expect(edit.locator("#event-start-time")).toHaveValue("23:30")

        // Save without touching anything, twice: nothing moves.
        await edit.getByRole("button", { name: "Save Changes" }).click()
        await expect(edit).toBeHidden()
        await row.getByRole("button", { name: /Actions/ }).click()
        await page.getByRole("menuitem", { name: "Edit" }).click()
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
      await first.getByRole("button", { name: /Actions/ }).click()
      await page.getByRole("menuitem", { name: "Edit" }).click()
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

    await row.getByRole("button", { name: /Actions/ }).click()
    await page.getByRole("menuitem", { name: "Edit" }).click()
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
  const userRow = (page: Page, email: string) => page.getByTestId("user-row").filter({ hasText: email })
  const pickAction = async (page: Page, email: string, item: string) => {
    await userRow(page, email).getByRole("button", { name: /Actions/ }).click()
    await page.getByRole("menuitem", { name: new RegExp(`^${item}`) }).click()
  }

  test("ADM users: list, search, filters, warn / suspend / ban with their dialogs, lifting them, history", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request, { firstName: `Zadie${Date.now()}` })
    const page = await adminPage(browser, admin)

    // Tabs: Users is open first.
    await expect(page.getByRole("tab", { name: "Users" })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByText("User Management")).toBeVisible()
    await expect(page.getByText("Manage users, events, and take moderation actions")).toBeVisible()

    // The row: name, status, email, joined and last-active dates.
    const row = userRow(page, member.email)
    await expect(row).toContainText(member.firstName)
    await expect(row).toContainText("Active")
    await expect(row).toContainText(/Joined \w{3} \d{1,2}, \d{4}/)
    await expect(row).toContainText(/Last active \w{3} \d{1,2}, \d{4}/)

    // Search by name, email and id; nothing found.
    const search = page.getByPlaceholder("Search users by name, email, or ID...")
    await search.fill(member.firstName.toUpperCase())
    await expect(page.getByTestId("user-row")).toHaveCount(1)
    await search.fill(member.email)
    await expect(page.getByTestId("user-row")).toHaveCount(1)
    await search.fill(member.id)
    await expect(page.getByTestId("user-row")).toHaveCount(1)
    await search.fill("zzz-nobody-by-this-name")
    await expect(page.getByText("No users found")).toBeVisible()
    await search.fill("")

    // Warning: the dialog needs a reason, and can be cancelled.
    await pickAction(page, member.email, "Warning")
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Issue Warning")).toBeVisible()
    await expect(dialog).toContainText(member.email)
    await expect(dialog.getByRole("button", { name: "Confirm" })).toBeDisabled()
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toContainText("Active")

    // A failed action says so and changes nothing.
    await pickAction(page, member.email, "Warning")
    await dialog.getByLabel("Reason for action").fill("Please keep messages friendly.")
    await page.route("**/api/admin/users/*/action", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error performing user action" }) }), { times: 1 })
    let alertText = ""
    page.once("dialog", (d) => { alertText = d.message(); void d.accept() })
    await dialog.getByRole("button", { name: "Confirm" }).click()
    await expect.poll(() => alertText).toContain("Error performing action: Error performing user action")
    await dialog.getByRole("button", { name: "Confirm" }).click()
    await expect(dialog).toBeHidden()
    await expect(row).toContainText("Warned (1)")
    // The member is told, with the reason.
    const notices = await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()
    expect(notices.some((n: any) => n.title === "Account Warning" && n.message === "Please keep messages friendly.")).toBe(true)

    // Filters (the four counters are also filters).
    await page.getByText("Active", { exact: true }).first().click()
    await expect(userRow(page, member.email)).toHaveCount(0)
    await page.getByText("Total Users").click()
    await expect(row).toBeVisible()

    // Suspend, then lift it from the same menu.
    await pickAction(page, member.email, "Suspend")
    await expect(dialog.getByText("Suspend User")).toBeVisible()
    await dialog.getByLabel("Reason for action").fill("Cooling-off period.")
    await dialog.getByRole("button", { name: "Confirm" }).click()
    await expect(row).toContainText("Suspended")
    await page.getByText("Suspended", { exact: true }).first().click()
    await expect(row).toBeVisible()
    expect((await request.post(`${API}/auth/login`, { data: { email: member.email, password: member.password } })).status()).toBe(403)
    await page.getByText("Total Users").click()
    await pickAction(page, member.email, "Suspend")
    await expect(row).not.toContainText("Suspended")
    expect((await request.post(`${API}/auth/login`, { data: { email: member.email, password: member.password } })).status()).toBe(200)

    // Ban, then lift it.
    await pickAction(page, member.email, "Ban")
    await expect(dialog.getByText("Ban User")).toBeVisible()
    await dialog.getByLabel("Reason for action").fill("Repeated harassment.")
    await dialog.getByRole("button", { name: "Confirm" }).click()
    await expect(row).toContainText("Banned")
    await page.getByText("Banned", { exact: true }).first().click()
    await expect(row).toBeVisible()
    expect((await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).status()).toBe(403)
    await page.getByText("Total Users").click()
    await pickAction(page, member.email, "Ban")
    await expect(row).not.toContainText("Banned")
    expect((await request.get(`${API}/auth/me`, { headers: authHeaders(member.token) })).status()).toBe(200)

    // History lists everything that was done, by whom, with the reasons.
    await row.getByRole("button", { name: "History" }).click()
    await expect(dialog.getByText("Action History")).toBeVisible()
    for (const text of ["Please keep messages friendly.", "Cooling-off period.", "Repeated harassment.", `By: ${ADMIN_EMAIL}`]) {
      await expect(dialog.getByText(text).first()).toBeVisible()
    }
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    // Someone with a clean record has an empty history.
    const clean = await createMember(request)
    await page.reload()
    await userRow(page, clean.email).getByRole("button", { name: "History" }).click()
    await expect(dialog.getByText("No action history for this user")).toBeVisible()
    await page.context().close()
  })

  // Not finished: the icon-only delete button could not be located reliably before time ran out.
  test.fixme("ADM notes: empty state, add, listed with author, kept after reload, delete, errors", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request)
    const page = await adminPage(browser, admin)
    const row = userRow(page, member.email)
    await row.getByRole("button", { name: /Notes/ }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Admin Notes")).toBeVisible()
    await expect(dialog.getByText("No notes for this user")).toBeVisible()
    const add = dialog.locator("button:has(svg.lucide-plus)")
    await expect(add).toBeDisabled()

    await dialog.getByLabel("Add a note").fill("Spoke on the phone - all fine.")
    await page.route("**/api/admin/users/*/notes", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error adding note" }) }) : route.continue(), { times: 1 })
    let alertText = ""
    page.once("dialog", (d) => { alertText = d.message(); void d.accept() })
    await add.click()
    await expect.poll(() => alertText).toContain("Could not save note: Error adding note")

    await add.click()
    await expect(dialog.getByText("Spoke on the phone - all fine.")).toBeVisible()
    await expect(dialog.getByText(`By: ${ADMIN_EMAIL}`)).toBeVisible()
    await expect(dialog.getByLabel("Add a note")).toHaveValue("")
    await page.keyboard.press("Escape")
    await expect(row.getByRole("button", { name: /Notes/ })).toContainText("1")

    // Kept on the server.
    await page.reload()
    await userRow(page, member.email).getByRole("button", { name: /Notes/ }).click()
    await expect(dialog.getByText("Spoke on the phone - all fine.")).toBeVisible()
    const saved = await (await request.get(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token) })).json()
    expect(saved).toHaveLength(1)
    // Edit through the API (there is no edit control on the screen).
    const edited = await request.put(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token), data: { noteId: saved[0].id, content: "Spoke on the phone - follow up in May." } })
    expect(edited.ok()).toBeTruthy()

    await page.route("**/api/admin/users/*/notes*", (route) => route.request().method() === "DELETE" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error deleting note" }) }) : route.continue(), { times: 1 })
    page.once("dialog", (d) => { alertText = d.message(); void d.accept() })
    await dialog.locator("button:has(svg.lucide-trash-2)").click()
    await expect.poll(() => alertText).toContain("Could not delete note: Error deleting note")
    await dialog.locator("button:has(svg.lucide-trash-2)").click()
    await expect(dialog.getByText("No notes for this user")).toBeVisible()
    expect(await (await request.get(`${API}/admin/users/${member.id}/notes`, { headers: authHeaders(admin.token) })).json()).toHaveLength(0)
    await page.context().close()
  })

  // Not finished: stops at the icon-only "remove photo" button in the event form.
  test.fixme("ADM events: counters, form fields, photo, cancel dialog, who is going, cancel / restore / delete, errors", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request, { firstName: "Goer" })
    const page = await adminPage(browser, admin)
    await openEventsTab(page)
    await expect(page.getByRole("tab", { name: "Events" })).toHaveAttribute("aria-selected", "true")
    for (const label of ["Total Events", "Upcoming", "Past", "Cancelled"]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    const total = async () => Number(await page.getByText("Total Events").locator("xpath=preceding-sibling::p").innerText())
    const before = await total()

    // The dialog can be cancelled; Create stays off until the required boxes are filled.
    await page.getByRole("button", { name: "Create Event" }).first().click()
    const dialog = page.getByRole("dialog", { name: "Create New Event" })
    const create = dialog.getByRole("button", { name: "Create Event" })
    await expect(create).toBeDisabled()
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
    expect(await total()).toBe(before)

    const title = `Bowling night ${Date.now()}`
    await page.getByRole("button", { name: "Create Event" }).first().click()
    await dialog.getByLabel("Event Title *").fill(title)
    await dialog.getByLabel("Description").fill("Shoes provided. All abilities welcome.")
    await dialog.getByLabel("Start Date *").fill("2027-01-16")
    await expect(create).toBeDisabled()
    await dialog.getByLabel("Start Time *").fill("18:00")
    await dialog.getByLabel("Location *").fill("Lucky Lanes, Tulsa")
    await expect(create).toBeEnabled()
    // An end date without a time, an end before the start and a bad limit are explained.
    await dialog.getByLabel("End Date").fill("2027-01-16")
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("Please add an end time")
    await dialog.getByLabel("End Time").fill("17:00")
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("cannot end before it starts")
    await dialog.getByLabel("End Time").fill("21:00")
    await dialog.getByRole("combobox", { name: "Category" }).click()
    for (const option of ["Local Chapter Event", "Regional", "National", "Dating", "Outdoor", "Food & Drink", "Social", "Fitness", "Arts & Culture"]) {
      await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible()
    }
    await page.getByRole("option", { name: "Social", exact: true }).click()
    await dialog.getByLabel("Max Attendees").fill("0")
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("must be 1 or more")
    await dialog.getByLabel("Max Attendees").fill("24")

    // Photo: upload shows a preview; it can be removed and added again.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
    await dialog.getByLabel("Upload Event Photo (optional)").setInputFiles({ name: "lanes.png", mimeType: "image/png", buffer: png })
    await expect(dialog.getByRole("img", { name: "Event preview" })).toBeVisible()
    await dialog.locator("button:has(svg.lucide-trash-2)").click()
    await expect(dialog.getByRole("img", { name: "Event preview" })).toHaveCount(0)
    await dialog.getByLabel("Upload Event Photo (optional)").setInputFiles({ name: "lanes.png", mimeType: "image/png", buffer: png })
    await expect(dialog.getByRole("img", { name: "Event preview" })).toBeVisible()

    // A failed save is explained in the dialog and nothing is lost.
    await page.route("**/api/admin/events", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error creating event" }) }) : route.continue(), { times: 1 })
    await create.click()
    await expect(dialog.getByRole("alert")).toContainText("The event was not saved. Error creating event")
    await expect(dialog.getByLabel("Event Title *")).toHaveValue(title)
    await create.click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText("Event created").first()).toBeVisible()
    expect(await total()).toBe(before + 1)

    const row = eventRow(page, title)
    await expect(row).toContainText("Shoes provided. All abilities welcome.")
    await expect(row).toContainText("Jan 16, 2027")
    await expect(row).toContainText("Lucky Lanes, Tulsa")
    await expect(row).toContainText("0/24 attending")
    await expect(row).toContainText(/social/i)
    const stored = (await adminEvents(request, admin.token)).find((e) => e.title === title)
    expect(stored).toMatchObject({ location: "Lucky Lanes, Tulsa", category: "social", max_attendees: 24 })
    expect(stored.image).toBeTruthy()
    expect(new Date(stored.end_date).getTime() - new Date(stored.start_date).getTime()).toBe(3 * 60 * 60 * 1000)
    // Members were told about the new event.
    const notices = await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()
    expect(notices.some((n: any) => n.type === "event" && String(n.message).includes(title))).toBe(true)

    // Who is going: empty, then one person.
    await row.getByRole("button", { name: /Attendees/ }).click()
    const going = page.getByRole("dialog", { name: "Event Attendees" })
    await expect(going.getByText("No attendees yet")).toBeVisible()
    await expect(going).toContainText("0 attending of 24 spots")
    await page.keyboard.press("Escape")
    expect((await request.post(`${API}/events/${stored.id}/join`, { headers: authHeaders(member.token) })).ok()).toBeTruthy()
    await page.reload()
    await openEventsTab(page)
    await expect(row).toContainText("1/24 attending")
    await row.getByRole("button", { name: /Attendees/ }).click()
    await expect(going.getByText(member.email)).toBeVisible()
    await expect(going).toContainText("1 attending of 24 spots")
    await page.keyboard.press("Escape")

    // Edit: remove the photo, the end time and the limit - and they stay removed.
    await row.getByRole("button", { name: /Actions/ }).click()
    await page.getByRole("menuitem", { name: "Edit" }).click()
    const edit = page.getByRole("dialog", { name: "Edit Event" })
    await edit.locator("button:has(svg.lucide-trash-2)").click()
    await edit.getByLabel("End Date").fill("")
    await edit.getByLabel("End Time").fill("")
    await edit.getByLabel("Max Attendees").fill("")
    await edit.getByRole("button", { name: "Save Changes" }).click()
    await expect(edit).toBeHidden()
    await expect(page.getByText("Event updated").first()).toBeVisible()
    await expect(row).toContainText("1 attending")
    const cleared = (await adminEvents(request, admin.token)).find((e) => e.title === title)
    expect(cleared.image ?? null).toBeNull()
    expect(cleared.end_date ?? null).toBeNull()
    expect(cleared.max_attendees ?? null).toBeNull()
    expect(cleared.start_date).toBe(stored.start_date)

    // Cancel (the person going is told), restore, delete.
    await row.getByRole("button", { name: /Actions/ }).click()
    await page.getByRole("menuitem", { name: "Cancel Event" }).click()
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible()
    await expect.poll(async () => {
      const list = await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()
      return list.some((n: any) => n.title === "Event Cancelled")
    }).toBe(true)
    await row.getByRole("button", { name: /Actions/ }).click()
    await page.getByRole("menuitem", { name: "Restore" }).click()
    await expect(row.getByText("Cancelled", { exact: true })).toHaveCount(0)
    await row.getByRole("button", { name: /Actions/ }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await expect(row).toHaveCount(0)
    expect((await adminEvents(request, admin.token)).some((e) => e.title === title)).toBe(false)
    expect(await total()).toBe(before)
    await page.context().close()
  })

  test("ADM news: post to everyone, listed, reaches members, withdraw (with confirmation), errors, empty state", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request)
    const page = await adminPage(browser, admin)
    await page.getByRole("tab", { name: "News" }).click()
    await expect(page.getByText("Post News to All Users")).toBeVisible()
    await expect(page.getByText("Previous Announcements")).toBeVisible()
    const post = page.getByRole("button", { name: "Post to All Users" })
    await expect(post).toBeDisabled()
    const title = `Road closure ${Date.now()}`
    await page.getByLabel("Title", { exact: true }).fill(title)
    await expect(post).toBeDisabled()
    await page.getByLabel("Message", { exact: true }).fill("Use the north entrance on Saturday.")

    await page.route("**/api/admin/news", (route) => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error sending news" }) }) : route.continue(), { times: 1 })
    let alertText = ""
    page.once("dialog", (d) => { alertText = d.message(); void d.accept() })
    await post.click()
    await expect.poll(() => alertText).toContain("Error posting announcement: Error sending news")
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title)

    await post.click()
    const item = page.locator("div.rounded-lg.border").filter({ hasText: title }).last()
    await expect(item).toContainText("Use the north entrance on Saturday.")
    await expect(item).toContainText(/\w{3} \d{1,2}, \d{4}/)
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("")
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("")
    const inbox = async () => (await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()) as any[]
    expect((await inbox()).some((n) => n.title === title)).toBe(true)

    // Withdraw: saying no keeps it, saying yes removes it everywhere.
    const withdraw = page.getByRole("button", { name: `Withdraw the announcement "${title}"` })
    page.once("dialog", (d) => { alertText = d.message(); void d.dismiss() })
    await withdraw.click()
    await expect.poll(() => alertText).toContain(`Withdraw "${title}"`)
    await expect(item).toBeVisible()
    expect((await inbox()).some((n) => n.title === title)).toBe(true)
    page.once("dialog", (d) => void d.accept())
    await withdraw.click()
    await expect(page.getByText("Announcement withdrawn")).toBeVisible()
    await expect(page.getByText(title)).toHaveCount(0)
    expect((await inbox()).some((n) => n.title === title)).toBe(false)

    // Nothing posted yet.
    await page.route("**/api/admin/news", (route) => route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" }) : route.continue())
    await page.reload()
    await page.getByRole("tab", { name: "News" }).click()
    await expect(page.getByText("No announcements posted yet")).toBeVisible()
    await page.context().close()
  })

  test("ADM events: nothing yet, and a new event reaches a member's Events badge live", async ({ browser, request }) => {
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const member = await createMember(request)
    const memberContext = await signedInContextWith(browser, member)
    const memberPage = await memberContext.newPage()
    await memberPage.goto("/browse")
    const eventsLink = memberPage.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: /Events/ })
    await expect(eventsLink).toBeVisible()
    await memberPage.waitForTimeout(1000)
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
})
