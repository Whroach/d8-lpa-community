"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { ErrorNote, adminToast, fullName, type AdminMember } from "./shared"

export type ModerationKind = "warn" | "suspend" | "ban" | "unsuspend" | "unban"

export interface ModerationRequest {
  kind: ModerationKind
  member: Pick<AdminMember, "id" | "first_name" | "last_name" | "email">
  /** The member report this decision answers, when it is taken from the report queue. */
  reportId?: string
  /** Words to start the box with (the standard warning sent from the report queue). */
  defaultReason?: string
}

const REPORTER_LINE = "They are not told who reported them."

/** The wording of each confirmation: what will happen, in plain words. */
function wording(kind: ModerationKind, name: string, first: string) {
  const seenByMember = `It is kept in the activity log. ${first} can also read it as a notice in the app, so do not name the person who reported them.`
  switch (kind) {
    case "warn":
      return {
        title: `Send a warning to ${name}?`,
        consequence: `${name} will get this warning as a notice in the app and can carry on using it as normal. ${REPORTER_LINE}`,
        label: `Message to ${first}`,
        help: `${first} will read these exact words. It is also kept in the activity log.`,
        confirm: "Send warning",
        required: true,
        destructive: false,
      }
    case "suspend":
      return {
        title: `Suspend ${name}?`,
        consequence: `${name} will be signed out and will not be able to sign in until the suspension is lifted. ${REPORTER_LINE}`,
        label: "Reason for the suspension",
        help: seenByMember,
        confirm: `Suspend ${first}`,
        required: true,
        destructive: true,
      }
    case "ban":
      return {
        title: `Ban ${name}?`,
        consequence: `${name} will be signed out and will not be able to sign in again unless an admin lifts the ban. ${REPORTER_LINE}`,
        label: "Reason for the ban",
        help: seenByMember,
        confirm: `Ban ${first}`,
        required: true,
        destructive: true,
      }
    case "unsuspend":
      return {
        title: `Lift the suspension for ${name}?`,
        consequence: `${name} will be able to sign in again straight away. They are not sent a notice about it.`,
        label: "Reason (optional)",
        help: "Kept in the activity log for other admins.",
        confirm: "Lift suspension",
        required: false,
        destructive: false,
      }
    case "unban":
      return {
        title: `Lift the ban for ${name}?`,
        consequence: `${name} will be able to sign in again straight away. They are not sent a notice about it.`,
        label: "Reason (optional)",
        help: "Kept in the activity log for other admins.",
        confirm: "Lift ban",
        required: false,
        destructive: false,
      }
  }
}

const DONE: Record<ModerationKind, (name: string) => string> = {
  warn: (name) => `${name} has been warned`,
  suspend: (name) => `${name} has been suspended`,
  ban: (name) => `${name} has been banned`,
  unsuspend: (name) => `Suspension lifted - ${name} can sign in again`,
  unban: (name) => `Ban lifted - ${name} can sign in again`,
}

const UNDO = {
  warn: { action: "remove_warning", done: "Warning removed. The notice already sent stays in their notifications." },
  suspend: { action: "unsuspend", done: "Suspension lifted - they can sign in again." },
  ban: { action: "unban", done: "Ban lifted - they can sign in again." },
} as const

/**
 * The confirmation for every moderation decision. It names the member, says
 * what will happen in plain words, asks for the reason and - once the server
 * has done it - offers Undo for a few seconds.
 */
export function ModerationDialog({
  request,
  onClose,
  onChanged,
}: {
  request: ModerationRequest | null
  onClose: () => void
  /** Called after the action (and again after an Undo) so lists can refresh. */
  onChanged: () => void
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setReason(request?.defaultReason || "")
    setError("")
    setBusy(false)
  }, [request])

  if (!request) return null
  const { kind, member, reportId } = request
  const name = fullName(member)
  const first = member.first_name || name
  const copy = wording(kind, name, first)

  const submit = async () => {
    const typed = reason.trim()
    if (copy.required && !typed) {
      setError(kind === "warn" ? "Please write the message first." : "Please give a reason first.")
      return
    }
    setBusy(true)
    setError("")
    const result = await api.admin.userAction(member.id, kind, typed || undefined, reportId ? { report_id: reportId } : undefined)
    setBusy(false)
    if (result.error) {
      setError(`That did not work, and nothing was changed. ${result.error}`)
      return
    }
    onClose()
    onChanged()

    const message = reportId && kind in UNDO ? `${DONE[kind](first)} and the report closed` : DONE[kind](name)
    const undo = UNDO[kind as keyof typeof UNDO]
    if (!undo) {
      adminToast.success(message)
      return
    }
    adminToast.success(message, {
      duration: 12000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undone = await api.admin.userAction(
            member.id,
            undo.action,
            "Undone straight away",
            reportId ? { report_id: reportId, reopen_report: true } : undefined
          )
          if (undone.error) {
            adminToast.error(`That could not be undone. ${undone.error}`)
            return
          }
          adminToast.success(reportId ? `${undo.done} The report is waiting again.` : undo.done)
          onChanged()
        },
      },
    })
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{copy.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground">{copy.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="[overflow-wrap:anywhere] text-base text-muted-foreground">{member.email}</p>
        <div className="space-y-2">
          <Label htmlFor="moderation-reason" className="text-base">{copy.label}</Label>
          <Textarea
            id="moderation-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            aria-describedby="moderation-reason-help"
            aria-required={copy.required}
            className="text-base"
          />
          <p id="moderation-reason-help" className="text-sm text-muted-foreground">{copy.help}</p>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="min-h-11" disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            className="min-h-11"
            variant={copy.destructive ? "destructive" : "default"}
            disabled={busy || (copy.required && !reason.trim())}
            onClick={submit}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** A plain yes/no confirmation that spells out the consequence. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  error = "",
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  error?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground">{children}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <ErrorNote>{error}</ErrorNote>}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="min-h-11" disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <Button className="min-h-11" variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
