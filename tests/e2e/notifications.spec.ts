import { test, expect, type APIRequestContext } from "@playwright/test"
import { API, authHeaders, createMember, matchMembers, signedInPage, type Member } from "./helpers"

const getNotifications = async (request: APIRequestContext, member: Member) =>
  (await (await request.get(`${API}/notifications`, { headers: authHeaders(member.token) })).json()) as any[]
const unreadCount = async (request: APIRequestContext, member: Member) =>
  (await (await request.get(`${API}/notifications/unread-count`, { headers: authHeaders(member.token) })).json()).count as number

/** A member with three unread notifications: a like, a match and a message. */
async function memberWithNotifications(request: APIRequestContext) {
  const me = await createMember(request, { firstName: "Nora" })
  const liker = await createMember(request, { firstName: "Liam" })
  const friend = await createMember(request, { firstName: "Mika" })
  await request.post(`${API}/browse/${me.id}/like`, { headers: authHeaders(liker.token) })
  const matchId = await matchMembers(request, me, friend)
  await request.post(`${API}/messages/${matchId}`, { headers: authHeaders(friend.token), data: { content: "Hello Nora, how was the picnic?" } })
  await expect.poll(async () => (await getNotifications(request, me)).length).toBeGreaterThanOrEqual(3)
  return { me, friend, matchId }
}

test.describe("Notifications", () => {
  test("NOT-02/03/13: opening the page does not mark anything read; unread items say New", async ({ browser, request }) => {
    const { me } = await memberWithNotifications(request)
    const total = (await getNotifications(request, me)).length
    const page = await signedInPage(browser, me, "/notifications")
    await expect(page.getByTestId("unread-summary")).toHaveText(`You have ${total} unread notifications`)
    const items = page.getByTestId("notification")
    await expect(items).toHaveCount(total)
    for (let i = 0; i < total; i += 1) {
      await expect(items.nth(i)).toHaveAttribute("data-unread", "true")
      await expect(items.nth(i).getByText("New", { exact: true })).toBeVisible()
    }
    // The badge in the menu shows the same number, and it is still there after a reload.
    const navLink = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Notifications/ })
    await expect(navLink).toContainText(String(total))
    await page.reload()
    await expect(page.getByTestId("unread-summary")).toHaveText(`You have ${total} unread notifications`)
    expect(await unreadCount(request, me)).toBe(total)
    await page.context().close()
  })

  test("NOT-07/09/05/06/12: mark one as read; the Unread filter and the badge follow", async ({ browser, request }) => {
    const { me } = await memberWithNotifications(request)
    const total = (await getNotifications(request, me)).length
    const page = await signedInPage(browser, me, "/notifications")
    const like = page.getByTestId("notification").filter({ hasText: "Someone Likes You!" })
    // Card content: kind of notice, a real time, title and message.
    await expect(like).toContainText("Like")
    await expect(like.locator("time")).toHaveText(/Just now|minutes? ago/)
    await expect(like).toContainText("Someone new has liked your profile")
    await expect(page.getByRole("button", { name: `All (${total})` })).toHaveAttribute("aria-pressed", "true")

    await like.getByRole("button", { name: /^Mark as read/ }).click()
    await expect(like).toHaveAttribute("data-unread", "false")
    await expect(like.getByText("New", { exact: true })).toHaveCount(0)
    await expect(like.getByRole("button", { name: /^Mark as read/ })).toHaveCount(0)
    await expect(page.getByTestId("unread-summary")).toHaveText(`You have ${total - 1} unread notifications`)
    await expect.poll(() => unreadCount(request, me)).toBe(total - 1)
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Notifications/ })).toContainText(String(total - 1))

    await page.getByRole("button", { name: `Unread (${total - 1})` }).click()
    await expect(page.getByTestId("notification")).toHaveCount(total - 1)
    await expect(page.getByText("Someone Likes You!")).toHaveCount(0)
    await page.getByRole("button", { name: `All (${total})` }).click()
    await expect(page.getByTestId("notification")).toHaveCount(total)
    await page.context().close()
  })

  test("NOT-04/12: Mark all as read clears the count, the badge and the Unread list", async ({ browser, request }) => {
    const { me } = await memberWithNotifications(request)
    const page = await signedInPage(browser, me, "/notifications")
    await page.getByRole("button", { name: "Mark all as read" }).click()
    await expect(page.getByText("All notifications marked as read")).toBeVisible()
    await expect(page.getByTestId("unread-summary")).toHaveText("All caught up!")
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0)
    await expect.poll(() => unreadCount(request, me)).toBe(0)
    await page.getByRole("button", { name: "Unread (0)" }).click()
    await expect(page.getByText("Nothing unread")).toBeVisible()
    await expect(page.getByText("You have read everything.")).toBeVisible()
    await page.reload()
    await expect(page.getByTestId("unread-summary")).toHaveText("All caught up!")
    await page.context().close()
  })

  test("NOT-08: opening a notification goes to what it is about and marks only that one read", async ({ browser, request }) => {
    const { me, matchId } = await memberWithNotifications(request)
    const total = (await getNotifications(request, me)).length
    const page = await signedInPage(browser, me, "/notifications")
    const message = page.getByTestId("notification").filter({ hasText: "New Message" })
    await expect(message).toContainText('Mika sent you a message: "Hello Nora, how was the picnic?"')
    await message.getByRole("link", { name: "Open the conversation" }).click()
    await expect(page).toHaveURL(new RegExp(`/messages\\?match=${matchId}`))
    await expect(page.getByText("Hello Nora, how was the picnic?").first()).toBeVisible()
    await expect.poll(() => unreadCount(request, me)).toBe(total - 1)

    await page.goto("/notifications")
    const match = page.getByTestId("notification").filter({ hasText: "New Match!" }).first()
    await match.getByRole("link", { name: "See your matches" }).click()
    await expect(page).toHaveURL(/\/matches$/)
    await page.goto("/notifications")
    // The anonymous like does not say who: it leads to Browse.
    const like = page.getByTestId("notification").filter({ hasText: "Someone Likes You!" })
    await expect(like.getByRole("link", { name: "Go to Browse" })).toHaveAttribute("href", "/browse")
    await page.context().close()
  })

  test("NOT-10: Delete can be undone; without Undo it is really deleted", async ({ browser, request }) => {
    const { me } = await memberWithNotifications(request)
    const total = (await getNotifications(request, me)).length
    const page = await signedInPage(browser, me, "/notifications")
    const like = page.getByTestId("notification").filter({ hasText: "Someone Likes You!" })
    await like.getByRole("button", { name: /^Delete/ }).click()
    await expect(like).toHaveCount(0)
    await page.getByRole("button", { name: "Undo" }).click()
    await expect(like).toBeVisible()
    expect(await getNotifications(request, me)).toHaveLength(total)

    await like.getByRole("button", { name: /^Delete/ }).click()
    await expect(like).toHaveCount(0)
    // Leaving the page sends the delete straight away.
    await page.goto("/matches")
    await expect.poll(async () => (await getNotifications(request, me)).length).toBe(total - 1)
    await page.goto("/notifications")
    await expect(page.getByText("Someone Likes You!")).toHaveCount(0)
    await page.context().close()
  })

  test("NOT-10: a delete left alone is sent after the Undo time runs out", async ({ browser, request }) => {
    const me = await createMember(request)
    const liker = await createMember(request)
    await request.post(`${API}/browse/${me.id}/like`, { headers: authHeaders(liker.token) })
    const page = await signedInPage(browser, me, "/notifications")
    await page.getByTestId("notification").getByRole("button", { name: /^Delete/ }).click()
    await expect(page.getByText("No notifications yet")).toBeVisible()
    await expect.poll(async () => (await getNotifications(request, me)).length, { timeout: 15_000 }).toBe(0)
    await page.context().close()
  })

  test("NOT-11: empty state, and a failed load says so with Try again", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/notifications")
    await expect(page.getByText("No notifications yet")).toBeVisible()
    await expect(page.getByText("When you get a match, a message, a like or event news, it will show here.")).toBeVisible()
    await expect(page.getByTestId("unread-summary")).toHaveText("All caught up!")

    let fail = true
    await page.route("**/api/notifications", (route) =>
      fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error fetching notifications" }) }) : route.fallback()
    )
    await page.reload()
    await expect(page.getByRole("alert").filter({ hasText: "We could not load your notifications" })).toBeVisible()
    fail = false
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(page.getByText("No notifications yet")).toBeVisible()
    await page.context().close()
  })

  test("NOT: keyboard only - Tab reaches the actions and Enter marks one as read", async ({ browser, request }) => {
    const me = await createMember(request)
    const liker = await createMember(request)
    await request.post(`${API}/browse/${me.id}/like`, { headers: authHeaders(liker.token) })
    const page = await signedInPage(browser, me, "/notifications")
    const item = page.getByTestId("notification")
    await expect(item).toBeVisible()
    await item.getByRole("button", { name: /^Mark as read/ }).focus()
    await page.keyboard.press("Enter")
    await expect(item).toHaveAttribute("data-unread", "false")
    await page.context().close()
  })
})
