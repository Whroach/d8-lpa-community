"use client"

import { useEffect, useState } from "react"
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
import { ProtectedRoute } from "@/components/protected-route"
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

const EVENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "local_chapter", label: "Local Chapter" },
  { value: "regional", label: "Regional" },
  { value: "national", label: "National" },
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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isActioning, setIsActioning] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming")
  
  // Filter state
  const [eventType, setEventType] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadEvents()
    if (typeof window !== "undefined") {
      localStorage.setItem("lastViewedEvents", new Date().toISOString())
      window.dispatchEvent(new Event("eventsViewed"))
    }
  }, [])

  useEffect(() => {
    let filtered = events.filter(
      (event) =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    // Filter by event type
    if (eventType !== "all") {
      filtered = filtered.filter(event => event.event_type === eventType)
    }
    
    // Filter by date range
    if (startDate) {
      const start = new Date(startDate)
      filtered = filtered.filter(event => new Date(event.start_date) >= start)
    }
    
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter(event => new Date(event.start_date) <= end)
    }

    const now = new Date()
    const upcoming = filtered.filter((event) => {
      const end = new Date(event.end_date || event.start_date)
      return end >= now
    })
    const past = filtered.filter((event) => {
      const end = new Date(event.end_date || event.start_date)
      return end < now
    })

    setFilteredEvents(activeTab === "past" ? past : upcoming)
  }, [events, searchQuery, eventType, startDate, endDate, activeTab])

  const clearFilters = () => {
    setEventType("all")
    setStartDate("")
    setEndDate("")
  }

  const activeFiltersCount = (eventType !== "all" ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)

  const loadEvents = async () => {
    setIsLoading(true)
    const result = await api.events.getAll()
    if (result.data) {
      setEvents(result.data)
    }
    setIsLoading(false)
  }

  const handleJoinLeave = async (event: Event) => {
    setIsActioning(event.id)

    if (event.is_joined) {
      await api.events.leave(event.id)
    } else {
      await api.events.join(event.id)
    }

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
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">
            Meet new people at local events
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant={activeTab === "upcoming" ? "default" : "outline"}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming Events
          </Button>
          <Button
            variant={activeTab === "past" ? "default" : "outline"}
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
                    <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filters</h4>
                    {activeFiltersCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto py-1 px-2 text-xs">
                        Clear all
                      </Button>
                    )}
                  </div>
                  
                  {/* Event Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Event Type</label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger>
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
                    <label className="text-sm font-medium text-muted-foreground">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">From</label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">To</label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button className="w-full" onClick={() => setShowFilters(false)}>
                    Apply Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {eventType !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {EVENT_TYPES.find(t => t.value === eventType)?.label}
                  <button onClick={() => setEventType("all")} className="ml-1 hover:bg-muted rounded-full">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {startDate && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  From: {new Date(startDate).toLocaleDateString()}
                  <button onClick={() => setStartDate("")} className="ml-1 hover:bg-muted rounded-full">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {endDate && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  To: {new Date(endDate).toLocaleDateString()}
                  <button onClick={() => setEndDate("")} className="ml-1 hover:bg-muted rounded-full">
                    <X className="h-3 w-3" />
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
                className={cn(
                  "overflow-hidden cursor-pointer hover:shadow-lg transition-all",
                  event.is_joined && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedEvent(event)}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Event Image */}
                    <div className="sm:w-48 h-32 sm:h-auto relative shrink-0 overflow-hidden">
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
                              <Badge variant="outline" className="text-xs capitalize">
                                {EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}
                              </Badge>
                            )}
                            {event.category && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {event.category}
                              </Badge>
                            )}
                            {event.is_joined && (
                              <Badge className="bg-primary text-primary-foreground text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Attending
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg text-foreground mb-2">
                            {event.title}
                          </h3>
                          <div className="space-y-1 text-sm text-muted-foreground">
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
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No events found</h3>
            <p className="text-muted-foreground">
              No events match "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {activeTab === "past" ? "No past events" : "No upcoming events"}
            </h3>
            <p className="text-muted-foreground">
              {activeTab === "past"
                ? "Past events will appear here"
                : "Check back later for upcoming events"}
            </p>
          </div>
        )}

        {/* Event Details Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          {selectedEvent && (
            <DialogContent className="sm:max-w-lg">
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
                    <Badge variant="outline" className="text-xs capitalize">
                      {EVENT_TYPES.find(t => t.value === selectedEvent.event_type)?.label || selectedEvent.event_type}
                    </Badge>
                  )}
                  {selectedEvent.category && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {selectedEvent.category}
                    </Badge>
                  )}
                  {selectedEvent.is_joined && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Attending
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-4 pt-2">
                    <p className="text-foreground">{selectedEvent.description}</p>

                    <div className="space-y-2 text-sm">
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

                    <Button
                      className="w-full mt-4"
                      variant={selectedEvent.is_joined ? "outline" : "default"}
                      onClick={() => handleJoinLeave(selectedEvent)}
                      disabled={isActioning === selectedEvent.id}
                    >
                      {isActioning === selectedEvent.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : selectedEvent.is_joined ? (
                        "Leave Event"
                      ) : (
                        "Join Event"
                      )}
                    </Button>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          )}
        </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
}
