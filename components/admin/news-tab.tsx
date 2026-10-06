"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"
import { ConfirmDialog } from "./moderation-dialog"
import { ErrorNote, SectionIntro, Whom, adminToast, formatDateTime } from "./shared"

interface Announcement {
  id: string
  title: string
  message: string
  created_at: string
  sent_to?: number
}

/** Announcements sent to every member's Notifications. */
export function NewsTab() {
  const [items, setItems] = useState<Announcement[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [form, setForm] = useState({ title: "", message: "" })
  const [postError, setPostError] = useState("")
  const [confirmPost, setConfirmPost] = useState(false)
  const [posting, setPosting] = useState(false)
  const [withdrawing, setWithdrawing] = useState<Announcement | null>(null)
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")

  const load = useCallback(async () => {
    const result = await api.admin.getAnnouncements()
    if (result.error || !result.data) {
      setLoadError(result.error || "No answer from the server.")
      return
    }
    setLoadError("")
    setItems(result.data as Announcement[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const post = async () => {
    setPosting(true)
    setPostError("")
    const result = await api.admin.createAnnouncement(form.title.trim(), form.message.trim())
    setPosting(false)
    setConfirmPost(false)
    if (result.error || !result.data) {
      setPostError(`The announcement was not sent. ${result.error || "Please try again."}`)
      return
    }
    const sent = result.data as Announcement
    setItems((prev) => [sent, ...(prev || [])])
    setForm({ title: "", message: "" })
    adminToast.success(
      sent.sent_to === undefined ? "Announcement sent" : `Announcement sent to ${sent.sent_to} ${sent.sent_to === 1 ? "member" : "members"}`
    )
  }

  const withdraw = async () => {
    if (!withdrawing) return
    setWithdrawBusy(true)
    setWithdrawError("")
    // This used to remove the row from the screen only; the announcement
    // stayed in every member's inbox.
    const result = await api.admin.deleteAnnouncement(withdrawing.id)
    setWithdrawBusy(false)
    if (result.error) {
      setWithdrawError(`The announcement was not withdrawn. ${result.error}`)
      return
    }
    setItems((prev) => (prev || []).filter((n) => n.id !== withdrawing.id))
    setWithdrawing(null)
    adminToast.success("Announcement withdrawn")
  }

  const ready = Boolean(form.title.trim() && form.message.trim())

  return (
    <section aria-labelledby="news-heading">
      <SectionIntro id="news-heading" title="News">
        Send an announcement to the whole community. It arrives in each member’s Notifications, for everyone who has
        news notices switched on (suspended and banned members are left out). You can withdraw it afterwards.
      </SectionIntro>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-4">
          <h3 className="text-lg font-semibold text-foreground">Post News to All Members</h3>
          <div className="space-y-2">
            <Label htmlFor="news-title" className="text-base">Title</Label>
            <Input
              id="news-title"
              placeholder="e.g., Picnic moved to Sunday"
              value={form.title}
              maxLength={150}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="news-message" className="text-base">Message</Label>
            <Textarea
              id="news-message"
              value={form.message}
              maxLength={2000}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              rows={4}
              className="text-base"
            />
          </div>
          {postError && <ErrorNote>{postError}</ErrorNote>}
          <Button className="min-h-11" onClick={() => { setPostError(""); setConfirmPost(true) }} disabled={!ready}>
            Post to All Members
          </Button>
        </CardContent>
      </Card>

      <h3 className="mb-3 text-lg font-semibold text-foreground">Previous Announcements</h3>
      {loadError && !items ? (
        <LoadError what="the announcements" detail={loadError} onRetry={load} />
      ) : !items ? (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading announcements</span>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-border py-10 text-center text-base text-muted-foreground">
          No announcements posted yet
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} data-testid="news-row" className="space-y-2 rounded-lg border-2 border-border bg-card p-4">
              <p className="break-words text-lg font-semibold text-foreground">{item.title}</p>
              <p className="whitespace-pre-wrap break-words text-base text-foreground">{item.message}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(item.created_at)}
                {item.sent_to !== undefined ? ` · sent to ${item.sent_to} ${item.sent_to === 1 ? "member" : "members"}` : ""}
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => { setWithdrawError(""); setWithdrawing(item) }}>
                Withdraw<Whom name={`the announcement "${item.title}"`} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmPost}
        title="Send this announcement to all members?"
        confirmLabel="Send to all members"
        cancelLabel="Not yet"
        busy={posting}
        onConfirm={post}
        onClose={() => setConfirmPost(false)}
      >
        “{form.title.trim()}” will appear in the Notifications of every member who has news notices switched on, straight
        away. You can withdraw it afterwards, but some members may already have read it.
      </ConfirmDialog>

      <ConfirmDialog
        open={withdrawing !== null}
        title={`Withdraw "${withdrawing?.title || ""}"?`}
        confirmLabel="Withdraw announcement"
        cancelLabel="Keep it"
        destructive
        busy={withdrawBusy}
        error={withdrawError}
        onConfirm={withdraw}
        onClose={() => setWithdrawing(null)}
      >
        It will be removed from every member’s Notifications and cannot be brought back. Members who have already read
        it are not told it was withdrawn.
      </ConfirmDialog>
    </section>
  )
}
