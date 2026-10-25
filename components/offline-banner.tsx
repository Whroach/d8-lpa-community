"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

/** Says so plainly when the device has lost its connection. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  if (!offline) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-surface px-4 py-3 text-base font-medium text-warning-foreground"
    >
      <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
      You are offline. Messages you write will be kept and can be sent when you are back online.
    </div>
  )
}
