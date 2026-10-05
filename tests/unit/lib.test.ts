import { describe, it, expect } from "vitest"
import { detectSafetyFlags, safetyNoteFor } from "../../lib/safety"
import { conversationStarters, sharedInterests } from "../../lib/icebreakers"
import { buildIcs, googleCalendarUrl, toCalendarStamp } from "../../lib/calendar"
import { isWithinQuietHours } from "../../lib/store/notification-store"

describe("scam reminders", () => {
  it.each([
    ["Can you buy me a couple of gift cards?", "gift_cards"],
    ["Just scratch off the back and send the code", "gift_cards"],
    ["I have a great bitcoin investment opportunity", "crypto"],
    ["Could you send me $200 until Friday", "money"],
    ["I need a wire transfer for the hospital bill", "money"],
    ["let's talk on WhatsApp instead", "off_platform"],
    ["text me at 555 0100", "off_platform"],
    ["what is the verification code they sent you", "personal_details"],
  ])("flags %j as %s", (text, flag) => {
    expect(detectSafetyFlags(text)).toContain(flag)
    expect(safetyNoteFor(text)?.note).toBeTruthy()
  })

  it.each([
    "How was the picnic on Saturday?",
    "I gave my niece a card for her birthday",
    "My garden is doing well this year",
    "I transferred to the Tulsa chapter last spring",
    "",
  ])("leaves ordinary conversation alone: %j", (text) => {
    expect(detectSafetyFlags(text)).toEqual([])
    expect(safetyNoteFor(text)).toBeNull()
  })
})

describe("conversation starters", () => {
  it("leads with what two members have in common", () => {
    const starters = conversationStarters(["Gardening", "Chess"], ["gardening ", "Fishing"], "Blake")
    expect(starters).toHaveLength(3)
    expect(starters[0]).toMatch(/gardening/i)
    expect(starters[1]).toMatch(/fishing/i) // something of theirs to ask about
    expect(sharedInterests(["Gardening", "Chess"], ["gardening ", "Fishing"])).toEqual(["gardening "])
  })

  it("falls back to friendly general openers", () => {
    const starters = conversationStarters([], [], "Sam")
    expect(starters).toHaveLength(3)
    expect(starters[0]).toContain("Hello Sam!")
  })
})

describe("add to calendar", () => {
  const event = {
    id: "abc",
    title: "Picnic, with games; and cake",
    description: "Bring a dish\nto share",
    location: "Riverside Park, Tulsa",
    start_date: "2026-10-10T16:00:00.000Z",
    end_date: "2026-10-10T19:30:00.000Z",
  }

  it("writes a valid calendar file with reminders", () => {
    const ics = buildIcs(event, new Date("2026-10-01T00:00:00Z"))
    expect(ics).toContain("BEGIN:VEVENT")
    expect(ics).toContain("DTSTART:20261010T160000Z")
    expect(ics).toContain("DTEND:20261010T193000Z")
    expect(ics).toContain("SUMMARY:Picnic\\, with games\\; and cake")
    expect(ics).toContain("DESCRIPTION:Bring a dish\\nto share")
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2)
    expect(ics.split("\r\n").length).toBeGreaterThan(10)
  })

  it("assumes two hours when there is no end time, and builds a Google link", () => {
    const ics = buildIcs({ ...event, end_date: undefined })
    expect(ics).toContain("DTEND:20261010T180000Z")
    expect(toCalendarStamp(new Date("2026-01-02T03:04:05Z"))).toBe("20260102T030405Z")
    const url = new URL(googleCalendarUrl(event))
    expect(url.hostname).toBe("calendar.google.com")
    expect(url.searchParams.get("dates")).toBe("20261010T160000Z/20261010T193000Z")
  })
})

describe("quiet hours", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 4, h, m)
  it("covers a period that crosses midnight", () => {
    const quiet = { enabled: true, start: "21:00", end: "08:00" }
    expect(isWithinQuietHours(quiet, at(23))).toBe(true)
    expect(isWithinQuietHours(quiet, at(7, 59))).toBe(true)
    expect(isWithinQuietHours(quiet, at(8))).toBe(false)
    expect(isWithinQuietHours(quiet, at(12))).toBe(false)
    expect(isWithinQuietHours(quiet, at(21))).toBe(true)
  })
  it("covers a daytime period, and does nothing when switched off", () => {
    expect(isWithinQuietHours({ enabled: true, start: "13:00", end: "15:00" }, at(14))).toBe(true)
    expect(isWithinQuietHours({ enabled: true, start: "13:00", end: "15:00" }, at(16))).toBe(false)
    expect(isWithinQuietHours({ enabled: false, start: "00:00", end: "23:59" }, at(14))).toBe(false)
  })
})
