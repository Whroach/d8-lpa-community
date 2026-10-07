"use client"

import { useEffect, useState } from "react"
import { CalendarPlus, Users, Loader2, Car } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { api } from "@/lib/api"
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar"

interface Attendee {
  id: string
  first_name: string
  photo: string | null
  note: string
  is_me: boolean
}

/**
 * The extras under an event: add it to a calendar, see who is going, and
 * leave a short note (a lift offered or wanted, "first time - say hello").
 */
export function EventExtras({
  event,
  isJoined,
  canRsvp,
}: {
  event: CalendarEvent & { id: string; my_note?: string }
  isJoined: boolean
  canRsvp: boolean
}) {
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const [note, setNote] = useState(event.my_note || "")
  const [savedNote, setSavedNote] = useState(event.my_note || "")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setAttendees(null)
    api.events.getAttendees(event.id).then((result) => {
      if (cancelled) return
      setAttendees(result.data || [])
      const mine = (result.data || []).find((a: Attendee) => a.is_me)
      if (mine) {
        setNote(mine.note || "")
        setSavedNote(mine.note || "")
      }
    })
    return () => {
      cancelled = true
    }
    // Re-read when the member joins or leaves.
  }, [event.id, isJoined])

  const saveNote = async () => {
    setIsSaving(true)
    const result = await api.events.saveNote(event.id, note.trim())
    setIsSaving(false)
    if (result.error) {
      toast.error(`Your note was not saved. ${result.error}`)
      return
    }
    setSavedNote(note.trim())
    setAttendees((prev) => (prev ? prev.map((a) => (a.is_me ? { ...a, note: note.trim() } : a)) : prev))
    toast.success(note.trim() ? "Note saved" : "Note removed")
  }

  return (
    <div className="mt-4 space-y-5 text-left">
      {canRsvp && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => downloadIcs(event)}>
            <CalendarPlus aria-hidden="true" />
            Add to my calendar
          </Button>
          <Button asChild variant="outline">
            <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
              Add to Google Calendar
            </a>
          </Button>
        </div>
      )}

      {isJoined && canRsvp && (
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <Label htmlFor="event-note" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Car className="h-5 w-5" aria-hidden="true" />
            Add a note for other members (optional)
          </Label>
          <p className="text-sm text-muted-foreground">
            For example: “Driving from Tulsa, two seats free” or “First time - please say hello”.
          </p>
          <div className="flex gap-2">
            <Input
              id="event-note"
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              className="bg-background"
            />
            <Button type="button" onClick={saveNote} disabled={isSaving || note.trim() === savedNote}>
              {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save note
            </Button>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Users className="h-5 w-5" aria-hidden="true" />
          Who&apos;s going
        </h3>
        {attendees === null ? (
          <p className="text-base text-muted-foreground" role="status">
            Loading…
          </p>
        ) : attendees.length === 0 ? (
          <p className="text-base text-muted-foreground">Nobody has said they are going yet. You could be the first.</p>
        ) : (
          <ul className="space-y-2" data-testid="attendee-list">
            {attendees.map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={person.photo || undefined} alt="" />
                  <AvatarFallback>{person.first_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 text-base text-foreground">
                  <span className="font-medium">
                    {person.first_name}
                    {person.is_me ? " (you)" : ""}
                  </span>
                  {person.note && <span className="block text-muted-foreground">“{person.note}”</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
