"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Calendar, Loader2, MapPin, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"
import { instantToSave, localTimeExists, toLocalDateInput, toLocalTimeInput } from "@/lib/event-dates"
import { ConfirmDialog } from "./moderation-dialog"
import { Chip, ErrorNote, SectionIntro, Whom, adminToast } from "./shared"

interface AdminEvent {
  id: string
  title: string
  description: string
  image?: string
  start_date: string
  end_date?: string
  location: string
  attendees: number
  max_attendees?: number
  category?: string
  is_cancelled?: boolean
}

interface Attendee {
  id: string
  first_name: string
  last_name: string
  email: string
  note?: string
}

const CATEGORIES: [string, string][] = [
  ["local-chapter", "Local Chapter Event"],
  ["regional", "Regional"],
  ["national", "National"],
  ["dating", "Dating"],
  ["outdoor", "Outdoor"],
  ["food", "Food & Drink"],
  ["social", "Social"],
  ["fitness", "Fitness"],
  ["arts", "Arts & Culture"],
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES)

const EMPTY_FORM = {
  title: "",
  description: "",
  image: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  location: "",
  max_attendees: "",
  category: "local-chapter",
}

const dateOptions = { month: "short", day: "numeric", year: "numeric" } as const
const timeOptions = { hour: "numeric", minute: "2-digit" } as const

function formatEventDateRange(startDate: string, endDate?: string) {
  const start = new Date(startDate)
  const startDateStr = start.toLocaleDateString("en-US", dateOptions)
  const startTimeStr = start.toLocaleTimeString("en-US", timeOptions)
  if (!endDate) return `${startDateStr} at ${startTimeStr}`
  const end = new Date(endDate)
  const endDateStr = end.toLocaleDateString("en-US", dateOptions)
  const endTimeStr = end.toLocaleTimeString("en-US", timeOptions)
  if (startDateStr === endDateStr) return `${startDateStr}, ${startTimeStr} - ${endTimeStr}`
  return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`
}

/** Create, change, cancel and delete community events, and see who is going. */
export function EventsTab() {
  const [events, setEvents] = useState<AdminEvent[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminEvent | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState("")
  const [photoError, setPhotoError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [going, setGoing] = useState<AdminEvent | null>(null)
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const [attendeesError, setAttendeesError] = useState("")
  const [confirming, setConfirming] = useState<{ kind: "cancel" | "restore" | "delete"; event: AdminEvent } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState("")

  const load = useCallback(async () => {
    const result = await api.events.getAll()
    if (result.error || !result.data) {
      setLoadError(result.error || "No answer from the server.")
      return
    }
    setLoadError("")
    setEvents(result.data as unknown as AdminEvent[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Each box changes only its own value, starting from the latest form - two
  // boxes filled in quick succession (autofill does this) must not undo each other.
  const patch = (changes: Partial<typeof EMPTY_FORM>) => setForm((prev) => ({ ...prev, ...changes }))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError("")
    setPhotoError("")
    setShowForm(true)
  }

  const openEdit = (event: AdminEvent) => {
    setEditing(event)
    setFormError("")
    setPhotoError("")
    // Date AND time both come from this device's clock (see
    // lib/event-dates.ts). The date used to come from the UTC calendar day,
    // which moved evening events a day later on every save.
    const start = new Date(event.start_date)
    const end = event.end_date ? new Date(event.end_date) : null
    setForm({
      title: event.title,
      description: event.description || "",
      image: event.image || "",
      start_date: toLocalDateInput(start),
      start_time: toLocalTimeInput(start),
      end_date: end ? toLocalDateInput(end) : "",
      end_time: end ? toLocalTimeInput(end) : "",
      location: event.location,
      max_attendees: event.max_attendees?.toString() || "",
      // An event saved without a category keeps none (it used to be given
      // "Dating" just by opening Edit and saving).
      category: event.category || "",
    })
    setShowForm(true)
  }

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    setUploading(true)
    setPhotoError("")
    const result = await api.admin.uploadEventPhoto(file)
    setUploading(false)
    input.value = ""
    if (result.error || !result.data?.url) {
      setPhotoError(`The photo was not added. ${result.error || "Please try another picture."}`)
      return
    }
    const url = result.data.url as string
    setForm((prev) => ({ ...prev, image: url }))
  }

  const save = async () => {
    if (!form.title.trim() || !form.start_date || !form.start_time || !form.location.trim()) {
      setFormError("Please fill in the title, start date, start time and location.")
      return
    }

    // What the admin types is the date and time on their own device; it is
    // saved as one exact moment. See lib/event-dates.ts for the convention.
    if (!localTimeExists(form.start_date, form.start_time)) {
      setFormError("That start time does not exist on that day (the clocks change). Please choose another time.")
      return
    }
    const startIso = instantToSave(form.start_date, form.start_time, editing?.start_date)
    if (!startIso) {
      setFormError("Please check the start date and time.")
      return
    }

    // An end time on its own means "the same day". An end date on its own is
    // not enough to go on.
    let endIso: string | null = null
    if (form.end_date && !form.end_time) {
      setFormError("Please add an end time, or clear the end date.")
      return
    }
    if (form.end_time) {
      const endDate = form.end_date || form.start_date
      if (!localTimeExists(endDate, form.end_time)) {
        setFormError("That end time does not exist on that day (the clocks change). Please choose another time.")
        return
      }
      endIso = instantToSave(endDate, form.end_time, editing?.end_date)
      if (!endIso) {
        setFormError("Please check the end date and time.")
        return
      }
      if (new Date(endIso) < new Date(startIso)) {
        setFormError("The event cannot end before it starts.")
        return
      }
    }

    const places = form.max_attendees.trim()
    if (places && (!/^\d+$/.test(places) || parseInt(places, 10) < 1)) {
      setFormError("The number of places must be 1 or more. Leave it blank for no limit.")
      return
    }

    const eventData = {
      title: form.title.trim(),
      description: form.description,
      // An empty value clears the field when editing (removing the photo, the
      // end time or the limit used to be ignored on save).
      image: form.image || (editing ? "" : undefined),
      start_date: startIso,
      end_date: endIso || (editing ? "" : undefined),
      location: form.location.trim(),
      max_attendees: places ? parseInt(places, 10) : editing ? "" : undefined,
      category: form.category || undefined,
    }

    setFormError("")
    setSaving(true)
    const result = editing ? await api.admin.updateEvent(editing.id, eventData) : await api.admin.createEvent(eventData)
    setSaving(false)

    if (result.error) {
      setFormError(`The event was not saved. ${result.error}`)
      return
    }

    await load()
    adminToast.success(editing ? "Event updated" : "Event created - members who want event notices have been told")
    setShowForm(false)
    setEditing(null)
  }

  const showGoing = async (event: AdminEvent) => {
    setGoing(event)
    setAttendees(null)
    setAttendeesError("")
    const result = await api.admin.getEventAttendees(event.id)
    if (result.error) {
      // Not an empty list: a list that failed must not read as "nobody is going".
      setAttendeesError(`The list could not be loaded. ${result.error}`)
      return
    }
    setAttendees((result.data || []) as Attendee[])
  }

  const confirm = async () => {
    if (!confirming) return
    const { kind, event } = confirming
    setConfirmBusy(true)
    setConfirmError("")
    const result =
      kind === "cancel" ? await api.admin.cancelEvent(event.id) : kind === "restore" ? await api.admin.uncancelEvent(event.id) : await api.admin.deleteEvent(event.id)
    setConfirmBusy(false)
    if (result.error) {
      setConfirmError(`The event was not ${kind === "cancel" ? "cancelled" : kind === "restore" ? "restored" : "deleted"}. ${result.error}`)
      return
    }
    setConfirming(null)
    await load()
    adminToast.success(
      kind === "cancel"
        ? `"${event.title}" is cancelled - members going have been sent a notice`
        : kind === "restore"
          ? `"${event.title}" is back on - members going have been sent a notice`
          : `"${event.title}" has been deleted`
    )
  }

  const now = new Date()
  // An event is over once it has ended - or, with no end time, once it has started.
  const isOver = (event: AdminEvent) => new Date(event.end_date || event.start_date) <= now
  const membersGoing = (n: number) => `${n} ${n === 1 ? "member" : "members"} going`
  const counts = {
    total: events?.length || 0,
    upcoming: (events || []).filter((e) => !isOver(e) && !e.is_cancelled).length,
    past: (events || []).filter((e) => isOver(e) && !e.is_cancelled).length,
    cancelled: (events || []).filter((e) => e.is_cancelled).length,
  }

  return (
    <section aria-labelledby="events-heading">
      <SectionIntro
        id="events-heading"
        title="Events"
        action={
          <Button onClick={openCreate} className="min-h-11 shrink-0">
            <Plus aria-hidden="true" />
            Create Event
          </Button>
        }
      >
        Events appear on every member’s Events page. Creating one sends a notice to members who have event notices
        switched on. Cancelling one sends a notice to the members who said they are going.
      </SectionIntro>

      {loadError && !events ? (
        <LoadError what="the events" detail={loadError} onRetry={load} />
      ) : !events ? (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading events</span>
        </div>
      ) : (
        <>
          {loadError && <ErrorNote className="mb-4">The list could not be refreshed. {loadError}</ErrorNote>}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {([
              ["total", "Total Events"],
              ["upcoming", "Upcoming"],
              ["past", "Past"],
              ["cancelled", "Cancelled"],
            ] as const).map(([key, label]) => (
              <Card key={key}>
                <CardContent className="flex flex-col-reverse p-4 text-center">
                  <p className="text-base text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold text-foreground" data-testid={`event-count-${key}`}>{counts[key]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {events.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
              <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mb-4 text-lg text-foreground">No events yet</p>
              <Button onClick={openCreate} className="min-h-11">
                <Plus aria-hidden="true" />
                Create Your First Event
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {events.map((event) => {
                const isPast = isOver(event)
                return (
                  <li key={event.id} data-testid="event-row" className="space-y-3 rounded-lg border-2 border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {event.image ? (
                          <Image src={event.image} alt="" width={64} height={64} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Calendar className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`break-words text-lg font-semibold text-foreground ${event.is_cancelled ? "line-through" : ""}`}>
                            {event.title}
                          </h3>
                          {event.category && <Chip tone="info">{CATEGORY_LABEL[event.category] || event.category}</Chip>}
                          {event.is_cancelled && <Chip tone="danger">Cancelled</Chip>}
                          {isPast && !event.is_cancelled && <Chip>Past</Chip>}
                        </div>
                        {event.description && <p className="line-clamp-2 break-words text-base text-muted-foreground">{event.description}</p>}
                        <p className="flex items-start gap-2 text-base text-foreground">
                          <Calendar className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                          {formatEventDateRange(event.start_date, event.end_date)}
                        </p>
                        <p className="flex items-start gap-2 break-words text-base text-foreground">
                          <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                          {event.location}
                        </p>
                        <p className="flex items-start gap-2 text-base text-foreground">
                          <Users className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                          {event.attendees}
                          {event.max_attendees ? `/${event.max_attendees}` : ""} attending
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="min-h-11" onClick={() => showGoing(event)}>
                        Who is going<Whom name={event.title} joiner="to" /> ({event.attendees})
                      </Button>
                      <Button variant="outline" className="min-h-11" onClick={() => openEdit(event)}>
                        Edit<Whom name={event.title} />
                      </Button>
                      {event.is_cancelled ? (
                        <Button variant="outline" className="min-h-11" onClick={() => { setConfirmError(""); setConfirming({ kind: "restore", event }) }}>
                          Restore event<Whom name={event.title} />
                        </Button>
                      ) : (
                        <Button variant="outline" className="min-h-11" onClick={() => { setConfirmError(""); setConfirming({ kind: "cancel", event }) }}>
                          Cancel event<Whom name={event.title} />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="min-h-11 border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => { setConfirmError(""); setConfirming({ kind: "delete", event }) }}
                      >
                        Delete<Whom name={event.title} />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {/* Create / edit */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!saving) setShowForm(open) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{editing ? "Edit Event" : "Create New Event"}</DialogTitle>
            <DialogDescription className="text-base">
              {editing
                ? "Members see the changes straight away. They are not sent a notice about an edit."
                : "Members who have event notices switched on are told about the new event as soon as you create it."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title" className="text-base">Event Title *</Label>
              <Input id="event-title" placeholder="e.g., Fall Picnic" value={form.title} aria-required="true" onChange={(e) => patch({ title: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description" className="text-base">Description</Label>
              <Textarea
                id="event-description"
                placeholder="What to expect, what to bring, how to get in"
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={3}
                maxLength={2000}
                className="text-base"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-start-date" className="text-base">Start Date *</Label>
                <Input id="event-start-date" type="date" value={form.start_date} aria-required="true" onChange={(e) => patch({ start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-start-time" className="text-base">Start Time *</Label>
                <Input id="event-start-time" type="time" value={form.start_time} aria-required="true" onChange={(e) => patch({ start_time: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-end-date" className="text-base">End Date</Label>
                <Input id="event-end-date" type="date" value={form.end_date} onChange={(e) => patch({ end_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end-time" className="text-base">End Time</Label>
                <Input id="event-end-time" type="time" value={form.end_time} onChange={(e) => patch({ end_time: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-location" className="text-base">Location *</Label>
              <Input
                id="event-location"
                placeholder="e.g., Riverside Park Pavilion, Tulsa"
                value={form.location}
                aria-required="true"
                onChange={(e) => patch({ location: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-category" className="text-base">Category</Label>
                <Select value={form.category} onValueChange={(value) => patch({ category: value })}>
                  <SelectTrigger id="event-category" className="min-h-11 text-base">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([value, label]) => (
                      <SelectItem key={value} value={value} className="min-h-11 text-base">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-max-attendees" className="text-base">Max Attendees</Label>
                <Input
                  id="event-max-attendees"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Blank = no limit"
                  value={form.max_attendees}
                  onChange={(e) => patch({ max_attendees: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-photo" className="text-base">Upload Event Photo (optional)</Label>
              <Input id="event-photo" type="file" accept="image/*" onChange={uploadPhoto} disabled={uploading} className="h-auto min-h-11" />
              {uploading && <p className="text-base text-muted-foreground" role="status">Uploading...</p>}
              {photoError && <ErrorNote>{photoError}</ErrorNote>}
              {form.image && (
                <div className="space-y-2">
                  <div className="h-32 overflow-hidden rounded-lg bg-muted">
                    <Image src={form.image} alt="Event preview" width={200} height={128} className="h-full w-full object-cover" />
                  </div>
                  <Button variant="outline" className="min-h-11" onClick={() => patch({ image: "" })}>
                    Remove photo
                  </Button>
                </div>
              )}
            </div>

            <p className="text-base text-muted-foreground">
              Dates and times are the ones on your own clock. Members see them in their own time zone.
            </p>

            {formError && <ErrorNote>{formError}</ErrorNote>}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" className="min-h-11" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button className="min-h-11" onClick={save} disabled={saving || !form.title || !form.start_date || !form.start_time || !form.location}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {editing ? "Save Changes" : "Create Event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Who is going */}
      <Dialog open={going !== null} onOpenChange={(open) => { if (!open) setGoing(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Event Attendees</DialogTitle>
            <DialogDescription className="text-base">
              {going ? `${going.title} - ${formatEventDateRange(going.start_date, going.end_date)}, ${going.location}` : ""}
            </DialogDescription>
          </DialogHeader>
          {going && (
            <>
              {attendeesError ? (
                <ErrorNote>{attendeesError}</ErrorNote>
              ) : attendees === null ? (
                <div className="flex justify-center py-8" role="status">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Loading who is going</span>
                </div>
              ) : (
                <>
                  <p className="text-base font-medium text-foreground">
                    {attendees.length} attending
                    {going.max_attendees ? ` of ${going.max_attendees} spots` : ""}
                  </p>
                  {attendees.length === 0 ? (
                    <p className="py-4 text-center text-base text-muted-foreground">No attendees yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {attendees.map((person) => (
                        <li key={person.id} className="rounded-lg border-2 border-border bg-card p-3">
                          <p className="text-base font-semibold text-foreground">{person.first_name} {person.last_name}</p>
                          <p className="break-all text-base text-muted-foreground">{person.email}</p>
                          {person.note && <p className="mt-1 break-words text-base text-foreground">Their note: {person.note}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming !== null}
        title={`${confirming?.kind === "delete" ? "Delete" : confirming?.kind === "restore" ? "Restore" : "Cancel"} "${confirming?.event.title || ""}"?`}
        confirmLabel={confirming?.kind === "delete" ? "Delete event" : confirming?.kind === "restore" ? "Restore event" : "Cancel event"}
        cancelLabel={confirming?.kind === "delete" ? "Keep event" : confirming?.kind === "restore" ? "Leave it cancelled" : "Keep event on"}
        destructive={confirming?.kind !== "restore"}
        busy={confirmBusy}
        error={confirmError}
        onConfirm={confirm}
        onClose={() => setConfirming(null)}
      >
        {!confirming
          ? ""
          : confirming.kind === "delete"
            ? confirming.event.is_cancelled
              ? "It will disappear from every member's Events page and cannot be brought back. It is already cancelled, so the members who were going have been told."
              : `It will disappear from every member's Events page and cannot be brought back. The ${membersGoing(confirming.event.attendees)} will NOT be told. If the event was due to happen, cancel it instead - that tells them.`
            : confirming.kind === "restore"
              ? `It goes back on the Events page as normal, and the ${membersGoing(confirming.event.attendees)} will be sent a notice that it is on again (unless they have switched event notices off).`
              : `It stays on the Events page marked as cancelled, and the ${membersGoing(confirming.event.attendees)} will be sent a notice (unless they have switched event notices off). You can restore it later.`}
      </ConfirmDialog>
    </section>
  )
}
