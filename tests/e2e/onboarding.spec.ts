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

/** The tips and "position your photo" step that opens after a picture is chosen. */
const cropStep = (page: Page) => page.getByRole("dialog", { name: "Position your photo" })

/** Chooses a picture and accepts it as framed in the crop step. */
async function addPhoto(page: Page, buffer: Buffer = TINY_PNG) {
  await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer })
  await cropStep(page).getByRole("button", { name: "Use photo" }).click()
  await expect(cropStep(page)).toBeHidden()
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

    await addPhoto(page)
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
    await addPhoto(page)
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
    await addPhoto(page)
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

test.describe("onboarding: the whole form, step by step", () => {
  test("ONB step 1: required answers, messages, 18+, guidelines dialog, Back/Next", async ({ browser, request }) => {
    const who = await createUnfinishedMember(request)
    const page = await openOnboarding(browser, who)
    // Shell: progress, step labels, Required chip, no Back or Skip on step 1.
    await expect(page.getByText("Step 1 of 3")).toBeVisible()
    await expect(page.getByText("33% complete")).toBeVisible()
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1")
    await expect(page.getByRole("listitem").filter({ hasText: "Personal Info" })).toHaveAttribute("aria-current", "step")
    await expect(page.getByText("Required", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Skip for now" })).toHaveCount(0)

    // Next with nothing filled in explains what is missing, field by field.
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Personal Info", level: 1 })).toBeVisible()
    for (const message of [
      "Please enter your first name", "Please enter your last name", "Please enter your date of birth", "Please choose one",
      "Please choose your state", "Please choose your district", "Please tick the box to agree to the Community Guidelines",
    ]) await expect(page.getByText(message)).toBeVisible()
    await expect(alertBox(page)).toContainText("Some required answers are missing")
    await expect(page.getByLabel(/First Name/)).toHaveAttribute("aria-invalid", "true")
    await expect(page.getByLabel(/First Name/)).toBeFocused()

    // Under 18 is refused.
    const young = new Date()
    young.setFullYear(young.getFullYear() - 17)
    await page.getByLabel(/First Name/).fill("Mary")
    await page.getByLabel(/Last Name/).fill("Example")
    await page.getByLabel(/Birthday/).fill(young.toISOString().slice(0, 10))
    await expect(page.getByText("You must be at least 18 years old")).toBeVisible()
    await page.getByLabel(/Birthday/).fill("1964-07-04")
    await expect(page.getByText("You must be at least 18 years old")).toBeHidden()

    // Gender is a single choice and says which one is chosen.
    await page.getByRole("button", { name: "Male", exact: true }).click()
    await page.getByRole("button", { name: "Non-binary", exact: true }).click()
    await page.getByRole("button", { name: "Prefer not to say", exact: true }).click()
    await page.getByRole("button", { name: "Female", exact: true }).click()
    await expect(page.getByRole("button", { name: "Female", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("button", { name: "Male", exact: true })).toHaveAttribute("aria-pressed", "false")

    await choose(page, /State/, "Oklahoma")
    await choose(page, /District Number/, "District 8")
    await page.getByLabel(/City or town/).fill("Tulsa")

    // Guidelines dialog: open, read, close with the button and with Escape.
    await page.getByRole("button", { name: "Read Community Guidelines" }).click()
    const dialog = page.getByRole("dialog", { name: "D8-LPA Community Guidelines" })
    await expect(dialog.getByText("1. Respect & Kindness")).toBeVisible()
    await expect(dialog.getByText("7. Consequences")).toBeVisible()
    await dialog.getByRole("button", { name: "I Understand" }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole("button", { name: "Read Community Guidelines" }).click()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    // Reading them does not tick the box for you.
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page.getByText("Please tick the box to agree to the Community Guidelines")).toBeVisible()
    await page.getByRole("checkbox", { name: /I agree to the Community Guidelines/ }).click()

    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Profile Setup", level: 1 })).toBeVisible()
    await expect(page.getByText("Step 2 of 3")).toBeVisible()
    await expect(page.getByText("67% complete")).toBeVisible()
    await expect(page.getByText("Optional", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await expect(page.getByLabel(/First Name/)).toHaveValue("Mary")
    await expect(page.getByLabel(/City or town/)).toHaveValue("Tulsa")
    await page.context().close()
  })

  test("ONB steps 2 and 3: every field, chip, custom entry, dropdown and counter - and every value is saved", async ({ browser, request }) => {
    test.setTimeout(150_000)
    const who = await createUnfinishedMember(request)
    const page = await openOnboarding(browser, who)
    await fillStepOne(page, "Mary")
    await page.getByLabel(/City or town/).fill("Tulsa")
    await page.getByRole("button", { name: "Next", exact: true }).click()

    // Upload validation.
    const file = page.locator('input[type="file"]')
    await file.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") })
    await expect(alertBox(page)).toContainText("not a picture we can use")
    // Phone photos are made smaller before upload, so only very big files are refused up front.
    await file.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.concat([TINY_PNG, Buffer.alloc(25 * 1024 * 1024 + 10)]) })
    await expect(alertBox(page)).toContainText("too large (over 25 MB)")
    await expect(cropStep(page)).toBeHidden()
    // A file that only claims to be a picture cannot be opened, so it cannot be used.
    await file.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("this is not really a png") })
    await expect(cropStep(page).getByRole("alert")).toContainText("We could not open that picture")
    await expect(cropStep(page).getByRole("button", { name: "Use photo" })).toBeDisabled()
    await expect(cropStep(page).getByRole("button", { name: "Use the whole picture" })).toBeDisabled()
    await cropStep(page).getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByText("Click to upload profile picture")).toBeVisible()
    await addPhoto(page)
    await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible()

    // Bio with its counter (stops at 300).
    await page.getByLabel("Short bio about yourself").fill("x".repeat(320))
    await expect(page.getByText("300/300")).toBeVisible()
    await page.getByLabel("Short bio about yourself").fill("Retired teacher who loves a good potluck.")
    await expect(page.getByText("41/300")).toBeVisible()
    await page.getByLabel("Occupation").fill("Retired teacher")
    await page.getByLabel("Education").fill("College degree")

    // Chips: select, deselect, add your own (button and Enter), no duplicates.
    const group = (name: string) => page.getByRole("group", { name })
    const interests = group("Pick a few interests/hobbies")
    for (const chip of ["Cooking", "Travel", "Reading"]) await interests.getByRole("button", { name: chip, exact: true }).click()
    await interests.getByRole("button", { name: "Reading", exact: true }).click()
    await expect(interests.getByRole("button", { name: "Cooking", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(interests.getByRole("button", { name: "Reading", exact: true })).toHaveAttribute("aria-pressed", "false")
    await interests.getByLabel("Add your own interest", { exact: true }).fill("Quilting")
    await interests.getByRole("button", { name: "Add your own interest - add" }).click()
    await expect(interests.getByRole("button", { name: "Quilting", exact: true })).toHaveAttribute("aria-pressed", "true")
    await interests.getByLabel("Add your own interest", { exact: true }).fill("Bird watching")
    await interests.getByLabel("Add your own interest", { exact: true }).press("Enter")
    await interests.getByLabel("Add your own interest", { exact: true }).fill("quilting")
    await interests.getByLabel("Add your own interest", { exact: true }).press("Enter")
    await expect(interests.getByRole("button", { name: /^quilting$/i })).toHaveCount(1)
    await expect(interests.getByRole("button", { name: "Add your own interest - add" })).toBeDisabled()

    const music = group("Favorite Music")
    await music.getByRole("button", { name: "Country", exact: true }).click()
    await music.getByRole("button", { name: "Jazz", exact: true }).click()
    await music.getByLabel("Add your own music", { exact: true }).fill("Gospel")
    await music.getByRole("button", { name: "Add your own music - add" }).click()

    const animals = group("Favorite Animals")
    await animals.getByRole("button", { name: "Dogs", exact: true }).click()
    await expect(animals.getByRole("button", { name: "Ferrets", exact: true })).toHaveCount(1)
    await animals.getByLabel("Add your own animal", { exact: true }).fill("Donkeys")
    await animals.getByLabel("Add your own animal", { exact: true }).press("Enter")

    const peeves = group("Pet Peeves")
    await peeves.getByRole("button", { name: "Being late", exact: true }).click()
    await peeves.getByLabel("Add your own pet peeve", { exact: true }).fill("Slow walkers")
    await peeves.getByRole("button", { name: "Add your own pet peeve - add" }).click()

    // Looking for: "Everyone" clears the others and the other way round.
    const looking = group("Looking For (Gender)")
    await looking.getByRole("button", { name: "Women", exact: true }).click()
    await looking.getByRole("button", { name: "Everyone", exact: true }).click()
    await expect(looking.getByRole("button", { name: "Women", exact: true })).toHaveAttribute("aria-pressed", "false")
    await looking.getByRole("button", { name: "Men", exact: true }).click()
    await looking.getByRole("button", { name: "Non-binary", exact: true }).click()
    await expect(looking.getByRole("button", { name: "Everyone", exact: true })).toHaveAttribute("aria-pressed", "false")

    await choose(page, "What I'm Looking For", "Friendship")

    // Age range: typing is not rewritten half-way; out-of-range values are tidied on leaving the box.
    await page.getByLabel("Min Age").fill("45")
    await page.getByLabel("Max Age").fill("70")
    await page.getByLabel("Max Age").blur()
    await expect(page.getByText("Age range: 45 - 70")).toBeVisible()
    await page.getByLabel("Min Age").fill("7")
    await page.getByLabel("Min Age").blur()
    await expect(page.getByLabel("Min Age")).toHaveValue("18")
    await page.getByLabel("Min Age").fill("45")
    await page.getByLabel("Min Age").blur()

    await page.getByLabel("Personal Preferences").fill("Kindness and a sense of humor.")
    await expect(page.getByText("30/500")).toBeVisible()

    const languages = group("Languages")
    await languages.getByRole("button", { name: "English", exact: true }).click()
    await languages.getByRole("button", { name: "Spanish", exact: true }).click()
    await page.getByLabel("Cultural Background").fill("Cherokee")
    await choose(page, "Religion", "Spiritual but not religious")
    await choose(page, "Life Goals", "Adventure and travel")

    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Get to Know Me", level: 1 })).toBeVisible()
    await expect(page.getByText("Step 3 of 3")).toBeVisible()
    await expect(page.getByText("100% complete")).toBeVisible()
    await expect(page.getByRole("button", { name: "Skip for now" })).toHaveCount(0)

    const prompts: Record<string, string> = {
      "I'm weirdly good at...": "Crossword puzzles",
      "A perfect weekend looks like...": "Coffee, garden, a movie",
      "You should message me if...": "You like road trips",
      "My ideal type of connection is...": "A good friend first",
      "A great day for me includes...": "Sunshine and music",
      "In a relationship, I value...": "Honesty",
      "I show I care by...": "Cooking dinner",
      "My vision for the future is...": "Seeing the national parks",
    }
    for (const [label, answer] of Object.entries(prompts)) await page.getByLabel(label).fill(answer)
    await page.getByLabel("I'm weirdly good at...").fill("y".repeat(520))
    await expect(page.getByText("500/500")).toBeVisible()
    await page.getByLabel("I'm weirdly good at...").fill("Crossword puzzles")
    await expect(page.getByText("17/500")).toBeVisible()

    // Back keeps everything.
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await expect(page.getByLabel("Occupation")).toHaveValue("Retired teacher")
    await expect(group("Favorite Music").getByRole("button", { name: "Gospel", exact: true })).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: "Next", exact: true }).click()

    // A failed save says so and keeps the answers; the second try works.
    await page.route("**/api/auth/complete-onboarding", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "We could not save your profile just now. Please try again." }) }), { times: 1 })
    await page.getByRole("button", { name: "Complete Setup" }).click()
    await expect(alertBox(page)).toContainText("We could not save your profile just now")
    await expect(page.getByLabel("I show I care by...")).toHaveValue("Cooking dinner")
    await page.getByRole("button", { name: "Complete Setup" }).click()
    await expect(page).toHaveURL(/\/profile/)

    // Every value entered is on the profile.
    const { user, profile } = await profileOf(request, who.token)
    expect(user).toMatchObject({ first_name: "Mary", last_name: "Example", gender: "female", onboarding_completed: true, agreed_to_guidelines: true })
    expect(String(user.birthdate)).toMatch(/^1964-07-04/)
    expect(profile).toMatchObject({
      location_state: "Oklahoma",
      location_city: "Tulsa",
      district_number: "district_8",
      bio: "Retired teacher who loves a good potluck.",
      occupation: "Retired teacher",
      education: "College degree",
      interests: ["Cooking", "Travel", "Quilting", "Bird watching"],
      favorite_music: ["Country", "Jazz", "Gospel"],
      animals: ["Dogs", "Donkeys"],
      pet_peeves: ["Being late", "Slow walkers"],
      looking_for_description: ["Friendship"],
      age_preference_min: 45,
      age_preference_max: 70,
      personal_preferences: "Kindness and a sense of humor.",
      languages: ["English", "Spanish"],
      cultural_background: "Cherokee",
      religion: "Spiritual but not religious",
      life_goals: ["Adventure and travel"],
      prompt_good_at: "Crossword puzzles",
      prompt_perfect_weekend: "Coffee, garden, a movie",
      prompt_message_if: "You like road trips",
      hoping_to_find: "A good friend first",
      great_day: "Sunshine and music",
      relationship_values: "Honesty",
      show_affection: "Cooking dinner",
      build_with_person: "Seeing the national parks",
    })
    expect([...profile.looking_for_gender].sort()).toEqual(["male", "non_binary"])
    expect(profile.photos).toHaveLength(1)

    // ...and My Profile shows it. No trip back to onboarding.
    await expect(page.getByText("Retired teacher who loves a good potluck.").first()).toBeVisible()
    await expect(page.getByText(/Mary/).first()).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/\/profile/)
    await page.goto("/onboarding")
    await expect(page).toHaveURL(/\/profile/)
    await page.context().close()
  })

  test("ONB: someone who logged in before finishing is not sent back to onboarding afterwards; signed-out visitors go to login", async ({ page, request }) => {
    await page.goto("/onboarding")
    await expect(page).toHaveURL(/\/login/)

    const who = await createUnfinishedMember(request)
    await page.locator("#email").fill(who.email)
    await page.locator("#password").fill(who.password)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/onboarding/)
    await fillStepOne(page, "Lou")
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await page.getByRole("button", { name: "Skip for now" }).click()
    await expect(page).toHaveURL(/\/profile/)
    await page.waitForTimeout(1500)
    await expect(page).toHaveURL(/\/profile/)
    await page.goto("/browse")
    await expect(page).toHaveURL(/\/browse/)
  })

  test("ONB (API): setting up cannot be finished without the required first step", async ({ request }) => {
    const who = await createUnfinishedMember(request)
    const res = await request.put(`${API}/auth/complete-onboarding`, { headers: authHeaders(who.token), data: { first_name: "No", last_name: "Birthday", gender: "male", agreed_to_guidelines: true } })
    expect(res.status()).toBe(400)
    expect((await res.json()).message).toContain("date of birth")
    expect((await profileOf(request, who.token)).user.onboarding_completed).toBe(false)
  })
})
