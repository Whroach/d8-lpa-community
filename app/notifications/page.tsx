"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"
import { formatNotificationTime } from "@/lib/relative-time"
import { Bell, Trash2, Check, CheckCheck, Heart, MessageCircle, Users, Calendar, Megaphone, Info, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notification {
  _id: string
  type: "match" | "message" | "like" | "event" | "news" | "system" | string
  title: string
  message: string
  read: boolean
  created_at: string
  related_user?: string
  related_match?: string
  related_event?: string
}

const TYPE_LABEL: Record<string, string> = {
  match: "Match",
  like: "Like",
  message: "Message",
  event: "Event",
  news: "News",
  system: "Notice",
}

const TYPE_ICON: Record<string, typeof Bell> = {
  match: Users,
  like: Heart,
  message: MessageCircle,
  event: Calendar,
  news: Megaphone,
  system: Info,
}

/** Where a notification leads, and the words on its link. */
function destination(n: Notification): { href: string; label: string } | null {
  switch (n.type) {
    case "message":
      return { href: n.related_match ? `/messages?match=${n.related_match}` : "/messages", label: "Open the conversation" }
    case "match":
      return { href: "/matches", label: "See your matches" }
    case "like":
      return n.related_user
        ? { href: `/profile/${n.related_user}`, label: "See their profile" }
        : { href: "/browse", label: "Go to Browse" }
    case "event":
      return { href: n.related_event ? `/events?event=${n.related_event}` : "/events", label: "See the event" }
    default:
      return null
  }
}

const UNDO_MS = 6000

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  // Deletes wait a few seconds so "Undo" is real; they are sent when the timer
  // runs out or when the member leaves the page.
  const pendingDeletes = useRef(new Map<string, number>())

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const result = await api.notifications.getAll()
    if (result.error || !Array.isArray(result.data)) {
      setLoadError(result.error || "Please try again.")
    } else {
      setNotifications(result.data)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  // Opening this page no longer marks everything read. A notification becomes
  // read when the member opens it, presses "Mark as read", or "Mark all as read".
  const announceRead = () => window.dispatchEvent(new Event("notificationsRead"))

  const markRead = async (id: string, quiet = false) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
    const result = await api.notifications.markAsRead(id)
    if (result.error) {
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: false } : n)))
      if (!quiet) toast.error("We could not mark that as read. Please try again.")
      return
    }
    announceRead()
  }

  const markAllRead = async () => {
    const before = notifications
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    const result = await api.notifications.markAllAsRead()
    if (result.error) {
      setNotifications(before)
      toast.error("We could not mark everything as read. Please try again.")
      return
    }
    toast.success("All notifications marked as read")
    announceRead()
  }

  const sendDelete = useCallback(async (id: string) => {
    pendingDeletes.current.delete(id)
    const result = await api.notifications.delete(id)
    if (result.error) {
      toast.error("We could not delete that notification.")
      void loadNotifications()
    }
    window.dispatchEvent(new Event("notificationsRead"))
  }, [loadNotifications])

  const remove = (notification: Notification) => {
    const index = notifications.findIndex((n) => n._id === notification._id)
    setNotifications((prev) => prev.filter((n) => n._id !== notification._id))
    const timer = window.setTimeout(() => void sendDelete(notification._id), UNDO_MS)
    pendingDeletes.current.set(notification._id, timer)
    toast.success("Notification deleted", {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          const pending = pendingDeletes.current.get(notification._id)
          if (pending === undefined) return
          window.clearTimeout(pending)
          pendingDeletes.current.delete(notification._id)
          setNotifications((prev) => {
            if (prev.some((n) => n._id === notification._id)) return prev
            const next = [...prev]
            next.splice(Math.min(index, next.length), 0, notification)
            return next
          })
        },
      },
    })
  }

  // Leaving the page: send any delete still waiting for its Undo window.
  useEffect(() => {
    const pending = pendingDeletes.current
    const flush = () => {
      for (const [id, timer] of pending) {
        window.clearTimeout(timer)
        pending.delete(id)
        void api.notifications.delete(id, true)
      }
    }
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length
  const shown = filter === "unread" ? notifications.filter((n) => !n.read) : notifications

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Bell className="h-8 w-8 text-primary" aria-hidden="true" />
              <h1 className="text-3xl font-bold">Notifications</h1>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllRead}>
                <CheckCheck aria-hidden="true" />
                Mark all as read
              </Button>
            )}
          </div>
          <p className="text-muted-foreground" role="status" data-testid="unread-summary">
            {isLoading || loadError
              ? " "
              : unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"}
          </p>
        </div>

        <div className="mb-6 flex gap-2" role="group" aria-label="Show">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All ({notifications.length})
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            aria-pressed={filter === "unread"}
            onClick={() => setFilter("unread")}
          >
            Unread ({unreadCount})
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading notifications">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : loadError ? (
          <LoadError what="your notifications" detail={loadError} onRetry={loadNotifications} />
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground opacity-50" aria-hidden="true" />
            <h2 className="mb-2 text-xl font-semibold">
              {filter === "unread" ? "Nothing unread" : "No notifications yet"}
            </h2>
            <p className="text-muted-foreground">
              {filter === "unread"
                ? "You have read everything. Choose All to see earlier notifications."
                : "When you get a match, a message, a like or event news, it will show here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Notifications">
            {shown.map((notification) => {
              const dest = destination(notification)
              const Icon = TYPE_ICON[notification.type] || Bell
              const time = formatNotificationTime(notification.created_at)
              return (
                <li
                  key={notification._id}
                  data-testid="notification"
                  data-unread={notification.read ? "false" : "true"}
                  className={cn(
                    "rounded-xl border bg-card p-4",
                    notification.read ? "border-border" : "border-2 border-primary"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 shrink-0 self-start rounded-full bg-muted p-2">
                      <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.read && (
                          <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-semibold text-primary-foreground">
                            New
                          </span>
                        )}
                        <span className="text-sm font-medium text-muted-foreground">
                          {TYPE_LABEL[notification.type] || "Notice"}
                        </span>
                        {time && (
                          <time
                            dateTime={time.iso}
                            title={time.full}
                            className="text-sm text-muted-foreground"
                          >
                            · {time.label}
                          </time>
                        )}
                      </div>
                      <h2 className={cn("mt-1 text-lg", notification.read ? "font-semibold" : "font-bold")}>
                        {notification.title}
                      </h2>
                      <p className="mt-1 break-words text-muted-foreground">{notification.message}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {dest && (
                          <Button asChild size="sm">
                            <Link
                              href={dest.href}
                              onClick={() => {
                                if (!notification.read) void markRead(notification._id, true)
                              }}
                            >
                              {dest.label}
                              <ChevronRight aria-hidden="true" />
                            </Link>
                          </Button>
                        )}
                        {!notification.read && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void markRead(notification._id)}
                            aria-label={`Mark as read: ${notification.title}`}
                          >
                            <Check aria-hidden="true" />
                            Mark as read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(notification)}
                          aria-label={`Delete: ${notification.title}`}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
