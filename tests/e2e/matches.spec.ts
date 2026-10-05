import { test, expect, type APIRequestContext } from "@playwright/test"
import { API, ADMIN_EMAIL, DEMO_PASSWORD, authHeaders, createMember, loginApi, matchMembers, signedInPage, type Member } from "./helpers"

const getMatches = async (request: APIRequestContext, member: Member) =>
  (await (await request.get(`${API}/matches`, { headers: authHeaders(member.token) })).json()) as { active: any[]; inactive: any[] }
const getLiked = async (request: APIRequestContext, member: Member) =>
  (await (await request.get(`${API}/browse/liked`, { headers: authHeaders(member.token) })).json()) as any[]

test.describe("Matches page", () => {
  test("MAT-23/24/29: a new member sees the three empty states, each with a way forward", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/matches")
    await expect(page.getByRole("heading", { name: "Matches & Likes", level: 1 })).toBeVisible()
    await expect(page.getByText("0 active matches • 0 profiles you liked")).toBeVisible()
    await expect(page.getByText("No matches yet")).toBeVisible()
    await expect(page.getByRole("link", { name: "Start Browsing" })).toHaveAttribute("href", "/browse")

    await page.getByRole("button", { name: "History (0)" }).click()
    await expect(page.getByRole("button", { name: "History (0)" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByText("No match history")).toBeVisible()
    await page.getByRole("button", { name: "Active Matches (0)" }).click()
    await expect(page.getByText("No matches yet")).toBeVisible()

    await page.getByRole("tab", { name: "Profiles You Liked" }).click()
    await expect(page.getByText("No likes yet")).toBeVisible()
    await page.getByRole("link", { name: "Browse Profiles" }).click()
    await expect(page).toHaveURL(/\/browse$/)
    await page.context().close()
  })

  test("MAT-05/06/09/10/11/25: search, sort and the card links", async ({ browser, request }) => {
    const me = await createMember(request)
    const zed = await createMember(request, { firstName: "Zed" })
    const abe = await createMember(request, { firstName: "Abe" })
    await matchMembers(request, me, abe)
    const zedMatch = await matchMembers(request, me, zed) // most recent
    const page = await signedInPage(browser, me, "/matches")
    const cards = page.getByTestId("match-card")
    await expect(cards).toHaveCount(2)
    await expect(page.getByText("2 active matches")).toBeVisible()
    // Most recent first, with age, an opener line and when they matched.
    await expect(cards.first()).toContainText("Zed, 5")
    await expect(cards.first()).toContainText("Start a conversation!")
    await expect(cards.first()).toContainText("Matched today")

    await page.getByRole("combobox", { name: "Sort matches" }).click()
    await page.getByRole("option", { name: "Alphabetical" }).click()
    await expect(cards.first()).toContainText("Abe")
    await page.getByRole("combobox", { name: "Sort matches" }).click()
    await page.getByRole("option", { name: "Most Recent" }).click()
    await expect(cards.first()).toContainText("Zed")

    const search = page.getByRole("textbox", { name: "Search matches by first name" })
    await search.fill("ab")
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText("Abe")
    await search.fill("nobody-here")
    await expect(page.getByText("No results found")).toBeVisible()
    await expect(page.getByText('No matches found for "nobody-here"')).toBeVisible()
    await search.fill("")
    await expect(cards).toHaveCount(2)

    const zedCard = cards.filter({ hasText: "Zed" })
    await expect(zedCard.getByRole("link", { name: "Profile" })).toHaveAttribute("href", `/profile/${zed.id}`)
    await expect(zedCard.getByRole("link", { name: "Message" })).toHaveAttribute("href", `/messages?match=${zedMatch}`)
    await zedCard.getByRole("link", { name: "Message" }).click()
    await expect(page).toHaveURL(new RegExp(`/messages\\?match=${zedMatch}`))
    await expect(page.getByRole("heading", { name: "Zed" })).toBeVisible()
    await page.goBack()
    await page.getByTestId("match-card").filter({ hasText: "Zed" }).getByRole("link", { name: "Profile" }).click()
    await expect(page.getByRole("heading", { name: "Zed", level: 1 })).toBeVisible()
    await page.context().close()
  })

  test("MAT-13/14/07/08/12: Unmatch asks first; Keep match changes nothing; Unmatch moves the card to History", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Quinn" })
    const matchId = await matchMembers(request, me, other)
    const page = await signedInPage(browser, me, "/matches")
    const card = page.getByTestId("match-card").filter({ hasText: "Quinn" })

    await card.getByRole("button", { name: "Options for Quinn" }).click()
    await page.getByRole("menuitem", { name: "Unmatch" }).click()
    const dialog = page.getByRole("dialog", { name: "Unmatch with Quinn?" })
    await expect(dialog).toContainText("You can still read your past messages under History")
    await dialog.getByRole("button", { name: "Keep match" }).click()
    await expect(dialog).toBeHidden()
    await expect(card).toBeVisible()
    expect((await getMatches(request, me)).active).toHaveLength(1)

    // Escape also keeps the match.
    await card.getByRole("button", { name: "Options for Quinn" }).click()
    await page.getByRole("menuitem", { name: "Unmatch" }).click()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    expect((await getMatches(request, me)).active).toHaveLength(1)

    // A server failure is shown inside the dialog and nothing changes.
    await page.route("**/api/matches/*", (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error unmatching" }) })
        : route.fallback()
    )
    await card.getByRole("button", { name: "Options for Quinn" }).click()
    await page.getByRole("menuitem", { name: "Unmatch" }).click()
    await dialog.getByRole("button", { name: "Unmatch" }).click()
    await expect(dialog.getByRole("alert")).toContainText("Error unmatching")
    await page.unroute("**/api/matches/*")

    await dialog.getByRole("button", { name: "Unmatch" }).click()
    await expect(page.getByText("You are no longer matched with Quinn")).toBeVisible()
    await expect(page.getByText("No matches yet")).toBeVisible()
    await expect(page.getByRole("button", { name: "History (1)" })).toBeVisible()
    const after = await getMatches(request, me)
    expect(after.active).toHaveLength(0)
    expect(after.inactive.map((m) => String(m.id))).toEqual([matchId])

    await page.getByRole("button", { name: "History (1)" }).click()
    const old = page.getByTestId("match-card").filter({ hasText: "Quinn" })
    await expect(old).toBeVisible()
    // History cards offer the old chat (read-only) and no Unmatch.
    await old.getByRole("button", { name: "Options for Quinn" }).click()
    await expect(page.getByRole("menuitem", { name: "Unmatch" })).toHaveCount(0)
    await expect(page.getByRole("menuitem", { name: "Block" })).toBeVisible()
    await page.keyboard.press("Escape")
    await old.getByRole("link", { name: "View Chat" }).click()
    await expect(page).toHaveURL(new RegExp(`/messages\\?match=${matchId}`))
    await page.context().close()
  })

  test("MAT-04/26/27/28: liked profiles; Remove like asks first and then really removes it", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Robin" })
    await request.post(`${API}/browse/${other.id}/like`, { headers: authHeaders(me.token) })
    const page = await signedInPage(browser, me, "/matches")
    await expect(page.getByText("0 active matches • 1 profile you liked")).toBeVisible()
    await page.getByRole("tab", { name: "Profiles You Liked" }).click()
    const card = page.getByTestId("liked-card").filter({ hasText: "Robin" })
    await expect(card).toContainText("Liked")
    await expect(card).toContainText("Robin, 5")
    await expect(card).toContainText("A fictional member created by an automated test.")
    await expect(card).toContainText("Liked today")
    await expect(card.getByRole("link", { name: "Profile" })).toHaveAttribute("href", `/profile/${other.id}`)

    await card.getByRole("button", { name: "Remove like for Robin" }).click()
    const dialog = page.getByRole("dialog", { name: "Remove your like for Robin?" })
    await expect(dialog).toContainText("Robin will not be told")
    await dialog.getByRole("button", { name: "Keep like" }).click()
    await expect(card).toBeVisible()
    expect(await getLiked(request, me)).toHaveLength(1)

    await card.getByRole("button", { name: "Remove like for Robin" }).click()
    await dialog.getByRole("button", { name: "Remove like" }).click()
    await expect(page.getByText("You no longer like Robin")).toBeVisible()
    await expect(page.getByText("No likes yet")).toBeVisible()
    expect(await getLiked(request, me)).toHaveLength(0)
    await page.context().close()
  })

  test("MAT-28: removing a like for someone I am matched with also ends the match", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Sage" })
    await matchMembers(request, me, other)
    const page = await signedInPage(browser, me, "/matches")
    await page.getByRole("tab", { name: "Profiles You Liked" }).click()
    await page.getByRole("button", { name: "Remove like for Sage" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Remove like" }).click()
    await expect(page.getByText("You no longer like Sage")).toBeVisible()
    await page.getByRole("tab", { name: "Matches" }).click()
    await expect(page.getByRole("button", { name: "History (1)" })).toBeVisible()
    expect((await getMatches(request, me)).active).toHaveLength(0)
    await page.context().close()
  })

  test("MAT-15/16/17/22: Block from the options menu - cancel, a failure, then block", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Tatum" })
    await matchMembers(request, me, other)
    const page = await signedInPage(browser, me, "/matches")
    const card = page.getByTestId("match-card").filter({ hasText: "Tatum" })
    await card.getByRole("button", { name: "Options for Tatum" }).click()
    await page.getByRole("menuitem", { name: "Block" }).click()
    const dialog = page.getByRole("dialog", { name: "Block Tatum?" })
    await expect(dialog).toContainText("They will be removed from your matches")
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(card).toBeVisible()

    await page.route("**/api/browse/*/block", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error blocking user" }) })
    )
    await card.getByRole("button", { name: "Options for Tatum" }).click()
    await page.getByRole("menuitem", { name: "Block" }).click()
    await dialog.getByRole("button", { name: "Block", exact: true }).click()
    await expect(dialog.getByRole("alert")).toContainText("Error blocking user")
    await page.unroute("**/api/browse/*/block")

    await dialog.getByRole("button", { name: "Block", exact: true }).click()
    await expect(page.getByText("Tatum is blocked")).toBeVisible()
    await expect(page.getByTestId("match-card")).toHaveCount(0)
    const blocked = await (await request.get(`${API}/browse/blocked-list`, { headers: authHeaders(me.token) })).json()
    expect(JSON.stringify(blocked)).toContain("Tatum")
    await page.context().close()
  })

  test("MAT-18/19/20/21: Report from the options menu - cancel, then a report that reaches the admins", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Uma" })
    await matchMembers(request, me, other)
    const page = await signedInPage(browser, me, "/matches")
    const card = page.getByTestId("match-card").filter({ hasText: "Uma" })
    await card.getByRole("button", { name: "Options for Uma" }).click()
    await page.getByRole("menuitem", { name: "Report" }).click()
    const dialog = page.getByRole("dialog", { name: "Report Uma" })
    const submit = dialog.getByRole("button", { name: "Submit Report" })
    await expect(submit).toBeDisabled()
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()

    await card.getByRole("button", { name: "Options for Uma" }).click()
    await page.getByRole("menuitem", { name: "Report" }).click()
    const reason = `Asked for money - matches test ${Date.now()}`
    await dialog.getByRole("textbox", { name: "What happened" }).fill(reason)
    await submit.click()
    const sent = page.getByRole("dialog", { name: "Report submitted" })
    await expect(sent).toContainText("Thank you for helping keep our community safe.")
    await sent.getByRole("button", { name: "Close" }).first().click()
    await expect(sent).toBeHidden()
    // Reporting does not remove the match.
    await expect(card).toBeVisible()

    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const reports = await (await request.get(`${API}/admin/reports`, { headers: authHeaders(admin.token) })).json()
    expect(JSON.stringify(reports)).toContain(reason)
    await page.context().close()
  })

  test("MAT: a failed load says so and Try again recovers", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Vale" })
    await matchMembers(request, me, other)
    const page = await signedInPage(browser, me, "/browse")
    let fail = true
    await page.route("**/api/matches", (route) =>
      fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error fetching matches" }) }) : route.fallback()
    )
    await page.goto("/matches")
    await expect(page.getByRole("alert").filter({ hasText: "We could not load your matches" })).toBeVisible()
    fail = false
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(page.getByTestId("match-card").filter({ hasText: "Vale" })).toBeVisible()
    await page.context().close()
  })
})
