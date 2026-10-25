import { test, expect, type Page } from "@playwright/test"
import { API, createMember, matchMembers, signedInPage, authHeaders, type Member } from "./helpers"

/**
 * Chat between two real browser sessions. Each test creates two fresh
 * fictional members who have matched, and opens a separate browser context
 * for each of them.
 */
test.describe("chat between two members", () => {
  let alex: Member
  let blake: Member
  let matchId: string
  let alexPage: Page
  let blakePage: Page

  test.beforeEach(async ({ browser, request }) => {
    alex = await createMember(request, { firstName: "Alex", interests: ["Gardening", "Chess"] })
    blake = await createMember(request, { firstName: "Blake", interests: ["Gardening", "Fishing"] })
    matchId = await matchMembers(request, alex, blake)
    alexPage = await signedInPage(browser, alex, `/messages?match=${matchId}`)
    blakePage = await signedInPage(browser, blake, `/messages?match=${matchId}`)
    await expect(alexPage.getByRole("heading", { name: "Blake" })).toBeVisible()
    await expect(blakePage.getByRole("heading", { name: "Alex" })).toBeVisible()
  })

  test.afterEach(async () => {
    await alexPage.context().close()
    await blakePage.context().close()
  })

  const box = (page: Page) => page.locator("#message-box")
  const send = (page: Page) => page.getByRole("button", { name: "Send", exact: true })

  test("MSG: conversation starters come from shared interests and fill the box", async () => {
    const starters = alexPage.getByTestId("conversation-starters")
    await expect(starters).toBeVisible()
    await expect(starters.getByRole("button", { name: /gardening/i })).toBeVisible()
    await starters.getByRole("button", { name: /gardening/i }).click()
    await expect(box(alexPage)).toHaveValue(/gardening/i)
  })

  test("MSG: send, receive in real time, typing indicator, Seen, online status", async () => {
    // Typing shows on the other screen before anything is sent.
    await box(alexPage).pressSequentially("Hello Blake", { delay: 30 })
    await expect(blakePage.getByTestId("typing-indicator")).toBeVisible()

    await send(alexPage).click()
    await expect(alexPage.getByTestId("message-own").filter({ hasText: "Hello Blake" })).toBeVisible()
    // Arrives on Blake's screen without a reload.
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "Hello Blake" })).toBeVisible()
    // Blake has it open, so Alex sees "Seen".
    await expect(alexPage.getByTestId("message-status")).toHaveText("Seen")

    // Enter sends too; the reply arrives on Alex's screen.
    await box(blakePage).fill("Hi Alex, lovely to meet you")
    await box(blakePage).press("Enter")
    await expect(alexPage.getByTestId("message-other").filter({ hasText: "lovely to meet you" })).toBeVisible()
    await expect(box(blakePage)).toHaveValue("")

    // Both are connected, so each sees the other as online in the list.
    await alexPage.reload()
    await expect(alexPage.getByText("Online now").first()).toBeVisible()
  })

  test("MSG: edit and unsend reach the other person straight away", async () => {
    await box(alexPage).fill("Helo there")
    await send(alexPage).click()
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "Helo there" })).toBeVisible()

    await alexPage.getByRole("button", { name: "Edit", exact: true }).click()
    await alexPage.getByLabel("Change your message").fill("Hello there")
    await alexPage.getByRole("button", { name: "Save changes" }).click()
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "Hello there" })).toBeVisible()
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "Edited" })).toBeVisible()

    await alexPage.getByRole("button", { name: "Unsend", exact: true }).click()
    await alexPage.getByRole("dialog").getByRole("button", { name: "Unsend" }).click()
    await expect(alexPage.getByText("You unsent a message")).toBeVisible()
    await expect(blakePage.getByText("Alex unsent a message")).toBeVisible()
    await expect(blakePage.getByText("Hello there")).toHaveCount(0)
    // Nothing left to edit or unsend.
    await expect(alexPage.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0)
  })

  test("MSG/NAV: unread badge in the menu and in the list while the other person is elsewhere", async () => {
    await blakePage.goto("/events")
    await expect(blakePage.getByRole("navigation", { name: "Main" })).toBeVisible()
    await box(alexPage).fill("Are you free on Saturday?")
    await send(alexPage).click()

    const messagesLink = blakePage.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Messages/ })
    await expect(messagesLink).toContainText("1")

    await messagesLink.click()
    // On a wide screen the newest conversation opens and is marked read.
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "Saturday" })).toBeVisible()
    await expect(blakePage.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Messages/ })).not.toContainText("1")
    await expect(alexPage.getByTestId("message-status")).toHaveText("Seen")
  })

  test("SET/GLB: the notification chime plays for a new message, and not when sound is off or in quiet hours", async ({ request }) => {
    await blakePage.goto("/browse")
    await blakePage.evaluate(() => {
      ;(window as any).__chimes = 0
      window.addEventListener("d8lpa:chime", () => ((window as any).__chimes += 1))
    })
    const chimes = () => blakePage.evaluate(() => (window as any).__chimes as number)

    await box(alexPage).fill("First")
    await send(alexPage).click()
    await expect.poll(chimes).toBe(1)

    // Sound off in Settings: the badge still goes up, no chime.
    await request.put(`${API}/settings`, { headers: authHeaders(blake.token), data: { notifications: { sound: false } } })
    await blakePage.reload()
    await blakePage.evaluate(() => {
      ;(window as any).__chimes = 0
      window.addEventListener("d8lpa:chime", () => ((window as any).__chimes += 1))
    })
    await expect(blakePage.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Messages/ })).toContainText("1")
    await box(alexPage).fill("Second")
    await send(alexPage).click()
    await expect(blakePage.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Messages/ })).toContainText("2")
    expect(await chimes()).toBe(0)

    // Sound on but quiet hours covering the whole day: still silent.
    await request.put(`${API}/settings`, {
      headers: authHeaders(blake.token),
      data: { notifications: { sound: true, quiet_hours_enabled: true, quiet_hours_start: "00:00", quiet_hours_end: "23:59" } },
    })
    await blakePage.reload()
    await blakePage.evaluate(() => {
      ;(window as any).__chimes = 0
      window.addEventListener("d8lpa:chime", () => ((window as any).__chimes += 1))
    })
    await expect(blakePage.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Messages/ })).toContainText("2")
    await box(alexPage).fill("Third")
    await send(alexPage).click()
    await expect(blakePage.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Messages/ })).toContainText("3")
    expect(await chimes()).toBe(0)
  })

  test("SAFE: a message asking for gift cards shows a private reminder to the reader only, and is still delivered", async () => {
    await box(alexPage).fill("Could you buy me some gift cards? I will pay you back.")
    await send(alexPage).click()
    const received = blakePage.getByTestId("message-other").filter({ hasText: "gift cards" })
    await expect(received).toBeVisible()
    await expect(blakePage.getByTestId("safety-note")).toContainText(/only you can see this/i)
    await expect(blakePage.getByTestId("safety-note").getByRole("link", { name: "Safety advice" })).toBeVisible()
    // The sender sees nothing unusual.
    await expect(alexPage.getByTestId("safety-note")).toHaveCount(0)

    // An ordinary message gets no note.
    await box(alexPage).fill("How was your weekend?")
    await send(alexPage).click()
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "weekend" })).toBeVisible()
    await expect(blakePage.getByTestId("safety-note")).toHaveCount(1)
  })

  test("MSG: a draft survives a reload, and a failed send can be retried", async () => {
    await box(alexPage).fill("A half-written thought")
    await alexPage.reload()
    await expect(box(alexPage)).toHaveValue("A half-written thought")

    // Make the next send fail, as if the connection dropped.
    await alexPage.route(`**/api/messages/${matchId}`, (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue()
    )
    await send(alexPage).click()
    const failed = alexPage.getByTestId("message-failed")
    await expect(failed).toContainText("Not sent")
    await expect(blakePage.getByText("A half-written thought")).toHaveCount(0)

    await alexPage.unroute(`**/api/messages/${matchId}`)
    await failed.getByRole("button", { name: "Try again" }).click()
    await expect(alexPage.getByTestId("message-failed")).toHaveCount(0)
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "A half-written thought" })).toBeVisible()
    // Sent, so the draft is gone.
    await alexPage.reload()
    await expect(box(alexPage)).toHaveValue("")
  })

  test("MSG/SAFE: report from a chat, then block with Undo; blocking closes the chat on the other screen", async ({ request }) => {
    await box(blakePage).fill("hello")
    await send(blakePage).click()
    await expect(alexPage.getByTestId("message-other").filter({ hasText: "hello" })).toBeVisible()

    // Report (does not block by itself).
    await alexPage.getByTestId("chat-options").click()
    await alexPage.getByRole("menuitem", { name: "Report Blake" }).click()
    const report = alexPage.getByRole("dialog")
    await report.getByRole("button", { name: "Send report" }).click()
    await expect(report.getByText("Please choose what happened.")).toBeVisible()
    await report.getByLabel("Rude, insulting or harassing messages").check()
    await report.getByRole("button", { name: "Send report" }).click()
    await expect(alexPage.getByText("Your report has been sent")).toBeVisible()
    await expect(box(alexPage)).toBeVisible() // still matched

    // Block.
    await alexPage.getByTestId("chat-options").click()
    await alexPage.getByRole("menuitem", { name: "Block Blake" }).click()
    await alexPage.getByRole("dialog").getByRole("button", { name: "Block Blake" }).click()
    await expect(alexPage.getByText("Blake is blocked")).toBeVisible()
    await expect(alexPage.getByTestId("conversation-item")).toHaveCount(0)
    // Blake's open chat closes by itself.
    await expect(blakePage.getByText("This conversation is no longer available.")).toBeVisible()
    expect((await request.get(`${API}/users/${alex.id}`, { headers: authHeaders(blake.token) })).status()).toBe(404)

    // Undo the block from the confirmation message.
    await alexPage.getByRole("button", { name: "Undo" }).click()
    await expect(alexPage.getByText("Blake is no longer blocked")).toBeVisible()
    expect((await request.get(`${API}/users/${alex.id}`, { headers: authHeaders(blake.token) })).status()).toBe(200)
  })

  test("MSG: unmatch keeps the history but stops new messages; clear conversation only affects my side", async () => {
    await box(alexPage).fill("One for the record")
    await send(alexPage).click()
    await expect(blakePage.getByTestId("message-other").filter({ hasText: "One for the record" })).toBeVisible()

    await blakePage.getByTestId("chat-options").click()
    await blakePage.getByRole("menuitem", { name: "Clear conversation" }).click()
    await blakePage.getByRole("dialog").getByRole("button", { name: "Clear conversation" }).click()
    await expect(blakePage.getByText("Conversation cleared on your side")).toBeVisible()
    await expect(blakePage.getByTestId("message-other")).toHaveCount(0)
    await blakePage.reload()
    await expect(blakePage.getByRole("heading", { name: "Alex" })).toBeVisible()
    await expect(blakePage.getByTestId("message-other")).toHaveCount(0)
    await alexPage.reload()
    await expect(alexPage.getByTestId("message-own").filter({ hasText: "One for the record" })).toBeVisible()

    await alexPage.getByTestId("chat-options").click()
    await alexPage.getByRole("menuitem", { name: "Unmatch" }).click()
    await alexPage.getByRole("dialog").getByRole("button", { name: "Unmatch" }).click()
    await expect(alexPage.getByText(/no longer matched\. You can read/i)).toBeVisible()
    await expect(box(alexPage)).toHaveCount(0)
    await expect(alexPage.getByTestId("message-own").filter({ hasText: "One for the record" })).toBeVisible()
  })
})
