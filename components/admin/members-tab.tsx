"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"
import { ConfirmDialog, ModerationDialog, type ModerationKind, type ModerationRequest } from "./moderation-dialog"
import {
  ACTION_LABEL,
  Chip,
  ErrorNote,
  FilterButton,
  Pager,
  SectionIntro,
  StatusChip,
  Whom,
  formatDate,
  formatDateTime,
  fullName,
  useDebounced,
  type AdminMember,
} from "./shared"

const PAGE_SIZE = 25

type Filter = "all" | "active" | "warned" | "suspended" | "banned"
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All members" },
  { value: "active", label: "Active" },
  { value: "warned", label: "Warned" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
]

interface MemberPage {
  users: AdminMember[]
  total: number
  page: number
  totalPages: number
  counts: Record<Filter, number>
}

interface AdminNote {
  id: string
  content: string
  admin: string
  created_at: string
}

/**
 * Everyone with an account. The list, the search and the counts all come from
 * the server one page at a time, so it stays quick however large the
 * community grows.
 */
export function MembersTab() {
  const [search, setSearch] = useState("")
  const query = useDebounced(search.trim())
  const [filter, setFilter] = useState<Filter>("all")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MemberPage | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState<ModerationRequest | null>(null)
  const [notesFor, setNotesFor] = useState<AdminMember | null>(null)
  const [historyFor, setHistoryFor] = useState<AdminMember | null>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const ticket = (latest.current += 1)
    setLoading(true)
    const result = await api.admin.getUsers({ page, limit: PAGE_SIZE, q: query, status: filter })
    // A slower, older answer must not replace a newer one.
    if (ticket !== latest.current) return
    setLoading(false)
    if (result.error || !result.data) {
      setError(result.error || "No answer from the server.")
      return
    }
    setError("")
    const body = result.data as unknown as MemberPage
    setData(body)
    // The server gives the last page when the one asked for no longer exists.
    if (body.page !== page) setPage(body.page)
  }, [page, query, filter])

  useEffect(() => {
    void load()
  }, [load])

  // A new search starts again from the first page.
  const lastQuery = useRef(query)
  useEffect(() => {
    if (lastQuery.current !== query) {
      lastQuery.current = query
      setPage(1)
    }
  }, [query])

  const ask = (member: AdminMember, kind: ModerationKind) => setRequest({ kind, member })

  return (
    <section aria-labelledby="members-heading">
      <SectionIntro id="members-heading" title="Members">
        Everyone with an account. Warn, suspend or ban a member here, keep private notes about them, and see what
        has been done before. Members never see notes or who reported them.
      </SectionIntro>

      <Card className="mb-4">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="member-search" className="text-base">Search members</Label>
            <p id="member-search-hint" className="text-sm text-muted-foreground">By name, email address or member ID.</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="member-search"
                type="search"
                placeholder="Search" aria-describedby="member-search-hint"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <FilterButton
                key={f.value}
                label={f.label}
                count={data?.counts?.[f.value]}
                pressed={filter === f.value}
                onClick={() => {
                  setFilter(f.value)
                  setPage(1)
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {error && !data ? (
        <LoadError what="the members" detail={error} onRetry={load} />
      ) : !data ? (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading members</span>
        </div>
      ) : (
        <div aria-busy={loading}>
          {error && <ErrorNote className="mb-4">The list could not be refreshed. {error}</ErrorNote>}
          <p className="sr-only" role="status">
            {loading ? "" : `${data.total} ${data.total === 1 ? "member" : "members"} found`}
          </p>
          {data.users.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="text-lg text-foreground">No members found</p>
              <p className="text-base text-muted-foreground">Try a different name, or choose “All members”.</p>
            </div>
          ) : (
            <ul className="space-y-3" data-testid="member-list">
              {data.users.map((member) => {
                const name = fullName(member)
                const isAdmin = member.role === "admin"
                return (
                  <li key={member.id} data-testid="user-row" className="space-y-3 rounded-lg border-2 border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground" aria-hidden="true">
                        {(member.first_name?.[0] || member.email[0] || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-lg font-semibold text-foreground">{name}</h3>
                          <StatusChip member={member} />
                          {isAdmin && <Chip tone="info">Admin</Chip>}
                        </div>
                        <p data-testid="member-email" className="[overflow-wrap:anywhere] text-base text-muted-foreground">{member.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Joined {formatDate(member.created_at)} · Last active {formatDate(member.last_active)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isAdmin && (
                        <>
                          <Button variant="outline" className="min-h-11" onClick={() => ask(member, "warn")}>
                            Warn<Whom name={name} />
                          </Button>
                          {member.is_suspended ? (
                            <Button variant="outline" className="min-h-11" onClick={() => ask(member, "unsuspend")}>
                              Lift suspension<Whom name={name} joiner="for" />
                            </Button>
                          ) : (
                            <Button variant="outline" className="min-h-11" onClick={() => ask(member, "suspend")}>
                              Suspend<Whom name={name} />
                            </Button>
                          )}
                          {member.is_banned ? (
                            <Button variant="outline" className="min-h-11" onClick={() => ask(member, "unban")}>
                              Lift ban<Whom name={name} joiner="for" />
                            </Button>
                          ) : (
                            <Button variant="outline" className="min-h-11 border-destructive text-destructive hover:bg-destructive/10" onClick={() => ask(member, "ban")}>
                              Ban<Whom name={name} />
                            </Button>
                          )}
                        </>
                      )}
                      <Button variant="ghost" className="min-h-11 underline" onClick={() => setNotesFor(member)}>
                        Notes<Whom name={name} joiner="about" /> ({member.notes_count || 0})
                      </Button>
                      <Button variant="ghost" className="min-h-11 underline" onClick={() => setHistoryFor(member)}>
                        History<Whom name={name} joiner="for" />
                      </Button>
                    </div>
                    {isAdmin && (
                      <p className="text-sm text-muted-foreground">Admin accounts cannot be warned, suspended or banned from here.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <Pager page={data.page} totalPages={data.totalPages} total={data.total} pageSize={PAGE_SIZE} noun="members" onPage={setPage} />
        </div>
      )}

      <ModerationDialog request={request} onClose={() => setRequest(null)} onChanged={load} />
      <NotesDialog
        member={notesFor}
        onClose={() => setNotesFor(null)}
        onCount={(id, count) =>
          setData((prev) => prev && { ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, notes_count: count } : u)) })
        }
      />
      <HistoryDialog member={historyFor} onClose={() => setHistoryFor(null)} />
    </section>
  )
}

/** Private notes admins keep about one member. Saved on the server. */
function NotesDialog({
  member,
  onClose,
  onCount,
}: {
  member: AdminMember | null
  onClose: () => void
  onCount: (memberId: string, count: number) => void
}) {
  const [notes, setNotes] = useState<AdminNote[] | null>(null)
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<AdminNote | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [loadFailed, setLoadFailed] = useState("")
  const memberId = member?.id

  useEffect(() => {
    setNotes(null)
    setText("")
    setError("")
    setLoadFailed("")
    setDeleting(null)
    if (!memberId) return
    let current = true
    void api.admin.getNotes(memberId).then((result) => {
      if (!current) return
      if (result.error) {
        // Not an empty list: notes that failed to load must not read as "no notes".
        setLoadFailed(`The notes could not be loaded. ${result.error} Close this and open it again to retry.`)
        return
      }
      setNotes((result.data || []) as AdminNote[])
    })
    return () => {
      current = false
    }
  }, [memberId])

  if (!member) return null
  const name = fullName(member)

  const add = async () => {
    if (!text.trim()) return
    setSaving(true)
    setError("")
    const result = await api.admin.addNote(member.id, text.trim())
    setSaving(false)
    if (result.error) {
      setError(`The note was not saved. ${result.error}`)
      return
    }
    const next = [...(notes || []), result.data as AdminNote]
    setNotes(next)
    // If the earlier notes never loaded, the real total is not known here.
    if (!loadFailed) onCount(member.id, next.length)
    setText("")
  }

  const remove = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    setDeleteError("")
    const result = await api.admin.deleteNote(member.id, deleting.id)
    setDeleteBusy(false)
    if (result.error) {
      setDeleteError(`The note was not deleted. ${result.error}`)
      return
    }
    const next = (notes || []).filter((n) => n.id !== deleting.id)
    setNotes(next)
    onCount(member.id, next.length)
    setDeleting(null)
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Admin notes</DialogTitle>
            <DialogDescription className="text-base">
              Private notes about {name} ({member.email}). Only admins can read them - {member.first_name || "the member"} never sees them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-note" className="text-base">Add a note</Label>
            <Textarea
              id="new-note"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              className="text-base"
            />
            <Button className="min-h-11" onClick={add} disabled={saving || !text.trim()}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Add note
            </Button>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          {loadFailed ? (
            <ErrorNote>{loadFailed}</ErrorNote>
          ) : notes === null ? (
            <div className="flex justify-center py-6" role="status">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading notes</span>
            </div>
          ) : notes.length === 0 ? (
            <p className="py-4 text-center text-base text-muted-foreground">No notes for this member</p>
          ) : (
            <ul className="space-y-3" aria-label="Notes, newest first">
              {[...notes].reverse().map((note) => (
                <li key={note.id} data-testid="note" className="space-y-2 rounded-lg border-2 border-border bg-card p-3">
                  <p className="whitespace-pre-wrap break-words text-base text-foreground">{note.content}</p>
                  <p className="text-sm text-muted-foreground">
                    By: {note.admin} · {formatDateTime(note.created_at)}
                  </p>
                  <Button variant="outline" className="min-h-11" onClick={() => { setDeleteError(""); setDeleting(note) }}>
                    Delete note
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this note?"
        confirmLabel="Delete note"
        cancelLabel="Keep note"
        destructive
        busy={deleteBusy}
        error={deleteError}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        It will be removed for every admin and cannot be brought back.
      </ConfirmDialog>
    </>
  )
}

/** What admins have done about one member before, newest first. */
function HistoryDialog({ member, onClose }: { member: AdminMember | null; onClose: () => void }) {
  if (!member) return null
  const entries = [...(member.moderation_history || [])].reverse()
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Action history</DialogTitle>
          <DialogDescription className="text-base">
            What admins have done about {fullName(member)} ({member.email}), newest first.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-base">
          <span>Now:</span>
          <StatusChip member={member} />
          <span className="text-muted-foreground">Joined {formatDate(member.created_at)}</span>
        </div>
        {entries.length === 0 ? (
          <p className="py-4 text-center text-base text-muted-foreground">No action history for this member</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} data-testid="history-entry" className="space-y-1 rounded-lg border-2 border-border bg-card p-3">
                <p className="text-base font-semibold text-foreground">{ACTION_LABEL[entry.action] || entry.action}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(entry.created_at)} · By: {entry.admin}
                </p>
                {entry.reason && <p className="whitespace-pre-wrap break-words text-base text-foreground">{entry.reason}</p>}
                {entry.report_id && <p className="text-sm text-muted-foreground">In answer to a member report.</p>}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
