/**
 * Event dates and times - the one convention, used by the admin event form.
 *
 *   STORED   one exact moment (an ISO/UTC instant such as
 *            "2026-11-02T05:30:00.000Z"). This has not changed, so every event
 *            already in the database shows exactly as it did before.
 *   TYPED    the admin types the calendar date and clock time as they read on
 *            the admin's own device (the device's time zone).
 *   SHOWN    every screen formats the stored moment with the viewer's device
 *            time zone (`toLocaleDateString` / `toLocaleTimeString`, as
 *            app/events/page.tsx does). So a member in the admin's time zone
 *            sees exactly what the admin typed; a member elsewhere sees the
 *            same moment on their own clock.
 *
 * The bug this replaces: the edit form filled the date box with
 * `toISOString().split("T")[0]` (the UTC calendar day) but the time box with
 * the local clock time. For an evening event in the United States the UTC day
 * is already "tomorrow", so opening an event and pressing Save moved it a day
 * later each time.
 *
 * Rules for anyone touching this:
 *   - never use `toISOString()` to get a date or time a person will read or
 *     type - use the helpers below;
 *   - never pass a bare "YYYY-MM-DD" to `new Date()` (it means midnight UTC,
 *     which is the previous evening in the United States).
 */

const pad = (n: number) => String(n).padStart(2, "0")

/** The calendar day of `date` on this device, as a `<input type="date">` value. */
export function toLocalDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The clock time of `date` on this device, as a `<input type="time">` value. */
export function toLocalTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The moment a date box ("YYYY-MM-DD") and a time box ("HH:mm") describe on
 * this device. Returns null when either is not a real date or time.
 */
export function fromLocalInputs(dateValue: string, timeValue: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const t = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(timeValue)
  if (!d || !t) return null
  const [year, month, day, hour, minute] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])]
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  const result = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (Number.isNaN(result.getTime())) return null
  // "February 31" would silently roll over into March.
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) return null
  return result
}

/**
 * False for a clock time that does not exist on that day - the hour skipped
 * when clocks go forward (for example 2:30 am on 14 March 2027 in the United
 * States). The browser would quietly move such a time an hour later.
 */
export function localTimeExists(dateValue: string, timeValue: string): boolean {
  const moment = fromLocalInputs(dateValue, timeValue)
  return !!moment && toLocalTimeInput(moment) === timeValue.slice(0, 5)
}

/**
 * The ISO instant to save for a date box and a time box. When the boxes still
 * show what `original` filled them with, the original instant is returned
 * untouched, so opening an event and saving it without changing the date can
 * never move it (not even by seconds, and not across a clock change).
 */
export function instantToSave(dateValue: string, timeValue: string, original?: string | null): string | null {
  if (original) {
    const was = new Date(original)
    if (!Number.isNaN(was.getTime()) && toLocalDateInput(was) === dateValue && toLocalTimeInput(was) === timeValue.slice(0, 5)) {
      return was.toISOString()
    }
  }
  const moment = fromLocalInputs(dateValue, timeValue)
  return moment ? moment.toISOString() : null
}
