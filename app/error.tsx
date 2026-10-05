"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Shown instead of a blank screen if a page crashes. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div role="alert" className="max-w-lg space-y-4 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-lg text-muted-foreground">
          Sorry about that. Nothing you did caused it, and your messages and profile are safe.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
          <Button size="lg" variant="outline" onClick={() => (window.location.href = "/browse")}>
            Go to the home screen
          </Button>
        </div>
      </div>
    </main>
  )
}
