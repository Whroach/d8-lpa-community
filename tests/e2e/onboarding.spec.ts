import { test, expect, type APIRequestContext, type Page } from "@playwright/test"
import { API, TINY_PNG, alertBox, authHeaders, createUnfinishedMember, signedInContextWith } from "./helpers"

type Newbie = Awaited<ReturnType<typeof createUnfinishedMember>>

async function openOnboarding(browser: import("@playwright/test").Browser, who: Newbie, options: Parameters<typeof signedInContextWith>[2] = {}) {
  const context = await signedInContextWith(browser, who, options)
  const page = await context.newPage()
  await page.goto("/onboarding")
  await expect(page.getByRole("heading", { name: "Personal Info", level: 1 })).toBeVisible()
  return page
}

async function choose(page: Page, label: string | RegExp, option: string) {
  await page.getByRole("combobox", { name: label }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

async function fillStepOne(page: Page, firstName = "Mary") {
  await page.getByLabel(/First Name/).fill(firstName)
  await page.getByLabel(/Last Name/).fill("Example")
  await page.getByLabel(/Birthday/).fill("1964-07-04")
  await page.getByRole("button", { name: "Female", exact: true }).click()
  await choose(page, /State/, "Oklahoma")
  await choose(page, /District Number/, "District 8")
  await page.getByRole("checkbox", { name: /I agree to the Community Guidelines/ }).click()
}

const profileOf = async (request: APIRequestContext, token: string) =>
  (await (await request.get(`${API}/auth/me`, { headers: authHeaders(token) })).json()) as { user: any; profile: any }

test.describe("ONB-38: removing the onboarding photo really removes it", () => {
  test("upload, remove (gone from the profile), upload again, finish", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openOnboarding(browser, who)
    await fillStepOne(page)
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Profile Setup", level: 1 })).toBeVisible()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: TINY_PNG })
    await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible()
    await expect(page.getByText("Picture added.")).toBeVisible()
    let saved = await profileOf(request, who.token)
    expect(saved.profile.photos).toHaveLength(1)
    expect(saved.profile.profile_picture_url).toBe(saved.profile.photos[0])

    // The button has a visible word, not just an icon.
    const remove = page.getByRole("button", { name: "Remove photo" })
    await expect(remove).toHaveText(/Remove photo/)
    await remove.click()
    await expect(page.getByRole("img", { name: "Your profile picture" })).toBeHidden()
    await expect(page.getByText("Picture removed.")).toBeVisible()
    await expect(page.getByText("Click to upload profile picture")).toBeVisible()
    saved = await profileOf(request, who.token)
    expect(saved.profile.photos).toEqual([])
    expect(saved.profile.profile_picture_url).toBeNull()

    // Finishing now leaves the profile without a picture...
    await page.getByRole("button", { name: "Skip for now" }).click()
    await expect(page).toHaveURL(/\/profile/)
    saved = await profileOf(request, who.token)
    expect(saved.user.onboarding_completed).toBe(true)
    expect(saved.profile.photos).toEqual([])
    expect(saved.profile.profile_picture_url).toBeNull()
    // ...and My Profile agrees: no uploaded picture is shown anywhere.
    await expect(page.locator('img[src*="/uploads/"], img[src*="local-uploads"]')).toHaveCount(0)
    await page.context().close()
  })

  test("a picture that is kept is on the profile after finishing, and survives a reload of the form", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openOnboarding(browser, who)
    await fillStepOne(page, "Rosa")
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: TINY_PNG })
    await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible()

    // Reload half-way: the answers and the picture are still there.
    await page.reload()
    await expect(page.getByRole("heading", { name: "Profile Setup", level: 1 })).toBeVisible()
    await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible()
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await expect(page.getByLabel(/First Name/)).toHaveValue("Rosa")
    await page.getByRole("button", { name: "Next", exact: true }).click()

    await page.getByRole("button", { name: "Skip for now" }).click()
    await expect(page).toHaveURL(/\/profile/)
    const saved = await profileOf(request, who.token)
    expect(saved.profile.photos).toHaveLength(1)
    expect(saved.profile.profile_picture_url).toBe(saved.profile.photos[0])
    await page.context().close()
  })

  test("if the server cannot remove the picture, it stays on screen with a clear message", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openOnboarding(browser, who)
    await fillStepOne(page)
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: TINY_PNG })
    await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible()

    await page.route("**/api/users/photos", (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error deleting photo" }) })
        : route.continue()
    )
    await page.getByRole("button", { name: "Remove photo" }).click()
    await expect(alertBox(page)).toContainText("The picture was not removed")
    await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible()
    expect((await profileOf(request, who.token)).profile.photos).toHaveLength(1)
    await page.context().close()
  })
})
