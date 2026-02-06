"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { Heart, MapPin, Loader2, Filter, X, ChevronDown } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import Image from "next/image"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Profile {
  id: string
  first_name: string
  last_name?: string
  age: number
  gender: string
  photos: string[]
  bio: string
  location_city: string
  location_state: string
  district_number: number
  distance: number
  occupation: string
  interests: string[]
  is_liked?: boolean
}

// US States for location filter
const ALL_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
]

// Districts 1-15
const ALL_DISTRICTS = Array.from({ length: 15 }, (_, i) => i + 1)

const ALL_ACTIVITIES = [
  "travel", "food", "yoga", "photography", "design", "art", "hiking", "cooking",
  "music", "coffee", "startups", "fitness", "networking", "dancing", "movies",
  "brunch", "law", "wine", "reading", "writing", "cats", "baking", "environment",
  "camping", "astronomy", "sustainability", "farmers markets", "rock climbing",
  "outdoors", "comedy", "podcasts", "board games", "dogs", "trivia", "medicine"
]

export default function BrowsePage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [likedProfiles, setLikedProfiles] = useState<Set<string>>(new Set())
  
  // Filter state
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([])
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  
  // Infinite scroll state
  const [displayCount, setDisplayCount] = useState(12)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    setIsLoading(true)
    const result = await api.browse.getProfiles()
    if (result.data) {
      setProfiles(result.data)
      // Initialize liked profiles from the API response
      const liked = new Set(
        result.data.filter((p: Profile) => p.is_liked).map((p: Profile) => p.id)
      )
      setLikedProfiles(liked)
    }
    setIsLoading(false)
  }

  const filteredProfiles = useMemo(() => {
    const normalizedSelectedStates = selectedStates.map((state) => state.toLowerCase())
    const normalizedSelectedActivities = selectedActivities.map((activity) => activity.toLowerCase())

    let filtered = profiles.filter((profile) => {
      // Filter by state
      if (
        normalizedSelectedStates.length > 0 &&
        !normalizedSelectedStates.includes((profile.location_state || "").toLowerCase())
      ) {
        return false
      }
      // Filter by district
      if (
        selectedDistricts.length > 0 &&
        !selectedDistricts.includes(Number(profile.district_number))
      ) {
        return false
      }
      // Filter by activities/interests
      if (normalizedSelectedActivities.length > 0) {
        const hasMatchingActivity = (profile.interests || []).some((interest) =>
          normalizedSelectedActivities.includes((interest || "").toLowerCase())
        )
        if (!hasMatchingActivity) return false
      }
      return true
    })

    return filtered
  }, [profiles, selectedStates, selectedDistricts, selectedActivities, likedProfiles])

  // Profiles to display (for infinite scroll)
  const displayedProfiles = useMemo(() => {
    return filteredProfiles.slice(0, displayCount)
  }, [filteredProfiles, displayCount])

  const hasMoreProfiles = displayCount < filteredProfiles.length

  // Load more profiles
  const loadMoreProfiles = useCallback(() => {
    if (isLoadingMore || !hasMoreProfiles) return
    setIsLoadingMore(true)
    // Simulate loading delay
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + 12, filteredProfiles.length))
      setIsLoadingMore(false)
    }, 500)
  }, [isLoadingMore, hasMoreProfiles, filteredProfiles.length])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreProfiles && !isLoadingMore) {
          loadMoreProfiles()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMoreProfiles, isLoadingMore, loadMoreProfiles])

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(12)
  }, [selectedStates, selectedDistricts, selectedActivities])

  const handleLike = async (profileId: string) => {
    setActioningId(profileId)
    await api.browse.like(profileId)
    setLikedProfiles((prev) => new Set(prev).add(profileId))
    setActioningId(null)
  }

  const handleUnlike = async (profileId: string) => {
    setActioningId(profileId)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 300))
    setLikedProfiles((prev) => {
      const newSet = new Set(prev)
      newSet.delete(profileId)
      return newSet
    })
    setActioningId(null)
  }

  const toggleState = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state)
        ? prev.filter((s) => s !== state)
        : [...prev, state]
    )
  }

  const toggleDistrict = (district: number) => {
    setSelectedDistricts((prev) =>
      prev.includes(district)
        ? prev.filter((d) => d !== district)
        : [...prev, district]
    )
  }

  const toggleActivity = (activity: string) => {
    setSelectedActivities((prev) =>
      prev.includes(activity)
        ? prev.filter((a) => a !== activity)
        : [...prev, activity]
    )
  }

  const toggleLocation = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location)
        ? prev.filter((l) => l !== location)
        : [...prev, location]
    )
  }

  const clearFilters = () => {
    setSelectedStates([])
    setSelectedDistricts([])
    setSelectedActivities([])
  }

  const hasActiveFilters = selectedStates.length > 0 || selectedDistricts.length > 0 || selectedActivities.length > 0

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Discover</h1>
          <p className="text-muted-foreground mt-1">Find your perfect match</p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* State Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <MapPin className="h-4 w-4" />
                State
                {selectedStates.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs bg-primary/10 text-primary">
                    {selectedStates.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 max-h-64 overflow-y-auto">
              {ALL_STATES.map((state) => (
                <DropdownMenuCheckboxItem
                  key={state}
                  checked={selectedStates.includes(state)}
                  onCheckedChange={() => toggleState(state)}
                >
                  {state}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* District Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                District
                {selectedDistricts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs bg-primary/10 text-primary">
                    {selectedDistricts.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 max-h-48 overflow-y-auto">
              {ALL_DISTRICTS.map((district) => (
                <DropdownMenuCheckboxItem
                  key={district}
                  checked={selectedDistricts.includes(district)}
                  onCheckedChange={() => toggleDistrict(district)}
                >
                  District {district}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Activities Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Heart className="h-4 w-4" />
                Activities
                {selectedActivities.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs bg-primary/10 text-primary">
                    {selectedActivities.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
              {ALL_ACTIVITIES.sort().map((activity) => (
                <DropdownMenuCheckboxItem
                  key={activity}
                  checked={selectedActivities.includes(activity)}
                  onCheckedChange={() => toggleActivity(activity)}
                  className="capitalize"
                >
                  {activity}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="h-3 w-3" />
              Clear all
            </Button>
          )}

          {/* Active filter tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5 ml-auto">
              {selectedStates.map((state) => (
                <Badge
                  key={state}
                  variant="secondary"
                  className="gap-1 pr-1 bg-primary/10 text-primary"
                >
                  {state}
                  <button
                    onClick={() => toggleState(state)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedDistricts.map((district) => (
                <Badge
                  key={district}
                  variant="secondary"
                  className="gap-1 pr-1 bg-blue-500/10 text-blue-600"
                >
                  District {district}
                  <button
                    onClick={() => toggleDistrict(district)}
                    className="hover:bg-blue-500/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedActivities.map((activity) => (
                <Badge
                  key={activity}
                  variant="secondary"
                  className="gap-1 pr-1 bg-secondary/20 text-secondary capitalize"
                >
                  {activity}
                  <button
                    onClick={() => toggleActivity(activity)}
                    className="hover:bg-secondary/30 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden border border-border">
                <Skeleton className="aspect-[4/5] w-full" />
                <div className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-3" />
                  <div className="flex gap-1.5 mb-4">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-xl font-medium text-foreground mb-2">
                {hasActiveFilters ? "No profiles match your filters" : "No more profiles"}
              </p>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters
                  ? "Try adjusting your filters to see more people"
                  : "Check back later for new matches!"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="bg-transparent">
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {displayedProfiles.map((profile) => {
              // Defensive checks for undefined data
              if (!profile || !profile.id) return null
              
              const isLiked = likedProfiles.has(profile.id)
              const photoSrc = (profile.photos && Array.isArray(profile.photos) && profile.photos.length > 0) 
                ? profile.photos[0] 
                : "/placeholder.svg"
              
              return (
                <div
                  key={profile.id}
                  className="bg-card rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Profile Image - Clickable to view profile */}
                  <Link href={`/profile/${profile.id}`} className="block relative aspect-[4/5] w-full cursor-pointer group">
                    <Image
                      src={photoSrc}
                      alt={profile.first_name || "User"}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    {/* Gradient overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    {/* Name and Age overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-xl font-bold text-white">
                        {profile.first_name}, {profile.age}
                      </h3>
                      <div className="flex items-center gap-1 text-white/80 text-sm mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{profile.location_state || 'California'}, District #{profile.district_number || 5}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Profile Details */}
                  <div className="p-4">
                    {/* Bio */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {profile.bio}
                    </p>

                    {/* Interests */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(profile.interests || []).slice(0, 4).map((interest) => (
                        <Badge
                          key={interest}
                          variant="secondary"
                          className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-0"
                        >
                          {interest}
                        </Badge>
                      ))}
                      {(profile.interests || []).length > 4 && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0.5 bg-muted text-muted-foreground border-0"
                        >
                          +{(profile.interests || []).length - 4}
                        </Badge>
                      )}
                    </div>

                    {/* Action Button */}
                    {isLiked ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full border-primary/30 text-primary hover:bg-primary/5 bg-transparent"
                            disabled={actioningId === profile.id}
                          >
                            {actioningId === profile.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Heart className="h-4 w-4 mr-1.5 fill-primary" />
                                You Liked This User
                              </>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="center" side="top">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleUnlike(profile.id)}
                          >
                            Unlike
                          </Button>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => handleLike(profile.id)}
                        disabled={actioningId === profile.id}
                      >
                        {actioningId === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Heart className="h-4 w-4 mr-1.5" />
                            Like
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Infinite scroll trigger and loading indicator */}
        {hasMoreProfiles && (
          <div
            ref={loadMoreRef}
            className="flex justify-center py-8"
          >
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading more profiles...</span>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Scroll down to load more</p>
            )}
          </div>
        )}

        {/* Results count */}
        <div className="text-center py-4 text-sm text-muted-foreground">
          Showing {displayedProfiles.length} of {filteredProfiles.length} profiles
        </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
}
