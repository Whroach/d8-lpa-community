"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Shown when a screen could not load its data. Before, a failed load looked
 * exactly like "you have nothing here", which is both confusing and, in
 * Settings, dangerous (saving would overwrite real settings with defaults).
 */
export function LoadError({
  what,
  detail,
  onRetry,
}: {
  what: string
  detail?: string
  onRetry: () => void
}) {
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 rounded-xl border-2 border-destructive/40 bg-card p-6 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
      <h2 className="text-xl font-semibold">We could not load {what}</h2>
      <p className="text-lg text-muted-foreground">{detail || "Please check your internet connection and try again."}</p>
      <Button onClick={onRetry} size="lg">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  )
}
