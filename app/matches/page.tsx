"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, MessageCircle, Users, Filter, MoreVertical, User, HeartOff, Ban, Flag, Heart, MapPin, ChevronUp, ChevronDown, History } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { LoadError } from "@/components/load-error"

interface Match {
  id: string
  user: {
    id: string
    first_name: string
    last_name?: string
    age?: number
    photos?: string[]
    bio?: string
    location_city?: string
  }
  matched_at: string
  last_message?: string | null
  last_message_at?: string | null
  unread_count?: number
  is_active?: boolean
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([])
  const [inactiveMatches, setInactiveMatches] = useState<Match[]>([])
  const [filteredInactiveMatches, setFilteredInactiveMatches] = useState<Match[]>([])
  const [likedProfiles, setLikedProfiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("recent")
  const [mainTab, setMainTab] = useState<"matches" | "liked">("matches")
  const [activeTab, setActiveTab] = useState("active")
  const [dialogMode, setDialogMode] = useState<"block" | "report" | "report-sent" | "unmatch" | "unlike" | null>(null)
  const [pendingMatch, setPendingMatch] = useState<Match | null>(null)
  const [pendingLike, setPendingLike] = useState<any | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const closeDialog = () => {
    setDialogMode(null)
    setPendingMatch(null)
    setPendingLike(null)
    setReportReason("")
    setDialogError(null)
  }

  useEffect(() => {
    // Both requests share isLoading, so wait for both before clearing it —
    // otherwise the faster one hides the skeleton while the other is pending.
    void loadAll()
    if (typeof window !== "undefined") {
      localStorage.setItem("lastViewedMatches", new Date().toISOString())
      window.dispatchEvent(new Event("matchesViewed"))
    }
  }, [])

  const loadAll = async () => {
    setIsLoading(true)
    setLoadError(null)
    const [matchError, likedError] = await Promise.all([loadMatches(), loadLikedProfiles()])
    setLoadError(matchError || likedError || null)
    setIsLoading(false)
  }

  const loadLikedProfiles = async (): Promise<string | null> => {
    const result = await api.browse.getLikedProfiles()
    if (result.data) {
      setLikedProfiles(result.data)
      return null
    }
    return result.error || "Please try again."
  }

  // Removing a like asks first. There is no Undo on purpose: liking again
  // would send the other member a second "someone likes you" notice.
  const handleUnlikeProfile = (profile: any) => {
    setPendingLike(profile)
    setDialogMode("unlike")
  }

  const confirmUnlikeProfile = async () => {
    if (!pendingLike) return
    setIsSubmitting(true)
    const result = await api.browse.unlike(pendingLike.like_id)
    setIsSubmitting(false)
    if (result.error) {
      setDialogError(result.error)
      return
    }
    const name = pendingLike.first_name
    setLikedProfiles((prev) => prev.filter((p) => p.like_id !== pendingLike.like_id))
    closeDialog()
    toast.success(`You no longer like ${name}`)
    // If the two were matched, the match has moved to History.
    await loadMatches()
  }

  useEffect(() => {
    let filtered = matches.filter((match) =>
      match.user.first_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (sortBy === "alphabetical") {
      filtered = [...filtered].sort((a, b) => 
        a.user.first_name.localeCompare(b.user.first_name)
      )
    } else {
      filtered = [...filtered].sort(
        (a, b) =>
          new Date(b.matched_at || "").getTime() -
          new Date(a.matched_at || "").getTime()
      )
    }

    setFilteredMatches(filtered)

    // Filter inactive matches
    let filteredInactive = inactiveMatches.filter((match) =>
      match.user.first_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (sortBy === "alphabetical") {
      filteredInactive = [...filteredInactive].sort((a, b) => 
        a.user.first_name.localeCompare(b.user.first_name)
      )
    } else {
      filteredInactive = [...filteredInactive].sort(
        (a, b) =>
          new Date(b.matched_at || "").getTime() -
          new Date(a.matched_at || "").getTime()
      )
    }

    setFilteredInactiveMatches(filteredInactive)
  }, [matches, inactiveMatches, searchQuery, sortBy])

  const loadMatches = async (): Promise<string | null> => {
    const result = await api.matches.getAll()
    if (result.data) {
      setMatches(
        Array.isArray(result.data) ? result.data : result.data.active || []
      )
      setInactiveMatches(Array.isArray(result.data) ? [] : result.data.inactive || [])
      return null
    }
    return (result as { error?: string }).error || "Please try again."
  }

  const formatTimestamp = (timestamp?: string | null) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  // Unmatching asks first. It cannot be undone from here: the server removes
  // both members' likes, and only the other member can give theirs back.
  const handleUnlike = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const match = matches.find((m) => m.id === matchId)
    if (!match) return
    setPendingMatch(match)
    setDialogMode("unmatch")
  }

  const confirmUnmatch = async () => {
    if (!pendingMatch) return
    setIsSubmitting(true)
    const result = await api.matches.unmatch(pendingMatch.id)
    setIsSubmitting(false)
    if (result.error) {
      setDialogError(result.error)
      return
    }
    const match = pendingMatch
    setMatches((prev) => prev.filter((m) => m.id !== match.id))
    setInactiveMatches((prev) => [...prev, { ...match, is_active: false }])
    setLikedProfiles((prev) => prev.filter((p) => String(p.id) !== String(match.user.id)))
    closeDialog()
    toast.success(`You are no longer matched with ${match.user.first_name}`)
  }

  const findMatch = (matchId: string) =>
    matches.find((m) => m.id === matchId) || inactiveMatches.find((m) => m.id === matchId)

  // These used to use window.confirm / window.prompt, which are jarring,
  // unstyled, and suppressed outright by some mobile browsers.
  const handleBlock = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const match = findMatch(matchId)
    if (!match) return
    setPendingMatch(match)
    setDialogMode("block")
  }

  const handleReport = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const match = findMatch(matchId)
    if (!match) return
    setPendingMatch(match)
    setReportReason("")
    setDialogMode("report")
  }

  const confirmBlock = async () => {
    if (!pendingMatch) return
    setIsSubmitting(true)
    const result = await api.browse.block(pendingMatch.user.id)
    setIsSubmitting(false)
    if (!result.error) {
      setMatches((prev) => prev.filter((m) => m.id !== pendingMatch.id))
      setInactiveMatches((prev) => prev.filter((m) => m.id !== pendingMatch.id))
      setLikedProfiles((prev) => prev.filter((p) => String(p.id) !== String(pendingMatch.user.id)))
      toast.success(`${pendingMatch.user.first_name} is blocked`)
      setDialogMode(null)
      setPendingMatch(null)
    } else {
      setDialogError(result.error)
    }
  }

  const confirmReport = async () => {
    if (!pendingMatch || !reportReason.trim()) return
    setIsSubmitting(true)
    const result = await api.browse.report(pendingMatch.user.id, reportReason.trim())
    setIsSubmitting(false)
    if (!result.error) {
      setDialogMode("report-sent")
    } else {
      setDialogError(result.error)
    }
  }

  const renderMatchList = (matchList: Match[], isHistory: boolean) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-9 w-full mt-4" />
            </div>
          ))}
        </div>
      )
    }

    if (matchList.length > 0) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {matchList.map((match) => (
            <div
              key={match.id}
              data-testid="match-card"
              className="group relative p-4 rounded-lg border border-border bg-card hover:shadow-lg hover:border-primary/40 transition-all duration-200"
            >
              {/* Three-dot menu */}
              <div className="absolute top-3 right-3 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* Always visible: hover-only controls are unreachable on
                        phones and tablets, which locked touch users out of
                        unmatch / block / report entirely. */}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Options for ${match.user.first_name}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical aria-hidden="true" />
                      Options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isHistory && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => handleUnlike(match.id, e)}
                          className="text-muted-foreground"
                        >
                          <HeartOff className="h-4 w-4 mr-2" />
                          Unmatch
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={(e) => handleBlock(match.id, e)}
                      className="text-destructive"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleReport(match.id, e)}
                      className="text-destructive"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                  <AvatarImage
                    src={match.user.photos?.[0] || "/placeholder.svg"}
                    alt={match.user.first_name}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {match.user.first_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 pr-28">
                  <h3 className="font-semibold text-foreground truncate">
                    {match.user.first_name}
                    {match.user.age ? `, ${match.user.age}` : ""}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {match.last_message || "Start a conversation!"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Matched {formatTimestamp(match.matched_at).toLowerCase()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  asChild
                >
                  <Link href={`/profile/${match.user.id}`}>
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                </Button>
                {!isHistory && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    asChild
                  >
                    <Link href={`/messages?match=${match.id}`}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Link>
                  </Button>
                )}
                {isHistory && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/messages?match=${match.id}`}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      View Chat
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (searchQuery) {
      return (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
          <p className="text-muted-foreground">
            No matches found for &quot;{searchQuery}&quot;
          </p>
        </div>
      )
    }

    return (
      <div className="text-center py-12">
        {isHistory ? (
          <>
            <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No match history</h3>
            <p className="text-muted-foreground">
People you have unmatched will appear here
            </p>
          </>
        ) : (
          <>
            <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No matches yet</h3>
            <p className="text-muted-foreground mb-6">
              Start browsing profiles to find your matches
            </p>
            <Button asChild>
              <Link href="/browse">Start Browsing</Link>
            </Button>
          </>
        )}
        </div>
      )
    }

    return (
      <AppLayout>
          <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Heart className="h-6 w-6 text-primary fill-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">Matches & Likes</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {matches.length} active {matches.length === 1 ? "match" : "matches"} • {likedProfiles.length} profiles you liked
              </p>
            </div>
          </div>
        </div>

        {/* Main Tab Switcher - Matches vs Profiles You Liked */}
        <div className="mb-6">
          <Tabs value={mainTab} onValueChange={(val) => setMainTab(val as "matches" | "liked")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-card border border-border p-1">
              <TabsTrigger value="matches" className="flex items-center gap-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Heart className="h-4 w-4" />
                Matches
              </TabsTrigger>
              <TabsTrigger value="liked" className="flex items-center gap-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Heart className="h-4 w-4 fill-current" />
                Profiles You Liked
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search and Filter - Only show for Matches tab */}
        {mainTab === "matches" && (
          <div className="flex flex-col sm:flex-row gap-3 mb-8 bg-card p-4 rounded-lg border border-border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search matches by first name"
                placeholder="Search matches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-label="Sort matches" className="w-full sm:w-[200px] bg-background border-border">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Content based on main tab */}
        {loadError && !isLoading ? (
          <LoadError what="your matches" detail={loadError} onRetry={loadAll} />
        ) : mainTab === "matches" ? (
          <>
            {/* Tabs for Active Matches and History */}
            <div className="mb-8">
              <div className="flex gap-3 mb-6">
                <button
                  type="button"
                  aria-pressed={activeTab === "active"}
                  onClick={() => setActiveTab("active")}
                  className={cn(
                    "flex min-h-11 items-center gap-2 px-4 py-2 rounded-full text-base font-medium transition-all",
                    activeTab === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <Heart className="h-4 w-4" />
                  Active Matches ({matches.length})
                </button>
                <button
                  type="button"
                  aria-pressed={activeTab === "history"}
                  onClick={() => setActiveTab("history")}
                  className={cn(
                    "flex min-h-11 items-center gap-2 px-4 py-2 rounded-full text-base font-medium transition-all",
                    activeTab === "history"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <History className="h-4 w-4" />
                  History ({inactiveMatches.length})
                </button>
              </div>

              {activeTab === "active" ? renderMatchList(filteredMatches, false) : renderMatchList(filteredInactiveMatches, true)}
            </div>
          </>
        ) : (
          <>
            {/* Profiles You Liked Content */}
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card rounded-lg overflow-hidden border border-border">
                    <Skeleton className="aspect-[4/5] w-full" />
                    <div className="p-4">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-24 mb-3" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : likedProfiles.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {likedProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    data-testid="liked-card"
                    className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
                  >
                    {/* Profile Image */}
                    <Link href={`/profile/${profile.id}`} className="block">
                      <div className="relative aspect-[4/5] w-full">
                        <Image
                          src={profile.photos?.[0] || "/placeholder.svg"}
                          alt={profile.first_name}
                          fill
                          className="object-cover"
                        />
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        
                        {/* Liked badge */}
                        <div className="absolute top-3 right-3">
                          <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1">
                            <Heart className="h-3 w-3 fill-current" />
                            {profile.type === 'superlike' ? 'Super Liked' : 'Liked'}
                          </div>
                        </div>
                        
                        {/* Name and info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-lg font-bold text-white">
                            {profile.first_name}{profile.age ? `, ${profile.age}` : ''}
                          </h3>
                          {profile.location_city && (
                            <div className="flex items-center gap-1 text-white text-sm mt-2">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{profile.location_city}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Profile Details */}
                    <div className="p-4">
                      {profile.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {profile.bio}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mb-3">
                        Liked {formatTimestamp(profile.liked_at).toLowerCase()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent hover:bg-primary/10"
                          asChild
                        >
                          <Link href={`/profile/${profile.id}`}>
                            <User className="h-4 w-4 mr-2" />
                            Profile
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-transparent"
                          aria-label={`Remove like for ${profile.first_name}`}
                          onClick={() => handleUnlikeProfile(profile)}
                        >
                          <HeartOff aria-hidden="true" />
                          Remove like
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-medium text-foreground mb-1">No likes yet</h3>
                <p className="text-muted-foreground mb-4">Start browsing to like profiles</p>
                <Button asChild>
                  <Link href="/browse">Browse Profiles</Link>
                </Button>
              </div>
            )}
          </>
        )}
        {/* Block / Report dialogs */}
        <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="sm:max-w-md">
            {dialogMode === "unmatch" && (
              <>
                <DialogHeader>
                  <DialogTitle>Unmatch with {pendingMatch?.user.first_name}?</DialogTitle>
                  <DialogDescription>
                    You will no longer be matched, and neither of you can send new messages.
                    You can still read your past messages under History. If you both like
                    each other again later, you will be matched again.
                  </DialogDescription>
                </DialogHeader>
                {dialogError && (
                  <p role="alert" className="text-destructive">{dialogError}</p>
                )}
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={closeDialog} disabled={isSubmitting} autoFocus>
                    Keep match
                  </Button>
                  <Button variant="destructive" onClick={confirmUnmatch} disabled={isSubmitting}>
                    {isSubmitting ? "Unmatching..." : "Unmatch"}
                  </Button>
                </div>
              </>
            )}

            {dialogMode === "unlike" && (
              <>
                <DialogHeader>
                  <DialogTitle>Remove your like for {pendingLike?.first_name}?</DialogTitle>
                  <DialogDescription>
                    {pendingLike?.first_name} will not be told. If the two of you are matched,
                    you will be unmatched and can no longer message each other. You can like
                    them again from Browse.
                  </DialogDescription>
                </DialogHeader>
                {dialogError && (
                  <p role="alert" className="text-destructive">{dialogError}</p>
                )}
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={closeDialog} disabled={isSubmitting} autoFocus>
                    Keep like
                  </Button>
                  <Button variant="destructive" onClick={confirmUnlikeProfile} disabled={isSubmitting}>
                    {isSubmitting ? "Removing..." : "Remove like"}
                  </Button>
                </div>
              </>
            )}

            {dialogMode === "block" && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-destructive" />
                    Block {pendingMatch?.user.first_name}?
                  </DialogTitle>
                  <DialogDescription>
                    They will be removed from your matches and neither of you will
                    see the other again. You can undo this in Settings.
                  </DialogDescription>
                </DialogHeader>
                {dialogError && (
                  <p role="alert" className="text-destructive">{dialogError}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={confirmBlock} disabled={isSubmitting}>
                    {isSubmitting ? "Blocking..." : "Block"}
                  </Button>
                </div>
              </>
            )}

            {dialogMode === "report" && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Flag className="h-5 w-5 text-destructive" />
                    Report {pendingMatch?.user.first_name}
                  </DialogTitle>
                  <DialogDescription>
                    Tell us what happened. Reports are private and reviewed by our team.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  rows={4}
                  aria-label="What happened"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Please describe the issue..."
                />
                {dialogError && (
                  <p role="alert" className="text-destructive">{dialogError}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmReport}
                    disabled={!reportReason.trim() || isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </>
            )}

            {dialogMode === "report-sent" && (
              <div className="py-4 text-center space-y-3">
                <Flag className="h-10 w-10 text-primary mx-auto" />
                <DialogTitle className="text-lg font-semibold">Report submitted</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Thank you for helping keep our community safe.
                </p>
                <Button className="w-full" onClick={closeDialog}>
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
          </div>
      </AppLayout>
    )
  }
