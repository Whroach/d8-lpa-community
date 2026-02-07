"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, ArrowLeft, ArrowRight, Loader2, Check, Upload, Trash2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthStore } from "@/lib/store/auth-store"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
const TOTAL_STEPS = 3

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
]

const DISTRICT_OPTIONS = Array.from({ length: 14 }, (_, i) => ({
  value: `district_${i + 1}`,
  label: `District ${i + 1}`,
}))

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

const INTEREST_OPTIONS = [
  "Sports", "Gaming", "Reading", "Travel", "Cooking", "Movies", "Music", "Photography",
  "Art", "Fitness", "Yoga", "Dancing", "Hiking", "Pets", "Technology", "Fashion"
]

const LOOKING_FOR_OPTIONS = [
  "Serious relationship",
  "Casual dating",
  "Friendship",
  "Networking",
  "Not sure yet"
]

const LIFE_GOALS_OPTIONS = [
  "Building a family",
  "Career focused",
  "Adventure and travel",
  "Personal growth",
  "Making a difference",
  "Financial independence",
  "Creative pursuits"
]

const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Hindi",
  "Russian"
]

const RELIGION_OPTIONS = [
  "Christianity",
  "Catholicism",
  "Islam",
  "Judaism",
  "Hinduism",
  "Buddhism",
  "Sikhism",
  "Atheist",
  "Agnostic",
  "Spiritual but not religious",
  "Prefer not to say",
  "Other"
]

const FAVORITE_MUSIC_OPTIONS = [
  "Pop", "Rock", "Hip-Hop", "Jazz", "Classical", "Country", "R&B", "Electronic",
  "Indie", "Alternative", "Metal", "Reggae", "Latin", "Soul", "Folk", "K-pop"
]

const ANIMALS_OPTIONS = [
  "Dogs", "Cats", "Birds", "Fish", "Rabbits", "Hamsters", "Reptiles", "Guinea Pigs",
  "Horses", "Ferrets", "Spiders", "Snakes", "Turtles", "Goats", "Chickens", "Ferrets"
]

const PET_PEEVES_OPTIONS = [
  "Loud noises", "Messiness", "Interrupting", "Poor manners", "Dishonesty", "Negativity",
  "Being late", "Loudness", "Rudeness", "Impatience", "Overconfidence", "Neediness",
  "Excessive talking", "Poor hygiene", "Pessimism", "Attention seeking"
]

interface OnboardingData {
  // Page 1 - Required (Personal Information)
  first_name: string
  last_name: string
  birthdate: string
  gender: string
  location_state: string
  location_city: string
  district_number: string
  lpa_membership_id: string
  agreed_to_guidelines: boolean
  // Page 2 - LPA Related (Optional)
  // Removed: district_number, membership_duration, lpa_positions (not in My Profile)
  // Page 3 - What You're Looking For (Optional)
  looking_for: string[]
  // Page 4 - Profile Setup (Optional)
  bio: string
  interests: string[]
  custom_interest: string
  custom_music: string
  custom_animal: string
  custom_peeve: string
  photos: string[]
  looking_for_description: string
  life_goals: string
  languages: string[]
  cultural_background: string
  religion: string
  personal_preferences: string
  occupation: string
  education: string
  favorite_music: string[]
  animals: string[]
  pet_peeves: string[]
  // Page 5 - Get to Know Me (Optional)
  // Removed: profile_visible, only_show_to_liked (not in My Profile)
  prompt_good_at: string
  prompt_perfect_weekend: string
  prompt_message_if: string
  // Open-ended questions
  hoping_to_find: string
  great_day: string
  relationship_values: string
  show_affection: string
  build_with_person: string
}

const initialOnboardingData: OnboardingData = {
  first_name: "",
  last_name: "",
  birthdate: "",
  gender: "",
  location_state: "",
  location_city: "",
  district_number: "",
  lpa_membership_id: "",
  agreed_to_guidelines: false,
  looking_for: [],
  bio: "",
  interests: [],
  custom_interest: "",
  custom_music: "",
  custom_animal: "",
  custom_peeve: "",
  photos: [],
  looking_for_description: "",
  life_goals: "",
  languages: [],
  cultural_background: "",
  religion: "",
  personal_preferences: "",
  occupation: "",
  education: "",
  favorite_music: [],
  animals: [],
  pet_peeves: [],
  prompt_good_at: "",
  prompt_perfect_weekend: "",
  prompt_message_if: "",
  hoping_to_find: "",
  great_day: "",
  relationship_values: "",
  show_affection: "",
  build_with_person: "",
}

export default function OnboardingPage() {
  const router = useRouter()
  const { setLoading, isLoading, error, setError } = useAuthStore()

  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(initialOnboardingData)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showGuidelines, setShowGuidelines] = useState(false)
  const [page1Completed, setPage1Completed] = useState(false)

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }

  const calculateAge = (birthdate: string): number => {
    const today = new Date()
    const birth = new Date(birthdate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const isPage1Valid = () => {
    if (!data.first_name || !data.last_name || !data.birthdate || !data.gender) {
      return false
    }
    if (!data.location_state) return false
    if (!data.district_number) return false
    if (!data.lpa_membership_id) return false
    if (!data.agreed_to_guidelines) return false
    const age = calculateAge(data.birthdate)
    return age >= 18
  }

  const canProceed = () => {
    if (currentStep === 1) return isPage1Valid()
    return true // All other steps are optional
  }

  const handleNext = () => {
    if (currentStep === 1 && isPage1Valid()) {
      setPage1Completed(true)
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkipToProfile = async () => {
    if (!page1Completed && !isPage1Valid()) {
      setError("Please complete the required personal information first")
      return
    }
    await handleComplete()
  }

  const handleComplete = async () => {
    setError(null)
    setLoading(true)

    const result = await api.auth.completeOnboarding(data)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push("/profile")
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file")
      return
    }

    if (data.photos.length >= 1) {
      setError("Only 1 profile photo allowed")
      return
    }

    setPhotoUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append("photo", file)

    const result = await api.users.uploadPhoto(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      updateData({ photos: [...data.photos, result.data.url] })
    }

    setPhotoUploading(false)
    e.target.value = ""
  }

  const handleRemovePhoto = () => {
    updateData({ photos: [] })
  }

  const toggleInterest = (interest: string) => {
    const interests = data.interests.includes(interest)
      ? data.interests.filter((i) => i !== interest)
      : [...data.interests, interest]
    updateData({ interests })
  }

  const toggleMusic = (music: string) => {
    const favorite_music = data.favorite_music.includes(music)
      ? data.favorite_music.filter((m) => m !== music)
      : [...data.favorite_music, music]
    updateData({ favorite_music })
  }

  const toggleAnimals = (animal: string) => {
    const animals = data.animals.includes(animal)
      ? data.animals.filter((a) => a !== animal)
      : [...data.animals, animal]
    updateData({ animals })
  }

  const togglePetPeeves = (peeve: string) => {
    const pet_peeves = data.pet_peeves.includes(peeve)
      ? data.pet_peeves.filter((p) => p !== peeve)
      : [...data.pet_peeves, peeve]
    updateData({ pet_peeves })
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return { title: "Personal Info", subtitle: "Required information to create your account", required: true }
      case 2:
        return { title: "Profile Setup", subtitle: "Tell others about yourself", required: false }
      case 3:
        return { title: "Get to Know Me", subtitle: "Answer a few fun prompts about yourself", required: false }
      default:
        return { title: "", subtitle: "", required: false }
    }
  }

  const stepInfo = getStepTitle()

  const handleSkipToDashboard = async () => {
    setLoading(true)
    try {
      // Mark onboarding as completed without filling in all details
      await api.auth.completeOnboarding(data)
      router.push('/profile')
    } catch (error) {
      console.error('Error completing onboarding:', error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary fill-primary" />
            <span className="text-xl font-bold text-foreground">D8-LPA</span>
          </div>
          {page1Completed && (
            <button
              onClick={handleSkipToProfile}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Skip to Profile
            </button>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round((currentStep / TOTAL_STEPS) * 100)}% complete
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        {/* Step indicators */}
        <div className="flex justify-between mt-2">
          {[
            "Personal Info",
            "Profile Setup",
            "Get to Know Me"
          ].map((label, i) => (
            <div
              key={i}
              className={cn(
                "text-xs text-center",
                i + 1 === currentStep ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-6 md:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-foreground">{stepInfo.title}</h2>
              {stepInfo.required ? (
                <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">Required</span>
              ) : (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
              )}
            </div>
            <p className="text-muted-foreground">{stepInfo.subtitle}</p>
          </div>

          {/* Step 1: Personal Info (Required) */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="first_name"
                    placeholder="John"
                    value={data.first_name}
                    onChange={(e) => updateData({ first_name: e.target.value })}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    value={data.last_name}
                    onChange={(e) => updateData({ last_name: e.target.value })}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthdate">Birthday <span className="text-destructive">*</span></Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={data.birthdate}
                  onChange={(e) => updateData({ birthdate: e.target.value })}
                  className="h-12"
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                />
                {data.birthdate && calculateAge(data.birthdate) < 18 && (
                  <p className="text-sm text-destructive">You must be at least 18 years old</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Gender <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateData({ gender: option.value })}
                      className={cn(
                        "p-3 rounded-lg border-2 text-center transition-all text-sm",
                        data.gender === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>State <span className="text-destructive">*</span></Label>
                <Select
                  value={data.location_state}
                  onValueChange={(value) => updateData({ location_state: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>District Number <span className="text-destructive">*</span></Label>
                <Select
                  value={data.district_number}
                  onValueChange={(value) => updateData({ district_number: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your district" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTRICT_OPTIONS.map((district) => (
                      <SelectItem key={district.value} value={district.value}>
                        {district.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lpa_id">LPA Membership ID <span className="text-destructive">*</span></Label>
                <Input
                  id="lpa_id"
                  placeholder="Enter your LPA membership ID"
                  value={data.lpa_membership_id}
                  onChange={(e) => updateData({ lpa_membership_id: e.target.value })}
                  className="h-12"
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="guidelines"
                    checked={data.agreed_to_guidelines}
                    onCheckedChange={(checked) => updateData({ agreed_to_guidelines: checked as boolean })}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="guidelines" className="cursor-pointer">
                      I agree to the Community Guidelines <span className="text-destructive">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowGuidelines(true)}
                      className="text-sm text-primary hover:underline block"
                    >
                      Read Community Guidelines
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Profile Setup (Optional) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">Short bio about yourself</Label>
                  <span className="text-sm text-muted-foreground">
                    {data.bio.length}/300
                  </span>
                </div>
                <Textarea
                  id="bio"
                  placeholder="Tell others a bit about yourself..."
                  value={data.bio}
                  onChange={(e) => updateData({ bio: e.target.value.slice(0, 300) })}
                  className="min-h-[120px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Pick a few interests/hobbies</Label>
                {data.interests.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg mb-3">
                    <p className="text-sm font-medium text-foreground mb-2">Selected ({data.interests.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {data.interests.map((interest) => (
                        <button
                          key={interest}
                          onClick={() => toggleInterest(interest)}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-all"
                        >
                          {interest}
                          <span className="text-xs">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm transition-all",
                        data.interests.includes(interest)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Add custom interest..."
                    value={data.custom_interest}
                    onChange={(e) => updateData({ custom_interest: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && data.custom_interest.trim()) {
                        e.preventDefault()
                        const newInterest = data.custom_interest.trim()
                        if (!data.interests.includes(newInterest)) {
                          updateData({ interests: [...data.interests, newInterest], custom_interest: '' })
                        } else {
                          updateData({ custom_interest: '' })
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (data.custom_interest.trim()) {
                        const newInterest = data.custom_interest.trim()
                        if (!data.interests.includes(newInterest)) {
                          updateData({ interests: [...data.interests, newInterest], custom_interest: '' })
                        } else {
                          updateData({ custom_interest: '' })
                        }
                      }
                    }}
                    disabled={!data.custom_interest.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Looking For (Gender)</Label>
                <p className="text-sm text-muted-foreground mb-2">Select all that apply</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "female", label: "Women" },
                    { value: "male", label: "Men" },
                    { value: "non-binary", label: "Non-binary" },
                    { value: "everyone", label: "Everyone" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        const current = data.looking_for || []
                        let next: string[] = []

                        if (option.value === "everyone") {
                          next = current.includes("everyone") ? [] : ["everyone"]
                        } else {
                          const withoutEveryone = current.filter((v) => v !== "everyone")
                          if (withoutEveryone.includes(option.value)) {
                            next = withoutEveryone.filter((v) => v !== option.value)
                          } else {
                            next = [...withoutEveryone, option.value]
                          }
                        }
                        updateData({ looking_for: next })
                      }}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm transition-all",
                        data.looking_for.includes(option.value)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>What I'm Looking For</Label>
                <Select
                  value={data.looking_for_description}
                  onValueChange={(value) => updateData({ looking_for_description: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select what you're looking for..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LOOKING_FOR_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Life Goals</Label>
                <Select
                  value={data.life_goals}
                  onValueChange={(value) => updateData({ life_goals: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your life goals..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LIFE_GOALS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Languages</Label>
                <p className="text-sm text-muted-foreground mb-2">Select all languages you speak</p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => {
                        const newLanguages = data.languages.includes(language)
                          ? data.languages.filter((l) => l !== language)
                          : [...data.languages, language]
                        updateData({ languages: newLanguages })
                      }}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm transition-all",
                        data.languages.includes(language)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cultural_background">Cultural Background</Label>
                <Input
                  id="cultural_background"
                  placeholder="e.g., Italian-American, South Asian, etc."
                  value={data.cultural_background}
                  onChange={(e) => updateData({ cultural_background: e.target.value })}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Religion</Label>
                <Select
                  value={data.religion}
                  onValueChange={(value) => updateData({ religion: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your religion..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RELIGION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <Input
                  id="occupation"
                  placeholder="e.g., Software Engineer, Teacher, Graphic Designer..."
                  value={data.occupation}
                  onChange={(e) => updateData({ occupation: e.target.value })}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="education">Education</Label>
                <Input
                  id="education"
                  placeholder="e.g., Bachelor's in Computer Science, High School..."
                  value={data.education}
                  onChange={(e) => updateData({ education: e.target.value })}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="personal_preferences">Personal Preferences</Label>
                  <span className="text-sm text-muted-foreground">
                    {data.personal_preferences.length}/500
                  </span>
                </div>
                <Textarea
                  id="personal_preferences"
                  placeholder="What are you looking for in a partner? (e.g., sense of humor, shared values, adventure seeker...)"
                  value={data.personal_preferences}
                  onChange={(e) => updateData({ personal_preferences: e.target.value.slice(0, 500) })}
                  className="min-h-[120px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Favorite Music</Label>
                {data.favorite_music.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg mb-3">
                    <p className="text-sm font-medium text-foreground mb-2">Selected ({data.favorite_music.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {data.favorite_music.map((music) => (
                        <button
                          key={music}
                          onClick={() => toggleMusic(music)}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-all"
                        >
                          {music}
                          <span className="text-xs">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {FAVORITE_MUSIC_OPTIONS.map((music) => (
                    <button
                      key={music}
                      type="button"
                      onClick={() => toggleMusic(music)}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm transition-all",
                        data.favorite_music.includes(music)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {music}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Add custom music genre..."
                    value={data.custom_music}
                    onChange={(e) => updateData({ custom_music: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && data.custom_music.trim()) {
                        e.preventDefault()
                        const newMusic = data.custom_music.trim()
                        if (!data.favorite_music.includes(newMusic)) {
                          updateData({ favorite_music: [...data.favorite_music, newMusic], custom_music: '' })
                        } else {
                          updateData({ custom_music: '' })
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (data.custom_music.trim()) {
                        const newMusic = data.custom_music.trim()
                        if (!data.favorite_music.includes(newMusic)) {
                          updateData({ favorite_music: [...data.favorite_music, newMusic], custom_music: '' })
                        } else {
                          updateData({ custom_music: '' })
                        }
                      }
                    }}
                    disabled={!data.custom_music.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Favorite Animals</Label>
                {data.animals.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg mb-3">
                    <p className="text-sm font-medium text-foreground mb-2">Selected ({data.animals.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {data.animals.map((animal) => (
                        <button
                          key={animal}
                          onClick={() => toggleAnimals(animal)}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-all"
                        >
                          {animal}
                          <span className="text-xs">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {ANIMALS_OPTIONS.map((animal) => (
                    <button
                      key={animal}
                      type="button"
                      onClick={() => toggleAnimals(animal)}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm transition-all",
                        data.animals.includes(animal)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {animal}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Add custom animal..."
                    value={data.custom_animal}
                    onChange={(e) => updateData({ custom_animal: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && data.custom_animal.trim()) {
                        e.preventDefault()
                        const newAnimal = data.custom_animal.trim()
                        if (!data.animals.includes(newAnimal)) {
                          updateData({ animals: [...data.animals, newAnimal], custom_animal: '' })
                        } else {
                          updateData({ custom_animal: '' })
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (data.custom_animal.trim()) {
                        const newAnimal = data.custom_animal.trim()
                        if (!data.animals.includes(newAnimal)) {
                          updateData({ animals: [...data.animals, newAnimal], custom_animal: '' })
                        } else {
                          updateData({ custom_animal: '' })
                        }
                      }
                    }}
                    disabled={!data.custom_animal.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pet Peeves</Label>
                {data.pet_peeves.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg mb-3">
                    <p className="text-sm font-medium text-foreground mb-2">Selected ({data.pet_peeves.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {data.pet_peeves.map((peeve) => (
                        <button
                          key={peeve}
                          onClick={() => togglePetPeeves(peeve)}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-all"
                        >
                          {peeve}
                          <span className="text-xs">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {PET_PEEVES_OPTIONS.map((peeve) => (
                    <button
                      key={peeve}
                      type="button"
                      onClick={() => togglePetPeeves(peeve)}
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm transition-all",
                        data.pet_peeves.includes(peeve)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {peeve}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Add custom pet peeve..."
                    value={data.custom_peeve}
                    onChange={(e) => updateData({ custom_peeve: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && data.custom_peeve.trim()) {
                        e.preventDefault()
                        const newPeeve = data.custom_peeve.trim()
                        if (!data.pet_peeves.includes(newPeeve)) {
                          updateData({ pet_peeves: [...data.pet_peeves, newPeeve], custom_peeve: '' })
                        } else {
                          updateData({ custom_peeve: '' })
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (data.custom_peeve.trim()) {
                        const newPeeve = data.custom_peeve.trim()
                        if (!data.pet_peeves.includes(newPeeve)) {
                          updateData({ pet_peeves: [...data.pet_peeves, newPeeve], custom_peeve: '' })
                        } else {
                          updateData({ custom_peeve: '' })
                        }
                      }
                    }}
                    disabled={!data.custom_peeve.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Profile Picture</Label>
                <p className="text-sm text-muted-foreground">
                  Note: If you do not upload a profile picture, your profile will be restricted to view only and will not be visible to others.
                </p>
                <div className="mt-4">
                  {data.photos.length === 0 ? (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={photoUploading}
                      />
                      {photoUploading ? (
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload profile picture</p>
                        </>
                      )}
                    </label>
                  ) : (
                    <div className="relative w-48 h-48 mx-auto">
                      <img
                        src={data.photos[0] || "/placeholder.svg"}
                        alt="Profile"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Get to Know Me (Optional) */}
          {currentStep === 3 && (
            <div className="space-y-6 pt-6 border-t border-border mt-6">
              <h3 className="text-lg font-semibold text-foreground">Get to Know Me</h3>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="prompt_good_at">I&apos;m weirdly good at...</Label>
                  <span className="text-xs text-muted-foreground">{data.prompt_good_at.length}/500</span>
                </div>
                <Textarea
                  id="prompt_good_at"
                  placeholder="e.g., Remembering song lyrics from the 90s"
                  value={data.prompt_good_at}
                  onChange={(e) => updateData({ prompt_good_at: e.target.value.slice(0, 500) })}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="prompt_weekend">A perfect weekend looks like...</Label>
                  <span className="text-xs text-muted-foreground">{data.prompt_perfect_weekend.length}/500</span>
                </div>
                <Textarea
                  id="prompt_weekend"
                  placeholder="e.g., Morning coffee, afternoon hike, evening movie marathon"
                  value={data.prompt_perfect_weekend}
                  onChange={(e) => updateData({ prompt_perfect_weekend: e.target.value.slice(0, 500) })}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="prompt_message">You should message me if...</Label>
                  <span className="text-xs text-muted-foreground">{data.prompt_message_if.length}/500</span>
                </div>
                <Textarea
                  id="prompt_message"
                  placeholder="e.g., You want to debate the best pizza toppings"
                  value={data.prompt_message_if}
                  onChange={(e) => updateData({ prompt_message_if: e.target.value.slice(0, 500) })}
                  className="min-h-[80px] resize-none"
                />
              </div>

              {/* New Open-Ended Questions */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="hoping_to_find">My ideal type of connection is...</Label>
                    <span className="text-xs text-muted-foreground">{data.hoping_to_find.length}/500</span>
                  </div>
                  <Textarea
                    id="hoping_to_find"
                    placeholder="e.g., Someone who loves spontaneous road trips and deep conversations"
                    value={data.hoping_to_find}
                    onChange={(e) => updateData({ hoping_to_find: e.target.value.slice(0, 500) })}
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="great_day">A great day for me includes...</Label>
                    <span className="text-xs text-muted-foreground">{data.great_day.length}/500</span>
                  </div>
                  <Textarea
                    id="great_day"
                    placeholder="e.g., Good food, laughter, and quality time with someone special"
                    value={data.great_day}
                    onChange={(e) => updateData({ great_day: e.target.value.slice(0, 500) })}
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="relationship_values">In a relationship, I value...</Label>
                    <span className="text-xs text-muted-foreground">{data.relationship_values.length}/500</span>
                  </div>
                  <Textarea
                    id="relationship_values"
                    placeholder="e.g., Honesty, humor, and supporting each other's dreams"
                    value={data.relationship_values}
                    onChange={(e) => updateData({ relationship_values: e.target.value.slice(0, 500) })}
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="show_affection">I show I care by...</Label>
                    <span className="text-xs text-muted-foreground">{data.show_affection.length}/500</span>
                  </div>
                  <Textarea
                    id="show_affection"
                    placeholder="e.g., Thoughtful messages, acts of service, and quality time"
                    value={data.show_affection}
                    onChange={(e) => updateData({ show_affection: e.target.value.slice(0, 500) })}
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="build_with_person">My vision for the future is...</Label>
                    <span className="text-xs text-muted-foreground">{data.build_with_person.length}/500</span>
                  </div>
                  <Textarea
                    id="build_with_person"
                    placeholder="e.g., A life full of adventure, growth, and meaningful moments together"
                    value={data.build_with_person}
                    onChange={(e) => updateData({ build_with_person: e.target.value.slice(0, 500) })}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex gap-3">
              {currentStep > 1 && page1Completed && (
                <Button
                  variant="outline"
                  onClick={handleSkipToDashboard}
                  disabled={isLoading}
                >
                  Skip All
                </Button>
              )}

              {currentStep < TOTAL_STEPS ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="gap-2"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Community Guidelines Dialog */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>D8-LPA Community Guidelines</DialogTitle>
            <DialogDescription>
              Please read and agree to our community guidelines
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground mb-2">1. Respect & Kindness</h3>
              <p>Treat all members with respect and kindness. Harassment, bullying, hate speech, or discrimination of any kind will not be tolerated.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-2">2. Authentic Profiles</h3>
              <p>Use real, recent photos of yourself. Impersonation or catfishing is strictly prohibited. Your profile should accurately represent who you are.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-2">3. Privacy & Safety</h3>
              <p>Protect your personal information and respect others&apos; privacy. Do not share others&apos; personal information without consent.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-2">4. Appropriate Content</h3>
              <p>Keep all content appropriate and respectful. Explicit, offensive, or inappropriate content is not allowed.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-2">5. LPA Community Values</h3>
              <p>As a platform for the LPA community, we expect all members to uphold the values of our community and support fellow members.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-2">6. Reporting</h3>
              <p>If you encounter any violations of these guidelines, please report them immediately. We take all reports seriously.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-2">7. Consequences</h3>
              <p>Violations of these guidelines may result in warnings, temporary suspension, or permanent removal from the platform.</p>
            </section>
          </div>
          <div className="pt-4">
            <Button onClick={() => setShowGuidelines(false)} className="w-full">
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
