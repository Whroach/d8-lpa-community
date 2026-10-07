"use client"

import { useCallback, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { api } from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { useAuthStore } from "@/lib/store/auth-store"
import { useNotificationStore, isWithinQuietHours } from "@/lib/store/notification-store"
import {
  playNotificationSound,
  unlockNotificationSound,
} from "@/lib/notification-sound"

interface RealtimePing {
  type?: string
  match_id?: string
  message_id?: string
  preview?: string
  from?: string
}

/**
 * Owns the app-wide realtime connection.
 *
 * This lives in AppLayout rather than on any one page, because badges and the
 * chime have to fire wherever the user happens to be — previously the socket
 * was only ever joined by the messages page, so anything that arrived while
 * the user was browsing went unnoticed until a full reload.
 */
export function RealtimeProvider() {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuthStore()
  // Select the actions individually — calling the hook bare would subscribe
  // this component to every badge change it causes.
  const setCounts = useNotificationStore((state) => state.setCounts)
  const incrementCount = useNotificationStore((state) => state.incrementCount)
  const clearCount = useNotificationStore((state) => state.clearCount)
  const setSoundEnabled = useNotificationStore((state) => state.setSoundEnabled)

  // Read inside the socket handler without re-subscribing every navigation.
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const userId = user?.id || user?._id

  // ---- initial counts -----------------------------------------------------

  const loadCounts = useCallback(async () => {
    const lastViewedMatches =
      typeof window !== "undefined"
        ? new Date(localStorage.getItem("lastViewedMatches") || 0)
        : new Date(0)

    const [matchesResult, conversationsResult, notificationsResult] =
      await Promise.all([
        api.matches.getAll(),
        api.messages.getConversations(),
        api.notifications.getAll(),
      ])

    const next: Partial<{
      matches: number
      messages: number
      events: number
      notifications: number
    }> = {}

    if (matchesResult.data) {
      const allMatches = matchesResult.data.active || matchesResult.data
      next.matches = (Array.isArray(allMatches) ? allMatches : []).filter(
        (m: { matched_at: string }) => new Date(m.matched_at) > lastViewedMatches
      ).length
    }

    if (Array.isArray(conversationsResult.data)) {
      next.messages = conversationsResult.data.reduce(
        (acc: number, conv: { unread_count?: number }) =>
          acc + (conv.unread_count || 0),
        0
      )
    }

    if (Array.isArray(notificationsResult.data)) {
      const all = notificationsResult.data
      next.notifications = all.filter((n: { read?: boolean }) => !n.read).length
      next.events = all.filter(
        (n: { type?: string; read?: boolean }) => n.type === "event" && !n.read
      ).length
    }

    setCounts(next)
  }, [setCounts])
  // The socket handlers below call this through a ref, so they are not torn
  // down and re-subscribed when it changes.
  const refreshCounts = useRef(loadCounts)
  useEffect(() => {
    refreshCounts.current = loadCounts
  }, [loadCounts])

  useEffect(() => {
    if (!isAuthenticated) return
    void refreshCounts.current()
  }, [isAuthenticated])

  // ---- sound preference ---------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    const loadPreference = async () => {
      const result = await api.settings.get()
      if (!cancelled && result.data) {
        setSoundEnabled(result.data.notifications?.sound !== false)
        useNotificationStore.getState().setQuietHours(
          Boolean(result.data.notifications?.quiet_hours_enabled),
          result.data.notifications?.quiet_hours_start || "21:00",
          result.data.notifications?.quiet_hours_end || "08:00"
        )
      }
    }
    void loadPreference()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, setSoundEnabled])

  // Browsers block audio until the user has interacted with the page. Prime
  // the audio context on the first real gesture so the first chime isn't lost.
  useEffect(() => {
    const unlock = () => unlockNotificationSound()
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  // ---- socket -------------------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated || !userId) return

    const socket = getSocket()
    if (!socket.connected) socket.connect()

    // The server puts each signed-in connection in its own personal room, so
    // there is nothing to join. After a dropped connection, re-read the counts
    // in case something arrived while we were away.
    const joinRoom = () => void refreshCounts.current()
    socket.on("connect", joinRoom)

    const handlePing = (ping: RealtimePing) => {
      // Read the preference at fire time — the user may have just changed it.
      // Quiet hours silence the chime; the badge below still updates.
      const { soundEnabled, quietHours } = useNotificationStore.getState()
      if (soundEnabled && !isWithinQuietHours(quietHours)) {
        playNotificationSound()
        window.dispatchEvent(new Event("d8lpa:chime"))
      }

      switch (ping?.type) {
        case "message":
          // On the messages screen the thread being read marks itself read, so
          // take the real number from the API instead of guessing.
          if (pathnameRef.current === "/messages") {
            void refreshCounts.current()
          } else {
            incrementCount("messages")
          }
          break
        case "match":
          incrementCount("matches")
          incrementCount("notifications")
          break
        case "event":
          incrementCount("events")
          incrementCount("notifications")
          break
        case "like":
        case "news":
        case "system":
          incrementCount("notifications")
          break
        default:
          incrementCount("notifications")
          break
      }
    }

    socket.on("new-notification", handlePing)

    return () => {
      socket.off("connect", joinRoom)
      socket.off("new-notification", handlePing)
    }
  }, [isAuthenticated, userId, incrementCount])

  // ---- "I've seen these" events from the pages ----------------------------

  useEffect(() => {
    // The notifications page updates the backend first, so give it a beat
    // before reading the count back.
    const handleNotificationsRead = () => {
      window.setTimeout(() => void refreshCounts.current(), 300)
    }
    const handleMessagesViewed = () => void refreshCounts.current()
    const handleMatchesViewed = () => clearCount("matches")
    const handleEventsViewed = () => clearCount("events")

    window.addEventListener("notificationsRead", handleNotificationsRead)
    window.addEventListener("messagesViewed", handleMessagesViewed)
    window.addEventListener("matchesViewed", handleMatchesViewed)
    window.addEventListener("eventsViewed", handleEventsViewed)

    return () => {
      window.removeEventListener("notificationsRead", handleNotificationsRead)
      window.removeEventListener("messagesViewed", handleMessagesViewed)
      window.removeEventListener("matchesViewed", handleMatchesViewed)
      window.removeEventListener("eventsViewed", handleEventsViewed)
    }
  }, [clearCount])

  return null
}
