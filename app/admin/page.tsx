"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Shield,
  AlertTriangle,
  Ban,
  Clock,
  Check,
  History,
  ChevronDown,
  StickyNote,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Edit,
  ImageIcon,
  Megaphone,
  Send,
  XCircle,
  MoreVertical,
  Undo2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { mockAdminActionHistory } from "@/lib/mock-data"
import { api } from "@/lib/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/store/auth-store"

interface AdminUser {
  id: string
  first_name: string
  last_name: string
  email: string
  photos: string[]
  status: string
  created_at: string
  last_active: string
  warnings: number
  is_suspended: boolean
  is_banned: boolean
}

interface ActionHistory {
  id: string
  action: string
  reason: string
  admin: string
  created_at: string
}

interface AdminNote {
  id: string
  content: string
  admin: string
  created_at: string
}

interface AdminEvent {
  id: string
  title: string
  description: string
  image?: string
  start_date: string
  end_date?: string
  location: string
  attendees: number
  max_attendees?: number
  is_joined: boolean
  category?: string
  is_cancelled?: boolean
}

const mockAdminNotes: Record<string, AdminNote[]> = {
  "user-3": [
    { id: "note-1", content: "User reported by multiple people for inappropriate messages. Monitoring closely.", admin: "Admin User", created_at: "2024-01-08T10:00:00Z" },
  ],
  "user-4": [
    { id: "note-2", content: "Repeated harassment complaints. User was warned twice before suspension.", admin: "Admin User", created_at: "2024-01-14T09:00:00Z" },
    { id: "note-3", content: "User appealed suspension, reviewing case.", admin: "Admin User", created_at: "2024-01-18T14:00:00Z" },
  ],
  "user-6": [
    { id: "note-4", content: "Confirmed fake profile using stolen photos.", admin: "Admin User", created_at: "2023-12-01T08:30:00Z" },
    { id: "note-5", content: "Multiple scam reports from different users.", admin: "Admin User", created_at: "2023-12-14T11:00:00Z" },
    { id: "note-6", content: "Permanent ban issued - do not reinstate.", admin: "Admin User", created_at: "2024-01-10T10:30:00Z" },
  ],
}

// Mock event attendees
const mockEventAttendees: Record<string, { id: string; first_name: string; last_name: string; email: string; photo: string; joined_at: string }[]> = {
  "event-1": [
    { id: "user-2", first_name: "Emma", last_name: "Wilson", email: "emma.wilson@example.com", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop", joined_at: "2024-01-15T10:00:00Z" },
    { id: "user-4", first_name: "Olivia", last_name: "Martinez", email: "olivia.martinez@example.com", photo: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop", joined_at: "2024-01-16T14:30:00Z" },
    { id: "user-7", first_name: "Mia", last_name: "Davis", email: "mia.davis@example.com", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop", joined_at: "2024-01-17T09:15:00Z" },
  ],
  "event-2": [
    { id: "user-3", first_name: "Sophia", last_name: "Chen", email: "sophia.chen@example.com", photo: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop", joined_at: "2024-01-18T11:00:00Z" },
    { id: "user-5", first_name: "Isabella", last_name: "Kim", email: "isabella.kim@example.com", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop", joined_at: "2024-01-19T16:00:00Z" },
  ],
  "event-3": [
    { id: "user-2", first_name: "Emma", last_name: "Wilson", email: "emma.wilson@example.com", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop", joined_at: "2024-01-20T08:00:00Z" },
    { id: "user-8", first_name: "Charlotte", last_name: "Brown", email: "charlotte.brown@example.com", photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop", joined_at: "2024-01-20T10:30:00Z" },
    { id: "user-3", first_name: "Sophia", last_name: "Chen", email: "sophia.chen@example.com", photo: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop", joined_at: "2024-01-20T12:00:00Z" },
    { id: "user-5", first_name: "Isabella", last_name: "Kim", email: "isabella.kim@example.com", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop", joined_at: "2024-01-21T09:00:00Z" },
  ],
}

export default function AdminPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  // If not authenticated at all, redirect to login
  if (!user) {
    router.push("/login")
    return null
  }

  // If not admin, show access denied
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You don't have admin privileges.</p>
          <Button onClick={() => router.push("/browse")}>
            Return to Browse
          </Button>
        </div>
      </div>
    )
  }

  // Admin user code continues below
  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [showNotesDialog, setShowNotesDialog] = useState(false)
  const [actionType, setActionType] = useState<"warning" | "suspend" | "ban" | null>(null)
  const [actionReason, setActionReason] = useState("")
  const [actionHistory, setActionHistory] = useState<Record<string, ActionHistory[]>>(mockAdminActionHistory)
  const [userNotes, setUserNotes] = useState<Record<string, AdminNote[]>>(mockAdminNotes)
  const [newNote, setNewNote] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "banned">("all")
  
  // Event management state
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showAttendeesDialog, setShowAttendeesDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null)
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    image: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    location: "",
    max_attendees: "",
    category: "local-chapter",
  })

  // News management state
  const [newsItems, setNewsItems] = useState<{ id: string; title: string; message: string; created_at: string }[]>([
    { id: "news-1", title: "Welcome to D8-LPA!", message: "Check out our upcoming events and new features. We're excited to have you in our community!", created_at: "2024-01-18T10:00:00Z" },
    { id: "news-2", title: "New Feature: Event RSVPs", message: "You can now RSVP to events and see who else is attending. Don't miss out on our community gatherings!", created_at: "2024-01-15T14:00:00Z" },
  ])
  const [newsForm, setNewsForm] = useState({ title: "", message: "" })

  useEffect(() => {
    loadUsers()
    loadEvents()
  }, [])

  const loadUsers = async () => {
    const result = await api.admin.getUsers()
    if (result.data) {
      const usersData = result.data.users || result.data
      setUsers(usersData as AdminUser[])
      setFilteredUsers(usersData as AdminUser[])
    }
  }

  const loadEvents = async () => {
    const result = await api.events.getAll()
    if (result.data) {
      setEvents(result.data as AdminEvent[])
    }
  }

  useEffect(() => {
    let filtered = users

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((u) => !u.is_banned && !u.is_suspended && u.warnings === 0)
    } else if (statusFilter === "suspended") {
      filtered = filtered.filter((u) => u.is_suspended)
    } else if (statusFilter === "banned") {
      filtered = filtered.filter((u) => u.is_banned)
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.first_name.toLowerCase().includes(query) ||
          user.last_name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query)
      )
    }

    setFilteredUsers(filtered)
  }, [searchQuery, users, statusFilter])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (user: AdminUser) => {
    if (user.is_banned) {
      return <Badge variant="destructive">Banned</Badge>
    }
    if (user.is_suspended) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Suspended</Badge>
    }
    if (user.warnings > 0) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Warned ({user.warnings})</Badge>
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>
  }

  const handleAction = (user: AdminUser, action: "warning" | "suspend" | "ban") => {
    setSelectedUser(user)
    setActionType(action)
    setActionReason("")
    setShowActionDialog(true)
  }

  const handleViewHistory = (user: AdminUser) => {
    setSelectedUser(user)
    setShowHistoryDialog(true)
  }

  const handleViewNotes = (user: AdminUser) => {
    setSelectedUser(user)
    setNewNote("")
    setShowNotesDialog(true)
  }

  const addNote = () => {
    if (!selectedUser || !newNote.trim()) return

    const note: AdminNote = {
      id: `note-${Date.now()}`,
      content: newNote.trim(),
      admin: "Admin User",
      created_at: new Date().toISOString(),
    }

    setUserNotes((prev) => ({
      ...prev,
      [selectedUser.id]: [...(prev[selectedUser.id] || []), note],
    }))

    setNewNote("")
  }

  const deleteNote = (noteId: string) => {
    if (!selectedUser) return

    setUserNotes((prev) => ({
      ...prev,
      [selectedUser.id]: (prev[selectedUser.id] || []).filter((n) => n.id !== noteId),
    }))
  }

  const submitAction = () => {
    if (!selectedUser || !actionType || !actionReason.trim()) return

    const newAction: ActionHistory = {
      id: `action-${Date.now()}`,
      action: actionType,
      reason: actionReason,
      admin: "Admin User",
      created_at: new Date().toISOString(),
    }

    // Update action history
    setActionHistory((prev) => ({
      ...prev,
      [selectedUser.id]: [...(prev[selectedUser.id] || []), newAction],
    }))

    // Update user status
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id === selectedUser.id) {
          if (actionType === "warning") {
            return { ...user, warnings: user.warnings + 1 }
          }
          if (actionType === "suspend") {
            return { ...user, is_suspended: true, is_banned: false }
          }
          if (actionType === "ban") {
            return { ...user, is_banned: true, is_suspended: false }
          }
        }
        return user
      })
    )

    setShowActionDialog(false)
    setActionType(null)
    setActionReason("")
    setSelectedUser(null)
  }

  const removeAction = (user: AdminUser, action: "warning" | "suspend" | "ban") => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === user.id) {
          if (action === "warning" && u.warnings > 0) {
            return { ...u, warnings: u.warnings - 1 }
          }
          if (action === "suspend") {
            return { ...u, is_suspended: false }
          }
          if (action === "ban") {
            return { ...u, is_banned: false }
          }
        }
        return u
      })
    )
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "suspend":
        return <Clock className="h-4 w-4 text-orange-500" />
      case "ban":
        return <Ban className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  // Event management functions
  const openCreateEventDialog = () => {
    setEditingEvent(null)
    setEventForm({
      title: "",
      description: "",
      image: "",
      start_date: "",
      start_time: "",
      end_date: "",
      end_time: "",
      location: "",
      max_attendees: "",
      category: "dating",
    })
    setShowEventDialog(true)
  }

  const openEditEventDialog = (event: AdminEvent) => {
    setEditingEvent(event)
    const startDate = new Date(event.start_date)
    const endDate = event.end_date ? new Date(event.end_date) : null
    setEventForm({
      title: event.title,
      description: event.description,
      image: event.image || "",
      start_date: startDate.toISOString().split("T")[0],
      start_time: startDate.toTimeString().slice(0, 5),
      end_date: endDate ? endDate.toISOString().split("T")[0] : "",
      end_time: endDate ? endDate.toTimeString().slice(0, 5) : "",
      location: event.location,
      max_attendees: event.max_attendees?.toString() || "",
      category: event.category || "dating",
    })
    setShowEventDialog(true)
  }

  const saveEvent = async () => {
    if (!eventForm.title || !eventForm.start_date || !eventForm.start_time || !eventForm.location) {
      console.error('Missing required fields:', { 
        title: eventForm.title, 
        start_date: eventForm.start_date, 
        start_time: eventForm.start_time, 
        location: eventForm.location 
      })
      return
    }

    try {
      const startDateTime = new Date(`${eventForm.start_date}T${eventForm.start_time}:00`)
      const endDateTime = eventForm.end_date && eventForm.end_time 
        ? new Date(`${eventForm.end_date}T${eventForm.end_time}:00`)
        : null

      const eventData = {
        title: eventForm.title,
        description: eventForm.description,
        image: eventForm.image || undefined,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime?.toISOString(),
        location: eventForm.location,
        max_attendees: eventForm.max_attendees ? parseInt(eventForm.max_attendees) : undefined,
        category: eventForm.category,
      }

      if (editingEvent) {
        // Update existing event
        const result = await api.admin.updateEvent(editingEvent.id, eventData)
        if (result.error) {
          console.error('Error updating event:', result.error)
          alert(`Error updating event: ${result.error}`)
          return
        }
        if (result.data) {
          await loadEvents()
        }
      } else {
        // Create new event
        const result = await api.admin.createEvent(eventData)
        if (result.error) {
          console.error('Error creating event:', result.error)
          alert(`Error creating event: ${result.error}`)
          return
        }
        if (result.data) {
          await loadEvents()
        }
      }

      setShowEventDialog(false)
      setEditingEvent(null)
      setEventForm({
        title: "",
        description: "",
        image: "",
        start_date: "",
        start_time: "",
        end_date: "",
        end_time: "",
        location: "",
        max_attendees: "",
        category: "local-chapter",
      })
    } catch (error) {
      console.error('Exception in saveEvent:', error)
      alert(`Error: ${error.message}`)
    }
  }

  const deleteEvent = async (eventId: string) => {
    const result = await api.admin.deleteEvent(eventId)
    if (result.data) {
      await loadEvents()
    }
  }

  const cancelEvent = async (eventId: string) => {
    const result = await api.admin.cancelEvent(eventId)
    if (result.data) {
      await loadEvents()
    }
  }

  const uncancelEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, is_cancelled: false } : e
      )
    )
  }

  const viewAttendees = (event: AdminEvent) => {
    setSelectedEvent(event)
    setShowAttendeesDialog(true)
  }

  const getEventAttendees = (eventId: string) => {
    return mockEventAttendees[eventId] || []
  }

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatEventTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatEventDateRange = (startDate: string, endDate?: string) => {
    const start = new Date(startDate)
    const startDateStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    const startTimeStr = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })

    if (!endDate) {
      return `${startDateStr} at ${startTimeStr}`
    }

    const end = new Date(endDate)
    const endDateStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    const endTimeStr = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })

    // Same day
    if (startDateStr === endDateStr) {
      return `${startDateStr}, ${startTimeStr} - ${endTimeStr}`
    }

    return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`
  }

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Admin Panel
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage users, events, and take moderation actions
          </p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="news" className="gap-2">
              <Megaphone className="h-4 w-4" />
              News
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            {/* Search */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  statusFilter === "all" && "ring-2 ring-primary"
                )}
                onClick={() => setStatusFilter("all")}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{users.length}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </CardContent>
              </Card>
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  statusFilter === "active" && "ring-2 ring-green-500"
                )}
                onClick={() => setStatusFilter("active")}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {users.filter((u) => !u.is_banned && !u.is_suspended && u.warnings === 0).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </CardContent>
              </Card>
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  statusFilter === "suspended" && "ring-2 ring-orange-500"
                )}
                onClick={() => setStatusFilter("suspended")}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {users.filter((u) => u.is_suspended).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Suspended</p>
                </CardContent>
              </Card>
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  statusFilter === "banned" && "ring-2 ring-red-500"
                )}
                onClick={() => setStatusFilter("banned")}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {users.filter((u) => u.is_banned).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Banned</p>
                </CardContent>
              </Card>
            </div>

            {/* User List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.photos?.[0] || "/placeholder.svg"} alt={user.first_name || "User"} />
                        <AvatarFallback>{user.first_name?.[0] || "U"}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">
                            {user.first_name} {user.last_name}
                          </p>
                          {getStatusBadge(user)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined {formatDate(user.created_at)} | Last active {formatDate(user.last_active)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Actions
                              <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleAction(user, "warning")}
                              className="flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                Warning
                              </span>
                              {user.warnings > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {user.warnings}
                                </Badge>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (user.is_suspended) {
                                  removeAction(user, "suspend")
                                } else {
                                  handleAction(user, "suspend")
                                }
                              }}
                              className="flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-orange-500" />
                                Suspend
                              </span>
                              {user.is_suspended && (
                                <Check className="h-4 w-4 text-orange-500" />
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (user.is_banned) {
                                  removeAction(user, "ban")
                                } else {
                                  handleAction(user, "ban")
                                }
                              }}
                              className={cn(
                                "flex items-center justify-between",
                                !user.is_banned && "text-destructive focus:text-destructive"
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <Ban className="h-4 w-4" />
                                Ban
                              </span>
                              {user.is_banned && (
                                <Check className="h-4 w-4 text-red-500" />
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Notes Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewNotes(user)}
                        >
                          <StickyNote className="h-4 w-4 mr-1" />
                          Notes
                          {(userNotes[user.id]?.length || 0) > 0 && (
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                              {userNotes[user.id]?.length}
                            </Badge>
                          )}
                        </Button>

                        {/* Report History Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewHistory(user)}
                        >
                          <History className="h-4 w-4 mr-1" />
                          History
                        </Button>
                      </div>
                    </div>
                  ))}

                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No users found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            {/* Event Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{events.length}</p>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {events.filter((e) => new Date(e.start_date) > new Date() && !e.is_cancelled).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">
                    {events.filter((e) => new Date(e.start_date) <= new Date() && !e.is_cancelled).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Past</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {events.filter((e) => e.is_cancelled).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Cancelled</p>
                </CardContent>
              </Card>
            </div>

            {/* Event List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Event Management</CardTitle>
                <Button onClick={openCreateEventDialog} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.map((event) => {
                    const isPast = new Date(event.start_date) <= new Date()
                    const isCancelled = event.is_cancelled
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors",
                          (isPast || isCancelled) && "opacity-60"
                        )}
                      >
                        {/* Event Image or Icon with Cancelled Overlay */}
                        <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                          {event.image ? (
                            <Image
                              src={event.image || "/placeholder.svg"}
                              alt={event.title}
                              width={64}
                              height={64}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                              <Calendar className="h-6 w-6 text-primary/50" />
                            </div>
                          )}
                          {isCancelled && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <XCircle className="h-8 w-8 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className={cn("font-medium text-foreground", isCancelled && "line-through")}>
                              {event.title}
                            </p>
                            {event.category && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {event.category}
                              </Badge>
                            )}
                            {isCancelled && (
                              <Badge variant="destructive" className="text-xs">
                                Cancelled
                              </Badge>
                            )}
                            {isPast && !isCancelled && (
                              <Badge variant="outline" className="text-xs">
                                Past
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                            {event.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatEventDateRange(event.start_date, event.end_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.attendees}{event.max_attendees ? `/${event.max_attendees}` : ""} attending
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewAttendees(event)}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Attendees
                            {event.attendees > 0 && (
                              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                {event.attendees}
                              </Badge>
                            )}
                          </Button>
                          
                          {/* Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                Actions
                                <ChevronDown className="h-4 w-4 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openEditEventDialog(event)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {isCancelled ? (
                                <DropdownMenuItem onClick={() => uncancelEvent(event.id)}>
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => cancelEvent(event.id)}
                                  className="text-orange-600 focus:text-orange-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancel Event
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => deleteEvent(event.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}

                  {events.length === 0 && (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground mb-4">No events yet</p>
                      <Button onClick={openCreateEventDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Event
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Post News to All Users
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="news-title">Title</Label>
                  <Input
                    id="news-title"
                    placeholder="e.g., New Feature Announcement"
                    value={newsForm.title}
                    onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="news-message">Message</Label>
                  <Textarea
                    id="news-message"
                    placeholder="Write your announcement message here..."
                    value={newsForm.message}
                    onChange={(e) => setNewsForm({ ...newsForm, message: e.target.value })}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (newsForm.title && newsForm.message) {
                      try {
                        const result = await api.admin.createAnnouncement(newsForm.title, newsForm.message)
                        if (result.data) {
                          setNewsItems([
                            {
                              id: result.data.id,
                              title: result.data.title,
                              message: result.data.message,
                              created_at: result.data.created_at,
                            },
                            ...newsItems,
                          ])
                          setNewsForm({ title: "", message: "" })
                        } else if (result.error) {
                          alert('Error posting announcement: ' + result.error)
                        }
                      } catch (error) {
                        console.error('Error posting announcement:', error)
                        alert('Failed to post announcement')
                      }
                    }
                  }}
                  disabled={!newsForm.title || !newsForm.message}
                >
                  <Megaphone className="h-4 w-4 mr-2" />
                  Post to All Users
                </Button>
              </CardContent>
            </Card>

            {/* Previous News */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Previous Announcements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {newsItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card"
                    >
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <Megaphone className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(item.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => setNewsItems(newsItems.filter((n) => n.id !== item.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {newsItems.length === 0 && (
                    <div className="text-center py-12">
                      <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No announcements posted yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionType === "warning" && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                {actionType === "suspend" && <Clock className="h-5 w-5 text-orange-500" />}
                {actionType === "ban" && <Ban className="h-5 w-5 text-red-500" />}
                {actionType === "warning" && "Issue Warning"}
                {actionType === "suspend" && "Suspend User"}
                {actionType === "ban" && "Ban User"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedUser && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.photos?.[0] || "/placeholder.svg"} alt={selectedUser.first_name || "User"} />
                    <AvatarFallback>{selectedUser.first_name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedUser.first_name} {selectedUser.last_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for action</Label>
                <Textarea
                  id="reason"
                  placeholder="Provide a reason for this action..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowActionDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitAction}
                  disabled={!actionReason.trim()}
                  className={cn(
                    actionType === "ban" && "bg-destructive hover:bg-destructive/90"
                  )}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Notes Dialog */}
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Admin Notes
              </DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.photos?.[0] || "/placeholder.svg"} alt={selectedUser.first_name || "User"} />
                    <AvatarFallback>{selectedUser.first_name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedUser.first_name} {selectedUser.last_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>

                {/* Add Note */}
                <div className="space-y-2">
                  <Label htmlFor="new-note">Add a note</Label>
                  <div className="flex gap-2">
                    <Textarea
                      id="new-note"
                      placeholder="Write a note about this user..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={2}
                      className="flex-1 resize-none"
                    />
                    <Button
                      onClick={addNote}
                      disabled={!newNote.trim()}
                      size="icon"
                      className="shrink-0 h-auto"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Notes List */}
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {(userNotes[selectedUser.id] || []).length > 0 ? (
                    [...(userNotes[selectedUser.id] || [])].reverse().map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-lg border border-border bg-card group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-foreground flex-1">{note.content}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => deleteNote(note.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">By: {note.admin}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(note.created_at)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <StickyNote className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No notes for this user</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Action History
              </DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.photos?.[0] || "/placeholder.svg"} alt={selectedUser.first_name || "User"} />
                    <AvatarFallback>{selectedUser.first_name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedUser.first_name} {selectedUser.last_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  {getStatusBadge(selectedUser)}
                </div>

                <Separator />

                <div className="max-h-80 overflow-y-auto space-y-3">
                  {(actionHistory[selectedUser.id] || []).length > 0 ? (
                    (actionHistory[selectedUser.id] || []).map((action) => (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {getActionIcon(action.action)}
                          <span className="font-medium capitalize">{action.action}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDateTime(action.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{action.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          By: {action.admin}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <History className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No action history for this user</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Event Create/Edit Dialog */}
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {editingEvent ? "Edit Event" : "Create New Event"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="event-title">Event Title *</Label>
                <Input
                  id="event-title"
                  placeholder="e.g., Speed Dating Night"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  placeholder="Describe the event..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Start Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-start-date">Start Date *</Label>
                  <Input
                    id="event-start-date"
                    type="date"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-start-time">Start Time *</Label>
                  <Input
                    id="event-start-time"
                    type="time"
                    value={eventForm.start_time}
                    onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                  />
                </div>
              </div>

              {/* End Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-end-date">End Date</Label>
                  <Input
                    id="event-end-date"
                    type="date"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-end-time">End Time</Label>
                  <Input
                    id="event-end-time"
                    type="time"
                    value={eventForm.end_time}
                    onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="event-location">Location *</Label>
                <Input
                  id="event-location"
                  placeholder="e.g., The Lounge Bar, San Francisco"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                />
              </div>

              {/* Category and Max Attendees */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-category">Category</Label>
                  <Select
                    value={eventForm.category}
                    onValueChange={(value) => setEventForm({ ...eventForm, category: value })}
                  >
                    <SelectTrigger id="event-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local-chapter">Local Chapter Event</SelectItem>
                      <SelectItem value="regional">Regional</SelectItem>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="dating">Dating</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                      <SelectItem value="food">Food & Drink</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="fitness">Fitness</SelectItem>
                      <SelectItem value="arts">Arts & Culture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-max-attendees">Max Attendees</Label>
                  <Input
                    id="event-max-attendees"
                    type="number"
                    placeholder="Leave blank for unlimited"
                    value={eventForm.max_attendees}
                    onChange={(e) => setEventForm({ ...eventForm, max_attendees: e.target.value })}
                  />
                </div>
              </div>

              {/* Image URL */}
              <div className="space-y-2">
                <Label htmlFor="event-image">Image URL (optional)</Label>
                <Input
                  id="event-image"
                  placeholder="https://example.com/image.jpg"
                  value={eventForm.image}
                  onChange={(e) => setEventForm({ ...eventForm, image: e.target.value })}
                />
                {eventForm.image && (
                  <div className="mt-2 h-32 rounded-lg overflow-hidden bg-muted">
                    <Image
                      src={eventForm.image || "/placeholder.svg"}
                      alt="Event preview"
                      width={200}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={saveEvent}
                  disabled={!eventForm.title || !eventForm.start_date || !eventForm.start_time || !eventForm.location}
                >
                  {editingEvent ? "Save Changes" : "Create Event"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Attendees Dialog */}
        <Dialog open={showAttendeesDialog} onOpenChange={setShowAttendeesDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Event Attendees
              </DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4">
                {/* Event Info */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium text-foreground">{selectedEvent.title}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatEventDateRange(selectedEvent.start_date, selectedEvent.end_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedEvent.location}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {getEventAttendees(selectedEvent.id).length} attending
                    {selectedEvent.max_attendees && ` of ${selectedEvent.max_attendees} spots`}
                  </p>
                </div>

                <Separator />

                {/* Attendees List */}
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {getEventAttendees(selectedEvent.id).length > 0 ? (
                    getEventAttendees(selectedEvent.id).map((attendee) => (
                      <div
                        key={attendee.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={attendee.photo || "/placeholder.svg"} alt={attendee.first_name || "Attendee"} />
                          <AvatarFallback>{attendee.first_name?.[0] || "A"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">
                            {attendee.first_name} {attendee.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {attendee.email}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          <p>Joined</p>
                          <p>{formatDateTime(attendee.joined_at)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No attendees yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
