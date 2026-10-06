import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { API, PASSWORD, alertBox, createMember, createUnfinishedMember, makePng, signedInContextWith, uniqueEmail } from "./helpers"
import { shot, shotViewport } from "./shots"

/**
 * axe on every screen, step and dialog a new person meets before they are a
 * member - log in, sign up, the emailed code, forgotten password, terms, each
 * onboarding step, the welcome tour - plus Help, Safety, the not-found page
 * and the offline page. Full WCAG 2.0 / 2.1 A and AA rule sets, light and
 * dark, in the style of a11y-member.spec.ts. Serious and critical findings
 * (which includes every colour-contrast failure) fail the test.
 *
 * Not covered: app/error.tsx ("Something went wrong") only appears when a page
 * crashes, which cannot be caused from a test without breaking a page.
 */
const minor: string[] = []

async function scan(page: Page, name: string, problems: string[], allow: string[] = []) {
  // Let opening animations finish, so positions and colours are the final ones
  // (spinners, which never finish, are left out).
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    ).then(() => undefined)
  )
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .exclude(".bg-yellow-100") // the development-only banner
    .analyze()
  for (const violation of results.violations) {
    if (allow.includes(violation.id)) continue
    for (const node of violation.nodes) {
      const line = `${name} [${violation.id}] ${node.target.join(" ")} :: ${node.failureSummary?.split("\n")[1]?.trim() || ""}`
      if (violation.impact === "serious" || violation.impact === "critical") problems.push(line)
      else minor.push(`${violation.impact}: ${line}`)
    }
  }
}

async function choose(page: Page, label: RegExp, option: string) {
  await page.getByRole("combobox", { name: label }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`A11Y: log in, sign up, verify, forgotten password, terms, not-found and offline pages pass axe (${colorScheme})`, async ({ browser, request }) => {
    test.setTimeout(240_000)
    const member = await createMember(request, { firstName: "Avery" })
    const context = await browser.newContext({ colorScheme, ...(shotViewport ? { viewport: shotViewport } : {}) })
    const page = await context.newPage()
    const problems: string[] = []
    const step = async (name: string, go: () => Promise<void>) => {
      await go()
      await page.waitForLoadState("networkidle").catch(() => {})
      await scan(page, name, problems)
      await shot(page, "signup", colorScheme, name)
    }

    // ---- log in ----
    await step("login", async () => {
      await page.goto("/login")
      await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
    })
    await step("login + wrong password message", async () => {
      await page.locator("#email").fill(member.email)
      await page.locator("#password").fill("Wrong-Pass-2026!")
      await page.getByRole("button", { name: "Sign In" }).click()
      await expect(alertBox(page)).toBeVisible()
    })
    await step("login + password shown", async () => {
      await page.getByRole("button", { name: "Show password" }).click()
      await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible()
    })
    await step("login + signed-out-after-a-while notice", async () => {
      await page.goto("/login?expired=1")
      await expect(page.getByRole("status").filter({ hasText: "signed out" })).toBeVisible()
    })

    // ---- sign up ----
    await step("signup", async () => {
      await page.goto("/signup")
      await expect(page.getByRole("heading", { name: "Create your account", level: 1 })).toBeVisible()
    })
    await step("signup + validation messages", async () => {
      await page.locator("#email").fill("nope")
      await page.locator("#password").fill("short")
      await page.locator("#confirmPassword").fill("different")
      await page.locator("#confirmPassword").blur()
      await expect(page.getByRole("list", { name: "Password rules" })).toBeVisible()
    })
    const email = uniqueEmail("axe")
    await step("signup + email already used message", async () => {
      await page.locator("#email").fill(member.email)
      await page.locator("#password").fill(PASSWORD)
      await page.locator("#confirmPassword").fill(PASSWORD)
      if (!(await page.locator("#terms").isChecked())) await page.locator("#terms").click()
      await page.getByRole("button", { name: "Create Account" }).click()
      await expect(alertBox(page)).toBeVisible()
    })
    await step("verify your email (code screen)", async () => {
      await page.locator("#email").fill(email)
      await page.getByRole("button", { name: "Create Account" }).click()
      await expect(page.getByRole("heading", { name: "Verify your email", level: 1 })).toBeVisible()
    })
    await step("verify your email + wrong code message", async () => {
      const boxes = page.locator('input[maxlength="1"]')
      await expect(boxes).toHaveCount(6)
      for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill("0")
      await page.getByRole("button", { name: "Verify Code" }).click()
      await expect(alertBox(page)).toBeVisible()
    })

    // ---- forgotten password ----
    await step("forgot password", async () => {
      await page.goto("/forgot-password")
      await expect(page.getByRole("heading", { name: "Forgot password?" })).toBeVisible()
    })
    await step("forgot password + validation message", async () => {
      await page.locator("#email").fill("nope")
      await expect(page.getByText("Please enter a valid email address")).toBeVisible()
    })
    await step("forgot password + check your email", async () => {
      await page.locator("#email").fill(member.email)
      await page.getByRole("button", { name: "Send Reset Link" }).click()
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
    })
    await step("reset password", async () => {
      await page.goto(`/reset-password?token=${"a".repeat(64)}`)
      await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible()
    })
    await step("reset password + validation messages", async () => {
      await page.locator("#password").fill("Reset-Pass-2026!")
      await page.locator("#confirmPassword").fill("Reset-Pass-2026?")
      await expect(page.getByText("Passwords do not match")).toBeVisible()
    })
    await step("reset password + link no longer valid message", async () => {
      await page.locator("#confirmPassword").fill("Reset-Pass-2026!")
      await page.getByRole("button", { name: /Reset Password/i }).click()
      await expect(alertBox(page)).toContainText("Invalid or expired reset token")
    })

    // ---- reading pages and dead ends ----
    await step("terms", async () => {
      await page.goto("/terms")
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    })
    await step("privacy", async () => {
      await page.goto("/privacy")
      await expect(page.getByRole("heading", { name: /Privacy Policy/i }).first()).toBeVisible()
    })
    await step("page not found", async () => {
      await page.goto("/no-such-page-here")
      await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible()
    })
    await step("offline page", async () => {
      await page.goto("/offline.html")
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    })

    const unique = [...new Set(problems)]
    expect(unique, unique.join("\n")).toEqual([])
    await context.close()
  })

  test(`A11Y: every onboarding step and dialog, the welcome tour, Help and Safety pass axe (${colorScheme})`, async ({ browser, request }) => {
    test.setTimeout(240_000)
    const who = await createUnfinishedMember(request, "axe-onb")
    const context = await signedInContextWith(browser, who, { colorScheme, ...(shotViewport ? { viewport: shotViewport } : {}) })
    const page = await context.newPage()
    const problems: string[] = []
    const step = async (name: string, go: () => Promise<void>, allow: string[] = []) => {
      await go()
      await scan(page, name, problems, allow)
      await shot(page, "onboarding", colorScheme, name)
    }
    const next = page.getByRole("button", { name: "Next", exact: true })
    const crop = page.getByRole("dialog", { name: "Position your photo" })

    // ---- step 1 ----
    await step("onboarding step 1 (Personal Info)", async () => {
      await page.goto("/onboarding")
      await expect(page.getByRole("heading", { name: "Personal Info", level: 1 })).toBeVisible()
    })
    await step("onboarding step 1 + required-answer messages", async () => {
      await next.click()
      await expect(page.getByText("Please enter your first name")).toBeVisible()
    })
    await step("onboarding step 1 + under-18 message", async () => {
      const d = new Date()
      await page.getByLabel(/Birthday/).fill(`${d.getFullYear() - 10}-01-15`)
      await expect(page.getByText("You must be at least 18 years old")).toBeVisible()
    })
    await step("onboarding step 1 + State list open", async () => {
      await page.getByRole("combobox", { name: /State/ }).click()
      await expect(page.getByRole("option", { name: "Oklahoma", exact: true })).toBeVisible()
      // One rule is set aside for this state only: axe wants a scrolling area
      // to hold something reachable with Tab, but a list of options is moved
      // through with the arrow keys (checked on the next line), not Tab.
      await page.keyboard.press("End")
      await expect(page.getByRole("option", { name: "Wyoming", exact: true })).toBeFocused()
    }, ["scrollable-region-focusable"])
    await page.keyboard.press("Escape")
    await step("onboarding step 1 + Community Guidelines dialog", async () => {
      await page.getByRole("button", { name: "Read Community Guidelines" }).click()
      await expect(page.getByRole("dialog", { name: "D8-LPA Community Guidelines" })).toBeVisible()
    })
    await page.getByRole("button", { name: "I Understand" }).click()
    await step("onboarding step 1 filled in", async () => {
      await page.getByLabel(/First Name/).fill("Mary")
      await page.getByLabel(/Last Name/).fill("Example")
      await page.getByLabel(/Birthday/).fill("1964-07-04")
      await page.getByRole("button", { name: "Female", exact: true }).click()
      await choose(page, /State/, "Oklahoma")
      await choose(page, /District Number/, "District 8")
      await page.getByRole("checkbox", { name: /I agree to the Community Guidelines/ }).click()
      await expect(page.getByText("Please enter your first name")).toBeHidden()
    })

    // ---- step 2 ----
    await step("onboarding step 2 (Profile Setup)", async () => {
      await next.click()
      await expect(page.getByRole("heading", { name: "Profile Setup", level: 1 })).toBeVisible()
    })
    await step("onboarding step 2 + photo message", async () => {
      await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") })
      await expect(alertBox(page)).toContainText("not a picture we can use")
    })
    await step("onboarding step 2 + position your photo", async () => {
      await page.locator('input[type="file"]').setInputFiles({ name: "p.png", mimeType: "image/png", buffer: await makePng(page, 800, 600) })
      await expect(crop.getByRole("button", { name: "Use photo" })).toBeEnabled()
    })
    await step("onboarding step 2 + position your photo, upload failed message", async () => {
      await page.route("**/api/users/photos", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error uploading photo" }) }), { times: 1 })
      await crop.getByRole("button", { name: "Use photo" }).click()
      await expect(crop.getByRole("alert")).toBeVisible()
    })
    await step("onboarding step 2 + photo added, chips chosen, own entry, answers typed", async () => {
      await crop.getByRole("button", { name: "Use photo" }).click()
      await expect(page.getByRole("img", { name: "Your profile picture" })).toBeVisible()
      await page.getByLabel("Short bio about yourself").fill("Retired teacher who loves a good potluck.")
      await page.getByRole("group", { name: "Pick a few interests/hobbies" }).getByRole("button", { name: "Cooking", exact: true }).click()
      await page.getByLabel("Add your own interest", { exact: true }).fill("Quilting")
      await page.getByRole("button", { name: "Add your own interest - add" }).click()
      await page.getByRole("group", { name: "Looking For (Gender)" }).getByRole("button", { name: "Everyone", exact: true }).click()
      await choose(page, /What I'm Looking For/, "Friendship")
    })

    // ---- step 3 ----
    await step("onboarding step 3 (Get to Know Me)", async () => {
      await next.click()
      await expect(page.getByRole("heading", { name: "Get to Know Me", level: 1 })).toBeVisible()
      await page.getByLabel("I'm weirdly good at...").fill("Remembering birthdays")
    })
    await step("onboarding step 3 + could-not-save message", async () => {
      await page.route("**/api/auth/complete-onboarding", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Error completing onboarding" }) }), { times: 1 })
      await page.getByRole("button", { name: "Complete Setup" }).click()
      await expect(alertBox(page)).toBeVisible()
    })

    // ---- finished: the welcome tour, every card ----
    await page.getByRole("button", { name: "Complete Setup" }).click()
    await expect(page).toHaveURL(/\/profile/)
    const tourTitles = ["Welcome to D8-LPA", "Browse: meet other members", "Matches: you both said yes", "Messages: have a conversation", "Events: get together", "Staying safe", "Make it comfortable"]
    for (const [index, title] of tourTitles.entries()) {
      await step(`welcome tour ${index + 1} of ${tourTitles.length}: ${title}`, async () => {
        if (index > 0) await page.getByRole("dialog").getByRole("button", { name: "Next", exact: true }).click()
        await expect(page.getByRole("dialog", { name: title })).toBeVisible()
      })
    }
    await page.getByRole("dialog").getByRole("button", { name: "Finish" }).click()
    await expect(page.getByRole("dialog")).toBeHidden()

    // ---- Help and Safety ----
    await step("help", async () => {
      await page.goto("/help")
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await page.waitForLoadState("networkidle").catch(() => {})
    })
    await step("help + offline banner", async () => {
      await context.setOffline(true)
      await expect(page.getByText(/offline/i).first()).toBeVisible()
    })
    await context.setOffline(false)
    await step("safety", async () => {
      await page.goto("/safety")
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await page.waitForLoadState("networkidle").catch(() => {})
    })

    const unique = [...new Set(problems)]
    expect(unique, unique.join("\n")).toEqual([])
    await context.close()
  })
}

test.afterAll(() => {
  // Findings below the failing level, for whoever reads the run.
  const unique = [...new Set(minor)]
  if (unique.length) console.log(`axe: ${unique.length} moderate/minor finding(s)\n${unique.join("\n")}`)
})
