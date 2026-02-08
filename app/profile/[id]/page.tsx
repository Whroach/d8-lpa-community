"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, MapPin, Briefcase, GraduationCap, Heart, MessageCircle, Flag, User as UserIcon, ChevronLeft, ChevronRight, Target, Globe, Compass, X, MoreVertical } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api"
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

  useEffect(() => {
    loadProfile()
  }, [userId])

  useEffect(() => {
    const loadLikeStatus = async () => {
      const result = await api.browse.getLikedProfiles()
      if (result.data) {
        const match = result.data.find((p: { id: string; like_id?: string }) => p.id === userId)
        setIsLiked(!!match)
        setLikeId(match?.like_id || null)
      }
    }

    if (userId) {
      loadLikeStatus()
    }
  }, [userId])

  useEffect(() => {
    const loadMatchStatus = async () => {
      const result = await api.matches.getMatches()
      if (result.data) {
        const match = result.data.find((m: any) => m.users.includes(userId))
        setHasMatched(!!match)
      }
    }

    if (userId) {
      loadMatchStatus()
    }
  }, [userId])

  const loadProfile = async () => {
    setIsLoading(true)
    const result = await api.users.getById(userId)
    if (result.data) {
      console.log('[PROFILE] Full API response:', result.data)
      console.log('[PROFILE] Profile object:', result.data.profile)
      console.log('[PROFILE] favorite_music:', result.data.profile?.favorite_music)
      console.log('[PROFILE] animals:', result.data.profile?.animals)
      console.log('[PROFILE] pet_peeves:', result.data.profile?.pet_peeves)
      setUser(result.data.user)
      setProfile(result.data.profile)
    }
    setIsLoading(false)
  }

  const calculateAge = () => {
    if (!user?.birthdate) return null
    const birthDate = new Date(user.birthdate)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

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

  const handleMessage = () => {
    router.push(`/messages`)
  }

  const handleToggleLike = async () => {
    if (isLiking) return
    setIsLiking(true)

    if (isLiked && likeId) {
      await api.browse.unlike(likeId)
      setIsLiked(false)
      setLikeId(null)
    } else {
      await api.browse.like(userId)
      const result = await api.browse.getLikedProfiles()
      if (result.data) {
        const match = result.data.find((p: { id: string; like_id?: string }) => p.id === userId)
        setIsLiked(!!match)
        setLikeId(match?.like_id || null)
      }
    }

    setIsLiking(false)
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

  if (!user || !profile) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="text-center py-12">
            <UserIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Profile not found</h2>
            <p className="text-muted-foreground mb-4">This user may have deleted their account.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const age = calculateAge()
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
              <h1 className="text-5xl md:text-6xl font-bold text-foreground">
                {user.first_name}
              </h1>
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
                  <span className="font-medium">{profile.district_number}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {hasMatched && (
                <Button className="flex-1" onClick={handleMessage}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message
                </Button>
              )}
              <Button
                size="lg"
                className={cn(
                  "flex-1 font-semibold",
                  isLiked
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                )}
                onClick={handleToggleLike}
                disabled={isLiking}
              >
                <Heart
                  className={cn(
                    "h-5 w-5 mr-2",
                    isLiked && "fill-white"
                  )}
                />
                {isLiked ? "Liked" : "Like"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="bg-transparent">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive">
                    <Flag className="mr-2 h-4 w-4" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group border-2 border-border hover:border-primary/50 transition-all"
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
                      </div>
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
          <DialogContent className="max-w-4xl p-0 bg-black/95">
            <div className="relative h-[80vh]">
              <button
                onClick={() => setShowPhotoModal(false)}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              
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
                        onClick={prevPhoto}
                        disabled={selectedPhotoIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-8 w-8" />
                      </button>
                      <button
                        onClick={nextPhoto}
                        disabled={selectedPhotoIndex === photos.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-8 w-8" />
                      </button>
                      
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {photos.map((_: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedPhotoIndex(idx)}
                            className={`h-2 rounded-full transition-all ${
                              idx === selectedPhotoIndex
                                ? "w-8 bg-white"
                                : "w-2 bg-white/50 hover:bg-white/70"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Favorites */}
        <Card className="mb-6 border-border">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">Favorites</h2>
            <Separator />

            {console.log('[PROFILE_RENDER] Profile in Favorites section:', profile)}

            <div>
              <h3 className="font-bold text-lg mb-3">🎵 Favorite Music</h3>
              {profile.favorite_music && Array.isArray(profile.favorite_music) && profile.favorite_music.filter((item: string) => item && item.length > 0 && item.length < 50).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.favorite_music.filter((item: string) => item && item.length > 0 && item.length < 50).map((music: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm py-1.5">{music}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-lg mb-3">🐾 Favorite Animals</h3>
              {profile.animals && Array.isArray(profile.animals) && profile.animals.filter((item: string) => item && item.length > 0 && item.length < 50).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.animals.filter((item: string) => item && item.length > 0 && item.length < 50).map((animal: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm py-1.5">{animal}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-lg mb-3">😤 Pet Peeves</h3>
              {profile.pet_peeves && Array.isArray(profile.pet_peeves) && profile.pet_peeves.filter((item: string) => item && item.length > 0 && item.length < 50).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.pet_peeves.filter((item: string) => item && item.length > 0 && item.length < 50).map((peeve: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm py-1.5">{peeve}</Badge>
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
