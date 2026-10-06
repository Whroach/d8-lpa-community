"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"
import { ModerationDialog, type ModerationKind, type ModerationRequest } from "@/components/admin/moderation-dialog"
import { Chip, ErrorNote, adminToast, FilterButton, Pager, SectionIntro, Whom, formatDate, fullName, useDebounced, type AdminMember } from "@/components/admin/shared"

const PAGE_SIZE = 10

interface Report {
  id: string
  reporter: AdminMember
  reported_user: AdminMember
  reason: string
  category: string
  source: string
  status: string
  action_taken?: string
  reviewed_at?: string
  created_at: string
}

type Filter = "pending" | "resolved" | "dismissed" | "all"
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "resolved", label: "Action taken" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All reports" },
]

interface ReportPage {
  reports: Report[]
  total: number
  page: number
  totalPages: number
  counts: Record<Filter, number>
}

const SOURCE_LABEL: Record<string, string> = {
  chat: "from a conversation",
  profile: "from a profile",
  browse: "from Browse",
  matches: "from Matches",
}

const OUTCOME_LABEL: Record<string, string> = {
  warning: "a warning was sent",
  suspension: "the member was suspended",
  ban: "the member was banned",
  none: "no action",
}

const STANDARD_WARNING = "A member reported your behaviour. Please re-read the community guidelines."

/**
 * The moderators' queue: reports members have sent about other members, one
 * page at a time, with the counts worked out by the server.
 */
export function AdminReports({ onWaiting }: { onWaiting?: (count: number) => void }) {
  const [search, setSearch] = useState("")
  const query = useDebounced(search.trim())
  const [filter, setFilter] = useState<Filter>("pending")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ReportPage | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [request, setRequest] = useState<ModerationRequest | null>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const ticket = (latest.current += 1)
    setLoading(true)
    const result = await api.admin.getReportsPage({ page, limit: PAGE_SIZE, q: query, status: filter })
    if (ticket !== latest.current) return
    setLoading(false)
    if (result.error || !result.data) {
      setError(result.error || "No answer from the server.")
      return
    }
    setError("")
    const body = result.data as ReportPage
    setData(body)
    if (body.page !== page) setPage(body.page)
    onWaiting?.(body.counts.pending)
  }, [page, query, filter, onWaiting])

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

  const setStatus = async (report: Report, status: "dismissed" | "pending") => {
    setBusy(report.id)
    const result = await api.admin.updateReport(report.id, status, "none")
    setBusy(null)
    if (result.error) {
      adminToast.error(`That did not work, and the report was not changed. ${result.error}`)
      return false
    }
    await load()
    return true
  }

  const dismiss = async (report: Report) => {
    if (!(await setStatus(report, "dismissed"))) return
    adminToast.success("Report dismissed", {
      duration: 12000,
      action: {
        label: "Undo",
        onClick: async () => {
          if (await setStatus(report, "pending")) adminToast.success("The report is waiting again.")
        },
      },
    })
  }

  const reopen = async (report: Report) => {
    if (await setStatus(report, "pending")) adminToast.success("The report is waiting again.")
  }

  const ask = (report: Report, kind: ModerationKind) =>
    setRequest({
      kind,
      member: report.reported_user,
      reportId: report.id,
      defaultReason: kind === "warn" ? STANDARD_WARNING : undefined,
    })

  return (
    <section aria-labelledby="reports-heading" data-testid="admin-reports">
      <SectionIntro id="reports-heading" title="Member reports">
        Reports members have sent about other members. Read each one and decide: warn, suspend or ban the member, or
        dismiss the report. Neither person is told what you decide, except that the member you act on receives a
        notice. The person who made the report is never named to them.
      </SectionIntro>

      <Card className="mb-4">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="report-search" className="text-base">Search reports</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="report-search"
                type="search"
                placeholder="A name, an email address, or words from the report"
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
        <LoadError what="the reports" detail={error} onRetry={load} />
      ) : !data ? (
        <div className="flex justify-center py-6" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading reports</span>
        </div>
      ) : (
        <div aria-busy={loading}>
          {error && <ErrorNote className="mb-4">The list could not be refreshed. {error}</ErrorNote>}
          <p className="sr-only" role="status">
            {loading ? "" : `${data.total} ${data.total === 1 ? "report" : "reports"} found`}
          </p>
          {data.reports.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-base text-foreground">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              {filter === "pending" && !query ? "No reports are waiting." : "No reports found."}
            </p>
          ) : (
            <ul className="space-y-4">
              {data.reports.map((report) => {
                const reported = report.reported_user
                const name = fullName(reported)
                const canAct = !reported.is_deleted && reported.role !== "admin"
                const waiting = report.status === "pending"
                return (
                  <li key={report.id} className="space-y-3 rounded-lg border-2 border-border bg-card p-4" data-testid="report-row">
                    <div className="space-y-1 text-base">
                      <p>
                        <span className="font-semibold">{name}</span>{" "}
                        {reported.email && <span className="break-all text-muted-foreground">({reported.email})</span>} was reported by{" "}
                        <span className="font-semibold">{fullName(report.reporter)}</span> {SOURCE_LABEL[report.source] || ""} on{" "}
                        {formatDate(report.created_at)}.
                      </p>
                      {report.category && <p className="font-medium">Reason chosen: {report.category}</p>}
                      {report.reason && report.reason !== report.category && (
                        <p className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-foreground">{report.reason}</p>
                      )}
                      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Earlier warnings: {reported.warnings || 0}</span>
                        {reported.is_deleted && <Chip>Account closed</Chip>}
                        {reported.is_suspended && <Chip tone="serious">Currently suspended</Chip>}
                        {reported.is_banned && <Chip tone="danger">Currently banned</Chip>}
                      </p>
                      {!waiting && (
                        <p className="text-sm text-foreground">
                          <Chip tone={report.status === "dismissed" ? "neutral" : "info"}>
                            {report.status === "dismissed" ? "Dismissed" : "Closed"}
                          </Chip>{" "}
                          {report.reviewed_at ? `on ${formatDate(report.reviewed_at)}` : ""}
                          {report.status !== "dismissed" ? ` - ${OUTCOME_LABEL[report.action_taken || "none"]}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!reported.is_deleted && (
                        <Button asChild variant="outline" className="min-h-11">
                          <Link href={`/profile/${reported.id}`}>View profile<Whom name={name} joiner="of" /></Link>
                        </Button>
                      )}
                      {waiting && canAct && (
                        <>
                          {/* A banned member cannot sign in to read a warning, so it is not offered. */}
                          {!reported.is_banned && (
                            <Button variant="outline" className="min-h-11" disabled={busy === report.id} onClick={() => ask(report, "warn")}>
                              Warn<Whom name={name} />
                            </Button>
                          )}
                          {!reported.is_suspended && !reported.is_banned && (
                            <Button variant="outline" className="min-h-11" disabled={busy === report.id} onClick={() => ask(report, "suspend")}>
                              Suspend<Whom name={name} />
                            </Button>
                          )}
                          {!reported.is_banned && (
                            <Button variant="destructive" className="min-h-11" disabled={busy === report.id} onClick={() => ask(report, "ban")}>
                              Ban<Whom name={name} />
                            </Button>
                          )}
                        </>
                      )}
                      {waiting ? (
                        <Button variant="ghost" className="min-h-11 underline" disabled={busy === report.id} onClick={() => dismiss(report)}>
                          Dismiss report<Whom name={name} joiner="about" />
                        </Button>
                      ) : (
                        <Button variant="ghost" className="min-h-11 underline" disabled={busy === report.id} onClick={() => reopen(report)}>
                          Reopen report<Whom name={name} joiner="about" />
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Pager page={data.page} totalPages={data.totalPages} total={data.total} pageSize={PAGE_SIZE} noun="reports" onPage={setPage} />
        </div>
      )}

      <ModerationDialog request={request} onClose={() => setRequest(null)} onChanged={load} />
    </section>
  )
}
