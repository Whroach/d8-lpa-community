/**
 * Plain-language times for lists ("5 minutes ago", "Yesterday at 3:15 PM").
 * Before, the notifications list said "Recently" or "Today" for everything.
 */

const clock = (date: Date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

export function relativeTimeLabel(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (dayDiff === 0) {
    const hours = Math.floor(minutes / 60)
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
  }
  if (dayDiff === 1) return `Yesterday at ${clock(date)}`
  if (dayDiff < 7) return `${date.toLocaleDateString(undefined, { weekday: "long" })} at ${clock(date)}`
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

export function formatNotificationTime(
  value: string | undefined | null,
  now: Date = new Date()
): { label: string; iso: string; full: string } | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    label: relativeTimeLabel(date, now),
    iso: date.toISOString(),
    full: date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }),
  }
}
