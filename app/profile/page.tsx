"use client"

import React from "react"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LoadError } from "@/components/load-error"
import { PhotoCropDialog, PHOTO_TIPS, PHOTO_FILE_TYPES, MAX_PHOTO_FILE_BYTES } from "@/components/profile/photo-crop-dialog"
import { profileCompleteness, type CompletenessItem } from "@/lib/profile-completeness"
import Image from "next/image"
import Link from "next/link"
import {
  User,
  Camera,
  MapPin,
  Edit3,
  Save,
  X,
  Trash2,
  Plus,
  Loader2,
  Briefcase,
  Heart,
  GripVertical,
  ImageIcon,
  Target,
  Compass,
  Globe,
  MessageCircle,
  Ruler,
  GraduationCap,
  Wine,
  Cigarette,
  Baby,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Users,
  Calendar,
  Music,
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { useAuthStore } from "@/lib/store/auth-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

// Mock photos for demo
const MOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1519345182389-52343af06ae3?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=500&fit=crop",
  "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400&h=500&fit=crop",
]

// New profile options
const LOOKING_FOR_OPTIONS = [
  "Serious relationship",
  "Casual dating",
  "Friendship",
  "Not sure yet",
  "Prefer not to say",
]

const LIFE_GOALS_OPTIONS = [
  "Career focused",
  "Family oriented",
  "Adventure seeker",
  "Personal growth",
  "Work-life balance",
  "Making a difference",
  "Prefer not to say",
]

const FAVORITE_MUSIC_OPTIONS = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "Jazz",
  "Classical",
  "Country",
  "Electronic/EDM",
  "Indie",
  "Metal",
  "R&B/Soul",
  "Latin",
  "K-Pop",
  "Reggae",
  "Blues",
  "Folk",
]

const FAVORITE_ANIMALS_OPTIONS = [
  "Dogs",
  "Cats",
  "Birds",
  "Fish",
  "Reptiles",
  "Rabbits",
  "Hamsters",
  "Horses",
  "Snakes",
]

const PET_PEEVES_OPTIONS = [
  "Lateness",
  "Dishonesty",
  "Loud chewing",
  "Leaving dishes out",
  "Interrupting",
  "Being on phone all the time",
  "Poor hygiene",
  "Negativity",
  "Loud talking",
  "Not listening",
  "Messiness",
  "Being fake",
]

const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Japanese",
  "Korean",
  "Portuguese",
  "Italian",
  "Arabic",
  "Hindi",
  "Russian",
  "Other",
]

const RELIGION_OPTIONS = [
  "Christian",
  "Catholic",
  "Jewish",
  "Muslim",
  "Hindu",
  "Buddhist",
  "Spiritual",
  "Agnostic",
  "Atheist",
  "Other",
  "Prefer not to say",
]

const AVAILABLE_INTERESTS = [
  "Travel", "Music", "Cooking", "Hiking", "Photography", "Reading", 
  "Fitness", "Art", "Movies", "Gaming", "Dancing", "Yoga", "Coffee",
  "Wine", "Sports", "Technology", "Fashion", "Pets", "Nature", "Food"
]

const BODY_TYPES = [
  { value: "athletic", label: "Athletic" },
  { value: "average", label: "Average" },
  { value: "thin", label: "Thin" },
  { value: "curvy", label: "Curvy" },
  { value: "other", label: "Other" },
]

const FREQUENCY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "occasionally", label: "Occasionally" },
  { value: "socially", label: "Socially" },
  { value: "often", label: "Often" },
]

export default function ProfilePageWrapper() {
  // AppLayout already applies ProtectedRoute, so no second guard is needed.
  return <ProfilePage />
}

type AuthUser = ReturnType<typeof useAuthStore.getState>["user"]
type AuthProfile = ReturnType<typeof useAuthStore.getState>["profile"]

/** The editor's fields, filled from what is saved. Cancel goes back to this. */
function buildForm(user: AuthUser, profile: AuthProfile) {
  return {
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    bio: profile?.bio || "",
    occupation: profile?.occupation || "",
    education: profile?.education || "",
    district_number: profile?.district_number || "",
    location_city: profile?.location_city || "",
    location_state: profile?.location_state || "",
    interests: profile?.interests || [],
    // New fields
    looking_for: Array.isArray(profile?.looking_for_description) ? profile?.looking_for_description : (profile?.looking_for_description ? [profile?.looking_for_description] : []),
    life_goals: Array.isArray(profile?.life_goals) ? profile?.life_goals : (profile?.life_goals ? [profile?.life_goals] : []),
    languages: profile?.languages || [],
    cultural_background: profile?.cultural_background || "",
    religion: profile?.religion || "",
    personal_preferences: profile?.personal_preferences || "",
    favorite_music: Array.isArray(profile?.favorite_music) ? profile?.favorite_music : (typeof profile?.favorite_music === 'string' && profile?.favorite_music ? [profile?.favorite_music] : []),
    animals: Array.isArray(profile?.animals) ? profile?.animals : (typeof profile?.animals === 'string' && profile?.animals ? [profile?.animals] : []),
    pet_peeves: Array.isArray(profile?.pet_peeves) ? profile?.pet_peeves : (typeof profile?.pet_peeves === 'string' && profile?.pet_peeves ? [profile?.pet_peeves] : []),
    prompt_good_at: profile?.prompt_good_at || "",
    prompt_perfect_weekend: profile?.prompt_perfect_weekend || "",
    prompt_message_if: profile?.prompt_message_if || "",
    hoping_to_find: profile?.hoping_to_find || "",
    great_day: profile?.great_day || "",
    relationship_values: profile?.relationship_values || "",
    show_affection: profile?.show_affection || "",
    build_with_person: profile?.build_with_person || "",
  }
}
type ProfileForm = ReturnType<typeof buildForm>

// The server allows nine photos. This screen used to say ten, so the tenth
// upload always failed with an error.
const MAX_PHOTOS = 9

function ProfilePage() {
  const { user, profile, setUser, setProfile } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPhotoManager, setShowPhotoManager] = useState(false)
  const [photos, setPhotos] = useState<string[]>(profile?.photos || [])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropError, setCropError] = useState<string | null>(null)
  const [photoToRemove, setPhotoToRemove] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [customInterest, setCustomInterest] = useState("")
  const [customMusic, setCustomMusic] = useState("")
  const [customAnimal, setCustomAnimal] = useState("")
  const [customPetPeeve, setCustomPetPeeve] = useState("")
  
  const [showPreview, setShowPreview] = useState(false)
  
  // Stats state
  const [stats, setStats] = useState({
    matches: 0,
    messages: 0,
  })
  const [upcomingEventCount, setUpcomingEventCount] = useState(0)

  // Load profile data
  // Goes through the shared API client so it honours NEXT_PUBLIC_API_URL and
  // the 401 handling. A hand-rolled fetch here used to build the URL from the
  // env var directly, which produced "undefined/users/profile" when unset.
  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true)
    setLoadError(null)
    const result = await api.users.getProfile()
    if (result.data) {
      setUser(result.data.user)
      setProfile(result.data.profile)
      setPhotos(result.data.profile?.photos || [])
    } else {
      setLoadError(result.error || "Please try again.")
    }
    setIsLoadingProfile(false)
  }, [setUser, setProfile])

  // Load profile data on mount
  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  // Load stats on mount
  useEffect(() => {
    const loadStats = async () => {
      const matchesResult = await api.matches.getAll()
      if (matchesResult.data) {
        // Handle new data structure {active: [], inactive: []}
        const activeMatches = matchesResult.data.active || matchesResult.data
        const matchesArray = Array.isArray(activeMatches) ? activeMatches : []
        setStats((prev) => ({
          ...prev,
          matches: matchesArray.length || 0,
        }))
      }

      const conversationsResult = await api.messages.getConversations()
      if (conversationsResult.data) {
        const conversations = Array.isArray(conversationsResult.data) ? conversationsResult.data : []
        const unreadMessages = conversations.reduce(
          (acc: number, convo: { unread_count?: number }) => acc + (convo.unread_count || 0),
          0
        )
        setStats((prev) => ({
          ...prev,
          messages: unreadMessages,
        }))
      }

      const eventsResult = await api.events.getAll()
      if (eventsResult.data && eventsResult.data.length > 0) {
        const now = new Date()
        const joinedUpcoming = eventsResult.data.filter(
          (event: { start_date: string; end_date?: string; is_joined?: boolean }) => {
            if (!event.is_joined) return false
            const end = new Date(event.end_date || event.start_date)
            return end >= now
          }
        )
        setUpcomingEventCount(joinedUpcoming.length)
      } else {
        setUpcomingEventCount(0)
      }
    }
    loadStats()
  }, [])
  
  const [formData, setFormData] = useState<ProfileForm>(() => buildForm(user, profile))
  // What is saved on the server right now, in the same shape as the form.
  const savedForm = useMemo(() => buildForm(user, profile), [user, profile])
  const [discardOpen, setDiscardOpen] = useState(false)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const router = useRouter()

  // Update formData when user/profile data loads
  useEffect(() => {
    if (user || profile) setFormData(buildForm(user, profile))
  }, [user, profile])

  const isDirty = isEditing && JSON.stringify(formData) !== JSON.stringify(savedForm)

  // Unsaved changes: warn before the tab is closed or reloaded, and before a
  // link elsewhere in the app is followed.
  useEffect(() => {
    if (!isDirty) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!link || link.target === "_blank" || e.defaultPrevented) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      setLeaveTo(url.pathname + url.search)
      setDiscardOpen(true)
    }
    window.addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [isDirty])

  const getInitials = () => {
    const first = formData.first_name?.[0] || ""
    const last = formData.last_name?.[0] || ""
    return (first + last).toUpperCase() || "U"
  }

  const calculateAge = () => {
    if (!user?.birthdate) return null
    const today = new Date()
    const birth = new Date(user.birthdate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const dataToSave = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        bio: formData.bio,
        occupation: formData.occupation,
        education: formData.education,
        location_city: formData.location_city,
        location_state: formData.location_state,
        district_number: formData.district_number,
        interests: formData.interests.filter(i => i.trim() !== ''),
        looking_for_description: formData.looking_for.filter(i => i.trim() !== ''),
        life_goals: formData.life_goals.filter(i => i.trim() !== ''),
        languages: formData.languages.filter(i => i.trim() !== ''),
        cultural_background: formData.cultural_background,
        religion: formData.religion,
        personal_preferences: formData.personal_preferences,
        favorite_music: formData.favorite_music.filter(i => i.trim() !== ''),
        animals: formData.animals.filter(i => i.trim() !== ''),
        pet_peeves: formData.pet_peeves.filter(i => i.trim() !== ''),
        prompt_good_at: formData.prompt_good_at.trim(),
        prompt_perfect_weekend: formData.prompt_perfect_weekend.trim(),
        prompt_message_if: formData.prompt_message_if.trim(),
        hoping_to_find: formData.hoping_to_find.trim(),
        great_day: formData.great_day.trim(),
        relationship_values: formData.relationship_values.trim(),
        show_affection: formData.show_affection.trim(),
        build_with_person: formData.build_with_person.trim(),
      }

      const result = await api.users.updateProfile(dataToSave)
      
      if (result.error) {
        setSaveError(result.error)
      } else {
        // Reload profile to ensure we have latest data
        await loadProfile()
        // Reset custom input states
        setCustomMusic('')
        setCustomAnimal('')
        setCustomPetPeeve('')
        setIsEditing(false)
        toast.success("Profile saved")
      }
    } catch (error) {
      console.error('[PROFILE] Save exception:', error)
      setSaveError('Something went wrong while saving. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel puts every field back to what is saved. (It used to leave the
  // edited text on screen, looking saved, and the next Save stored it.)
  const discardChanges = () => {
    setFormData(savedForm)
    setCustomInterest("")
    setCustomMusic("")
    setCustomAnimal("")
    setCustomPetPeeve("")
    setSaveError(null)
    setIsEditing(false)
    setDiscardOpen(false)
    if (leaveTo) {
      const to = leaveTo
      setLeaveTo(null)
      router.push(to)
    }
  }

  const handleCancel = () => {
    if (isDirty) {
      setLeaveTo(null)
      setDiscardOpen(true)
    } else {
      discardChanges()
    }
  }

  const toggleInterest = (interest: string) => {
    if (formData.interests.includes(interest)) {
      setFormData({
        ...formData,
        interests: formData.interests.filter(i => i !== interest)
      })
    } else if (formData.interests.length < 10) {
      setFormData({
        ...formData,
        interests: [...formData.interests, interest]
      })
    }
  }

  const addCustomInterest = () => {
    const trimmedInterest = customInterest.trim()
    if (trimmedInterest && !formData.interests.includes(trimmedInterest) && formData.interests.length < 10) {
      setFormData({
        ...formData,
        interests: [...formData.interests, trimmedInterest]
      })
      setCustomInterest("")
    }
  }

  const handleCustomInterestKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomInterest()
    }
  }

  // Photo management functions.
  // Every change is written straight back to the server — an earlier version
  // only updated local state, so deletes and reordering silently reverted on
  // the next page load.
  const persistPhotoOrder = async (nextPhotos: string[]) => {
    setPhotoSaving(true)
    setUploadError(null)
    const result = await api.users.savePhotoOrder(nextPhotos)
    if (result.error) {
      setUploadError(result.error)
      // Put the server's version back so the UI never lies about what is saved.
      setPhotos(profile?.photos || [])
    } else {
      setProfile({ ...(profile || {}), photos: nextPhotos })
    }
    setPhotoSaving(false)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newPhotos = [...photos]
    const draggedPhoto = newPhotos[draggedIndex]
    newPhotos.splice(draggedIndex, 1)
    newPhotos.splice(index, 0, draggedPhoto)
    setPhotos(newPhotos)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    persistPhotoOrder(photos)
  }

  // Arrow controls alongside drag-and-drop: dragging is unreliable on touch
  // screens and fiddly with a trackpad.
  const movePhoto = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= photos.length) return
    const newPhotos = [...photos]
    ;[newPhotos[index], newPhotos[target]] = [newPhotos[target], newPhotos[index]]
    setPhotos(newPhotos)
    persistPhotoOrder(newPhotos)
  }

  const handleDeletePhoto = async (index: number) => {
    const url = photos[index]
    const nextPhotos = photos.filter((_, i) => i !== index)
    setPhotos(nextPhotos)
    setPhotoSaving(true)
    setUploadError(null)
    const result = await api.users.deletePhoto(url)
    if (result.error) {
      setUploadError(result.error)
      setPhotos(photos)
    } else {
      setProfile({ ...(profile || {}), photos: nextPhotos })
      toast.success("Photo removed")
    }
    setPhotoSaving(false)
  }

  const handleAddPhoto = () => fileInputRef.current?.click()

  // ---- "Your profile is N% complete" ------------------------------------
  const HIDE_KEY = "d8lpa-hide-completeness"
  const [helperHidden, setHelperHidden] = useState(false)
  useEffect(() => {
    try {
      setHelperHidden(localStorage.getItem(HIDE_KEY) === "1")
    } catch {
      // private browsing: the card simply shows
    }
  }, [])
  const completeness = useMemo(
    () => profileCompleteness({ ...(profile || {}), photos }),
    [profile, photos]
  )

  const FIELD_FOR: Partial<Record<CompletenessItem["key"], { form?: keyof ProfileForm; label?: string; chip?: string }>> = {
    bio: { form: "bio", label: "About me" },
    interests: { label: "Add your own interest" },
    looking_for: { chip: "Friendship" },
    prompt_good_at: { form: "prompt_good_at", label: "I'm weirdly good at..." },
    prompt_perfect_weekend: { form: "prompt_perfect_weekend", label: "My perfect weekend..." },
    hoping_to_find: { form: "hoping_to_find", label: "What are you hoping to find on this site?" },
    prompt_message_if: { form: "prompt_message_if", label: "Message me if..." },
    languages: { chip: "English" },
    occupation: { label: "Occupation" },
  }

  /** Opens the editor at the field for this suggestion, optionally with an example filled in. */
  const startOn = (item: CompletenessItem, example?: string) => {
    if (item.key === "photo") {
      setShowPhotoManager(true)
      return
    }
    const target = FIELD_FOR[item.key]
    if (!target) return
    setIsEditing(true)
    if (example && target.form) setFormData((prev) => ({ ...prev, [target.form as string]: example }))
    window.setTimeout(() => {
      const el = target.label
        ? document.querySelector<HTMLElement>(`[aria-label="${target.label}"]`)
        : Array.from(document.querySelectorAll<HTMLElement>('[role="button"][aria-pressed]')).find(
            (node) => node.textContent?.trim() === target.chip
          )
      el?.scrollIntoView({ block: "center" })
      el?.focus()
    }, 100)
  }

  // A picture was chosen: check it, then show the tips and the crop step.
  const handleFileChosen = (file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    setCropError(null)
    if (!PHOTO_FILE_TYPES.includes(file.type)) {
      setUploadError('That file is not a photo we can use. Please choose a JPG or PNG image.')
      return
    }
    // Phone photos are often larger than this; they are made smaller before
    // upload, so only refuse files that are unreasonably big.
    if (file.size > MAX_PHOTO_FILE_BYTES) {
      setUploadError('That photo is too large. Please choose an image under 25MB.')
      return
    }
    if (photos.length >= MAX_PHOTOS) {
      setUploadError(`You can have up to ${MAX_PHOTOS} photos. Remove one to add another.`)
      return
    }
    setCropFile(file)
  }

  const uploadPrepared = async (blob: Blob) => {
    setPhotoUploading(true)
    setCropError(null)
    const body = new FormData()
    body.append('photo', blob, 'photo.jpg')
    const result = await api.users.uploadPhoto(body)
    setPhotoUploading(false)
    if (result.error || !result.data) {
      setCropError(result.error || 'We could not upload that picture. Please try again.')
      return
    }
    const nextPhotos = [...photos, result.data.url]
    setPhotos(nextPhotos)
    setProfile({ ...(profile || {}), photos: nextPhotos })
    setCropFile(null)
    toast.success(nextPhotos.length === 1 ? "Photo added. It is now your main photo." : "Photo added")
  }

  const age = calculateAge()
  const visiblePhotos = photos.slice(0, 6)
  // Only the 6th tile doubles as a "+N more" overlay, and only when photos are
  // actually hidden behind it. With exactly 6 photos nothing is hidden.
  const remainingCount = photos.length > 6 ? photos.length - 5 : 0

  const formatLabel = (value: string | undefined) => {
    if (!value) return "Not set"
    return value.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  }
  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        {/* Loading State */}
        {isLoadingProfile && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span className="ml-3 text-muted-foreground" role="status">Loading profile...</span>
          </div>
        )}

        {!isLoadingProfile && loadError && (
          <LoadError what="your profile" detail={loadError} onRetry={loadProfile} />
        )}

        {!isLoadingProfile && !loadError && (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">
              This is what other members see. Choose Edit to change it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)} className="bg-white border-2 border-black dark:bg-slate-950 dark:border-white hover:bg-slate-50 dark:hover:bg-slate-900">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="bg-white border-2 border-black dark:bg-slate-950 dark:border-white hover:bg-slate-50 dark:hover:bg-slate-900">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        {!isEditing && !helperHidden && completeness.percent < 100 && (
          <section aria-labelledby="completeness-title" data-testid="completeness" className="mb-6 rounded-xl border-2 border-primary/40 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 id="completeness-title" className="text-xl font-semibold">
                Your profile is {completeness.percent}% complete
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHelperHidden(true)
                  try {
                    localStorage.setItem(HIDE_KEY, "1")
                  } catch {
                    // not remembered; that is all
                  }
                }}
              >
                Hide for now
              </Button>
            </div>
            <div
              role="progressbar"
              aria-label="Profile completeness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completeness.percent}
              aria-valuetext={`${completeness.percent} percent`}
              className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${completeness.percent}%` }} />
            </div>
            <p className="mt-3 text-muted-foreground">
              Only you see this. {completeness.missing.length === 1 ? "One thing would finish it:" : "Next, you could:"}
            </p>
            <ul className="mt-3 space-y-4">
              {completeness.missing.slice(0, 3).map((item) => (
                <li key={item.key} data-testid={`suggestion-${item.key}`} className="rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 sm:flex-1">
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-muted-foreground">{item.reason}</p>
                    </div>
                    <Button size="sm" onClick={() => startOn(item)} aria-label={`Add this: ${item.label}`}>
                      Add this
                    </Button>
                  </div>
                  {item.examples && (
                    <div className="mt-3">
                      <p className="text-sm font-medium">Stuck for words? Start from an example and make it yours:</p>
                      <div className="mt-2 flex flex-col gap-2">
                        {item.examples.map((example) => (
                          <Button
                            key={example}
                            type="button"
                            variant="outline"
                            className="h-auto min-h-11 justify-start whitespace-normal py-2 text-left font-normal"
                            onClick={() => startOn(item, example)}
                          >
                            &ldquo;{example}&rdquo;
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {saveError && (
          <div role="alert" className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-card border-2 border-destructive/50">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-semibold">We couldn&apos;t save your profile</p>
              <p>{saveError} Your changes are still here - please try Save again.</p>
            </div>
          </div>
        )}

        {/* Profile Header Card */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Profile Picture - Square with rounded corners */}
              <div className="relative shrink-0">
                <div className="w-36 h-36 md:w-40 md:h-40 rounded-2xl overflow-hidden border-4 border-primary/20 shadow-lg bg-muted">
                  <Image
                    src={photos[0] || "/placeholder.svg"}
                    alt={formData.first_name}
                    width={160}
                    height={160}
                    className="w-full h-full object-cover"
                  />
                </div>
                {isEditing && (
                  <button
                    type="button"
                    aria-label="Change photos"
                    onClick={() => setShowPhotoManager(true)}
                    className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
              
              {/* Profile Info */}
              <div className="flex-1 space-y-3">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="my-name">
                  {formData.first_name} {formData.last_name}
                  {age ? `, ${age}` : ""}
                </h2>
                
                {isEditing ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="edit-first-name">First name</Label>
                      <Input id="edit-first-name" value={formData.first_name} maxLength={50} autoComplete="given-name"
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-last-name">Last name</Label>
                      <Input id="edit-last-name" value={formData.last_name} maxLength={50} autoComplete="family-name"
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-city">City or town</Label>
                      <Input id="edit-city" value={formData.location_city} maxLength={80}
                        onChange={(e) => setFormData({ ...formData, location_city: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-state">State</Label>
                      <Input id="edit-state" value={formData.location_state} maxLength={40}
                        onChange={(e) => setFormData({ ...formData, location_state: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-district">LPA district number</Label>
                      <Input id="edit-district" inputMode="numeric" maxLength={2} placeholder="e.g. 8"
                        value={String(formData.district_number).replace("district_", "")}
                        onChange={(e) => setFormData({ ...formData, district_number: e.target.value.replace(/[^0-9]/g, "") })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-occupation-top">Occupation (optional)</Label>
                      <Input id="edit-occupation-top" value={formData.occupation} maxLength={100}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} />
                    </div>
                    <p className="text-muted-foreground sm:col-span-2">
                      Your birthday cannot be changed here. If it is wrong, please contact us and we will correct it.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {formData.district_number ? (
                      <span className="font-medium text-primary">District {String(formData.district_number).replace("district_", "")}</span>
                    ) : null}
                    {(formData.location_city || formData.location_state) && (
                      <span className="flex items-center gap-1 text-muted-foreground" data-testid="my-location">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {[formData.location_city, formData.location_state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {formData.occupation ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Briefcase className="h-4 w-4" aria-hidden="true" />
                        {formData.occupation}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Link href="/matches">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.matches}</p>
                    <p className="text-sm text-muted-foreground">Total Matches</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/messages">
            <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20 hover:shadow-md hover:border-secondary/40 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-secondary/20">
                    <MessageCircle className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stats.messages}</p>
                    <p className="text-sm text-muted-foreground">New Messages</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/events">
            <Card className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border-chart-3/20 hover:shadow-md hover:border-chart-3/40 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-chart-3/20">
                    <Calendar className="h-5 w-5 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">
                      {upcomingEventCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Upcoming Events</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* About Me */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, 500) })}
                  aria-label="About me"
                  placeholder="Tell others about yourself..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2 text-right">
                  {formData.bio.length}/500
                </p>
              </div>
            ) : (
              <p className="text-foreground leading-relaxed">{formData.bio}</p>
            )}
          </CardContent>
        </Card>

        {/* Photo Gallery */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Photos
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowPhotoManager(true)}
            >
              Manage Photos
            </Button>
          </CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowPhotoManager(true)}
                className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="h-10 w-10" />
                <span className="text-base font-medium">Add your first photo</span>
                <span className="text-sm">
                  A photo helps other members recognise you
                </span>
              </button>
            ) : (
            <div className="grid grid-cols-3 gap-2">
              {visiblePhotos.map((photo, index) => (
                <button
                  type="button"
                  key={index}
                  aria-label={index === 5 && remainingCount > 0 ? `Manage photos (${remainingCount} more)` : `Photo ${index + 1}. Manage photos`}
                  className="relative aspect-[4/5] rounded-lg overflow-hidden group"
                  onClick={() => setShowPhotoManager(true)}
                >
                  <Image
                    src={photo || "/placeholder.svg"}
                    alt={`Photo ${index + 1}`}
                    fill
                    className={cn(
                      "object-cover transition-transform group-hover:scale-105",
                      index === 5 && remainingCount > 0 && "blur-sm"
                    )}
                  />
                  {index === 5 && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">+{remainingCount}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Details Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Occupation */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Occupation
              </Label>
              {isEditing ? (
                <Input
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  aria-label="Occupation"
                  placeholder="Enter your occupation"
                />
              ) : (
                <p className="font-medium">{formData.occupation || "Not specified"}</p>
              )}
            </div>

            <Separator />

            {/* Education */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Education
              </Label>
              {isEditing ? (
                <Select
                  value={formData.education}
                  onValueChange={(v) => setFormData({ ...formData, education: v })}
                >
                  <SelectTrigger aria-label="Education" className="w-full">
                    <SelectValue placeholder="Select your education level" />
                  </SelectTrigger>
                  <SelectContent>
                    {['high-school', 'some-college', 'bachelors', 'masters', 'doctorate', 'trade-school', 'other'].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace(/-/g, ' ').charAt(0).toUpperCase() + option.replace(/-/g, ' ').slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{formData.education ? formData.education.replace(/-/g, ' ').charAt(0).toUpperCase() + formData.education.replace(/-/g, ' ').slice(1) : "Not specified"}</p>
              )}
            </div>

            <Separator />

            {/* Interests */}
            <div>
              <h3 className="text-base font-bold text-foreground mb-3">Interests</h3>
              {isEditing ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Select up to 10 interests or add your own</p>
                  
                  {/* Selected Interests */}
                  {formData.interests.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Your Interests ({formData.interests.length}/10)</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.interests.map((interest) => (
                          <Badge
                            key={interest}
                            variant="default"
                            className="text-sm pr-1"
                          >
                            {interest}
                            <button
                              type="button"
                              aria-label={`Remove ${interest}`}
                              onClick={() => toggleInterest(interest)}
                              className="ml-1 flex h-8 w-8 items-center justify-center hover:bg-primary-foreground/20 rounded-full"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Interest Input */}
                  {formData.interests.length < 10 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Add Custom Interest</p>
                      <div className="flex gap-2">
                        <Input
                          aria-label="Add your own interest"
                  placeholder="Type an interest and press Enter"
                          value={customInterest}
                          onChange={(e) => setCustomInterest(e.target.value)}
                          onKeyDown={handleCustomInterestKeyPress}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCustomInterest}
                          disabled={!customInterest.trim()}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Predefined Interests */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Suggested Interests</p>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_INTERESTS.filter(i => !formData.interests.includes(i)).map((interest) => (
                        <Badge
                          key={interest}
                          variant="outline"
                          className="cursor-pointer transition-all hover:scale-105 hover:bg-primary hover:text-primary-foreground"
                          onClick={() => toggleInterest(interest)}
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.interests.map((interest) => (
                    <Badge key={interest} variant="secondary">
                      {interest}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preferences & Background - Combined Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Preferences & Background
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* What I'm Looking For */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block flex items-center gap-2">
                <Heart className="h-4 w-4" />
                {"What I'm Looking For"}
              </Label>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {LOOKING_FOR_OPTIONS.map((option) => (
                    <Badge
                      key={option}
                      variant={formData.looking_for.includes(option) ? "default" : "outline"}
                      aria-pressed={formData.looking_for.includes(option)}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => {
                        if (formData.looking_for.includes(option)) {
                          setFormData({ ...formData, looking_for: formData.looking_for.filter(l => l !== option) })
                        } else {
                          setFormData({ ...formData, looking_for: [...formData.looking_for, option] })
                        }
                      }}
                    >
                      {option}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.looking_for.length > 0 ? (
                    formData.looking_for.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Not specified</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Life Goals */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block flex items-center gap-2">
                <Compass className="h-4 w-4" />
                Life Goals
              </Label>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {LIFE_GOALS_OPTIONS.map((option) => (
                    <Badge
                      key={option}
                      variant={formData.life_goals.includes(option) ? "default" : "outline"}
                      aria-pressed={formData.life_goals.includes(option)}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => {
                        if (formData.life_goals.includes(option)) {
                          setFormData({ ...formData, life_goals: formData.life_goals.filter(l => l !== option) })
                        } else {
                          setFormData({ ...formData, life_goals: [...formData.life_goals, option] })
                        }
                      }}
                    >
                      {option}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.life_goals.length > 0 ? (
                    formData.life_goals.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Not specified</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Languages */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Languages
              </Label>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <Badge
                      key={lang}
                      variant={formData.languages.includes(lang) ? "default" : "outline"}
                      aria-pressed={formData.languages.includes(lang)}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => {
                        if (formData.languages.includes(lang)) {
                          setFormData({ ...formData, languages: formData.languages.filter(l => l !== lang) })
                        } else {
                          setFormData({ ...formData, languages: [...formData.languages, lang] })
                        }
                      }}
                    >
                      {lang}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.languages.map((lang) => (
                    <Badge key={lang} variant="secondary">{lang}</Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Cultural Background */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">Cultural Background</Label>
              {isEditing ? (
                <Input
                  value={formData.cultural_background}
                  onChange={(e) => setFormData({ ...formData, cultural_background: e.target.value })}
                  aria-label="Cultural background"
                  placeholder="Enter your cultural background"
                />
              ) : (
                <p className="font-medium">{formData.cultural_background || "Not specified"}</p>
              )}
            </div>

            <Separator />

            {/* Religion */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">Religion</Label>
              {isEditing ? (
                <Select
                  value={formData.religion}
                  onValueChange={(v) => setFormData({ ...formData, religion: v })}
                >
                  <SelectTrigger aria-label="Religion" className="w-full">
                    <SelectValue placeholder="Select your religion" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELIGION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{formData.religion}</p>
              )}
            </div>

            <Separator />

            {/* Personal Preferences */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Personal Preferences
              </Label>
              {isEditing ? (
                <div>
                  <Textarea
                    value={formData.personal_preferences}
                    onChange={(e) => setFormData({ ...formData, personal_preferences: e.target.value.slice(0, 500) })}
                    aria-label="Personal preferences"
                  placeholder="Share what you value in a partner and relationship..."
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-right">
                    {formData.personal_preferences.length}/500
                  </p>
                </div>
              ) : (
                <p className="text-foreground leading-relaxed">{formData.personal_preferences || "Not specified"}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Favorites Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Music className="h-4 w-4" />
              Favorites
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              
            {/* Favorite Music */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">Favorite Music</Label>
              {isEditing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {FAVORITE_MUSIC_OPTIONS.map((option) => (
                      <Badge
                        key={option}
                        variant={formData.favorite_music.includes(option) ? "default" : "outline"}
                      aria-pressed={formData.favorite_music.includes(option)}
                        className="cursor-pointer transition-all hover:scale-105"
                        onClick={() => {
                          if (formData.favorite_music.includes(option)) {
                            setFormData({ ...formData, favorite_music: formData.favorite_music.filter(m => m !== option) })
                          } else {
                            setFormData({ ...formData, favorite_music: [...formData.favorite_music, option] })
                          }
                        }}
                      >
                        {option}
                      </Badge>
                    ))}
                  </div>
                  {/* Display custom values */}
                  {formData.favorite_music.filter(item => !FAVORITE_MUSIC_OPTIONS.includes(item)).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 p-2 bg-muted rounded">
                      {formData.favorite_music
                        .filter(item => !FAVORITE_MUSIC_OPTIONS.includes(item))
                        .map((item) => (
                          <Badge
                            key={item}
                            variant="default"
                            className="cursor-pointer"
                            aria-label={`Remove ${item}`}
                            onClick={() => {
                              setFormData({ ...formData, favorite_music: formData.favorite_music.filter(m => m !== item) })
                            }}
                          >
                            {item} ✕
                          </Badge>
                        ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-2">Or add custom:</p>
                    <Input
                      type="text"
                      aria-label="Add your own music"
                  placeholder="Add custom music genre or artist..."
                      value={customMusic}
                      onChange={(e) => setCustomMusic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customMusic.trim()) {
                          const value = customMusic.trim()
                          if (!formData.favorite_music.includes(value)) {
                            setFormData({ ...formData, favorite_music: [...formData.favorite_music, value] })
                          }
                          setCustomMusic('')
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.favorite_music.filter(item => item.length < 50).length > 0 ? (
                    formData.favorite_music.filter(item => item.length < 50).map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Not specified</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Favorite Animals */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">Favorite Animals</Label>
              {isEditing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {FAVORITE_ANIMALS_OPTIONS.map((option) => (
                      <Badge
                        key={option}
                        variant={formData.animals.includes(option) ? "default" : "outline"}
                      aria-pressed={formData.animals.includes(option)}
                        className="cursor-pointer transition-all hover:scale-105"
                        onClick={() => {
                          if (formData.animals.includes(option)) {
                            setFormData({ ...formData, animals: formData.animals.filter(a => a !== option) })
                          } else {
                            setFormData({ ...formData, animals: [...formData.animals, option] })
                          }
                        }}
                      >
                        {option}
                      </Badge>
                    ))}
                  </div>
                  {/* Display custom values */}
                  {formData.animals.filter(item => !FAVORITE_ANIMALS_OPTIONS.includes(item)).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 p-2 bg-muted rounded">
                      {formData.animals
                        .filter(item => !FAVORITE_ANIMALS_OPTIONS.includes(item))
                        .map((item) => (
                          <Badge
                            key={item}
                            variant="default"
                            className="cursor-pointer"
                            aria-label={`Remove ${item}`}
                            onClick={() => {
                              setFormData({ ...formData, animals: formData.animals.filter(a => a !== item) })
                            }}
                          >
                            {item} ✕
                          </Badge>
                        ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-2">Or add custom:</p>
                    <Input
                      type="text"
                      aria-label="Add your own animal"
                  placeholder="Add custom animal..."
                      value={customAnimal}
                      onChange={(e) => setCustomAnimal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customAnimal.trim()) {
                          const value = customAnimal.trim()
                          if (!formData.animals.includes(value)) {
                            setFormData({ ...formData, animals: [...formData.animals, value] })
                          }
                          setCustomAnimal('')
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.animals.filter(item => item.length < 50).length > 0 ? (
                    formData.animals.filter(item => item.length < 50).map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Not specified</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Pet Peeves */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">Pet Peeves</Label>
              {isEditing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PET_PEEVES_OPTIONS.map((option) => (
                      <Badge
                        key={option}
                        variant={formData.pet_peeves.includes(option) ? "default" : "outline"}
                      aria-pressed={formData.pet_peeves.includes(option)}
                        className="cursor-pointer transition-all hover:scale-105"
                        onClick={() => {
                          if (formData.pet_peeves.includes(option)) {
                            setFormData({ ...formData, pet_peeves: formData.pet_peeves.filter(p => p !== option) })
                          } else {
                            setFormData({ ...formData, pet_peeves: [...formData.pet_peeves, option] })
                          }
                        }}
                      >
                        {option}
                      </Badge>
                    ))}
                  </div>
                  {/* Display custom values */}
                  {formData.pet_peeves.filter(item => !PET_PEEVES_OPTIONS.includes(item)).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 p-2 bg-muted rounded">
                      {formData.pet_peeves
                        .filter(item => !PET_PEEVES_OPTIONS.includes(item))
                        .map((item) => (
                          <Badge
                            key={item}
                            variant="default"
                            className="cursor-pointer"
                            aria-label={`Remove ${item}`}
                            onClick={() => {
                              setFormData({ ...formData, pet_peeves: formData.pet_peeves.filter(p => p !== item) })
                            }}
                          >
                            {item} ✕
                          </Badge>
                        ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-2">Or add custom:</p>
                    <Input
                      type="text"
                      aria-label="Add your own pet peeve"
                  placeholder="Add custom pet peeve..."
                      value={customPetPeeve}
                      onChange={(e) => setCustomPetPeeve(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customPetPeeve.trim()) {
                          const value = customPetPeeve.trim()
                          if (!formData.pet_peeves.includes(value)) {
                            setFormData({ ...formData, pet_peeves: [...formData.pet_peeves, value] })
                          }
                          setCustomPetPeeve('')
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {formData.pet_peeves.filter(item => item.length < 50).length > 0 ? (
                    formData.pet_peeves.filter(item => item.length < 50).map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Not specified</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Get to Know Me Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Get to Know Me</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* I'm weirdly good at... */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">I'm weirdly good at...</Label>
              {isEditing ? (
                <Textarea
                  value={formData.prompt_good_at}
                  onChange={(e) => setFormData({ ...formData, prompt_good_at: e.target.value.slice(0, 250) })}
                  aria-label="I'm weirdly good at..."
                  placeholder="Share something you're uniquely good at..."
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <p className="text-foreground">{formData.prompt_good_at || "Not answered yet"}</p>
              )}
            </div>

            <Separator />

            {/* My perfect weekend... */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">My perfect weekend...</Label>
              {isEditing ? (
                <Textarea
                  value={formData.prompt_perfect_weekend}
                  onChange={(e) => setFormData({ ...formData, prompt_perfect_weekend: e.target.value.slice(0, 250) })}
                  aria-label="My perfect weekend..."
                  placeholder="Describe your ideal weekend..."
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <p className="text-foreground">{formData.prompt_perfect_weekend || "Not answered yet"}</p>
              )}
            </div>

            <Separator />

            {/* Message me if... */}
            <div>
              <Label className="text-base font-bold text-foreground mb-2 block">Message me if...</Label>
              {isEditing ? (
                <Textarea
                  value={formData.prompt_message_if}
                  onChange={(e) => setFormData({ ...formData, prompt_message_if: e.target.value.slice(0, 250) })}
                  aria-label="Message me if..."
                  placeholder="What should someone mention when they message you?"
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <p className="text-foreground">{formData.prompt_message_if || "Not answered yet"}</p>
              )}
            </div>

            <Separator />

            {/* Open-Ended Questions Section */}
            <div className="pt-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase">About You & Your Future</h3>

              {/* What are you hoping to find on this site? */}
              <div className="mb-6">
                <Label className="text-base font-bold text-foreground mb-2 block">What are you hoping to find on this site?</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.hoping_to_find}
                    onChange={(e) => setFormData({ ...formData, hoping_to_find: e.target.value.slice(0, 250) })}
                    aria-label="What are you hoping to find on this site?"
                  placeholder="Share what you're looking for..."
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <p className="text-foreground">{formData.hoping_to_find || "Not answered yet"}</p>
                )}
              </div>

              <Separator />

              {/* What does a great day look like for you? */}
              <div className="my-6">
                <Label className="text-base font-bold text-foreground mb-2 block">What does a great day look like for you?</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.great_day}
                    onChange={(e) => setFormData({ ...formData, great_day: e.target.value.slice(0, 250) })}
                    aria-label="What does a great day look like for you?"
                  placeholder="Describe your ideal day..."
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <p className="text-foreground">{formData.great_day || "Not answered yet"}</p>
                )}
              </div>

              <Separator />

              {/* What values matter most to you in a relationship? */}
              <div className="my-6">
                <Label className="text-base font-bold text-foreground mb-2 block">What values matter most to you in a relationship?</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.relationship_values}
                    onChange={(e) => setFormData({ ...formData, relationship_values: e.target.value.slice(0, 250) })}
                    aria-label="What values matter most to you in a relationship?"
                  placeholder="Share the values that are important to you..."
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <p className="text-foreground">{formData.relationship_values || "Not answered yet"}</p>
                )}
              </div>

              <Separator />

              {/* How do you like to show appreciation or affection? */}
              <div className="my-6">
                <Label className="text-base font-bold text-foreground mb-2 block">How do you like to show appreciation or affection?</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.show_affection}
                    onChange={(e) => setFormData({ ...formData, show_affection: e.target.value.slice(0, 250) })}
                    aria-label="How do you like to show appreciation or affection?"
                  placeholder="Describe how you express care and appreciation..."
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <p className="text-foreground">{formData.show_affection || "Not answered yet"}</p>
                )}
              </div>

              <Separator />

              {/* What kind of life do you want to build with the right person? */}
              <div className="mt-6">
                <Label className="text-base font-bold text-foreground mb-2 block">What kind of life do you want to build with the right person?</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.build_with_person}
                    onChange={(e) => setFormData({ ...formData, build_with_person: e.target.value.slice(0, 250) })}
                    aria-label="What kind of life do you want to build with the right person?"
                  placeholder="Share your vision for the future..."
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <p className="text-foreground">{formData.build_with_person || "Not answered yet"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo Manager Dialog */}
        <Dialog open={showPhotoManager} onOpenChange={setShowPhotoManager}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Photos</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Your first photo is your main profile picture. Use the arrows to
                reorder, or drag a photo to a new spot. Changes save automatically.
              </p>
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer font-medium">Tips for a good photo</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {PHOTO_TIPS.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </details>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                aria-label="Choose a photo to add"
                tabIndex={-1}
                data-testid="photo-file-input"
                onChange={(e) => {
                  handleFileChosen(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div
                    key={photo}
                    data-testid="managed-photo"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "relative aspect-[4/5] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border-2",
                      draggedIndex === index ? "border-primary opacity-50" : "border-transparent",
                      index === 0 && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    <Image
                      src={photo || "/placeholder.svg"}
                      alt={`Photo ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    {/* Controls stay visible rather than appearing on hover —
                        hover does not exist on the phones and tablets most of
                        our members use. */}
                    <button
                      type="button"
                      onClick={() => setPhotoToRemove(index)}
                      disabled={photoSaving}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 disabled:opacity-50"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <button
                        onClick={() => movePhoto(index, -1)}
                        disabled={index === 0 || photoSaving}
                        aria-label={`Move photo ${index + 1} earlier`}
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-md hover:bg-black/80 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => movePhoto(index, 1)}
                        disabled={index === photos.length - 1 || photoSaving}
                        aria-label={`Move photo ${index + 1} later`}
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-md hover:bg-black/80 disabled:opacity-30"
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    {index === 0 && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-primary text-primary-foreground text-sm rounded font-medium">
                        Main
                      </div>
                    )}
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    disabled={photoUploading}
                    className="aspect-[4/5] rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {photoUploading ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm font-medium">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-8 w-8" />
                        <span className="text-sm font-medium">Add Photo</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              {photos.length === 0 && !photoUploading && (
                <p className="text-muted-foreground text-center py-2">
                  You have no photos yet. A photo helps other members recognise
                  you at events - add your first one above.
                </p>
              )}
              {uploadError && (
                <div role="alert" className="font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {uploadError}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-4">
                <span className="text-muted-foreground flex items-center gap-2" role="status">
                  {photoSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "All changes saved"
                  )}
                </span>
                <Button onClick={() => setShowPhotoManager(false)} disabled={photoSaving}>
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <PhotoCropDialog
          file={cropFile}
          open={cropFile !== null}
          busy={photoUploading}
          error={cropError}
          onCancel={() => { setCropFile(null); setCropError(null) }}
          onConfirm={uploadPrepared}
        />

        {/* Remove a photo: ask first */}
        <Dialog open={photoToRemove !== null} onOpenChange={(open) => !open && setPhotoToRemove(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remove this photo?</DialogTitle>
              <DialogDescription>
                It will be taken off your profile. This cannot be undone, but you can add the photo again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setPhotoToRemove(null)} autoFocus>Keep photo</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const index = photoToRemove
                  setPhotoToRemove(null)
                  if (index !== null) void handleDeletePhoto(index)
                }}
              >
                Remove photo
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Unsaved changes: ask before throwing them away */}
        <Dialog open={discardOpen} onOpenChange={(open) => { if (!open) { setDiscardOpen(false); setLeaveTo(null) } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Discard your changes?</DialogTitle>
              <DialogDescription>
                You have changes that are not saved. If you discard them, your profile stays as it was.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => { setDiscardOpen(false); setLeaveTo(null) }} autoFocus>Keep editing</Button>
              <Button variant="destructive" onClick={discardChanges}>Discard changes</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Profile Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-md p-0 overflow-hidden [&>button:last-child]:hidden">
            <ProfilePreviewCard
              photos={photos}
              name={formData.first_name}
              age={age}
              location={formData.location_state}
              occupation={formData.occupation}
              bio={formData.bio}
              interests={formData.interests}
              lookingFor={formData.looking_for}
              onClose={() => setShowPreview(false)}
            />
          </DialogContent>
        </Dialog>
            </>
          )}
        </div>
      </AppLayout>
  )
}

// Profile Preview Card Component - shows how other users see the profile
function ProfilePreviewCard({
  photos,
  name,
  age,
  location,
  occupation,
  bio,
  interests,
  lookingFor,
  onClose,
}: {
  photos: string[]
  name: string
  age: number | null
  location: string
  occupation: string
  bio: string
  interests: string[]
  lookingFor: string[]
  onClose: () => void
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  return (
    <div className="bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <DialogTitle className="text-base font-semibold">Profile Preview</DialogTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X aria-hidden="true" />
          Close
        </Button>
      </div>

      {/* Photo Section */}
      <div className="relative aspect-[4/5] bg-muted">
        <Image
          src={photos[currentPhotoIndex] || "/placeholder.svg"}
          alt={name}
          fill
          className="object-cover"
        />
        
        {/* Photo navigation dots */}
        {photos.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5 px-4">
            {photos.map((_, index) => (
              <button
                type="button"
                key={index}
                aria-label={`Go to photo ${index + 1}`}
                aria-current={index === currentPhotoIndex}
                onClick={() => setCurrentPhotoIndex(index)}
                className="flex h-8 items-center"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all",
                    index === currentPhotoIndex ? "bg-white w-6" : "bg-white/60 w-4"
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {/* Photo navigation arrows */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Name and basic info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="text-2xl font-bold">
            {name}
            {age ? `, ${age}` : ""}
          </h3>
          <div className="flex items-center gap-2 text-white/90 text-sm mt-1">
            <MapPin className="h-4 w-4" />
            <span>{location}</span>
          </div>
          <div className="flex items-center gap-2 text-white/90 text-sm mt-0.5">
            <Briefcase className="h-4 w-4" />
            <span>{occupation}</span>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="p-4 space-y-4 max-h-64 overflow-y-auto">
        {/* Bio */}
        <div>
          <p className="text-sm text-foreground leading-relaxed">{bio}</p>
        </div>

        {/* Looking For */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Looking for</p>
          <div className="flex flex-wrap gap-1.5">
            {lookingFor.length > 0 
              ? lookingFor.map(item => (
                  <Badge key={item} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))
              : <p className="text-sm text-muted-foreground">Not specified</p>
            }
          </div>
        </div>

        {/* Interests */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Interests</p>
          <div className="flex flex-wrap gap-1.5">
            {interests.slice(0, 6).map((interest) => (
              <Badge
                key={interest}
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-0"
              >
                {interest}
              </Badge>
            ))}
            {interests.length > 6 && (
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-muted text-muted-foreground border-0"
              >
                +{interests.length - 6}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

