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
