"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Flag, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"

interface Person {
  id: string
  first_name: string
  last_name: string
  email: string
  is_banned?: boolean
  is_suspended?: boolean
  warnings?: number
}

interface Report {
  id: string
  reporter: Person
  reported_user: Person
  reason: string
  category: string
  source: string
  status: string
  created_at: string
}

const SOURCE_LABEL: Record<string, string> = {
  chat: "from a conversation",
  profile: "from a profile",
  browse: "from Browse",
  matches: "from Matches",
}

/**
 * The moderators' queue. Members could file reports before, but there was no
 * screen where an admin could see them.
 */
export function AdminReports() {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError("")
    const result = await api.admin.getReports("pending")
    if (result.error) {
      setError(result.error)
      return
    }
    setReports(result.data || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (report: Report, action: "warn" | "suspend" | "ban" | "dismiss") => {
    setBusy(report.id)
    if (action !== "dismiss") {
      const done = await api.admin.userAction(
        report.reported_user.id,
        action,
        action === "warn" ? "A member reported your behaviour. Please re-read the community guidelines." : undefined
      )
      if (done.error) {
        setBusy(null)
        toast.error(`That did not work. ${done.error}`)
        return
      }
    }
    const taken = { warn: "warning", suspend: "suspension", ban: "ban", dismiss: "none" }[action]
    const result = await api.admin.updateReport(report.id, action === "dismiss" ? "dismissed" : "resolved", taken)
    setBusy(null)
    if (result.error) {
      toast.error(`The report could not be closed. ${result.error}`)
      return
    }
    setReports((prev) => (prev || []).filter((r) => r.id !== report.id))
    toast.success(
      action === "dismiss"
        ? "Report dismissed"
        : `${report.reported_user.first_name} has been ${{ warn: "warned", suspend: "suspended", ban: "banned" }[action]} and the report closed`
    )
  }

  return (
    <Card className="mb-6" data-testid="admin-reports">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Flag className="h-5 w-5" aria-hidden="true" />
          Member reports
          {reports && reports.length > 0 && <Badge variant="destructive">{reports.length} waiting</Badge>}
        </CardTitle>
        <CardDescription className="text-base">
          Reports members have sent about other members. Neither person is told what you decide here, except that a
          warned member receives a notice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <LoadError what="the reports" detail={error} onRetry={load} />
        ) : reports === null ? (
          <div className="flex justify-center py-6" role="status">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading reports</span>
          </div>
        ) : reports.length === 0 ? (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            No reports are waiting.
          </p>
        ) : (
          <ul className="space-y-4">
            {reports.map((report) => (
              <li key={report.id} className="space-y-3 rounded-lg border-2 border-border p-4" data-testid="report-row">
                <div className="space-y-1 text-base">
                  <p>
                    <span className="font-semibold">
                      {report.reported_user.first_name} {report.reported_user.last_name}
                    </span>{" "}
                    <span className="text-muted-foreground">({report.reported_user.email})</span> was reported by{" "}
                    <span className="font-semibold">
                      {report.reporter.first_name} {report.reporter.last_name}
                    </span>{" "}
                    {SOURCE_LABEL[report.source] || ""} on {new Date(report.created_at).toLocaleDateString()}.
                  </p>
                  {report.category && <p className="font-medium">Reason chosen: {report.category}</p>}
                  {report.reason && report.reason !== report.category && (
                    <p className="whitespace-pre-wrap rounded bg-muted p-2">{report.reason}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Earlier warnings: {report.reported_user.warnings || 0}
                    {report.reported_user.is_suspended ? " · currently suspended" : ""}
                    {report.reported_user.is_banned ? " · currently banned" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/profile/${report.reported_user.id}`}>View profile</Link>
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === report.id} onClick={() => act(report, "warn")}>
                    Warn
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === report.id} onClick={() => act(report, "suspend")}>
                    Suspend
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy === report.id} onClick={() => act(report, "ban")}>
                    Ban
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === report.id} onClick={() => act(report, "dismiss")}>
                    Dismiss report
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
