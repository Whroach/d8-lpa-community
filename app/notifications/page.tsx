"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { Bell, Trash2, CheckCircle2, Heart, MessageCircle, Users, Calendar, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notification {
  _id: string
  user_id: string
  type: 'match' | 'message' | 'like' | 'event' | 'admin'
  title: string
  message: string
  read: boolean
  created_at: string
  related_user?: string
  related_match?: string
  avatar?: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    // Mark all unread notifications as read when visiting this page
    const unreadNotifications = notifications.filter((n) => !n.read)
    if (unreadNotifications.length > 0) {
      handleMarkAllAsRead()
    }
  }, [])

  const loadNotifications = async () => {
    setIsLoading(true)
    const result = await api.notifications.getAll()
    if (result.data) {
      setNotifications(result.data)
    }
    setIsLoading(false)
  }

  const handleMarkAsRead = async (notificationId: string) => {
    await api.notifications.markAsRead(notificationId)
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === notificationId ? { ...n, read: true } : n
      )
    )
    // Emit event for sidebar to update badge count
    window.dispatchEvent(new Event('notificationsRead'))
  }

  const handleDelete = async (notificationId: string) => {
    await api.notifications.delete(notificationId)
    setNotifications((prev) => prev.filter((n) => n._id !== notificationId))
  }

  const handleMarkAllAsRead = async () => {
    await api.notifications.markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    window.dispatchEvent(new Event('notificationsRead'))
  }

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'match':
        return <Users className="h-5 w-5 text-pink-500" />
      case 'like':
        return <Heart className="h-5 w-5 text-red-500" />
      case 'message':
        return <MessageCircle className="h-5 w-5 text-blue-500" />
      case 'event':
        return <Calendar className="h-5 w-5 text-purple-500" />
      case 'admin':
        return <Shield className="h-5 w-5 text-orange-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  const getNotificationBadgeColor = (type: string) => {
    switch (type) {
      case 'match':
        return 'bg-pink-100 text-pink-800'
      case 'like':
        return 'bg-red-100 text-red-800'
      case 'message':
        return 'bg-blue-100 text-blue-800'
      case 'event':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bell className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">Notifications</h1>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  onClick={handleMarkAllAsRead}
                  className="text-primary hover:text-primary"
                >
                  Mark all as read
                </Button>
              )}
            </div>
            <p className="text-muted-foreground">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className="gap-2"
            >
              All
              {notifications.length > 0 && (
                <Badge variant="secondary">{notifications.length}</Badge>
              )}
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              onClick={() => setFilter('unread')}
              className="gap-2"
            >
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount}</Badge>
              )}
            </Button>
          </div>

          {/* Notifications List */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                <p className="text-muted-foreground text-center">
                  {filter === 'unread'
                    ? "You're all caught up! No unread notifications."
                    : 'No notifications yet. You will be notified here when you get matches, messages, likes, and more.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <Card
                  key={notification._id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    !notification.read && 'border-primary/50 bg-primary/5'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Icon and Type Badge */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2 rounded-full bg-muted">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <Badge variant="secondary" className={cn('text-xs', getNotificationBadgeColor(notification.type))}>
                          {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                        </Badge>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className={cn('font-semibold', !notification.read && 'font-bold')}>
                              {notification.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDate(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification._id)}
                            title="Mark as read"
                          >
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification._id)}
                          title="Delete notification"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
}

