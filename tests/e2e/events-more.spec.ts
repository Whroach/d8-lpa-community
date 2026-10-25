import { test, expect, type APIRequestContext, type Page } from "@playwright/test"
import { API, ADMIN_EMAIL, DEMO_PASSWORD, authHeaders, createMember, loginApi, runTag, signedInPage, type Member } from "./helpers"

const DAY = 86400000

async function adminToken(request: APIRequestContext) {
  return (await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)).token
}

async function createEvent(request: APIRequestContext, token: string, data: Record<string, unknown>) {
  const res = await request.post(`${API}/admin/events`, {
    headers: authHeaders(token),
    data: { description: "A made-up event for a test.", location: "Test Hall, Testville", category: "social", ...data },
  })
  expect(res.status()).toBe(201)
  return String((await res.json()).id)
}

const card = (page: Page, title: string) => page.getByTestId("event-card").filter({ hasText: title })
const search = (page: Page) => page.getByRole("textbox", { name: "Search events by name or place" })
const unread = async (request: APIRequestContext, member: Member) =>
  ((await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()) as any[]).filter((n) => !n.read)

/** "2026-11-07" for a local calendar day `days` from today, in `timeZone`. */
const dayIn = (timeZone: string, days: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + days * DAY))

test.describe("Events list", () => {
  test("EVT-03/04/05/13/19/20/23: upcoming and past tabs, search by name or place, card details", async ({ browser, request }) => {
    const tag = runTag()
    const token = await adminToken(request)
    const me = await createMember(request)
    const soonId = await createEvent(request, token, {
      title: `Harvest Supper ${tag}`, location: `Grange Hall ${tag}, Tulsa`, start_date: new Date(Date.now() + 5 * DAY).toISOString(), max_attendees: 40,
    })
    await createEvent(request, token, { title: `Spring Picnic ${tag}`, location: "Riverside Park", start_date: new Date(Date.now() - 20 * DAY).toISOString() })
    await request.post(`${API}/events/${soonId}/join`, { headers: authHeaders(me.token) })

    const page = await signedInPage(browser, me, "/events")
    await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible()
    await expect(page.getByRole("button", { name: "Upcoming Events" })).toHaveAttribute("aria-pressed", "true")
    const soon = card(page, `Harvest Supper ${tag}`)
    await expect(soon).toContainText("social")
    await expect(soon).toContainText("You're going")
    await expect(soon).toContainText("1 / 40 attending")
    await expect(soon).toContainText(`Grange Hall ${tag}, Tulsa`)
    await expect(card(page, `Spring Picnic ${tag}`)).toHaveCount(0)

    // Search matches the name or the place.
    await search(page).fill(`grange hall ${tag}`)
    await expect(page.getByTestId("event-card")).toHaveCount(1)
    await search(page).fill(`harvest supper ${tag}`)
    await expect(page.getByTestId("event-card")).toHaveCount(1)
    await search(page).fill(`nothing-${tag}`)
    await expect(page.getByText("No events found")).toBeVisible()
    await expect(page.getByText(`No events match "nothing-${tag}"`)).toBeVisible()
    await search(page).fill(tag)

    await page.getByRole("button", { name: "Past Events" }).click()
    await expect(page.getByRole("button", { name: "Past Events" })).toHaveAttribute("aria-pressed", "true")
    await expect(card(page, `Harvest Supper ${tag}`)).toHaveCount(0)
    await card(page, `Spring Picnic ${tag}`).getByRole("button").click()
    const dialog = page.getByRole("dialog", { name: `Spring Picnic ${tag}` })
    await expect(dialog.getByText("This event has already taken place.")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "I'm going" })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Upcoming Events" }).click()
    await expect(soon).toBeVisible()
    await page.context().close()
  })

  test("EVT-06/07/10/11/12: kind-of-event filter, its count and chip, Clear all, and the no-match state", async ({ browser, request }) => {
    const tag = runTag()
    const token = await adminToken(request)
    const me = await createMember(request)
    await createEvent(request, token, { title: `Regional Meet ${tag}`, category: "regional", start_date: new Date(Date.now() + 8 * DAY).toISOString() })
    await createEvent(request, token, { title: `Potluck ${tag}`, category: "food", start_date: new Date(Date.now() + 9 * DAY).toISOString() })
    const page = await signedInPage(browser, me, "/events")
    await search(page).fill(tag)
    await expect(page.getByTestId("event-card")).toHaveCount(2)

    const filters = page.getByRole("button", { name: /^Filters/ })
    await filters.click()
    await page.getByRole("combobox", { name: "Kind of event" }).click()
    await page.getByRole("option", { name: "Regional" }).click()
    // Filters apply straight away; "Show events" just closes the panel.
    await expect(page.getByTestId("event-card")).toHaveCount(1)
    await page.getByRole("button", { name: "Show events" }).click()
    await expect(page.getByRole("combobox", { name: "Kind of event" })).toBeHidden()
    await expect(card(page, `Regional Meet ${tag}`)).toBeVisible()
    await expect(filters).toContainText("1")
    await expect(page.getByTestId("filter-chip")).toHaveText(["Regional"])

    await page.getByRole("button", { name: "Remove filter: Regional" }).click()
    await expect(page.getByTestId("event-card")).toHaveCount(2)
    await expect(page.getByTestId("filter-chip")).toHaveCount(0)

    await filters.click()
    await page.getByRole("combobox", { name: "Kind of event" }).click()
    await page.getByRole("option", { name: "National" }).click()
    await page.keyboard.press("Escape")
    await expect(page.getByText("No events found")).toBeVisible() // a search is active
    await search(page).fill("")
    await filters.click()
    await page.getByRole("combobox", { name: "Kind of event" }).click()
    await page.getByRole("option", { name: "Arts" }).click()
    await page.keyboard.press("Escape")
    // (The seed has no Arts event.) The empty state explains and offers a way out.
    await expect(page.getByText("No events match your filters")).toBeVisible()
    await page.getByRole("button", { name: "Clear filters" }).click()
    await expect(page.getByTestId("event-card").first()).toBeVisible()

    await filters.click()
    await page.getByRole("combobox", { name: "Kind of event" }).click()
    await page.getByRole("option", { name: "Food" }).click()
    await page.getByRole("button", { name: "Clear all" }).click()
    await expect(page.getByTestId("filter-chip")).toHaveCount(0)
    await page.context().close()
  })

  for (const timezoneId of ["America/Chicago", "Pacific/Honolulu", "Asia/Tokyo"]) {
    test(`EVT-08/09/12/13: From and To include the chosen day, and times show on the member's own clock (${timezoneId})`, async ({ browser, request }) => {
      const tag = runTag()
      const token = await adminToken(request)
      const me = await createMember(request)
      // 8:15 in the evening on the member's own calendar day, ten days from now.
      const day = dayIn(timezoneId, 10)
      const probe = new Date(`${day}T20:15:00Z`)
      const offsetMinutes = Math.round(
        (new Date(probe.toLocaleString("en-US", { timeZone: timezoneId })).getTime() - new Date(probe.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 60000
      )
      const start = new Date(probe.getTime() - offsetMinutes * 60000)
      await createEvent(request, token, { title: `Evening Social ${tag}`, start_date: start.toISOString() })

      const page = await signedInPage(browser, me, "/events", { timezoneId, locale: "en-US" })
      await search(page).fill(tag)
      const wanted = card(page, `Evening Social ${tag}`)
      const expectedDate = start.toLocaleDateString("en-US", { timeZone: timezoneId, weekday: "short", month: "short", day: "numeric" })
      await expect(wanted).toContainText(expectedDate)
      await expect(wanted).toContainText("8:15 PM")

      const filters = page.getByRole("button", { name: /^Filters/ })
      const dayLabel = start.toLocaleDateString("en-US", { timeZone: timezoneId, weekday: "short", month: "short", day: "numeric", year: "numeric" })
      // From = the day of the event: included. The chip names that same day.
      await filters.click()
      await page.locator("#events-from").fill(day)
      await page.keyboard.press("Escape")
      await expect(wanted).toBeVisible()
      await expect(page.getByTestId("filter-chip")).toHaveText([`From: ${dayLabel}`])
      // To = the day of the event: still included, even late in the evening.
      await filters.click()
      await page.locator("#events-to").fill(day)
      await page.keyboard.press("Escape")
      await expect(wanted).toBeVisible()
      await expect(filters).toContainText("2")
      // To = the day before: left out.
      await filters.click()
      await page.locator("#events-from").fill("")
      await page.locator("#events-to").fill(dayIn(timezoneId, 9))
      await page.keyboard.press("Escape")
      await expect(wanted).toHaveCount(0)
      // From = the day after: left out.
      await filters.click()
      await page.locator("#events-to").fill("")
      await page.locator("#events-from").fill(dayIn(timezoneId, 11))
      await page.keyboard.press("Escape")
      await expect(wanted).toHaveCount(0)
      await page.getByRole("button", { name: /^Remove filter: From/ }).click()
      await expect(wanted).toBeVisible()

      // Quick choices.
      await filters.click()
      await page.getByRole("button", { name: "Next 7 days" }).click()
      await expect(page.locator("#events-from")).toHaveValue(dayIn(timezoneId, 0))
      await expect(page.locator("#events-to")).toHaveValue(dayIn(timezoneId, 7))
      await expect(wanted).toHaveCount(0)
      await page.getByRole("button", { name: "Next 30 days" }).click()
      await expect(wanted).toBeVisible()
      await page.getByRole("button", { name: "Any time" }).click()
      await expect(page.locator("#events-from")).toHaveValue("")
      await expect(page.locator("#events-to")).toHaveValue("")
      await page.context().close()
    })
  }
})

test.describe("Event details", () => {
  test("EVT-17/18: a full event and a cancelled event cannot be joined, and say why", async ({ browser, request }) => {
    const tag = runTag()
    const token = await adminToken(request)
    const me = await createMember(request)
    const early = await createMember(request)
    const fullId = await createEvent(request, token, { title: `Small Table ${tag}`, max_attendees: 1, start_date: new Date(Date.now() + 6 * DAY).toISOString() })
    const cancelledId = await createEvent(request, token, { title: `Rained Off ${tag}`, start_date: new Date(Date.now() + 6 * DAY).toISOString() })
    expect((await request.put(`${API}/admin/events/${cancelledId}/cancel`, { headers: authHeaders(token) })).ok()).toBeTruthy()

    const page = await signedInPage(browser, me, "/events")
    await search(page).fill(tag)
    await expect(card(page, `Rained Off ${tag}`)).toContainText("Cancelled")
    await card(page, `Rained Off ${tag}`).getByRole("button").click()
    let dialog = page.getByRole("dialog", { name: `Rained Off ${tag}` })
    await expect(dialog.getByText("This event has been cancelled.")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "I'm going" })).toHaveCount(0)
    await page.keyboard.press("Escape")

    await card(page, `Small Table ${tag}`).getByRole("button").click()
    dialog = page.getByRole("dialog", { name: `Small Table ${tag}` })
    await expect(dialog).toContainText("0 / 1 attending")
    // Someone else takes the last place while the details are open.
    await request.post(`${API}/events/${fullId}/join`, { headers: authHeaders(early.token) })
    await dialog.getByRole("button", { name: "I'm going" }).click()
    await expect(dialog.getByRole("alert")).toHaveText("Event is full")
    await expect(dialog.getByRole("button", { name: "I'm going" })).toBeVisible()
    // The message does not linger on the next event opened.
    await page.keyboard.press("Escape")
    await card(page, `Rained Off ${tag}`).getByRole("button").click()
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0)
    await page.context().close()
  })

  test("EVT-14: keyboard only - Enter opens the details, Escape closes them and focus returns to the card", async ({ browser, request }) => {
    const tag = runTag()
    const token = await adminToken(request)
    const me = await createMember(request)
    await createEvent(request, token, { title: `Card Night ${tag}`, start_date: new Date(Date.now() + 4 * DAY).toISOString() })
    const page = await signedInPage(browser, me, "/events")
    await search(page).fill(tag)
    const open = card(page, `Card Night ${tag}`).getByRole("button")
    await open.focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog", { name: `Card Night ${tag}` })
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "I'm going" }).focus()
    await page.keyboard.press("Enter")
    await expect(page.getByText(`You are going to Card Night ${tag}`)).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(open).toBeFocused()
    await expect(card(page, `Card Night ${tag}`)).toContainText("You're going")
    await page.context().close()
  })
})

test.describe("Events states", () => {
  test("EVT-21/22: nothing upcoming and nothing past", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/browse")
    await page.route("**/api/events", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
    await page.goto("/events")
    await expect(page.getByText("No upcoming events")).toBeVisible()
    await expect(page.getByText("Check back later for upcoming events")).toBeVisible()
    await page.getByRole("button", { name: "Past Events" }).click()
    await expect(page.getByText("No past events")).toBeVisible()
    await expect(page.getByText("Past events will appear here")).toBeVisible()
    await page.context().close()
  })

  test("EVT-01: a failed load says so; Try again shows the events", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/browse")
    let fail = true
    await page.route("**/api/events", (route) =>
      fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error fetching events" }) }) : route.fallback()
    )
    await page.goto("/events")
    await expect(page.getByRole("alert").filter({ hasText: "We could not load the events" })).toBeVisible()
    await expect(page.getByText("No upcoming events")).toHaveCount(0)
    fail = false
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(page.getByTestId("event-card").first()).toBeVisible()
    await page.context().close()
  })
})

test.describe("Event reminders and the Events badge", () => {
  test("REM/EVT-02: the day before, a reminder appears in Notifications and opens the event; visiting Events clears the Events badge", async ({ browser, request }) => {
    const tag = runTag()
    const token = await adminToken(request)
    const me = await createMember(request)
    const title = `Tomorrow Brunch ${tag}`
    const eventId = await createEvent(request, token, { title, location: `Sunny Cafe ${tag}`, start_date: new Date(Date.now() + DAY).toISOString() })
    // The "New Event!" notice is unread; nothing else yet.
    expect((await unread(request, me)).map((n) => n.title)).toEqual(["New Event!"])
    await request.post(`${API}/events/${eventId}/join`, { headers: authHeaders(me.token) })

    const page = await signedInPage(browser, me, "/notifications")
    const reminder = page.getByTestId("notification").filter({ hasText: title }).filter({ hasText: /^(?!.*New Event!)/ }).first()
    await expect(page.getByRole("heading", { name: new RegExp(`^(Today|Tomorrow): ${title}$`) })).toBeVisible()
    await expect(reminder).toContainText(`Sunny Cafe ${tag}. You said you are going.`)
    const nav = page.getByRole("navigation", { name: "Main" })
    await expect(nav.getByRole("link", { name: /Notifications/ })).toContainText("2")
    await expect(nav.getByRole("link", { name: /Events/ })).toContainText("2")

    // Reloading does not create a second reminder.
    await page.reload()
    await expect(page.getByRole("heading", { name: new RegExp(`^(Today|Tomorrow): ${title}$`) })).toHaveCount(1)

    await page
      .getByTestId("notification")
      .filter({ has: page.getByRole("heading", { name: new RegExp(`^(Today|Tomorrow): ${title}$`) }) })
      .getByRole("link", { name: "See the event" })
      .click()
    await expect(page).toHaveURL(new RegExp(`/events\\?event=${eventId}`))
    const dialog = page.getByRole("dialog", { name: title })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("button", { name: "I can't go" })).toBeVisible()

    // Being on Events marks the event notices as read and clears the Events badge.
    await expect.poll(async () => (await unread(request, me)).length).toBe(0)
    await page.keyboard.press("Escape")
    await expect(nav.getByRole("link", { name: /Events/ })).not.toContainText(/\d/)
    await page.context().close()
  })
})
