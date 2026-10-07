"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Loader2,
  Search,
  ChevronRight,
  Check,
  Filter,
  X,
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { EventExtras } from "@/components/event-extras"
import { LoadError } from "@/components/load-error"

/**
 * A day typed into a date box ("2026-11-07") means that day on the member's
 * own clock. `new Date("2026-11-07")` reads it as midnight in London, which
 * in the United States is the evening before - so "From" let in the previous
 * evening's events, "To" left out the chosen day, and the chips showed the
 * day before.
 */
const localDay = (value: string, endOfDay = false): Date => {
  const [y, m, d] = value.split("-").map(Number)
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)
}
const dayValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const dayLabel = (value: string) =>
  localDay(value).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })

// These are the event categories the server stores. The old list filtered on
// a field that does not exist, so choosing any type hid every event.
const EVENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "local-chapter", label: "Local Chapter" },
  { value: "regional", label: "Regional" },
  { value: "national", label: "National" },
  { value: "social", label: "Social" },
  { value: "dating", label: "Singles" },
  { value: "food", label: "Food" },
  { value: "outdoor", label: "Outdoor" },
  { value: "fitness", label: "Fitness" },
  { value: "arts", label: "Arts" },
]

interface Event {
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
  event_type?: string
  is_cancelled?: boolean
}

// Helper function to get category badge color
const getCategoryColor = (category?: string): string => {
  const categoryColorMap: Record<string, string> = {
    "social": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
    "regional": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800",
    "national": "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800",
    "local-chapter": "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950 dark:text-pink-200 dark:border-pink-800",
    "workshop": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800",
    "networking": "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800",
    "dating": "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
  };
  
  const normalizedCategory = category?.toLowerCase() || "dating";
  return categoryColorMap[normalizedCategory] || "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600";
};

// The same names the admin chooses from when creating an event.
const CATEGORY_NAMES: Record<string, string> = {
  "local-chapter": "Local Chapter Event",
  food: "Food & Drink",
  arts: "Arts & Culture",
};
const categoryName = (category: string) => CATEGORY_NAMES[category.toLowerCase()] || category;

const isPastEvent = (event: Event): boolean =>
  new Date(event.end_date || event.start_date) < new Date()

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isActioning, setIsActioning] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming")
  
  // Filter state
  const [eventType, setEventType] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The card that opened the details, so keyboard focus can go back to it.
  const openerRef = useRef<HTMLElement | null>(null)

  const loadEvents = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    const result = await api.events.getAll()
    if (Array.isArray(result.data)) {
      setEvents(result.data)
      // A reminder or notification can link straight to one event.
      const wanted = new URLSearchParams(window.location.search).get("event")
      const found = wanted && result.data.find((e: Event) => String(e.id) === wanted)
      if (found) {
        if (isPastEvent(found)) setActiveTab("past")
        setSelectedEvent(found)
      }
    } else {
      setLoadError(result.error || "Please try again.")
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void loadEvents()
    if (typeof window !== "undefined") {
      localStorage.setItem("lastViewedEvents", new Date().toISOString())
      window.dispatchEvent(new Event("eventsViewed"))
      
      // Mark event notifications as read
      const markEventNotificationsAsRead = async () => {
        try {
          const notificationsResult = await api.notifications.getAll()
          if (notificationsResult.data) {
            const unreadEventNotifications = notificationsResult.data.filter(
              (n: { type?: string; read?: boolean }) => n.type === 'event' && !n.read
            )
            
            // Mark each unread event notification as read
            for (const notification of unreadEventNotifications) {
              await api.notifications.markAsRead(notification.id || notification._id)
            }
            // Let the menu badges re-read the real counts.
            if (unreadEventNotifications.length > 0) {
              window.dispatchEvent(new Event("notificationsRead"))
              window.dispatchEvent(new Event("eventsViewed"))
            }
          }
        } catch (error) {
          console.error('Error marking event notifications as read:', error)
        }
      }
      
      markEventNotificationsAsRead()
    }
  }, [loadEvents])

  useEffect(() => {
    let filtered = events.filter(
      (event) =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    // Filter by event type
    if (eventType !== "all") {
      filtered = filtered.filter(event => event.category === eventType)
    }
    
    // Filter by date range
    if (startDate) {
      const start = localDay(startDate)
      filtered = filtered.filter(event => new Date(event.start_date) >= start)
    }
    
    if (endDate) {
      const end = localDay(endDate, true)
      filtered = filtered.filter(event => new Date(event.start_date) <= end)
    }

    setFilteredEvents(
      filtered.filter((event) =>
        activeTab === "past" ? isPastEvent(event) : !isPastEvent(event)
      )
    )
  }, [events, searchQuery, eventType, startDate, endDate, activeTab])

  const clearFilters = () => {
    setEventType("all")
    setStartDate("")
    setEndDate("")
  }

  const activeFiltersCount = (eventType !== "all" ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)

  // Quick choices beside the date boxes.
  const setRange = (days: number | null) => {
    if (days === null) {
      setStartDate("")
      setEndDate("")
      return
    }
    const today = new Date()
    setStartDate(dayValue(today))
    setEndDate(dayValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)))
  }

  const handleJoinLeave = async (event: Event) => {
    setIsActioning(event.id)
    setActionError(null)

    const result = event.is_joined
      ? await api.events.leave(event.id)
      : await api.events.join(event.id)

    // Only flip the UI if the server agreed. Previously a rejected join (event
    // full, already cancelled) still rendered as "Attending".
    if (result.error) {
      setActionError(result.error)
      setIsActioning(null)
      return
    }

    toast.success(event.is_joined ? `You are no longer going to ${event.title}` : `You are going to ${event.title}`, {
      description: event.is_joined ? undefined : "Add it to your calendar so you do not forget.",
    })

    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id
          ? {
              ...e,
              is_joined: !e.is_joined,
              attendees: e.is_joined ? e.attendees - 1 : e.attendees + 1,
            }
          : e
      )
    )

    if (selectedEvent?.id === event.id) {
      setSelectedEvent({
        ...selectedEvent,
        is_joined: !selectedEvent.is_joined,
        attendees: selectedEvent.is_joined
          ? selectedEvent.attendees - 1
          : selectedEvent.attendees + 1,
      })
    }

    setIsActioning(null)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            <p className="text-muted-foreground" role="status">Loading events...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="p-6 md:p-8">
          <LoadError what="the events" detail={loadError} onRetry={loadEvents} />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
        <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">
            Get-togethers for members. Choose one to read more and say if you are going.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6" role="group" aria-label="Which events">
          <Button
            variant={activeTab === "upcoming" ? "default" : "outline"}
            aria-pressed={activeTab === "upcoming"}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming Events
          </Button>
          <Button
            variant={activeTab === "past" ? "default" : "outline"}
            aria-pressed={activeTab === "past"}
            onClick={() => setActiveTab("past")}
          >
            Past Events
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search events by name or place"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="relative bg-transparent">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-2 px-2 py-0 text-sm">
                      {activeFiltersCount}<span className="sr-only"> in use</span>
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(22rem,calc(100vw-2rem))]" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Filters</h2>
                    {activeFiltersCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear all
                      </Button>
                    )}
                  </div>
                  
                  {/* Event Type */}
                  <div className="space-y-2">
                    <label id="event-type-label" className="font-medium">Kind of event</label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger aria-labelledby="event-type-label">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Date Range */}
                  <div className="space-y-2">
                    <p className="font-medium">When</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setRange(7)}>Next 7 days</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setRange(30)}>Next 30 days</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setRange(null)}>Any time</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="events-from" className="text-sm text-muted-foreground">From</label>
                        <Input
                          id="events-from"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label htmlFor="events-to" className="text-sm text-muted-foreground">To</label>
                        <Input
                          id="events-to"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button className="w-full" onClick={() => setShowFilters(false)}>
                    Show events
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {eventType !== "all" && (
                <Badge variant="secondary" data-testid="filter-chip" className="flex items-center gap-1 py-1 pl-3 pr-1 text-sm">
                  {EVENT_TYPES.find(t => t.value === eventType)?.label}
                  <button type="button" aria-label={`Remove filter: ${EVENT_TYPES.find(t => t.value === eventType)?.label}`} onClick={() => setEventType("all")} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </Badge>
              )}
              {startDate && (
                <Badge variant="secondary" data-testid="filter-chip" className="flex items-center gap-1 py-1 pl-3 pr-1 text-sm">
                  From: {dayLabel(startDate)}
                  <button type="button" aria-label={`Remove filter: From ${dayLabel(startDate)}`} onClick={() => setStartDate("")} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </Badge>
              )}
              {endDate && (
                <Badge variant="secondary" data-testid="filter-chip" className="flex items-center gap-1 py-1 pl-3 pr-1 text-sm">
                  To: {dayLabel(endDate)}
                  <button type="button" aria-label={`Remove filter: To ${dayLabel(endDate)}`} onClick={() => setEndDate("")} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Events List */}
        {filteredEvents.length > 0 ? (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <Card
                key={event.id}
                data-testid="event-card"
                className={cn(
                  "overflow-hidden hover:shadow-lg transition-all py-0",
                  event.is_joined && !event.is_cancelled && "ring-2 ring-primary"
                )}
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="flex w-full flex-col text-left sm:flex-row"
                    aria-label={`${event.title}, ${formatDate(event.start_date)} at ${formatTime(event.start_date)}. Read more`}
                    onClick={(e) => { openerRef.current = e.currentTarget; setActionError(null); setSelectedEvent(event) }}
                  >
                    {/* Event Image */}
                    <div className="w-full sm:w-48 h-32 sm:h-auto sm:self-stretch sm:min-h-36 relative shrink-0 overflow-hidden">
                      {event.image ? (
                        <Image
                          src={event.image || "/placeholder.svg"}
                          alt={event.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          <Calendar className="h-12 w-12 text-primary/50" />
                        </div>
                      )}
                    </div>

                    {/* Event Info */}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {event.event_type && (
                              <Badge variant="outline" className="text-sm capitalize">
                                {EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}
                              </Badge>
                            )}
                            {event.category && (
                              <Badge className={`text-sm capitalize border ${getCategoryColor(event.category)}`}>
                                {categoryName(event.category)}
                              </Badge>
                            )}
                            {event.is_cancelled && (
                              <Badge variant="destructive" className="text-sm">
                                Cancelled
                              </Badge>
                            )}
                            {event.is_joined && !event.is_cancelled && (
                              <Badge className="bg-primary text-primary-foreground text-sm">
                                <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                                You're going
                              </Badge>
                            )}
                          </div>
                          <h2 className="font-semibold text-lg text-foreground mb-2">
                            {event.title}
                          </h2>
                          <div className="space-y-1 text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(event.start_date)}</span>
                              <Clock className="h-4 w-4 ml-2" />
                              <span>{formatTime(event.start_date)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>
                                {event.attendees}
                                {event.max_attendees && ` / ${event.max_attendees}`} attending
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
                      </div>
                    </div>
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-foreground mb-2">No events found</h2>
            <p className="text-muted-foreground">
              No events match "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-foreground mb-2">
              {activeFiltersCount > 0 ? "No events match your filters" : activeTab === "past" ? "No past events" : "No upcoming events"}
            </h2>
            <p className="text-muted-foreground">
              {activeFiltersCount > 0
                ? "Try a different kind of event or a wider range of dates."
                : activeTab === "past"
                  ? "Past events will appear here"
                  : "Check back later for upcoming events"}
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        {/* Event Details Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => { setSelectedEvent(null); setActionError(null) }}>
          {selectedEvent && (
            <DialogContent
              className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
              onCloseAutoFocus={(e) => {
                if (openerRef.current?.isConnected) {
                  e.preventDefault()
                  openerRef.current.focus()
                }
              }}
            >
              {selectedEvent.image && (
                <div className="relative h-48 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg">
                  <Image
                    src={selectedEvent.image || "/placeholder.svg"}
                    alt={selectedEvent.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {selectedEvent.event_type && (
                    <Badge variant="outline" className="text-sm capitalize">
                      {EVENT_TYPES.find(t => t.value === selectedEvent.event_type)?.label || selectedEvent.event_type}
                    </Badge>
                  )}
                  {selectedEvent.category && (
                    <Badge className={`text-sm capitalize border ${getCategoryColor(selectedEvent.category)}`}>
                      {categoryName(selectedEvent.category)}
                    </Badge>
                  )}
                  {selectedEvent.is_cancelled && (
                    <Badge variant="destructive" className="text-sm">
                      Cancelled
                    </Badge>
                  )}
                  {selectedEvent.is_joined && !selectedEvent.is_cancelled && (
                    <Badge className="bg-primary text-primary-foreground text-sm">
                      <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                      You're going
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-4 pt-2">
                    <p className="text-foreground">{selectedEvent.description}</p>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>
                          {formatDate(selectedEvent.start_date)} at {formatTime(selectedEvent.start_date)}
                          {selectedEvent.end_date && ` - ${formatTime(selectedEvent.end_date)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>{selectedEvent.location}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Users className="h-4 w-4 shrink-0" />
                        <span>
                          {selectedEvent.attendees}
                          {selectedEvent.max_attendees &&
                            ` / ${selectedEvent.max_attendees}`}{" "}
                          attending
                        </span>
                      </div>
                    </div>

                    {actionError && (
                      <p role="alert" className="font-medium text-destructive">{actionError}</p>
                    )}

                    {/* Cancelled and finished events are read-only — there is
                        nothing to RSVP to. */}
                    {selectedEvent.is_cancelled ? (
                      <div className="w-full mt-4 rounded-lg border-2 border-destructive/40 p-3 text-center font-medium text-foreground">
                        This event has been cancelled.
                      </div>
                    ) : isPastEvent(selectedEvent) ? (
                      <div className="w-full mt-4 rounded-lg bg-muted p-3 text-center text-foreground">
                        This event has already taken place.
                      </div>
                    ) : (
                      <Button
                        className="w-full mt-4 h-12 text-base"
                        variant={selectedEvent.is_joined ? "outline" : "default"}
                        onClick={() => handleJoinLeave(selectedEvent)}
                        disabled={isActioning === selectedEvent.id}
                      >
                        {isActioning === selectedEvent.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-label="Working" />
                        ) : selectedEvent.is_joined ? (
                          "I can't go"
                        ) : (
                          "I'm going"
                        )}
                      </Button>
                    )}
                    <EventExtras
                      event={selectedEvent}
                      isJoined={selectedEvent.is_joined}
                      canRsvp={!selectedEvent.is_cancelled && !isPastEvent(selectedEvent)}
                    />
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          )}
        </Dialog>
        </div>
    </AppLayout>
  )
}
