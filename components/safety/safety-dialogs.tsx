"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { REPORT_REASONS } from "@/lib/safety"

interface TargetProps {
  userId: string
  firstName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Block: one clear explanation of what will happen, one confirm button, and
 * an Undo on the confirmation message for a slip of the finger.
 */
export function BlockDialog({
  userId,
  firstName,
  open,
  onOpenChange,
  onBlocked,
  onUnblocked,
}: TargetProps & { onBlocked?: () => void; onUnblocked?: () => void }) {
  const [busy, setBusy] = useState(false)

  const block = async () => {
    setBusy(true)
    const result = await api.browse.block(userId)
    setBusy(false)
    if (result.error) {
      toast.error(`We could not block ${firstName}. ${result.error}`)
      return
    }
    onOpenChange(false)
    onBlocked?.()
    toast.success(`${firstName} is blocked`, {
      description: "They can no longer see your profile or write to you. They are not told.",
      duration: 10000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await api.browse.unblock(userId)
          if (undo.error) {
            toast.error("We could not undo that. You can unblock from Settings, under Blocked Members.")
          } else {
            toast.success(`${firstName} is no longer blocked`, {
              description: "Your match and earlier messages are not brought back.",
            })
            onUnblocked?.()
          }
        },
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block {firstName}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-base text-foreground">
              <p>If you block {firstName}:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>they will not be able to see your profile or write to you</li>
                <li>you will not see them in Browse, Matches or Messages</li>
                <li>your match and your conversation with them are removed</li>
                <li>they are not told that you blocked them</li>
              </ul>
              <p>You can unblock someone later in Settings.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={block} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            Block {firstName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Report: pick what happened, optionally add detail. Reporting does not block
 * by itself; the member is offered that as a separate, clearly worded choice.
 */
export function ReportDialog({
  userId,
  firstName,
  open,
  onOpenChange,
  source,
  matchId,
  onAlsoBlock,
}: TargetProps & {
  source: "profile" | "chat" | "browse" | "matches"
  matchId?: string
  onAlsoBlock?: () => void
}) {
  const [category, setCategory] = useState<string>("")
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setCategory("")
      setDetails("")
      setError("")
    }
  }, [open])

  const submit = async () => {
    if (!category) {
      setError("Please choose what happened.")
      return
    }
    setBusy(true)
    setError("")
    const result = await api.browse.report(userId, details.trim(), { category, source, match_id: matchId })
    setBusy(false)
    if (result.error) {
      setError(`We could not send your report. ${result.error}`)
      return
    }
    onOpenChange(false)
    toast.success("Thank you. Your report has been sent", {
      description: `The moderators will look at it. ${firstName} is not told who reported them.`,
      duration: 10000,
      action: onAlsoBlock ? { label: `Block ${firstName} too`, onClick: onAlsoBlock } : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {firstName}</DialogTitle>
          <DialogDescription className="text-base">
            Tell the moderators what happened. {firstName} will not be told that you reported them.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-base font-semibold">What happened?</legend>
          {REPORT_REASONS.map((reason) => (
            <label
              key={reason}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-border px-3 py-2 text-base has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="report-reason"
                value={reason}
                checked={category === reason}
                onChange={() => {
                  setCategory(reason)
                  setError("")
                }}
              />
              {reason}
            </label>
          ))}
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="report-details" className="text-base">
            Anything else we should know? (optional)
          </Label>
          <Textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 900))}
            rows={3}
            className="text-base"
          />
        </div>

        {error && (
          <p role="alert" className="text-base font-medium text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
