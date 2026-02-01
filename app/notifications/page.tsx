"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Bell,
  Heart,
  MessageCircle,
  Users,
  Calendar,
  Loader2,
  Check,
  Trash2,
  CheckCheck,
  Megaphone,
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

interface Notification {
  id: string
  type: "match" | "message" | "like" | "event" | "news" | "system"
  title: string
  message: string
  timestamp?: string
  created_at?: string
  read: boolean
  avatar?: string
  link?: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initPage = async () => {
      // Mark all as read when user visits the page
      await markAllAsReadOnLoad()
      // Wait a moment for the backend to update
      await new Promise(resolve => setTimeout(resolve, 500))
      // Then load the updated notifications
      await loadNotifications()
    }
    initPage()
  }, [])

  const loadNotifications = async () => {
    setIsLoading(true)
    const result = await api.notifications.getAll()
    if (result.data) {
      // Sort by created_at descending (newest first)
      const sortedNotifications = [...result.data].sort((a, b) => 
        new Date(b.created_at || b.timestamp || 0).getTime() - 
        new Date(a.created_at || a.timestamp || 0).getTime()
      )
      setNotifications(sortedNotifications)
    }
    setIsLoading(false)
  }

  const markAllAsReadOnLoad = async () => {
    try {
      console.log('[NotificationsPage] Starting markAllAsReadOnLoad')
      // Mark all as read on the backend
      const result = await api.notifications.markAllAsRead()
      console.log('[NotificationsPage] Mark all as read result:', result)
      
      // Update all notifications to read state locally
      setNotifications((prev) => {
        const updated = prev.map((n) => ({ ...n, read: true }))
        console.log('[NotificationsPage] Updated notifications locally:', updated)
        return updated
      })
      
      // Trigger sidebar update - this will reload the notification count
      console.log('[NotificationsPage] Dispatching notificationsRead event')
      window.dispatchEvent(new Event('notificationsRead'))
    } catch (error) {
      console.error('[NotificationsPage] Error marking all as read:', error)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    await api.notifications.markAsRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleMarkAllAsRead = async () => {
    await api.notifications.markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    // Trigger a page reload or emit an event to update the sidebar
    window.dispatchEvent(new Event('notificationsRead'))
  }

  const handleDelete = async (id: string) => {
    await api.notifications.delete(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "match":
        return <Users className="h-5 w-5 text-secondary" />
      case "message":
        return <MessageCircle className="h-5 w-5 text-chart-3" />
      case "like":
        return <Heart className="h-5 w-5 text-primary" />
      case "event":
        return <Calendar className="h-5 w-5 text-chart-4" />
      case "news":
        return <Megaphone className="h-5 w-5 text-orange-500" />
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getInitials = (title: string) => {
    return title.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  }

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "Just now"
    
    try {
      const date = new Date(timestamp)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Just now"
      }
      
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      
      // If timestamp is in the future or very recent (within 1 second), show the date
      if (diff < 1000) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) + ', ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }
      
      const minutes = Math.floor(diff / (1000 * 60))
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))

      if (minutes < 1) return "Just now"
      if (minutes < 60) return `${minutes}m ago`
      if (hours < 24) return `${hours}h ago`
      if (days < 7) return `${days}d ago`
      
      // For older dates, show the actual date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) + ', ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return "Just now"
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className={cn(
                "flex items-start gap-4 p-4 rounded-xl border border-border bg-card transition-all group",
                !notification.read && "bg-primary/5 border-primary/20",
                notification.link && "hover:shadow-md cursor-pointer"
              )}>
                {/* Icon/Avatar */}
                <div className="relative shrink-0">
                  {notification.avatar ? (
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={notification.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(notification.title)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      {getIcon(notification.type)}
                    </div>
                  )}
                  {!notification.read && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-card" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-foreground",
                    !notification.read && "font-medium"
                  )}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatTimestamp(notification.timestamp || notification.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleMarkAsRead(notification.id)
                      }}
                    >
                      <Check className="h-4 w-4" />
                      <span className="sr-only">Mark as read</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(notification.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No notifications</h3>
            <p className="text-muted-foreground">
              {"When you get likes, matches, or messages, they'll appear here"}
            </p>
          </div>
        )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
}
