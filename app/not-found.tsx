import Link from "next/link"
import { Compass } from "lucide-react"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-lg space-y-4 text-center">
        <Compass className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold">We can&apos;t find that page</h1>
        <p className="text-lg text-muted-foreground">
          The link may be old, or the page may have moved.
        </p>
        <Link
          href="/browse"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-8 text-lg font-semibold text-primary-foreground"
        >
          Go to the home screen
        </Link>
      </div>
    </main>
  )
}
