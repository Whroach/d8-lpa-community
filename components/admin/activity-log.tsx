"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"
import { ACTION_LABEL, ErrorNote, Pager, SectionIntro, formatDateTime, useDebounced } from "./shared"

const PAGE_SIZE = 25

interface Entry {
  id: string
  action: string
  target: { id: string; name: string; email: string }
  admin: { id: string; name: string; email: string }
  reason: string
  report_id: string | null
  created_at: string
}

interface LogPage {
  entries: Entry[]
  total: number
  page: number
  totalPages: number
}

/** Every moderation decision: who took it, about whom, when and why. Read-only. */
export function ActivityLog() {
  const [search, setSearch] = useState("")
  const query = useDebounced(search.trim())
  const [action, setAction] = useState("all")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LogPage | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const ticket = (latest.current += 1)
    setLoading(true)
    const result = await api.admin.getAuditLog({ page, limit: PAGE_SIZE, q: query, action })
    if (ticket !== latest.current) return
    setLoading(false)
    if (result.error || !result.data) {
      setError(result.error || "No answer from the server.")
      return
    }
    setError("")
    const body = result.data as LogPage
    setData(body)
    if (body.page !== page) setPage(body.page)
  }, [page, query, action])

  useEffect(() => {
    void load()
  }, [load])

  const lastQuery = useRef(query)
  useEffect(() => {
    if (lastQuery.current !== query) {
      lastQuery.current = query
      setPage(1)
    }
  }, [query])

  return (
    <section aria-labelledby="activity-heading">
      <SectionIntro id="activity-heading" title="Activity log">
        A record of every moderation decision: who took it, about which member, when and why. Entries are added
        automatically and cannot be changed or removed. Only admins can read this - members never see it.
      </SectionIntro>

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="activity-search" className="text-base">Search the log</Label>
            <p id="activity-search-hint" className="text-sm text-muted-foreground">By a member, an admin, or words from the reason.</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="activity-search"
                type="search"
                placeholder="Search" aria-describedby="activity-search-hint"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-action" className="text-base">Show</Label>
            <select
              id="activity-action"
              value={action}
              onChange={(e) => {
                setAction(e.target.value)
                setPage(1)
              }}
              className="flex h-11 w-full rounded-md border-2 border-input bg-background px-3 text-base text-foreground"
            >
              <option value="all">Everything</option>
              {Object.entries(ACTION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {error && !data ? (
        <LoadError what="the activity log" detail={error} onRetry={load} />
      ) : !data ? (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading the activity log</span>
        </div>
      ) : (
        <div aria-busy={loading}>
          {error && <ErrorNote className="mb-4">The log could not be refreshed. {error}</ErrorNote>}
          <p className="sr-only" role="status">
            {loading ? "" : `${data.total} ${data.total === 1 ? "entry" : "entries"} found`}
          </p>
          {data.entries.length === 0 ? (
            <p className="rounded-lg border-2 border-dashed border-border py-10 text-center text-base text-muted-foreground">
              {query || action !== "all" ? "Nothing in the log matches." : "Nothing has been recorded yet."}
            </p>
          ) : (
            <ul className="space-y-3">
              {data.entries.map((entry) => (
                <li key={entry.id} data-testid="activity-row" className="space-y-1 rounded-lg border-2 border-border bg-card p-4">
                  <p className="text-base text-foreground">
                    <span className="font-semibold">{ACTION_LABEL[entry.action] || entry.action}</span>
                    {": "}
                    <span className="font-semibold">{entry.target.name || "Deleted account"}</span>{" "}
                    {entry.target.email && <span className="[overflow-wrap:anywhere] text-muted-foreground">({entry.target.email})</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(entry.created_at)} · By: {entry.admin.name || "Admin"}{" "}
                    <span className="[overflow-wrap:anywhere]">({entry.admin.email})</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-base text-foreground">
                    {entry.reason ? `Reason: ${entry.reason}` : "No reason was given."}
                  </p>
                  {entry.report_id && <p className="text-sm text-muted-foreground">In answer to a member report.</p>}
                </li>
              ))}
            </ul>
          )}
          <Pager page={data.page} totalPages={data.totalPages} total={data.total} pageSize={PAGE_SIZE} noun="entries" onPage={setPage} />
        </div>
      )}
    </section>
  )
}
