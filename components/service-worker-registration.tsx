"use client"

import { useEffect } from "react"

/**
 * Registers the small service worker that makes the app installable and shows
 * a friendly page when there is no connection. Production only, so it never
 * gets in the way of development.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Installing is a nicety; the app works without it. */
    })
  }, [])
  return null
}
