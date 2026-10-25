/** "Add to calendar" helpers: a standard .ics file and a Google Calendar link. */
export interface CalendarEvent {
  id?: string
  title: string
  description?: string
  location: string
  start_date: string
  end_date?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/** 20261004T180000Z */
export function toCalendarStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

const escapeIcs = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")

function endOf(event: CalendarEvent): Date {
  const start = new Date(event.start_date)
  const end = event.end_date ? new Date(event.end_date) : null
  // No end time given: assume two hours.
  return end && end > start ? end : new Date(start.getTime() + 2 * 60 * 60 * 1000)
}

export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const start = new Date(event.start_date)
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//D8-LPA Community//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id || start.getTime()}@d8lpa`,
    `DTSTAMP:${toCalendarStamp(now)}`,
    `DTSTART:${toCalendarStamp(start)}`,
    `DTEND:${toCalendarStamp(endOf(event))}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs(event.location || "")}`,
    `DESCRIPTION:${escapeIcs(event.description || "")}`,
    // A reminder the day before and two hours before.
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(event.title)} is tomorrow`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(event.title)} starts in two hours`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarStamp(new Date(event.start_date))}/${toCalendarStamp(endOf(event))}`,
    details: event.description || "",
    location: event.location || "",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function downloadIcs(event: CalendarEvent) {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
