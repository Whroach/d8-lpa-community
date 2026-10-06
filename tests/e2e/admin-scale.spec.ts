import { test, expect, type Page } from "@playwright/test"
import { API, ADMIN_EMAIL, DEMO_PASSWORD, authHeaders, loginApi, signedInContextWith } from "./helpers"

/**
 * The admin panel with a community the size it is expected to reach: about
 * 300 members and 250 reports (all fictional, added through the local-only
 * test route and removed again afterwards so no other test is slowed down).
 */
test.describe("admin at scale: 300 members and 250 reports", () => {
  test.beforeAll(async ({ request }) => {
    await request.delete(`${API}/__test/bulk-admin-data`)
    const seeded = await (await request.post(`${API}/__test/bulk-admin-data`, { data: { members: 300, reports: 250 } })).json()
    expect(seeded).toMatchObject({ members: 300, reports: 250 })
  })
  test.afterAll(async ({ request }) => {
    await request.delete(`${API}/__test/bulk-admin-data`)
  })

  const rows = (page: Page) => page.getByTestId("user-row")
  const summary = (page: Page) => page.getByTestId("pager-summary")
  const pages = (page: Page, noun: string) => page.getByRole("navigation", { name: `Pages of ${noun}` })
  const shown = (page: Page, label: string) => page.getByRole("group", { name: "Show" }).getByRole("button", { name: new RegExp(`^${label}`) })

  async function open(page: Page, tab: string) {
    await page.goto("/admin")
    await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible()
    await page.getByRole("tab", { name: tab }).click()
  }

  test("ADM members at scale: page through, search by name and email, filter, act on a member on a later page and stay there", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const api = async (query: string) => (await (await request.get(`${API}/admin/users?${query}`, { headers: authHeaders(admin.token) })).json()) as any
    const context = await signedInContextWith(browser, admin)
    const page = await context.newPage()
    await open(page, "Members")

    // 25 to a page; the counts are the whole community's, not the page's.
    const all = await api("limit=25&page=1")
    expect(all.total).toBeGreaterThanOrEqual(300)
    await expect(rows(page)).toHaveCount(25)
    await expect(summary(page)).toHaveText(`Showing 1 to 25 of ${all.total} members`)
    await expect(pages(page, "members")).toContainText(`Page 1 of ${all.totalPages}`)
    await expect(pages(page, "members").getByRole("button", { name: "Previous" })).toBeDisabled()
    for (const [label, key] of [["All members", "all"], ["Active", "active"], ["Warned", "warned"], ["Suspended", "suspended"], ["Banned", "banned"]] as const) {
      await expect(shown(page, label).getByTestId("filter-count")).toHaveText(String(all.counts[key]))
    }
    expect(all.counts.suspended).toBeGreaterThan(5)

    // Next / Previous show different people each time.
    const emailsOn = async () => rows(page).locator("p.break-all").allInnerTexts()
    const first = await emailsOn()
    await pages(page, "members").getByRole("button", { name: "Next" }).click()
    await expect(summary(page)).toHaveText(`Showing 26 to 50 of ${all.total} members`)
    const second = await emailsOn()
    expect(second.filter((email) => first.includes(email))).toEqual([])
    await pages(page, "members").getByRole("button", { name: "Next" }).click()
    await pages(page, "members").getByRole("button", { name: "Next" }).click()
    await expect(pages(page, "members")).toContainText(`Page 4 of ${all.totalPages}`)
    await expect(summary(page)).toHaveText(`Showing 76 to 100 of ${all.total} members`)
    // Previous goes back one page, to the same people as before.
    await pages(page, "members").getByRole("button", { name: "Previous" }).click()
    await pages(page, "members").getByRole("button", { name: "Previous" }).click()
    await expect(summary(page)).toHaveText(`Showing 26 to 50 of ${all.total} members`)
    expect(await emailsOn()).toEqual(second)
    await pages(page, "members").getByRole("button", { name: "Next" }).click()
    await pages(page, "members").getByRole("button", { name: "Next" }).click()
    await expect(summary(page)).toHaveText(`Showing 76 to 100 of ${all.total} members`)

    // Act on someone on page 4: still on page 4 afterwards, same people, new status and counts.
    const pageFour = await emailsOn()
    const target = rows(page).filter({ has: page.getByRole("button", { name: /^Suspend / }) }).first()
    const email = await target.locator("p.break-all").innerText()
    const name = await target.getByRole("heading").innerText()
    await target.getByRole("button", { name: /^Suspend / }).click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog.getByRole("heading", { name: `Suspend ${name}?` })).toBeVisible()
    await dialog.getByLabel("Reason for the suspension").fill("Scale test.")
    await dialog.getByRole("button", { name: /^Suspend / }).click()
    await expect(dialog).toBeHidden()
    const acted = rows(page).filter({ hasText: email })
    await expect(acted).toContainText("Suspended")
    await expect(pages(page, "members")).toContainText(`Page 4 of ${all.totalPages}`)
    expect(await emailsOn()).toEqual(pageFour)
    await expect(shown(page, "Suspended").getByTestId("filter-count")).toHaveText(String(all.counts.suspended + 1))
    // Lift it again from the same page.
    await acted.getByRole("button", { name: /^Lift suspension/ }).click()
    await dialog.getByRole("button", { name: "Lift suspension" }).click()
    await expect(acted).not.toContainText("Suspended")
    await expect(pages(page, "members")).toContainText(`Page 4 of ${all.totalPages}`)
    await expect(shown(page, "Suspended").getByTestId("filter-count")).toHaveText(String(all.counts.suspended))

    // Search by last name: 20 people, one page, and searching goes back to page 1.
    await page.getByLabel("Search members").fill("nightingale")
    await expect(summary(page)).toHaveText("Showing 1 to 20 of 20 members")
    await expect(rows(page)).toHaveCount(20)
    await expect(pages(page, "members").getByRole("button", { name: "Next" })).toHaveCount(0)
    // First and last name together.
    await page.getByLabel("Search members").fill("pearl nightingale")
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).getByRole("heading", { name: "Pearl Nightingale" })).toBeVisible()
    // By email address.
    await page.getByLabel("Search members").fill("bulk-member-042@example.test")
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page)).toContainText("bulk-member-042@example.test")

    // A filter on its own pages too, and combines with the search.
    await page.getByLabel("Search members").fill("")
    await shown(page, "Suspended").click()
    await expect(summary(page)).toContainText(`of ${all.counts.suspended} members`)
    await expect(rows(page).filter({ hasText: "Suspended" })).toHaveCount(Math.min(25, all.counts.suspended))
    const some = await api("status=banned&q=nightingale&limit=100")
    await shown(page, "Banned").click()
    await page.getByLabel("Search members").fill("nightingale")
    await expect(summary(page)).toContainText(`of ${some.total} members`)
    await expect(rows(page)).toHaveCount(some.total)
    await expect(rows(page).filter({ hasText: "Nightingale" })).toHaveCount(some.total)
    // The filter buttons still show the whole community's numbers while searching.
    await expect(shown(page, "All members").getByTestId("filter-count")).toHaveText(String(all.counts.all))
    await context.close()
  })

  test("ADM reports at scale: counts from the server, page through, filter, search, dismiss on a later page and stay there", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const admin = await loginApi(request, ADMIN_EMAIL, DEMO_PASSWORD)
    const api = async (query: string) => (await (await request.get(`${API}/admin/reports?${query}`, { headers: authHeaders(admin.token) })).json()) as any
    const context = await signedInContextWith(browser, admin)
    const page = await context.newPage()
    await open(page, "Reports")
    const reports = page.getByTestId("report-row")

    const waiting = await api("page=1&limit=10")
    expect(waiting.counts.pending).toBeGreaterThanOrEqual(190)
    await expect(reports).toHaveCount(10)
    await expect(summary(page)).toHaveText(`Showing 1 to 10 of ${waiting.counts.pending} reports`)
    await expect(page.getByTestId("reports-waiting")).toContainText(String(waiting.counts.pending))
    for (const [label, key] of [["Waiting", "pending"], ["Action taken", "resolved"], ["Dismissed", "dismissed"], ["All reports", "all"]] as const) {
      await expect(shown(page, label).getByTestId("filter-count")).toHaveText(String(waiting.counts[key]))
    }

    // Page 3, then dismiss the first report there: still page 3, one fewer waiting.
    await pages(page, "reports").getByRole("button", { name: "Next" }).click()
    await pages(page, "reports").getByRole("button", { name: "Next" }).click()
    await expect(summary(page)).toHaveText(`Showing 21 to 30 of ${waiting.counts.pending} reports`)
    await pages(page, "reports").getByRole("button", { name: "Previous" }).click()
    await expect(summary(page)).toHaveText(`Showing 11 to 20 of ${waiting.counts.pending} reports`)
    await pages(page, "reports").getByRole("button", { name: "Next" }).click()
    await expect(summary(page)).toHaveText(`Showing 21 to 30 of ${waiting.counts.pending} reports`)
    const second = await reports.nth(1).innerText()
    await reports.first().getByRole("button", { name: /^Dismiss report/ }).click()
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Report dismissed" })).toBeVisible()
    await expect(summary(page)).toHaveText(`Showing 21 to 30 of ${waiting.counts.pending - 1} reports`)
    await expect(pages(page, "reports")).toContainText("Page 3 of")
    // The report that was second on the page has moved up to first.
    expect(await reports.first().innerText()).toBe(second)
    await expect(shown(page, "Dismissed").getByTestId("filter-count")).toHaveText(String(waiting.counts.dismissed + 1))
    await expect(page.getByTestId("reports-waiting")).toContainText(String(waiting.counts.pending - 1))

    // Filters.
    await shown(page, "Dismissed").click()
    await expect(summary(page)).toHaveText(`Showing 1 to 10 of ${waiting.counts.dismissed + 1} reports`)
    await expect(reports.filter({ hasText: "Dismissed on" })).toHaveCount(10)
    await shown(page, "All reports").click()
    await expect(summary(page)).toContainText(`of ${waiting.counts.all} reports`)

    // Search by a member's name (either side of the report) and by words in it.
    const byName = await api("page=1&limit=10&status=all&q=pearl%20nightingale")
    await page.getByLabel("Search reports").fill("pearl nightingale")
    await expect(summary(page)).toContainText(`of ${byName.total} reports`)
    await expect(reports.filter({ hasText: "Pearl Nightingale" })).toHaveCount(Math.min(10, byName.total))
    const byWords = await api("page=1&limit=10&status=all&q=asked%20for%20a%20loan")
    await page.getByLabel("Search reports").fill("asked for a loan")
    await expect(summary(page)).toContainText(`of ${byWords.total} reports`)
    await expect(reports.filter({ hasText: "Asked for a loan in the second message." })).toHaveCount(10)
    await page.getByLabel("Search reports").fill("zzz-no-such-report")
    await expect(page.getByText("No reports found.")).toBeVisible()
    await context.close()
  })
})
