"use client"

import React from "react"

import { useState, useEffect } from "react"
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
import { ProtectedRoute } from "@/components/protected-route"
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
  return (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  )
}

function ProfilePage() {
  const { user, profile, setUser, setProfile } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPhotoManager, setShowPhotoManager] = useState(false)
  const [photos, setPhotos] = useState<string[]>(user?.photos || [])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
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
  const loadProfile = async () => {
    try {
      setIsLoadingProfile(true)
      
      // Get token from localStorage
      const authData = JSON.parse(localStorage.getItem("spark-auth") || "{}")
      const token = authData?.state?.token
      
      if (!token) {
        console.error('No auth token found')
        setIsLoadingProfile(false)
        return
      }
      
      const response = await fetch('http://localhost:5001/api/users/profile', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Profile data loaded:', data)
        setUser(data.user)
        setProfile(data.profile)
        if (data.user?.photos) {
          setPhotos(data.user.photos)
        }
      } else {
        console.error('Failed to load profile:', response.status)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  // Load profile data on mount
  useEffect(() => {
    loadProfile()
  }, [setUser, setProfile])

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
  
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    bio: profile?.bio || "",
    occupation: profile?.occupation || "",
    education: profile?.education || "",
    district_number: "5",
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
  })

  // Update formData when user/profile data loads
  useEffect(() => {
    if (user || profile) {
      setFormData({
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        bio: profile?.bio || "",
        occupation: profile?.occupation || "",
        education: profile?.education || "",
        district_number: "5",
        location_city: profile?.location_city || "",
        location_state: profile?.location_state || "",
        interests: profile?.interests || [],
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
      })
    }
  }, [user, profile])

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
    try {
      const dataToSave = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        bio: formData.bio,
        occupation: formData.occupation,
        education: formData.education,
        location_city: formData.location_city,
        location_state: formData.location_state,
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
      }

      console.log('[PROFILE] Saving profile with data:', dataToSave)
      const result = await api.users.updateProfile(dataToSave)
      
      if (result.error) {
        console.error('[PROFILE] Save error:', result.error)
        alert('Failed to save profile: ' + result.error)
      } else {
        console.log('[PROFILE] Profile saved successfully:', result.data)
        // Reload profile to ensure we have latest data
        await loadProfile()
        // Reset custom input states
        setCustomMusic('')
        setCustomAnimal('')
        setCustomPetPeeve('')
        setIsEditing(false)
      }
    } catch (error) {
      console.error('[PROFILE] Save exception:', error)
      alert('An error occurred while saving your profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
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

  // Photo management functions
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
  }

  const handleDeletePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  const handleAddPhoto = () => {
    // Create a hidden file input element
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const files = target.files
      if (!files || files.length === 0) return

      const file = files[0]
      if (!file.type.startsWith('image/')) {
        setUploadError('Please upload an image file')
        return
      }

      if (photos.length >= 10) {
        setUploadError('Maximum 10 photos allowed')
        return
      }

      setPhotoUploading(true)
      setUploadError(null)

      const formData = new FormData()
      formData.append('photo', file)

      const result = await api.users.uploadPhoto(formData)
      
      if (result.error) {
        setUploadError(result.error)
      } else if (result.data) {
        setPhotos([...photos, result.data.url])
      }

      setPhotoUploading(false)
    }
    // Trigger the file picker
    fileInput.click()
  }

  const age = calculateAge()
  const visiblePhotos = photos.slice(0, 6)
  const remainingCount = photos.length - 5

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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading profile...</span>
          </div>
        )}

        {!isLoadingProfile && (
          <>
            {/* Profile Incomplete Warning */}
            {!user?.onboarding_completed && (
              <div className="mb-6 flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium">Complete Your Profile</p>
                  <p className="text-sm text-amber-700">
                    Add more details to your profile to increase your visibility and get more matches.
                  </p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your dating profile
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)} className="bg-transparent">
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
                <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="bg-transparent">
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
                    onClick={() => setShowPhotoManager(true)}
                    className="absolute bottom-2 right-2 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Profile Info */}
              <div className="flex-1 space-y-3">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  {formData.first_name} {formData.last_name}, {age}
                </h2>
                
                <div className="flex flex-col gap-2">
                  {/* District Number */}
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">District #</span>
                      <Input
                        value={formData.district_number}
                        onChange={(e) => setFormData({ ...formData, district_number: e.target.value })}
                        className="w-20 h-8"
                        placeholder="e.g. 5"
                      />
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-foreground font-medium">
                      <span className="text-primary">District #{formData.district_number}</span>
                    </span>
                  )}
                  
                  {/* Location */}
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={formData.location_state}
                        onChange={(e) => setFormData({ ...formData, location_state: e.target.value })}
                        className="w-48 h-8"
                        placeholder="State"
                      />
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {formData.location_state}
                    </span>
                  )}
                  
                  {/* Occupation (Optional) */}
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={formData.occupation}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        className="w-48 h-8"
                        placeholder="Occupation (optional)"
                      />
                    </div>
                  ) : formData.occupation ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      {formData.occupation}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
            <div className="grid grid-cols-3 gap-2">
              {visiblePhotos.map((photo, index) => (
                <div
                  key={index}
                  className={cn(
                    "relative aspect-[4/5] rounded-lg overflow-hidden cursor-pointer group",
                    index === 5 && remainingCount > 0 && "relative"
                  )}
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
                </div>
              ))}
            </div>
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
                  <SelectTrigger className="w-full">
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
                      <p className="text-xs font-medium text-foreground">Your Interests ({formData.interests.length}/10)</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.interests.map((interest) => (
                          <Badge
                            key={interest}
                            variant="default"
                            className="cursor-pointer transition-all hover:scale-105 pr-1"
                          >
                            {interest}
                            <button
                              onClick={() => toggleInterest(interest)}
                              className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Interest Input */}
                  {formData.interests.length < 10 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Add Custom Interest</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type an interest and press Enter"
                          value={customInterest}
                          onChange={(e) => setCustomInterest(e.target.value)}
                          onKeyPress={handleCustomInterestKeyPress}
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
                    <p className="text-xs font-medium text-foreground">Suggested Interests</p>
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
                  <SelectTrigger className="w-full">
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
                  placeholder="What should someone mention when they message you?"
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <p className="text-foreground">{formData.prompt_message_if || "Not answered yet"}</p>
              )}
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
              <p className="text-sm text-muted-foreground">
                Drag photos to rearrange. Your first photo will be your main profile picture.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "relative aspect-[4/5] rounded-lg overflow-hidden group cursor-grab active:cursor-grabbing border-2",
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
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-5 w-5 text-white drop-shadow-lg" />
                    </div>
                    <button
                      onClick={() => handleDeletePhoto(index)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded font-medium">
                        Main
                      </div>
                    )}
                  </div>
                ))}
                {photos.length < 10 && (
                  <button
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
              {uploadError && (
                <div className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {uploadError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowPhotoManager(false)} className="bg-transparent">
                  Cancel
                </Button>
                <Button onClick={() => setShowPhotoManager(false)}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Profile Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
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
  age: number
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
        <span className="text-sm font-medium text-muted-foreground">Profile Preview</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2">
          <X className="h-4 w-4" />
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
                key={index}
                onClick={() => setCurrentPhotoIndex(index)}
                className={cn(
                  "h-1 rounded-full transition-all",
                  index === currentPhotoIndex
                    ? "bg-white w-6"
                    : "bg-white/50 w-4 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        )}

        {/* Photo navigation arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Name and basic info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="text-2xl font-bold">
            {name}, {age}
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

