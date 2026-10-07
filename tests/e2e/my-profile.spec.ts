import { test, expect, type APIRequestContext, type Page } from "@playwright/test"
import { API, authHeaders, createMember, makePng, matchMembers, runTag, signedInPage, updateProfile, type Member } from "./helpers"

const saved = async (request: APIRequestContext, member: Member) =>
  (await (await request.get(`${API}/users/profile`, { headers: authHeaders(member.token) })).json()) as { user: any; profile: any }

const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true })
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true })

test.describe("My Profile: edit, cancel, save", () => {
  test("PRO-04/05: Cancel puts every kind of field back; nothing is saved", async ({ browser, request }) => {
    const me = await createMember(request, { firstName: "Cora" })
    const page = await signedInPage(browser, me, "/profile")
    await expect(page.getByRole("heading", { name: "My Profile", level: 1 })).toBeVisible()

    // No changes: Cancel simply leaves edit mode.
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await box(page, "First name").fill("Changed")
    await box(page, "About me").fill("Text that must not be kept.")
    await box(page, "Add your own interest").fill("Skydiving")
    await page.getByRole("button", { name: "Add", exact: true }).click()
    await chip(page, "Friendship").click()
    await box(page, "I'm weirdly good at...").fill("Forgetting things")

    await page.getByRole("button", { name: "Cancel" }).click()
    const dialog = page.getByRole("dialog", { name: "Discard your changes?" })
    await dialog.getByRole("button", { name: "Keep editing" }).click()
    await expect(box(page, "About me")).toHaveValue("Text that must not be kept.")

    await page.getByRole("button", { name: "Cancel" }).click()
    await dialog.getByRole("button", { name: "Discard changes" }).click()
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible()
    await expect(page.getByTestId("my-name")).toContainText("Cora Example")
    await expect(page.getByText("A fictional member created by an automated test.")).toBeVisible()
    await expect(page.getByText("Text that must not be kept.")).toHaveCount(0)
    await expect(page.getByText("Skydiving")).toHaveCount(0)
    await expect(page.getByText("Forgetting things")).toHaveCount(0)

    // Opening the editor again shows the saved values, and Save stores nothing new.
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await expect(box(page, "First name")).toHaveValue("Cora")
    await expect(box(page, "About me")).toHaveValue("A fictional member created by an automated test.")
    await expect(chip(page, "Friendship")).toHaveAttribute("aria-pressed", "false")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByText("Profile saved")).toBeVisible()
    const after = await saved(request, me)
    expect(after.user.first_name).toBe("Cora")
    expect(after.profile.bio).toBe("A fictional member created by an automated test.")
    expect(after.profile.interests).toEqual(["Gardening", "Cooking"])
    expect(after.profile.prompt_good_at || "").toBe("")

    await page.reload()
    await expect(page.getByTestId("my-name")).toContainText("Cora Example")
    await page.context().close()
  })

  test("PRO-05: following a menu link with unsaved changes asks first", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/profile")
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await box(page, "About me").fill("Half-written.")
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Events" }).click()
    const dialog = page.getByRole("dialog", { name: "Discard your changes?" })
    await dialog.getByRole("button", { name: "Keep editing" }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(box(page, "About me")).toHaveValue("Half-written.")
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Events" }).click()
    await dialog.getByRole("button", { name: "Discard changes" }).click()
    await expect(page).toHaveURL(/\/events$/)
    expect((await saved(request, me)).profile.bio).toBe("A fictional member created by an automated test.")
    await page.context().close()
  })

  test("PRO-06/10..12/16..38: every field of the editor saves, survives a reload, and shows on the profile other members see", async ({ browser, request }) => {
    const tag = runTag()
    const me = await createMember(request, { firstName: "Edie", interests: ["Cooking"] })
    const viewer = await createMember(request)
    const page = await signedInPage(browser, me, "/profile")
    await page.getByRole("button", { name: "Edit", exact: true }).click()

    await box(page, "First name").fill("Edith")
    await box(page, "Last name").fill("Sample")
    await box(page, "City or town").fill("Norman")
    await box(page, "State").fill("Oklahoma")
    await box(page, "LPA district number").fill("8")
    await box(page, "Occupation (optional)").fill("School librarian")

    await box(page, "About me").fill(`I like slow mornings. ${tag}`)
    await expect(page.getByText(`${`I like slow mornings. ${tag}`.length}/500`)).toBeVisible()
    await expect(box(page, "Occupation")).toHaveValue("School librarian") // same value in Details
    await page.getByRole("combobox", { name: "Education" }).click()
    await page.getByRole("option", { name: "Masters" }).click()

    // Interests: remove one, add a suggested one, add my own (Enter), add my own (button).
    await page.getByRole("button", { name: "Remove Cooking" }).click()
    await chip(page, "Travel").click()
    await box(page, "Add your own interest").fill(`Quilting ${tag}`)
    await page.keyboard.press("Enter")
    await box(page, "Add your own interest").fill("Birdwatching")
    await page.getByRole("button", { name: "Add", exact: true }).click()
    await expect(page.getByText("Your Interests (3/10)")).toBeVisible()

    await chip(page, "Friendship").click()
    await chip(page, "Serious relationship").click()
    await chip(page, "Serious relationship").click() // toggles off again
    await chip(page, "Personal growth").click()
    await chip(page, "English").click()
    await chip(page, "Spanish").click()
    await box(page, "Cultural background").fill("Irish-American")
    await page.getByRole("combobox", { name: "Religion" }).click()
    await page.getByRole("option", { name: "Prefer not to say" }).click()
    await box(page, "Personal preferences").fill("Kindness and a sense of humour.")

    await chip(page, "Jazz").click()
    await box(page, "Add your own music").fill(`Zydeco ${tag}`)
    await page.keyboard.press("Enter")
    await chip(page, "Dogs").click()
    await box(page, "Add your own animal").fill("Donkeys")
    await page.keyboard.press("Enter")
    await chip(page, "Lateness").click()
    await box(page, "Add your own pet peeve").fill("Loud chewing")
    await page.keyboard.press("Enter")
    // A custom entry can be taken off again before saving.
    await box(page, "Add your own pet peeve").fill("Mistake")
    await page.keyboard.press("Enter")
    await page.getByRole("button", { name: "Remove Mistake" }).click()

    const prompts: Record<string, string> = {
      "I'm weirdly good at...": "Naming birds by their song",
      "My perfect weekend...": "Farmers market, then a long lunch",
      "Message me if...": "You have a book to recommend",
      "What are you hoping to find on this site?": "Good company, and maybe more",
      "What does a great day look like for you?": "Coffee on the porch and a walk",
      "What values matter most to you in a relationship?": "Honesty and patience",
      "How do you like to show appreciation or affection?": "Cooking for people",
      "What kind of life do you want to build with the right person?": "A quiet one with plenty of laughter",
    }
    for (const [label, value] of Object.entries(prompts)) await box(page, label).fill(value)

    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByText("Profile saved")).toBeVisible()
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible()

    const { user, profile } = await saved(request, me)
    expect(user).toMatchObject({ first_name: "Edith", last_name: "Sample" })
    expect(profile).toMatchObject({
      location_city: "Norman", location_state: "Oklahoma", district_number: "8", occupation: "School librarian",
      bio: `I like slow mornings. ${tag}`, education: "masters", cultural_background: "Irish-American",
      personal_preferences: "Kindness and a sense of humour.",
      prompt_good_at: prompts["I'm weirdly good at..."], prompt_perfect_weekend: prompts["My perfect weekend..."],
      prompt_message_if: prompts["Message me if..."], hoping_to_find: prompts["What are you hoping to find on this site?"],
      great_day: prompts["What does a great day look like for you?"],
      relationship_values: prompts["What values matter most to you in a relationship?"],
      show_affection: prompts["How do you like to show appreciation or affection?"],
      build_with_person: prompts["What kind of life do you want to build with the right person?"],
    })
    expect(profile.interests).toEqual(["Travel", `Quilting ${tag}`, "Birdwatching"])
    expect(profile.languages).toEqual(["English", "Spanish"])
    expect(profile.favorite_music).toEqual(["Jazz", `Zydeco ${tag}`])
    expect(profile.animals).toEqual(["Dogs", "Donkeys"])
    expect(profile.pet_peeves).toEqual(["Lateness", "Loud chewing"])
    expect(JSON.stringify(profile.looking_for_description)).toContain("Friendship")
    expect(JSON.stringify(profile.looking_for_description)).not.toContain("Serious")
    expect(JSON.stringify(profile.life_goals)).toContain("Personal growth")
    expect(String(profile.religion).toLowerCase()).toContain("prefer")

    // Still there after a reload, in view mode.
    await page.reload()
    await expect(page.getByTestId("my-name")).toContainText("Edith Sample")
    await expect(page.getByTestId("my-location")).toHaveText("Norman, Oklahoma")
    await expect(page.getByText("District 8", { exact: true })).toBeVisible()
    for (const text of [`I like slow mornings. ${tag}`, "Irish-American", `Zydeco ${tag}`, "Donkeys", "Loud chewing", "Birdwatching", ...Object.values(prompts)]) {
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
    }

    // What another member sees.
    const other = await signedInPage(browser, viewer, `/profile/${me.id}`)
    await expect(other.getByRole("heading", { name: "Edith", level: 1 })).toBeVisible()
    for (const text of [`I like slow mornings. ${tag}`, "School librarian", `Quilting ${tag}`, `Zydeco ${tag}`, "Donkeys", "Loud chewing", "Spanish", ...Object.values(prompts)]) {
      await expect(other.getByText(text, { exact: true }).first()).toBeVisible()
    }
    await expect(other.getByText("Sample")).toHaveCount(0) // last names are not shown to other members
    await other.context().close()
    await page.context().close()
  })

  test("PRO-07: a failed save says so and keeps the changes; saving again works", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/profile")
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await box(page, "About me").fill("Second attempt lucky.")
    let fail = true
    await page.route("**/api/users/profile", (route) =>
      fail && route.request().method() === "PUT"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "We could not save your changes just now. Please try again." }) })
        : route.fallback()
    )
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByRole("alert").filter({ hasText: "We couldn't save your profile" })).toBeVisible()
    await expect(box(page, "About me")).toHaveValue("Second attempt lucky.")
    fail = false
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByText("Profile saved")).toBeVisible()
    expect((await saved(request, me)).profile.bio).toBe("Second attempt lucky.")
    await page.context().close()
  })

  test("PRO-01: a failed load says so; Try again shows the profile", async ({ browser, request }) => {
    const me = await createMember(request, { firstName: "Faye" })
    const page = await signedInPage(browser, me, "/browse")
    let fail = true
    await page.route("**/api/users/profile", (route) =>
      fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error fetching profile" }) }) : route.fallback()
    )
    await page.goto("/profile")
    await expect(page.getByRole("alert").filter({ hasText: "We could not load your profile" })).toBeVisible()
    fail = false
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(page.getByTestId("my-name")).toContainText("Faye")
    await page.context().close()
  })

  test("PRO-13/14/15/03/39: the three counts link to their screens; Preview shows the card other members see", async ({ browser, request }) => {
    const me = await createMember(request, { firstName: "Gail", interests: ["Reading", "Travel"] })
    const friend = await createMember(request, { firstName: "Hugo" })
    const matchId = await matchMembers(request, me, friend)
    await request.post(`${API}/messages/${matchId}`, { headers: authHeaders(friend.token), data: { content: "Hello Gail" } })
    await updateProfile(request, me, { occupation: "Florist", location_state: "Oklahoma" })

    const page = await signedInPage(browser, me, "/profile")
    const matches = page.getByRole("link", { name: /Total Matches/ })
    await expect(matches).toContainText("1")
    await expect(matches).toHaveAttribute("href", "/matches")
    const messages = page.getByRole("link", { name: /New Messages/ })
    await expect(messages).toContainText("1")
    await expect(messages).toHaveAttribute("href", "/messages")
    const events = page.getByRole("link", { name: /Upcoming Events/ })
    await expect(events).toContainText("0")
    await expect(events).toHaveAttribute("href", "/events")

    await page.getByRole("button", { name: "Preview" }).click()
    const preview = page.getByRole("dialog")
    await expect(preview).toContainText("Profile Preview")
    await expect(preview).toContainText("Gail")
    await expect(preview).toContainText("Florist")
    await expect(preview).toContainText("Reading")
    await page.keyboard.press("Escape")
    await expect(preview).toBeHidden()

    await matches.click()
    await expect(page).toHaveURL(/\/matches$/)
    await page.context().close()
  })
})

test.describe("My Profile: photos", () => {
  test("PRO-50..64 + crop: add with the crop step, add whole, reorder, remove with confirmation", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/profile")
    const photos = async () => ((await saved(request, me)).profile.photos || []) as string[]
    const size = (url: string) =>
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

    // Empty state.
    await page.getByRole("button", { name: /Add your first photo/ }).click()
    const manager = page.getByRole("dialog", { name: "Manage Photos" })
    await expect(manager.getByText("You have no photos yet.")).toBeVisible()
    await expect(manager.getByText("All changes saved")).toBeVisible()
    await manager.getByText("Tips for a good photo").click()
    await expect(manager.getByText("Make your main photo one of just you.")).toBeVisible()

    // A file that is not a picture is refused with a plain message.
    const input = page.getByTestId("photo-file-input")
    await input.setInputFiles({ name: "notes.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") })
    await expect(manager.getByRole("alert")).toContainText("That file is not a photo we can use")
    expect(await photos()).toHaveLength(0)

    // Choose a wide picture: the crop step opens with the tips.
    const wide = await makePng(page, 1200, 600, "#2f6f4f")
    const chooser = page.waitForEvent("filechooser")
    await manager.getByRole("button", { name: "Add Photo" }).click()
    await (await chooser).setFiles({ name: "garden.png", mimeType: "image/png", buffer: wide })
    const crop = page.getByRole("dialog", { name: "Position your photo" })
    await expect(crop.getByRole("list", { name: "Photo tips" })).toContainText("no house numbers, licence plates")
    const canvas = crop.getByTestId("crop-canvas")

    // Cancel uploads nothing.
    await crop.getByRole("button", { name: "Cancel" }).click()
    await expect(crop).toBeHidden()
    expect(await photos()).toHaveLength(0)

    // Keyboard: move and zoom with the buttons and the slider.
    await input.setInputFiles({ name: "garden.png", mimeType: "image/png", buffer: wide })
    await crop.getByRole("button", { name: "Left" }).focus()
    await page.keyboard.press("Enter")
    await page.keyboard.press("Enter")
    await expect(canvas).toHaveAttribute("data-offset-x", "0.20")
    await expect(crop.getByRole("button", { name: "Up" })).toBeDisabled() // nothing hidden above or below yet
    await crop.getByRole("button", { name: "Zoom in" }).focus()
    await page.keyboard.press("Space")
    await expect(canvas).toHaveAttribute("data-zoom", "1.25")
    await expect(crop.getByRole("button", { name: "Up" })).toBeEnabled()
    await crop.getByRole("slider", { name: "Zoom" }).focus()
    await page.keyboard.press("ArrowRight")
    await expect(canvas).toHaveAttribute("data-zoom", "1.3")
    await crop.getByRole("button", { name: "Zoom out" }).click()
    // Dragging the picture moves it too.
    const frame = (await canvas.boundingBox())!
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
    await page.mouse.down()
    await page.mouse.move(frame.x + frame.width / 2 - 60, frame.y + frame.height / 2, { steps: 4 })
    await page.mouse.up()
    expect(Number(await canvas.getAttribute("data-offset-x"))).toBeLessThan(0.2)

    await crop.getByRole("button", { name: "Use photo" }).click()
    await expect(page.getByText("Photo added. It is now your main photo.")).toBeVisible()
    await expect(crop).toBeHidden()
    await expect.poll(photos).toHaveLength(1)
    const first = (await photos())[0]
    const framed = await size(first)
    expect(framed.w / framed.h).toBeCloseTo(0.8, 1) // 4:5, the shape of a profile card
    await expect(manager.getByTestId("managed-photo")).toHaveCount(1)
    await expect(manager.getByText("Main", { exact: true })).toBeVisible()

    // A second one, whole: a very large original is made smaller, same shape.
    await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: await makePng(page, 3200, 1600, "#8a5a2b") })
    await crop.getByRole("button", { name: "Use the whole picture" }).click()
    await expect(page.getByText("Photo added", { exact: true })).toBeVisible()
    await expect.poll(photos).toHaveLength(2)
    const second = (await photos())[1]
    expect(await size(second)).toEqual({ w: 1600, h: 800 })

    // Reorder with the arrows: the second becomes the main photo.
    await expect(manager.getByRole("button", { name: "Move photo 1 earlier" })).toBeDisabled()
    await expect(manager.getByRole("button", { name: "Move photo 2 later" })).toBeDisabled()
    await manager.getByRole("button", { name: "Move photo 2 earlier" }).click()
    await expect.poll(photos).toEqual([second, first])
    expect((await saved(request, me)).profile.profile_picture_url).toBe(second)
    await manager.getByRole("button", { name: "Move photo 1 later" }).click()
    await expect.poll(photos).toEqual([first, second])

    // A failed upload is explained inside the crop step and nothing is added.
    await page.route("**/api/users/photos", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "You can have up to 9 photos. Remove one to add another." }) })
        : route.fallback()
    )
    await input.setInputFiles({ name: "third.png", mimeType: "image/png", buffer: wide })
    await crop.getByRole("button", { name: "Use photo" }).click()
    await expect(crop.getByRole("alert")).toContainText("You can have up to 9 photos")
    await crop.getByRole("button", { name: "Cancel" }).click()
    await page.unroute("**/api/users/photos")

    // Remove asks first.
    await manager.getByRole("button", { name: "Remove photo 2" }).click()
    const confirm = page.getByRole("dialog", { name: "Remove this photo?" })
    await confirm.getByRole("button", { name: "Keep photo" }).click()
    expect(await photos()).toHaveLength(2)
    await manager.getByRole("button", { name: "Remove photo 2" }).click()
    await confirm.getByRole("button", { name: "Remove photo" }).click()
    await expect(page.getByText("Photo removed")).toBeVisible()
    await expect.poll(photos).toEqual([first])

    await manager.getByRole("button", { name: "Done" }).click()
    await expect(manager).toBeHidden()
    // The photo shows on the profile; its tile opens the manager again.
    await page.getByRole("button", { name: "Photo 1. Manage photos" }).click()
    await expect(manager).toBeVisible()
    await manager.getByRole("button", { name: "Done" }).click()
    await page.getByRole("button", { name: "Manage Photos", exact: true }).click()
    await expect(manager).toBeVisible()
    // In edit mode the camera button on the main photo opens it too.
    await manager.getByRole("button", { name: "Done" }).click()
    await page.getByRole("button", { name: "Edit", exact: true }).click()
    await page.getByRole("button", { name: "Change photos" }).click()
    await expect(manager).toBeVisible()
    await page.context().close()
  })

  test("PRO-55: the ninth photo is the last; the limit is explained before any upload", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/profile")
    const png = await makePng(page, 200, 250)
    for (let i = 0; i < 9; i += 1) {
      const res = await request.post(`${API}/users/photos`, {
        headers: authHeaders(me.token),
        multipart: { photo: { name: `p${i}.png`, mimeType: "image/png", buffer: png } },
      })
      expect(res.ok()).toBeTruthy()
    }
    await page.reload()
    await page.getByRole("button", { name: "Manage Photos", exact: true }).click()
    const manager = page.getByRole("dialog", { name: "Manage Photos" })
    await expect(manager.getByTestId("managed-photo")).toHaveCount(9)
    await expect(manager.getByRole("button", { name: "Add Photo" })).toHaveCount(0)
    await manager.getByRole("button", { name: "Done" }).click()
    // Six tiles on the profile, the last one standing for the rest.
    await expect(page.getByRole("button", { name: "Manage photos (4 more)" })).toBeVisible()
    await page.context().close()
  })
})

test.describe("My Profile: completeness helper", () => {
  test("HELP: shows the percentage and next steps; an example fills the field; saving raises the percentage; Hide is remembered", async ({ browser, request }) => {
    const me = await createMember(request, { interests: ["Gardening", "Cooking", "Travel"] })
    const page = await signedInPage(browser, me, "/profile")
    const card = page.getByTestId("completeness")
    // A new member has a bio and three interests: 25%.
    await expect(card.getByRole("heading", { name: "Your profile is 25% complete" })).toBeVisible()
    await expect(card.getByRole("progressbar", { name: "Profile completeness" })).toHaveAttribute("aria-valuenow", "25")
    await expect(card.getByText("Only you see this.")).toBeVisible()
    await expect(card.getByRole("listitem")).toHaveCount(3)
    await expect(card.getByTestId("suggestion-photo")).toContainText("A photo helps other members recognise you at events.")

    // "Add this" on the photo opens the photo manager.
    await card.getByRole("button", { name: "Add this: Add a photo" }).click()
    await expect(page.getByRole("dialog", { name: "Manage Photos" })).toBeVisible()
    await page.getByRole("dialog", { name: "Manage Photos" }).getByRole("button", { name: "Done" }).click()

    // "Add this" on a choice opens the editor at that choice.
    await card.getByRole("button", { name: "Add this: Say what you are looking for" }).click()
    await expect(page.getByRole("button", { name: "Friendship", exact: true })).toBeFocused()
    await expect(card).toBeHidden() // out of the way while editing
    await page.getByRole("button", { name: "Friendship", exact: true }).press("Enter")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByText("Profile saved")).toBeVisible()
    await expect(card.getByRole("heading", { name: "Your profile is 35% complete" })).toBeVisible()

    // An example answer is a starting point: it fills the field, focused, ready to change.
    const example = "Finding the best pie in any town"
    await card.getByTestId("suggestion-prompt_good_at").getByRole("button", { name: new RegExp(example) }).click()
    const field = page.getByRole("textbox", { name: "I'm weirdly good at...", exact: true })
    await expect(field).toHaveValue(example)
    await expect(field).toBeFocused()
    await field.fill(example + " - and eating it")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(card.getByRole("heading", { name: "Your profile is 45% complete" })).toBeVisible()
    const stored = await (await request.get(`${API}/users/profile`, { headers: authHeaders(me.token) })).json()
    expect(stored.profile.prompt_good_at).toBe(example + " - and eating it")

    // An example that is not wanted is thrown away with Cancel.
    await card.getByTestId("suggestion-prompt_perfect_weekend").getByRole("button").nth(1).click()
    await page.getByRole("button", { name: "Cancel" }).click()
    await page.getByRole("dialog", { name: "Discard your changes?" }).getByRole("button", { name: "Discard changes" }).click()
    await expect(card.getByRole("heading", { name: "Your profile is 45% complete" })).toBeVisible()

    await card.getByRole("button", { name: "Hide for now" }).click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId("my-name")).toBeVisible()
    await expect(page.getByTestId("completeness")).toHaveCount(0)
    await page.context().close()
  })

  test("HELP: a complete profile shows no helper, and other members never see one", async ({ browser, request }) => {
    const me = await createMember(request, { firstName: "Lena", interests: ["Gardening", "Cooking", "Travel"] })
    const viewer = await createMember(request)
    await updateProfile(request, me, {
      looking_for_description: ["Friendship"], occupation: "Baker", languages: ["English"],
      prompt_good_at: "Bread", prompt_perfect_weekend: "Markets", prompt_message_if: "You bake", hoping_to_find: "Friends",
    })
    const page = await signedInPage(browser, me, "/profile")
    await expect(page.getByRole("heading", { name: "Your profile is 80% complete" })).toBeVisible() // only the photo is missing
    await expect(page.getByTestId("completeness").getByText("One thing would finish it:")).toBeVisible()
    const res = await request.post(`${API}/users/photos`, {
      headers: authHeaders(me.token),
      multipart: { photo: { name: "p.png", mimeType: "image/png", buffer: await makePng(page, 240, 300) } },
    })
    expect(res.ok()).toBeTruthy()
    await page.reload()
    await expect(page.getByTestId("my-name")).toContainText("Lena")
    await expect(page.getByTestId("completeness")).toHaveCount(0)

    const other = await signedInPage(browser, viewer, `/profile/${me.id}`)
    await expect(other.getByRole("heading", { name: "Lena", level: 1 })).toBeVisible()
    await expect(other.getByText(/% complete/)).toHaveCount(0)
    await other.context().close()
    await page.context().close()
  })
})

test.describe("My Profile: drag to reorder", () => {
  test("PRO-59: dragging a photo onto another changes the order and saves it", async ({ browser, request }) => {
    const me = await createMember(request)
    const page = await signedInPage(browser, me, "/profile")
    for (const colour of ["#2f6f4f", "#8a5a2b"]) {
      const res = await request.post(`${API}/users/photos`, {
        headers: authHeaders(me.token),
        multipart: { photo: { name: "p.png", mimeType: "image/png", buffer: await makePng(page, 240, 300, colour) } },
      })
      expect(res.ok()).toBeTruthy()
    }
    const order = async () => (await (await request.get(`${API}/users/profile`, { headers: authHeaders(me.token) })).json()).profile.photos as string[]
    const [first, second] = await order()
    await page.reload()
    await page.getByRole("button", { name: "Manage Photos", exact: true }).click()
    const tiles = page.getByRole("dialog", { name: "Manage Photos" }).getByTestId("managed-photo")
    await expect(tiles).toHaveCount(2)
    await tiles.nth(1).dragTo(tiles.nth(0))
    await expect.poll(order).toEqual([second, first])
    await page.context().close()
  })
})
