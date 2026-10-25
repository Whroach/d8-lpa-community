import { describe, it, expect } from "vitest"
import { COMPLETENESS_ITEMS, profileCompleteness } from "../../lib/profile-completeness"
import { relativeTimeLabel, formatNotificationTime } from "../../lib/relative-time"

const full = {
  photos: ["a.jpg"],
  bio: "Retired teacher and keen gardener.",
  interests: ["Gardening", "Cooking", "Travel"],
  looking_for_description: ["Friendship"],
  occupation: "Teacher",
  languages: ["English"],
  prompt_good_at: "Pie",
  prompt_perfect_weekend: "Fishing",
  prompt_message_if: "You like books",
  hoping_to_find: "Friends",
}

describe("profile completeness", () => {
  it("weights add up to 100 and every text item has examples", () => {
    expect(COMPLETENESS_ITEMS.reduce((sum, item) => sum + item.weight, 0)).toBe(100)
    for (const key of ["bio", "prompt_good_at", "prompt_perfect_weekend", "prompt_message_if", "hoping_to_find"]) {
      expect(COMPLETENESS_ITEMS.find((item) => item.key === key)?.examples?.length).toBeGreaterThanOrEqual(2)
    }
  })

  it("an empty or missing profile is 0% with the photo suggested first", () => {
    for (const profile of [null, undefined, {}]) {
      const result = profileCompleteness(profile)
      expect(result.percent).toBe(0)
      expect(result.missing[0].key).toBe("photo")
      expect(result.missing).toHaveLength(COMPLETENESS_ITEMS.length)
    }
  })

  it("a full profile is 100% with nothing missing", () => {
    expect(profileCompleteness(full)).toMatchObject({ percent: 100, missing: [] })
  })

  it("counts each part and keeps the suggestions in priority order", () => {
    const result = profileCompleteness({ ...full, photos: [], hoping_to_find: "", languages: [] })
    expect(result.percent).toBe(100 - 20 - 10 - 5)
    expect(result.missing.map((item) => item.key)).toEqual(["photo", "hoping_to_find", "languages"])
  })

  it("is strict about thin answers and tolerant of old data shapes", () => {
    expect(profileCompleteness({ ...full, bio: "Hi" }).missing.map((i) => i.key)).toEqual(["bio"])
    expect(profileCompleteness({ ...full, interests: ["One", "Two"] }).missing.map((i) => i.key)).toEqual(["interests"])
    expect(profileCompleteness({ ...full, interests: ["One", "Two", "  "] }).missing.map((i) => i.key)).toEqual(["interests"])
    // "Looking for" was once stored as a single string.
    expect(profileCompleteness({ ...full, looking_for_description: "Friendship" }).percent).toBe(100)
    expect(profileCompleteness({ ...full, looking_for_description: "" }).missing.map((i) => i.key)).toEqual(["looking_for"])
    expect(profileCompleteness({ ...full, prompt_good_at: "   " }).missing.map((i) => i.key)).toEqual(["prompt_good_at"])
  })

  it("never suggests anything about stature or makes promises about replies", () => {
    const words = JSON.stringify(COMPLETENESS_ITEMS).toLowerCase()
    for (const banned of ["height", "tall", "short stature", "more replies", "more matches", "far more"]) expect(words).not.toContain(banned)
  })
})

describe("times in lists", () => {
  const now = new Date(2026, 9, 5, 15, 0, 0) // Monday 5 October 2026, 3:00 PM on this machine's clock
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000)

  it("uses plain words for recent times", () => {
    expect(relativeTimeLabel(ago(0), now)).toBe("Just now")
    expect(relativeTimeLabel(ago(1), now)).toBe("1 minute ago")
    expect(relativeTimeLabel(ago(45), now)).toBe("45 minutes ago")
    expect(relativeTimeLabel(ago(60), now)).toBe("1 hour ago")
    expect(relativeTimeLabel(ago(5 * 60), now)).toBe("5 hours ago")
  })

  it("names yesterday and weekdays, then gives the date", () => {
    expect(relativeTimeLabel(new Date(2026, 9, 4, 18, 30), now)).toMatch(/^Yesterday at 6:30/)
    expect(relativeTimeLabel(new Date(2026, 9, 4, 23, 59), now)).toMatch(/^Yesterday at 11:59/) // 15 hours ago, but yesterday
    expect(relativeTimeLabel(new Date(2026, 9, 1, 9, 0), now)).toMatch(/^Thursday at 9:00/)
    expect(relativeTimeLabel(new Date(2026, 8, 20, 9, 0), now)).toMatch(/Sep 20$/)
    expect(relativeTimeLabel(new Date(2025, 11, 25, 9, 0), now)).toMatch(/2025/)
  })

  it("returns nothing for a missing or broken date instead of the word Recently", () => {
    expect(formatNotificationTime(undefined, now)).toBeNull()
    expect(formatNotificationTime("not a date", now)).toBeNull()
    expect(formatNotificationTime(ago(3).toISOString(), now)).toMatchObject({ label: "3 minutes ago", iso: ago(3).toISOString() })
  })
})
