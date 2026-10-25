import { test, expect } from "@playwright/test"
import { API, authHeaders, createMember, makePng, runTag, signedInPage, updateProfile } from "./helpers"

test.describe("Another member's profile", () => {
  test("PRV-03/13/16..21: every section shows what the member wrote; Back returns to where I was", async ({ browser, request }) => {
    const tag = runTag()
    const me = await createMember(request)
    const other = await createMember(request, { firstName: `Ivy${tag}`, interests: ["Reading", `Canoeing ${tag}`] })
    await updateProfile(request, other, {
      bio: `Two lines.\nSecond line ${tag}.`,
      occupation: "Nurse", education: "bachelors", location_city: "Tulsa", location_state: "Oklahoma", district_number: "8",
      looking_for_description: ["Friendship"], life_goals: ["Personal growth"], languages: ["English", "French"],
      favorite_music: ["Jazz"], animals: ["Cats"], pet_peeves: ["Lateness"],
      prompt_good_at: `Crosswords ${tag}`, prompt_perfect_weekend: "A lake and a book", prompt_message_if: "You like board games",
      hoping_to_find: "Friends first", great_day: "Sunshine", relationship_values: "Honesty", show_affection: "Small notes", build_with_person: "A calm one",
    })

    const page = await signedInPage(browser, me, "/browse")
    await page.getByTestId("browse-card").filter({ hasText: other.firstName }).getByRole("link").click()
    await expect(page.getByRole("heading", { name: other.firstName, level: 1 })).toBeVisible()
    await expect(page.getByText("Tulsa, Oklahoma").first()).toBeVisible()
    await expect(page.getByText("District 8").first()).toBeVisible()

    await expect(page.getByRole("heading", { name: "About", exact: true })).toBeVisible()
    await expect(page.getByText(`Second line ${tag}.`)).toBeVisible()
    await expect(page.getByRole("heading", { name: "Details" })).toBeVisible()
    await expect(page.getByText("Nurse", { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Bachelors/i).first()).toBeVisible()
    await expect(page.getByText(`Canoeing ${tag}`).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible()
    for (const text of ["Jazz", "Cats", "Lateness"]) await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: "What I'm Looking For" })).toBeVisible()
    for (const text of ["Friendship", "Personal growth", "French"]) await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: "Get to Know Me" })).toBeVisible()
    for (const text of [`Crosswords ${tag}`, "A lake and a book", "You like board games"]) await expect(page.getByText(text, { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "About You & Your Future" })).toBeVisible()
    for (const text of ["Friends first", "Sunshine", "Honesty", "Small notes", "A calm one"]) await expect(page.getByText(text, { exact: true })).toBeVisible()
    // One photo or none: no gallery section.
    await expect(page.getByRole("heading", { name: "Photo Gallery" })).toHaveCount(0)

    await page.getByRole("button", { name: "Back", exact: true }).click()
    await expect(page).toHaveURL(/\/browse$/)
    await page.context().close()
  })

  test("PRV-13/17..21: an almost empty profile says so plainly instead of leaving gaps", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Jo", interests: [] })
    await updateProfile(request, other, { bio: "", interests: [] })
    const page = await signedInPage(browser, me, `/profile/${other.id}`)
    await expect(page.getByRole("heading", { name: "Jo", level: 1 })).toBeVisible()
    await expect(page.getByText("No bio added yet")).toBeVisible()
    await expect(page.getByText("No interests added yet")).toBeVisible()
    expect(await page.getByText("Not specified").count()).toBeGreaterThanOrEqual(5)
    expect(await page.getByText("Not answered yet").count()).toBe(8)
    await page.context().close()
  })

  test("PRV-14/15: the photo gallery opens a viewer with labelled Next, Previous and Close", async ({ browser, request }) => {
    const me = await createMember(request)
    const other = await createMember(request, { firstName: "Kim" })
    const page = await signedInPage(browser, me, "/browse")
    for (const colour of ["#2f6f4f", "#8a5a2b", "#35508a"]) {
      const res = await request.post(`${API}/users/photos`, {
        headers: authHeaders(other.token),
        multipart: { photo: { name: "p.png", mimeType: "image/png", buffer: await makePng(page, 240, 300, colour) } },
      })
      expect(res.ok()).toBeTruthy()
    }
    await page.goto(`/profile/${other.id}`)
    await expect(page.getByRole("heading", { name: "Photo Gallery" })).toBeVisible()
    await page.getByRole("button", { name: "Open photo 2 of 3" }).click()
    const viewer = page.getByRole("dialog", { name: "Kim's photos" })
    await expect(viewer.getByText("Photo 2 of 3")).toBeVisible()
    await viewer.getByRole("button", { name: "Next photo" }).click()
    await expect(viewer.getByText("Photo 3 of 3")).toBeVisible()
    await expect(viewer.getByRole("button", { name: "Next photo" })).toBeDisabled() // the last one
    await viewer.getByRole("button", { name: "Previous photo" }).click()
    await expect(viewer.getByText("Photo 2 of 3")).toBeVisible()
    await viewer.getByRole("button", { name: "Go to photo 1" }).click()
    await expect(viewer.getByText("Photo 1 of 3")).toBeVisible()
    await expect(viewer.getByRole("button", { name: "Previous photo" })).toBeDisabled()
    await viewer.getByRole("button", { name: "Close photos" }).click()
    await expect(viewer).toBeHidden()
    await page.getByRole("button", { name: "Open photo 2 of 3" }).click()
    await expect(viewer.getByText("Photo 2 of 3")).toBeVisible()
    // Keyboard: arrow keys move, Escape closes.
    await page.keyboard.press("ArrowRight")
    await expect(viewer.getByText("Photo 3 of 3")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(viewer).toBeHidden()
    await page.context().close()
  })
})
