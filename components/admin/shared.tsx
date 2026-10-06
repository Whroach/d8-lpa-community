"use client"

import { useEffect, useState, type ReactNode } from "react"
import { toast, type ExternalToast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Pieces the admin screens share: types, wording, dates, paging. */

export interface HistoryEntry {
  id: string
  action: string
  reason: string
  admin: string
  report_id?: string | null
  created_at: string
}

export interface AdminMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role?: string
  created_at?: string
  last_active?: string
  warnings?: number
  is_suspended?: boolean
  is_banned?: boolean
  is_deleted?: boolean
  notes_count?: number
  moderation_history?: HistoryEntry[]
}

export const fullName = (person: Pick<AdminMember, "first_name" | "last_name" | "email">) =>
  `${person.first_name || ""} ${person.last_name || ""}`.trim() || person.email || "This member"

/** What each entry in the history and the activity log is called. */
export const ACTION_LABEL: Record<string, string> = {
  warn: "Warning sent",
  remove_warning: "Warning removed",
  suspend: "Suspended",
  unsuspend: "Suspension lifted",
  ban: "Banned",
  unban: "Ban lifted",
  dismiss_report: "Report dismissed",
  reopen_report: "Report reopened",
}

export const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown"

export const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "unknown"

/** The value, once it has stopped changing for a moment (for search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

const CHIP_TONE = {
  neutral: "bg-muted text-foreground",
  good: "bg-green-100 text-green-900",
  caution: "bg-amber-100 text-amber-900",
  serious: "bg-orange-700 text-white",
  danger: "bg-red-700 text-white",
  info: "bg-blue-100 text-blue-900",
} as const

export function Chip({ tone = "neutral", className, children }: { tone?: keyof typeof CHIP_TONE; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold", CHIP_TONE[tone], className)}>
      {children}
    </span>
  )
}

export function StatusChip({ member }: { member: Pick<AdminMember, "warnings" | "is_suspended" | "is_banned"> }) {
  if (member.is_banned) return <Chip tone="danger">Banned</Chip>
  if (member.is_suspended) return <Chip tone="serious">Suspended</Chip>
  if ((member.warnings || 0) > 0) return <Chip tone="caution">Warned ({member.warnings})</Chip>
  return <Chip tone="good">Active</Chip>
}

/** A short explanation at the top of a section: what it is for and what members see. */
export function SectionIntro({ id, title, children, action }: { id: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 id={id} className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="max-w-3xl text-base text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  )
}

/** An error message that is read out as well as shown. */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("rounded-lg border-2 border-destructive/40 bg-destructive/10 p-3 text-base text-foreground", className)}>
      {children}
    </p>
  )
}

/** One of the "show me only these" buttons, with its count. */
export function FilterButton({ label, count, pressed, onClick }: { label: string; count?: number; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 py-2 text-base font-semibold transition-colors",
        pressed ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-muted"
      )}
    >
      {label}
      {count !== undefined && <span className="tabular-nums" data-testid="filter-count">{count}</span>}
    </button>
  )
}

/** Previous / Next with a plain "Showing 26 to 50 of 312 members" line. */
export function Pager({
  page,
  totalPages,
  total,
  pageSize,
  noun,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  noun: string
  onPage: (page: number) => void
}) {
  if (total === 0) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <nav aria-label={`Pages of ${noun}`} className="mt-4 flex flex-col items-center gap-x-6 gap-y-3 sm:flex-row sm:flex-wrap">
      <p className="text-base text-muted-foreground" data-testid="pager-summary">
        Showing {first} to {last} of {total} {noun}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <span className="px-2 text-base font-medium" aria-current="page">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" className="min-h-11" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </nav>
  )
}

/** Adds a person's name to a button for screen readers ("Suspend" -> "Suspend Noel Example"). */
export const Whom = ({ name, joiner = "" }: { name: string; joiner?: string }) => (
  <span className="sr-only">
    {" "}
    {joiner ? `${joiner} ` : ""}
    {name}
  </span>
)

/**
 * Admin toasts. On a wide screen they sit in the bottom right corner, where
 * there is nothing to press: the app's usual top-centre spot covers the admin
 * tabs for as long as an Undo toast stays up. On a phone they stay at the top.
 */
const placed = (): ExternalToast =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? { position: "bottom-right" } : {}

export const adminToast = {
  success: (message: string, options: ExternalToast = {}) => toast.success(message, { ...placed(), ...options }),
  error: (message: string, options: ExternalToast = {}) => toast.error(message, { ...placed(), ...options }),
}