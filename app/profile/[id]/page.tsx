"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, MapPin, Briefcase, GraduationCap, Heart, MessageCircle, Flag, User as UserIcon, ChevronLeft, ChevronRight, Target, Globe, Compass, X, MoreVertical } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { BadgeCheck, Ban, Bookmark } from "lucide-react"
import { LoadError } from "@/components/load-error"
import { BlockDialog, ReportDialog } from "@/components/safety/safety-dialogs"
import { sharedInterests } from "@/lib/icebreakers"
import { useAuthStore } from "@/lib/store/auth-store"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [likeId, setLikeId] = useState<string | null>(null)
  const [isLiking, setIsLiking] = useState(false)
  const [hasMatched, setHasMatched] = useState(false)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [notFound, setNotFound] = useState(false)
  const myProfile = useAuthStore((state) => state.profile)
  const me = useAuthStore((state) => state.user)

  // One request now returns the profile and how I relate to this member
  // (liked, matched, saved); this page used to make three.
  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError("")
    setNotFound(false)
    const result = await api.users.getById(userId)
    if (result.data) {
      setUser(result.data.user)
      setProfile(result.data.profile)
      const relationship = result.data.relationship || {}
      setIsLiked(Boolean(relationship.is_liked))
      setLikeId(relationship.like_id || null)
      setHasMatched(Boolean(relationship.match_id))
      setMatchId(relationship.match_id || null)
      setIsSaved(Boolean(relationship.is_favorite))
    } else if (result.status === 404) {
      setNotFound(true)
    } else {
      setLoadError(result.error || "Please try again.")
    }
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const nextPhoto = () => {
    if (selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1)
    }
  }

  const prevPhoto = () => {
    if (selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1)
    }
  }

  const handlePhotoClick = (index: number) => {
    setSelectedPhotoIndex(index)
    setShowPhotoModal(true)
  }

  // Deep-link straight to this person's thread instead of dumping the user on
  // the messages index to hunt for it.
  const handleMessage = () => {
    router.push(matchId ? `/messages?match=${matchId}` : `/messages`)
  }

  const handleToggleLike = async () => {
    if (isLiking) return
    setIsLiking(true)

    if (isLiked && likeId) {
      const result = await api.browse.unlike(likeId)
      if (result.error) {
        toast.error(`We could not undo your like. ${result.error}`)
      } else {
        setIsLiked(false)
        setLikeId(null)
        if (hasMatched) {
          setHasMatched(false)
          setMatchId(null)
          toast.success(`You are no longer matched with ${user?.first_name}`)
        } else {
          toast.success("Like removed")
        }
      }
    } else {
      const result = await api.browse.like(userId)
      if (result.error) {
        toast.error(`Your like was not saved. ${result.error}`)
      } else {
        setIsLiked(true)
        setLikeId(result.data?.like_id || null)
        if (result.data?.is_match) {
          setHasMatched(true)
          setMatchId(result.data.match?.id || null)
          toast.success(`It's a match! You and ${user?.first_name} like each other.`, {
            duration: 10000,
            action: result.data.match?.id
              ? { label: "Say hello", onClick: () => router.push(`/messages?match=${result.data.match.id}`) }
              : undefined,
          })
        } else {
          toast.success(`You liked ${user?.first_name}`, {
            description: "If they like you too, you will both be told.",
          })
        }
      }
    }

    setIsLiking(false)
  }

  const handleToggleSave = async () => {
    const next = !isSaved
    setIsSaved(next)
    const result = next ? await api.favorites.add(userId) : await api.favorites.remove(userId)
    if (result.error) {
      setIsSaved(!next)
      toast.error(`That did not work. ${result.error}`)
      return
    }
    toast.success(next ? `${user?.first_name} saved` : `${user?.first_name} removed from Saved`, {
      description: next ? "Find saved profiles under Saved in the menu. They are not told." : undefined,
    })
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="aspect-[4/5] w-full rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <LoadError what="this profile" detail={loadError} onRetry={loadProfile} />
        </div>
      </AppLayout>
    )
  }

  if (notFound || !user || !profile) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="text-center py-12">
            <UserIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-xl font-semibold mb-2">This profile is not available</h1>
            <p className="text-lg text-muted-foreground mb-4">The member may have paused or closed their account.</p>
            <Button onClick={() => router.push("/browse")}>Back to Browse</Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const age = user.age ?? null
  const isOwnProfile = String(user._id || user.id) === String(me?.id || me?._id)
  const inCommon = sharedInterests(myProfile?.interests, profile.interests)
  const photos = user.photos || []
  const location = [profile.location_city, profile.location_state].filter(Boolean).join(", ")

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Photo Gallery - Main Photo Only (No Swipe) */}
          <div className="space-y-4">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 shadow-lg">
              {photos.length > 0 ? (
                <Image
                  src={photos[0]}
                  alt={user.first_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <UserIcon className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                {user.first_name}
              </h1>
              <div className="flex flex-wrap gap-2">
                {user.email_verified && (
                  <Badge variant="outline" className="gap-1 border-success text-sm text-success" data-testid="verified-badge">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                    Email confirmed
                  </Badge>
                )}
                {user.is_online && (
                  <Badge variant="outline" className="gap-1 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
                    Online now
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                {age && <span className="text-3xl font-semibold text-primary">{age}</span>}
                {location && (
                  <div className="flex items-center gap-2 text-lg text-muted-foreground">
                    <MapPin className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className="font-medium">{location}</span>
                  </div>
                )}
              </div>
              {profile.district_number && (
                <div className="flex items-center gap-2 text-base text-muted-foreground pt-2">
                  <Compass className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="font-medium">
                    {profile.district_number.includes('district_')
                      ? `District ${profile.district_number.replace('district_', '')}`
                      : `District ${profile.district_number}`}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!isOwnProfile && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-3">
                  {hasMatched && (
                    <Button size="lg" className="flex-1" onClick={handleMessage}>
                      <MessageCircle aria-hidden="true" />
                      Message {user.first_name}
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant={isLiked ? "outline" : hasMatched ? "outline" : "default"}
                    className="flex-1"
                    onClick={handleToggleLike}
                    disabled={isLiking}
                    aria-pressed={isLiked}
                  >
                    <Heart className={cn(isLiked && "fill-primary text-primary")} aria-hidden="true" />
                    {isLiked ? "Liked - tap to undo" : `Like ${user.first_name}`}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleToggleSave} aria-pressed={isSaved}>
                    <Bookmark className={cn(isSaved && "fill-primary text-primary")} aria-hidden="true" />
                    {isSaved ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowReportDialog(true)}>
                    <Flag aria-hidden="true" />
                    Report
                  </Button>
                  <Button variant="outline" onClick={() => setShowBlockDialog(true)}>
                    <Ban aria-hidden="true" />
                    Block
                  </Button>
                </div>
                {inCommon.length > 0 && (
                  <p className="text-base text-muted-foreground" data-testid="in-common">
                    <span className="font-semibold text-foreground">You both like:</span> {inCommon.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* About Me Section */}
        <Card className="mb-6 border-border bg-gradient-to-br from-muted/20 to-muted/10">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4">About</h2>
            <p className="text-foreground leading-relaxed text-base whitespace-pre-wrap">{profile.bio || "No bio added yet"}</p>
          </CardContent>
        </Card>

        {/* Photo Grid - Centered */}
        {photos.length > 1 && (
          <Card className="mb-6 border-border">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-4">Photo Gallery</h2>
              <div className="max-w-3xl mx-auto">
                <div className="grid grid-cols-3 gap-3">
                  {photos.slice(0, 6).map((photo: string, idx: number) => {
                    const isLastPhoto = idx === 5;
                    const hasMorePhotos = photos.length > 6;
                    const remainingCount = photos.length - 6;

                    return (
                      <button
                        type="button"
                        key={idx}
                        aria-label={isLastPhoto && hasMorePhotos ? `Open photo ${idx + 1} of ${photos.length} (${remainingCount} more)` : `Open photo ${idx + 1} of ${photos.length}`}
                        className="relative aspect-square rounded-lg overflow-hidden group border-2 border-border hover:border-primary/50 transition-all"
                        onClick={() => {
                          if (isLastPhoto && hasMorePhotos) {
                            setSelectedPhotoIndex(idx);
                            setShowPhotoModal(true);
                          } else {
                            handlePhotoClick(idx);
                          }
                        }}
                      >
                        <Image
                          src={photo}
                          alt={`Photo ${idx + 1}`}
                          fill
                          className={cn(
                            "object-cover transition-transform group-hover:scale-110",
                            isLastPhoto && hasMorePhotos && "brightness-50"
                          )}
                        />
                        {isLastPhoto && hasMorePhotos && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white text-4xl font-bold">+{remainingCount}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Details Section */}
        <Card className="mb-6 border-border">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.occupation && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Briefcase className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Occupation</p>
                    <p className="text-base font-medium">{profile.occupation}</p>
                  </div>
                </div>
              )}

              {profile.education && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <GraduationCap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Education</p>
                    <p className="text-base font-medium capitalize">{profile.education.replace(/-/g, " ")}</p>
                  </div>
                </div>
              )}

              {profile.lpa_membership_id && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <UserIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">LPA Member ID</p>
                    <p className="text-base font-medium">{profile.lpa_membership_id}</p>
                  </div>
                </div>
              )}

              {profile.location_state && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Globe className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">State</p>
                    <p className="text-base font-medium">{profile.location_state}</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Interests
              </h3>
              {profile.interests && profile.interests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="capitalize text-sm py-1.5">
                      {interest}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No interests added yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Photo Modal */}
        <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
          <DialogContent
            className="max-w-4xl p-0 bg-black/95 [&>button:last-child]:hidden"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") prevPhoto()
              if (e.key === "ArrowRight") nextPhoto()
            }}
          >
            <DialogTitle className="sr-only">{user.first_name}&apos;s photos</DialogTitle>
            <div className="relative h-[80vh]">
              <button
                type="button"
                aria-label="Close photos"
                onClick={() => setShowPhotoModal(false)}
                className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-white hover:bg-black/90 transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
                Close
              </button>
              <p className="absolute top-5 left-4 z-50 rounded-full bg-black/70 px-3 py-1 text-white" aria-live="polite">
                Photo {selectedPhotoIndex + 1} of {photos.length}
              </p>

              {photos.length > 0 && (
                <>
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src={photos[selectedPhotoIndex]}
                      alt={`Photo ${selectedPhotoIndex + 1}`}
                      fill
                      className="object-contain"
                    />
                  </div>

                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous photo"
                        onClick={prevPhoto}
                        disabled={selectedPhotoIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-8 w-8" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next photo"
                        onClick={nextPhoto}
                        disabled={selectedPhotoIndex === photos.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-8 w-8" aria-hidden="true" />
                      </button>

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {photos.map((_: any, idx: number) => (
                          <button
                            type="button"
                            key={idx}
                            aria-label={`Go to photo ${idx + 1}`}
                            aria-current={idx === selectedPhotoIndex}
                            onClick={() => setSelectedPhotoIndex(idx)}
                            className="flex h-11 w-8 items-center justify-center"
                          >
                            <span className={`block h-2.5 rounded-full transition-all ${idx === selectedPhotoIndex ? "w-8 bg-white" : "w-2.5 bg-white/60"}`} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ReportDialog
          userId={userId}
          firstName={user.first_name}
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          source="profile"
          onAlsoBlock={() => setShowBlockDialog(true)}
        />
        <BlockDialog
          userId={userId}
          firstName={user.first_name}
          open={showBlockDialog}
          onOpenChange={setShowBlockDialog}
          onBlocked={() => router.push("/browse")}
        />

        {/* Favorites */}
        <Card className="mb-6 border-border">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">Favorites</h2>
            <Separator />

            <div>
              <h3 className="font-bold text-lg mb-3">🎵 Favorite Music</h3>
              {profile?.favorite_music && Array.isArray(profile.favorite_music) && profile.favorite_music.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.favorite_music.map((music: string, idx: number) => (
                    music && <Badge key={idx} variant="secondary" className="text-sm py-1.5">{music}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-lg mb-3">🐾 Favorite Animals</h3>
              {profile?.animals && Array.isArray(profile.animals) && profile.animals.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.animals.map((animal: string, idx: number) => (
                    animal && <Badge key={idx} variant="secondary" className="text-sm py-1.5">{animal}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-lg mb-3">😤 Pet Peeves</h3>
              {profile?.pet_peeves && Array.isArray(profile.pet_peeves) && profile.pet_peeves.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.pet_peeves.map((peeve: string, idx: number) => (
                    peeve && <Badge key={idx} variant="secondary" className="text-sm py-1.5">{peeve}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preferences & Background */}
        <Card className="mb-6 border-border">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">What I'm Looking For</h2>
            <Separator />

            <div>
              <Label className="text-sm text-muted-foreground mb-3 block font-semibold">Connection Type</Label>
              {profile.looking_for_description && Array.isArray(profile.looking_for_description) && profile.looking_for_description.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.looking_for_description.map((item: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm py-1.5">{item}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>

            <Separator />

            <div>
              <Label className="text-sm text-muted-foreground mb-3 block font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                Life Goals
              </Label>
              {profile.life_goals && Array.isArray(profile.life_goals) && profile.life_goals.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.life_goals.map((goal: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm py-1.5">{goal}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>

            <Separator />

            <div>
              <Label className="text-sm text-muted-foreground mb-3 block font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Languages
              </Label>
              {profile.languages && profile.languages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((lang: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm py-1.5">{lang}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Get to Know Me Prompts */}
        <Card className="mb-6 border-border">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Get to Know Me</h2>
            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2 font-semibold">I'm weirdly good at...</p>
              <p className="font-medium">{profile.prompt_good_at || "Not answered yet"}</p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2 font-semibold">My perfect weekend...</p>
              <p className="font-medium">{profile.prompt_perfect_weekend || "Not answered yet"}</p>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2 font-semibold">Message me if...</p>
              <p className="font-medium">{profile.prompt_message_if || "Not answered yet"}</p>
            </div>
          </CardContent>
        </Card>

        {/* About You & Your Future */}
        <Card className="border-border">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">About You & Your Future</h2>
            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">What are you hoping to find on this site?</h3>
              <p className="text-foreground leading-relaxed">{profile.hoping_to_find || "Not answered yet"}</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">What does a great day look like for you?</h3>
              <p className="text-foreground leading-relaxed">{profile.great_day || "Not answered yet"}</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">What values matter most to you in a relationship?</h3>
              <p className="text-foreground leading-relaxed">{profile.relationship_values || "Not answered yet"}</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">How do you like to show appreciation or affection?</h3>
              <p className="text-foreground leading-relaxed">{profile.show_affection || "Not answered yet"}</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">What kind of life do you want to build with the right person?</h3>
              <p className="text-foreground leading-relaxed">{profile.build_with_person || "Not answered yet"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
