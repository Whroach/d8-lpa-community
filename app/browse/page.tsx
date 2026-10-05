"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { Heart, MapPin, Loader2, Filter, X, ChevronDown } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
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
import { Dialog, DialogContent } from "@/components/ui/dialog"

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
  district_number: number | string
  distance: number
  occupation: string
  interests: string[]
  is_liked?: boolean
  like_id?: string
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

// District is stored either as a bare number or as "district_2" depending on
// when the profile was created.
const districtLabel = (value: Profile["district_number"]): string => {
  if (value === undefined || value === null || value === "") return ""
  const raw = String(value)
  const num = raw.startsWith("district_") ? raw.replace("district_", "") : raw
  return num ? `District ${num}` : ""
}

const locationLabel = (profile: Profile): string =>
  [profile.location_state, districtLabel(profile.district_number)]
    .filter(Boolean)
    .join(", ")

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
  const [actionError, setActionError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newMatchName, setNewMatchName] = useState<string | null>(null)
  const [likedProfiles, setLikedProfiles] = useState<Set<string>>(new Set())
  const [likeIds, setLikeIds] = useState<Map<string, string>>(new Map())
  
  // Filter state
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([])
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  
  // Infinite scroll state
  const [displayCount, setDisplayCount] = useState(12)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    setIsLoading(true)
    setLoadError(null)
    const result = await api.browse.getProfiles()
    if (result.error) {
      setLoadError(result.error)
    }
    if (result.data) {
      setProfiles(result.data)
      // Initialize liked profiles from the API response
      const liked = new Set(
        result.data.filter((p: Profile) => p.is_liked).map((p: Profile) => p.id)
      )
      const likeIdMap = new Map<string, string>(
        result.data
          .filter((p: Profile): p is Profile & { like_id: string } =>
            Boolean(p.is_liked && p.like_id)
          )
          .map((p) => [p.id, p.like_id])
      )
      setLikedProfiles(liked)
      setLikeIds(likeIdMap)
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
      if (selectedDistricts.length > 0) {
        // Extract district number from string like "district_2" or just use number if it's already a number
        const districtValue = profile.district_number?.toString() || ""
        const districtNum = districtValue.includes("district_")
          ? parseInt(districtValue.replace("district_", ""))
          : parseInt(districtValue)
        
        if (!selectedDistricts.includes(districtNum)) {
          return false
        }
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
  }, [profiles, selectedStates, selectedDistricts, selectedActivities])

  // Profiles to display (for infinite scroll)
  const displayedProfiles = useMemo(() => {
    return filteredProfiles.slice(0, displayCount)
  }, [filteredProfiles, displayCount])

  const hasMoreProfiles = displayCount < filteredProfiles.length

  // Profiles are already in memory; reveal the next page immediately rather
  // than sitting behind an artificial delay.
  const loadMoreProfiles = useCallback(() => {
    if (!hasMoreProfiles) return
    setDisplayCount((prev) => Math.min(prev + 12, filteredProfiles.length))
  }, [hasMoreProfiles, filteredProfiles.length])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreProfiles) {
          loadMoreProfiles()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMoreProfiles, loadMoreProfiles])

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(12)
  }, [selectedStates, selectedDistricts, selectedActivities])

  const handleLike = async (profileId: string) => {
    setActioningId(profileId)
    setActionError(null)
    const result = await api.browse.like(profileId)
    if (result.error) {
      // Don't paint the card as liked when the request failed.
      setActionError(result.error)
      setActioningId(null)
      return
    }
    if (result.data?.like_id) {
      setLikeIds((prev) => new Map(prev).set(profileId, result.data.like_id))
    }
    setLikedProfiles((prev) => new Set(prev).add(profileId))
    // A mutual like creates a match — tell the user, rather than letting it
    // pass silently. This is the whole point of the app.
    if (result.data?.is_match) {
      const profile = profiles.find((p) => p.id === profileId)
      setNewMatchName(profile?.first_name || "someone")
    }
    setActioningId(null)
  }

  const handleUnlike = async (profileId: string) => {
    setActioningId(profileId)
    setActionError(null)
    const likeId = likeIds.get(profileId)
    if (likeId) {
      const result = await api.browse.unlike(likeId)
      if (result.error) {
        setActionError(result.error)
        setActioningId(null)
        return
      }
    }
    setLikedProfiles((prev) => {
      const newSet = new Set(prev)
      newSet.delete(profileId)
      return newSet
    })
    setLikeIds((prev) => {
      const newMap = new Map(prev)
      newMap.delete(profileId)
      return newMap
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

  const clearFilters = () => {
    setSelectedStates([])
    setSelectedDistricts([])
    setSelectedActivities([])
  }

  const hasActiveFilters = selectedStates.length > 0 || selectedDistricts.length > 0 || selectedActivities.length > 0

  return (
    <AppLayout>
        <div className="p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Browse</h1>
          <p className="text-muted-foreground mt-1">Meet other members. Choose a card to read more.</p>
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

        {(loadError || actionError) && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <X className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm">{loadError || actionError}</p>
            </div>
            {loadError && (
              <Button variant="outline" size="sm" onClick={loadProfiles}>
                Try again
              </Button>
            )}
          </div>
        )}

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
                      {/* Only show what the member actually filled in — this
                          used to fall back to "California, District 5" for
                          everyone with a blank location. */}
                      {locationLabel(profile) && (
                        <div className="flex items-center gap-1 text-white/80 text-sm mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{locationLabel(profile)}</span>
                        </div>
                      )}
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

        {/* Infinite scroll trigger, with an explicit button as a fallback for
            anyone whose browser doesn't fire the observer */}
        {hasMoreProfiles && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            <Button variant="outline" onClick={loadMoreProfiles} className="h-12 px-8 text-base">
              Show more profiles
            </Button>
          </div>
        )}

        {/* Results count */}
        <div className="text-center py-4 text-sm text-muted-foreground">
          Showing {displayedProfiles.length} of {filteredProfiles.length} profiles
        </div>

        {/* It's a Match */}
        <Dialog open={!!newMatchName} onOpenChange={() => setNewMatchName(null)}>
          <DialogContent className="sm:max-w-sm text-center">
            <div className="py-4 space-y-4">
              <Heart className="h-16 w-16 text-primary fill-primary mx-auto" />
              <div>
                <h2 className="text-2xl font-bold">It&apos;s a match!</h2>
                <p className="text-muted-foreground mt-1">
                  You and {newMatchName} liked each other. Say hello.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full h-12 text-base">
                  <Link href="/matches">Go to Matches</Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 text-base"
                  onClick={() => setNewMatchName(null)}
                >
                  Keep Browsing
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
    </AppLayout>
  )
}
