import { test, expect, type Page } from "@playwright/test"
import { API, authHeaders, createMember, runTag, signedInPage, updateProfile } from "./helpers"

const cardFor = (page: Page, name: string) => page.getByTestId("browse-card").filter({ hasText: name })

async function chooseFilter(page: Page, button: string, option: string) {
  await page.getByRole("group", { name: "Filters" }).getByRole("button", { name: new RegExp(`^${button}`) }).click()
  await page.getByRole("menuitemcheckbox", { name: option, exact: true }).click()
  await page.keyboard.press("Escape")
}

test.describe("Browse filters", () => {
  test("BRW-03..08/12/18: each filter alone, all three together, chips, counts and Clear", async ({ browser, request }) => {
    const tag = runTag()
    const kite = `Kite flying ${tag}`
    const chess = `Chess ${tag}`
    const me = await createMember(request)
    const a = await createMember(request, { firstName: `Ada${tag}` })
    const b = await createMember(request, { firstName: `Ben${tag}` })
    const c = await createMember(request, { firstName: `Cy${tag}` })
    await updateProfile(request, a, { location_state: "Wyoming", district_number: "13", interests: [kite, "Cooking"] })
    await updateProfile(request, b, { location_state: "Wyoming", district_number: "14", interests: [chess] })
    await updateProfile(request, c, { location_state: "Vermont", district_number: "13", interests: [kite] })

    const page = await signedInPage(browser, me, "/browse")
    const filters = page.getByRole("group", { name: "Filters" })
    const count = page.getByTestId("results-count")
    await expect(page.getByTestId("browse-card").first()).toBeVisible()
    await expect(filters.getByRole("button", { name: "Clear all" })).toHaveCount(0)

    // Interests alone: the list is made from members' real interests, so a custom one can be chosen.
    await chooseFilter(page, "Interests", kite)
    await expect(count).toHaveText("Showing 2 of 2 profiles")
    await expect(cardFor(page, a.firstName)).toBeVisible()
    await expect(cardFor(page, c.firstName)).toBeVisible()
    await expect(cardFor(page, b.firstName)).toHaveCount(0)
    await expect(filters.getByRole("button", { name: /^Interests/ })).toContainText("1")
    await expect(page.getByTestId("filter-chip")).toHaveText([kite])

    // Two interests: either one matches.
    await chooseFilter(page, "Interests", chess)
    await expect(count).toHaveText("Showing 3 of 3 profiles")
    await expect(filters.getByRole("button", { name: /^Interests/ })).toContainText("2")
    await page.getByRole("button", { name: `Remove filter: ${chess}` }).click()
    await expect(count).toHaveText("Showing 2 of 2 profiles")

    // Interests + State.
    await chooseFilter(page, "State", "Wyoming")
    await expect(count).toHaveText("Showing 1 of 1 profiles")
    await expect(cardFor(page, a.firstName)).toBeVisible()
    await expect(cardFor(page, a.firstName)).toContainText("Wyoming, District 13")
    await expect(filters.getByRole("button", { name: /^State/ })).toContainText("1")

    // Interests + State + District: nobody; the empty state offers a way out.
    await chooseFilter(page, "District", "District 14")
    await expect(page.getByText("No profiles match your filters")).toBeVisible()
    await expect(page.getByText("Try adjusting your filters to see more people")).toBeVisible()
    await expect(count).toHaveText("Showing 0 of 0 profiles")
    await expect(page.getByTestId("filter-chip")).toHaveCount(3)
    await page.getByRole("button", { name: "Remove filter: District 14" }).click()
    await expect(cardFor(page, a.firstName)).toBeVisible()
    await chooseFilter(page, "District", "District 14")
    await page.getByRole("button", { name: "Clear Filters" }).click()
    await expect(page.getByTestId("filter-chip")).toHaveCount(0)
    await expect(cardFor(page, b.firstName)).toBeVisible()

    // State alone (two states: either matches).
    await chooseFilter(page, "State", "Wyoming")
    await expect(cardFor(page, a.firstName)).toBeVisible()
    await expect(cardFor(page, b.firstName)).toBeVisible()
    await expect(cardFor(page, c.firstName)).toHaveCount(0)
    await chooseFilter(page, "State", "Vermont")
    await expect(cardFor(page, c.firstName)).toBeVisible()
    await expect(filters.getByRole("button", { name: /^State/ })).toContainText("2")
    await filters.getByRole("button", { name: "Clear all" }).click()
    await expect(page.getByTestId("filter-chip")).toHaveCount(0)

    // District alone, then State + District.
    await chooseFilter(page, "District", "District 13")
    await expect(cardFor(page, a.firstName)).toBeVisible()
    await expect(cardFor(page, c.firstName)).toBeVisible()
    await expect(cardFor(page, b.firstName)).toHaveCount(0)
    await chooseFilter(page, "State", "Vermont")
    await expect(cardFor(page, c.firstName)).toBeVisible()
    await expect(cardFor(page, a.firstName)).toHaveCount(0)
    // Un-ticking in the menu removes the filter too.
    await chooseFilter(page, "State", "Vermont")
    await expect(cardFor(page, a.firstName)).toBeVisible()
    await page.context().close()
  })

  test("BRW-13: a card shows photo link, name and age, place, bio and up to four interests", async ({ browser, request }) => {
    const tag = runTag()
    const me = await createMember(request)
    const other = await createMember(request, { firstName: `Dee${tag}` })
    await updateProfile(request, other, {
      location_state: "Vermont",
      district_number: "district_12",
      bio: `Retired teacher who bakes. ${tag}`,
      interests: ["Baking", "Reading", "Travel", "Pets", "Hiking", "Music"],
    })
    const page = await signedInPage(browser, me, "/browse")
    const card = cardFor(page, other.firstName)
    await expect(card.getByRole("heading")).toHaveText(new RegExp(`^${other.firstName}, \\d\\d$`))
    await expect(card).toContainText("Vermont, District 12")
    await expect(card).toContainText(`Retired teacher who bakes. ${tag}`)
    for (const interest of ["Baking", "Reading", "Travel", "Pets"]) await expect(card.getByText(interest, { exact: true })).toBeVisible()
    await expect(card.getByText("+2", { exact: true })).toBeVisible()
    await expect(card.getByRole("link")).toHaveAttribute("href", `/profile/${other.id}`)
    await card.getByRole("link").click()
    await expect(page.getByRole("heading", { name: other.firstName, level: 1 })).toBeVisible()
    await page.context().close()
  })
})

test.describe("Browse likes", () => {
  test("BRW-14/15: Like, then Remove like, both saved", async ({ browser, request }) => {
    const tag = runTag()
    const me = await createMember(request)
    const other = await createMember(request, { firstName: `Eli${tag}` })
    const liked = async () =>
      ((await (await request.get(`${API}/browse/liked`, { headers: authHeaders(me.token) })).json()) as any[]).map((p) => String(p.id))
    const page = await signedInPage(browser, me, "/browse")
    const card = cardFor(page, other.firstName)
    await card.getByRole("button", { name: `Like ${other.firstName}` }).click()
    const likedButton = card.getByRole("button", { name: `You like ${other.firstName}` })
    await expect(likedButton).toBeVisible()
    await expect.poll(liked).toContain(other.id)

    // The liked state is still there after a reload.
    await page.reload()
    await likedButton.click()
    await page.getByRole("button", { name: "Remove like" }).click()
    await expect(page.getByText(`You no longer like ${other.firstName}`)).toBeVisible()
    await expect(card.getByRole("button", { name: `Like ${other.firstName}` })).toBeVisible()
    await expect.poll(liked).not.toContain(other.id)
    await page.context().close()
  })

  test("BRW-16: a mutual like shows It's a match, with Keep Browsing and Go to Matches", async ({ browser, request }) => {
    const tag = runTag()
    const me = await createMember(request)
    const one = await createMember(request, { firstName: `Fay${tag}` })
    const two = await createMember(request, { firstName: `Gus${tag}` })
    await request.post(`${API}/browse/${me.id}/like`, { headers: authHeaders(one.token) })
    await request.post(`${API}/browse/${me.id}/like`, { headers: authHeaders(two.token) })
    const page = await signedInPage(browser, me, "/browse")

    await cardFor(page, one.firstName).getByRole("button", { name: `Like ${one.firstName}` }).click()
    const dialog = page.getByRole("dialog", { name: "It's a match!" })
    await expect(dialog).toContainText(`You and ${one.firstName} liked each other. Say hello.`)
    await dialog.getByRole("button", { name: "Keep Browsing" }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/browse$/)

    await cardFor(page, two.firstName).getByRole("button", { name: `Like ${two.firstName}` }).click()
    await dialog.getByRole("link", { name: "Go to Matches" }).click()
    await expect(page).toHaveURL(/\/matches$/)
    await expect(page.getByTestId("match-card")).toHaveCount(2)
    await page.context().close()
  })

  test("BRW-10: a like that fails says so and the card is not shown as liked", async ({ browser, request }) => {
    const tag = runTag()
    const me = await createMember(request)
    const other = await createMember(request, { firstName: `Hal${tag}` })
    const page = await signedInPage(browser, me, "/browse")
    await page.route("**/api/browse/*/like", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error processing like" }) })
    )
    const card = cardFor(page, other.firstName)
    await card.getByRole("button", { name: `Like ${other.firstName}` }).click()
    const alert = page.getByRole("alert").filter({ hasText: "That did not work" })
    await expect(alert).toContainText("Error processing like")
    await expect(alert.getByRole("button", { name: "Try again" })).toHaveCount(0)
    await expect(card.getByRole("button", { name: `Like ${other.firstName}` })).toBeVisible()
    await alert.getByRole("button", { name: "Dismiss" }).click()
    await expect(alert).toHaveCount(0)
    await page.context().close()
  })
})

test.describe("Browse states", () => {
  test("BRW-09: a failed load says so; Try again loads the profiles", async ({ browser, request }) => {
    const me = await createMember(request)
    await createMember(request)
    const page = await signedInPage(browser, me, "/matches")
    let fail = true
    await page.route("**/api/browse", (route) =>
      fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error fetching profiles" }) }) : route.fallback()
    )
    await page.goto("/browse")
    const alert = page.getByRole("alert").filter({ hasText: "We could not load Browse" })
    await expect(alert).toContainText("Error fetching profiles")
    await expect(page.getByText("No profiles to show yet")).toHaveCount(0)
    fail = false
    await alert.getByRole("button", { name: "Try again" }).click()
    await expect(page.getByTestId("browse-card").first()).toBeVisible()
    await expect(alert).toHaveCount(0)
    await page.context().close()
  })

  test("BRW-11: nobody to show", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/matches")
    await page.route("**/api/browse", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }))
    await page.goto("/browse")
    await expect(page.getByText("No profiles to show yet")).toBeVisible()
    await expect(page.getByText("New members join regularly. Please check back soon.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Clear Filters" })).toHaveCount(0)
    await page.context().close()
  })

  test("BRW-17/18: twelve at a time, then Show more (or scrolling) brings the rest", async ({ browser, request }) => {
    const tag = runTag()
    const hobby = `Paging ${tag}`
    const me = await createMember(request)
    for (let i = 0; i < 14; i += 1) {
      const member = await createMember(request, { firstName: `P${i}x${tag}`, interests: [hobby] })
      expect(member.id).toBeTruthy()
    }
    const page = await signedInPage(browser, me, "/browse")
    await page.setViewportSize({ width: 1280, height: 500 })
    await chooseFilter(page, "Interests", hobby)
    const count = page.getByTestId("results-count")
    await expect(count).toHaveText("Showing 12 of 14 profiles")
    await expect(page.getByTestId("browse-card")).toHaveCount(12)
    // Reaching the bottom reveals the rest by itself; the button does the same.
    const more = page.getByRole("button", { name: "Show more profiles" })
    await more.click({ timeout: 5000 }).catch(() => {})
    await expect(count).toHaveText("Showing 14 of 14 profiles")
    await expect(page.getByTestId("browse-card")).toHaveCount(14)
    await expect(more).toHaveCount(0)
    await page.context().close()
  })

  test("BRW: keyboard only - open a filter, tick an option, remove the chip", async ({ browser, request }) => {
    const tag = runTag()
    const me = await createMember(request)
    const other = await createMember(request, { firstName: `Kay${tag}` })
    await updateProfile(request, other, { location_state: "Wyoming" })
    const page = await signedInPage(browser, me, "/browse")
    await expect(page.getByTestId("browse-card").first()).toBeVisible()
    await page.getByRole("group", { name: "Filters" }).getByRole("button", { name: /^District/ }).focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("menu")).toBeVisible()
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    const chip = page.getByTestId("filter-chip")
    await expect(chip).toHaveCount(1)
    await page.keyboard.press("Escape")
    await chip.getByRole("button").focus()
    await page.keyboard.press("Enter")
    await expect(chip).toHaveCount(0)
    await page.context().close()
  })
})
