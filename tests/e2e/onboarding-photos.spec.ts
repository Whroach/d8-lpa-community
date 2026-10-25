import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test"
import { API, alertBox, authHeaders, createUnfinishedMember, makePng, signedInContextWith } from "./helpers"

/**
 * The photo step in onboarding uses the same tips and "position your photo"
 * step as My Profile (components/profile/photo-crop-dialog.tsx). Pictures here
 * are plain coloured rectangles made in the page - never a photo of a person.
 */
type Newbie = Awaited<ReturnType<typeof createUnfinishedMember>>

const profileOf = async (request: APIRequestContext, token: string) =>
  (await (await request.get(`${API}/auth/me`, { headers: authHeaders(token) })).json()) as { user: any; profile: any }

const cropStep = (page: Page) => page.getByRole("dialog", { name: "Position your photo" })
const fileInput = (page: Page) => page.locator('input[type="file"]')
const picture = (page: Page) => page.getByRole("img", { name: "Your profile picture" })

const sizeOf = (page: Page, url: string) =>
  page.evaluate(
    (src) =>
      new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => reject(new Error("image did not load"))
        img.src = src
      }),
    url
  )

/** Waits for a dialog's opening animation, so positions and colours are the final ones. */
const settled = (page: Page) =>
  cropStep(page).evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)).then(() => undefined))

/** True when the page cannot be scrolled sideways. */
const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

/** Signs in a brand-new fictional person and goes to the photo box on step 2. */
async function openPhotoStep(browser: Browser, who: Newbie, options: Parameters<typeof signedInContextWith>[2] = {}) {
  const context = await signedInContextWith(browser, who, options)
  const page = await context.newPage()
  await page.goto("/onboarding")
  await expect(page.getByRole("heading", { name: "Personal Info", level: 1 })).toBeVisible()
  await page.getByLabel(/First Name/).fill("Mary")
  await page.getByLabel(/Last Name/).fill("Example")
  await page.getByLabel(/Birthday/).fill("1964-07-04")
  await page.getByRole("button", { name: "Female", exact: true }).click()
  for (const [label, option] of [[/State/, "Oklahoma"], [/District Number/, "District 8"]] as const) {
    await page.getByRole("combobox", { name: label }).click()
    await page.getByRole("option", { name: option, exact: true }).click()
  }
  await page.getByRole("checkbox", { name: /I agree to the Community Guidelines/ }).click()
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Profile Setup", level: 1 })).toBeVisible()
  return page
}

test.describe("ONB-37: onboarding photo with tips and the position-your-photo step", () => {
  test("choose a photo, move and zoom with the keyboard, Use photo - it shows in onboarding and is on the saved profile", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openPhotoStep(browser, who)

    await fileInput(page).setInputFiles({ name: "garden.png", mimeType: "image/png", buffer: await makePng(page, 1200, 600, "#2f6f4f") })
    const crop = cropStep(page)
    await expect(crop).toBeVisible()
    await expect(crop.getByRole("list", { name: "Photo tips" })).toContainText("Use a recent photo in good light")
    await expect(crop.getByRole("list", { name: "Photo tips" })).toContainText("no house numbers, licence plates")
    // Nothing is uploaded until the member says so.
    expect((await profileOf(request, who.token)).profile.photos || []).toHaveLength(0)

    // Keyboard only: move with the buttons, zoom with the button and the slider.
    const canvas = crop.getByTestId("crop-canvas")
    await crop.getByRole("button", { name: "Left" }).focus()
    await page.keyboard.press("Enter")
    await page.keyboard.press("Enter")
    await expect(canvas).toHaveAttribute("data-offset-x", "0.20")
    await crop.getByRole("button", { name: "Right" }).focus()
    await page.keyboard.press("Space")
    await expect(canvas).toHaveAttribute("data-offset-x", "0.10")
    await expect(crop.getByRole("button", { name: "Up" })).toBeDisabled() // a wide picture has nothing hidden above or below yet
    await crop.getByRole("button", { name: "Zoom in" }).focus()
    await page.keyboard.press("Space")
    await expect(canvas).toHaveAttribute("data-zoom", "1.25")
    await crop.getByRole("button", { name: "Down" }).focus()
    await page.keyboard.press("Enter")
    await expect(canvas).toHaveAttribute("data-offset-y", "-0.10")
    await crop.getByRole("slider", { name: "Zoom" }).focus()
    await page.keyboard.press("ArrowRight")
    await expect(canvas).toHaveAttribute("data-zoom", "1.3")
    // Dragging moves it too.
    const frame = (await canvas.boundingBox())!
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
    await page.mouse.down()
    await page.mouse.move(frame.x + frame.width / 2 - 60, frame.y + frame.height / 2, { steps: 4 })
    await page.mouse.up()
    expect(Number(await canvas.getAttribute("data-offset-x"))).toBeLessThan(0.1)

    await crop.getByRole("button", { name: "Use photo" }).focus()
    await page.keyboard.press("Enter")
    await expect(crop).toBeHidden()
    await expect(picture(page)).toBeVisible()
    await expect(page.getByText("Picture added.")).toBeVisible()
    // The upload box has gone, so focus moves to the button beside the new picture.
    await expect(page.getByRole("button", { name: "Remove photo" })).toBeFocused()

    let saved = await profileOf(request, who.token)
    expect(saved.profile.photos).toHaveLength(1)
    expect(saved.profile.profile_picture_url).toBe(saved.profile.photos[0])
    const framed = await sizeOf(page, saved.profile.photos[0])
    expect(framed.w / framed.h).toBeCloseTo(0.8, 1) // 4:5, the shape of a profile card

    // Finish: the same picture is on the saved profile and shown on My Profile.
    await page.getByRole("button", { name: "Skip for now" }).click()
    await expect(page).toHaveURL(/\/profile/)
    saved = await profileOf(request, who.token)
    expect(saved.user.onboarding_completed).toBe(true)
    expect(saved.profile.photos).toHaveLength(1)
    await expect(page.locator(`img[src="${saved.profile.photos[0]}"]`).first()).toBeVisible()
    await page.context().close()
  })

  test("Use the whole picture keeps the shape and makes a very large original smaller", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openPhotoStep(browser, who)

    await fileInput(page).setInputFiles({ name: "big.png", mimeType: "image/png", buffer: await makePng(page, 3200, 1600, "#8a5a2b") })
    await cropStep(page).getByRole("button", { name: "Use the whole picture" }).click()
    await expect(cropStep(page)).toBeHidden()
    await expect(picture(page)).toBeVisible()
    await expect(page.getByText("Picture added.")).toBeVisible()

    const saved = await profileOf(request, who.token)
    expect(saved.profile.photos).toHaveLength(1)
    expect(await sizeOf(page, saved.profile.photos[0])).toEqual({ w: 1600, h: 800 })

    // The existing removal still really removes it.
    await page.getByRole("button", { name: "Remove photo" }).click()
    await expect(page.getByText("Picture removed.")).toBeVisible()
    await expect(page.getByText("Click to upload profile picture")).toBeVisible()
    expect((await profileOf(request, who.token)).profile.photos).toEqual([])
    await page.context().close()
  })

  test("Cancel, Escape and the X add nothing, and focus goes back to the upload box", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openPhotoStep(browser, who)
    const uploads: string[] = []
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/users/photos")) uploads.push(req.url())
    })
    const png = await makePng(page, 800, 600)
    const crop = cropStep(page)

    await fileInput(page).focus()
    await fileInput(page).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: png })
    await expect(crop).toBeVisible()
    await crop.getByRole("button", { name: "Cancel" }).click()
    await expect(crop).toBeHidden()
    await expect(fileInput(page)).toBeFocused()

    await fileInput(page).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: png })
    await expect(crop).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(crop).toBeHidden()
    await expect(fileInput(page)).toBeFocused()

    await fileInput(page).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: png })
    await expect(crop).toBeVisible()
    await crop.getByRole("button", { name: "Close" }).click()
    await expect(crop).toBeHidden()

    await expect(picture(page)).toBeHidden()
    await expect(page.getByText("Click to upload profile picture")).toBeVisible()
    await expect(page.getByText("Picture added.")).toBeHidden()
    expect(uploads).toEqual([])
    expect((await profileOf(request, who.token)).profile.photos || []).toHaveLength(0)

    // Finishing without a picture leaves the profile without one.
    await page.getByRole("button", { name: "Skip for now" }).click()
    await expect(page).toHaveURL(/\/profile/)
    expect((await profileOf(request, who.token)).profile.photos || []).toHaveLength(0)
    await page.context().close()
  })

  test("a failed upload is explained inside the step, nothing is added, and trying again works", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openPhotoStep(browser, who)
    let fail = true
    await page.route("**/api/users/photos", (route) =>
      route.request().method() === "POST" && fail
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error uploading photo" }) })
        : route.continue()
    )
    await fileInput(page).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: await makePng(page, 600, 800) })
    const crop = cropStep(page)
    await crop.getByRole("button", { name: "Use photo" }).click()
    await expect(crop.getByRole("alert")).toContainText("Error uploading photo")
    await expect(crop).toBeVisible()
    await expect(picture(page)).toBeHidden()
    expect((await profileOf(request, who.token)).profile.photos || []).toHaveLength(0)

    fail = false
    await crop.getByRole("button", { name: "Use photo" }).click()
    await expect(crop).toBeHidden()
    await expect(picture(page)).toBeVisible()
    expect((await profileOf(request, who.token)).profile.photos).toHaveLength(1)
    await expect(alertBox(page)).toHaveCount(0)
    await page.context().close()
  })

  test("on a 390px-wide phone the step fits: every control is on screen and the page never scrolls sideways", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openPhotoStep(browser, who, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    expect(await noSidewaysScroll(page)).toBe(true)

    await fileInput(page).setInputFiles({ name: "tall.png", mimeType: "image/png", buffer: await makePng(page, 900, 1600, "#2f6f4f") })
    const crop = cropStep(page)
    await expect(crop).toBeVisible()
    await expect(crop.getByRole("button", { name: "Use photo" })).toBeEnabled()
    await settled(page)
    expect(await noSidewaysScroll(page)).toBe(true)

    // The dialog and each of its controls sit inside the 390px screen.
    const box = (await crop.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    const controls = ["Left", "Right", "Up", "Down", "Zoom out", "Zoom in", "Cancel", "Use the whole picture", "Use photo"]
    for (const name of controls) {
      const control = crop.getByRole("button", { name, exact: true })
      await control.scrollIntoViewIfNeeded()
      const b = (await control.boundingBox())!
      expect(b.x, `${name} starts on screen`).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width, `${name} ends on screen`).toBeLessThanOrEqual(390)
    }
    const canvasBox = (await crop.getByTestId("crop-canvas").boundingBox())!
    expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(390)

    // A tall picture can be moved up and down; zoom works by tapping.
    const canvas = crop.getByTestId("crop-canvas")
    await crop.getByRole("button", { name: "Up", exact: true }).tap()
    await expect(canvas).toHaveAttribute("data-offset-y", "0.10")
    await crop.getByRole("button", { name: "Zoom in" }).tap()
    await expect(canvas).toHaveAttribute("data-zoom", "1.25")

    await crop.getByRole("button", { name: "Use photo" }).tap()
    await expect(crop).toBeHidden()
    await expect(picture(page)).toBeVisible()
    expect(await noSidewaysScroll(page)).toBe(true)
    expect((await profileOf(request, who.token)).profile.photos).toHaveLength(1)
    await page.context().close()
  })
})
