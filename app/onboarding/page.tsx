"use client"

import React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, ArrowLeft, ArrowRight, Loader2, Check, Upload, Trash2, AlertCircle, Plus } from "lucide-react"
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
const STEP_LABELS = ["Personal Info", "Profile Setup", "Get to Know Me"]
const DRAFT_KEY = "d8-lpa-onboarding-draft"
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

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

const LOOKING_FOR_GENDER_OPTIONS = [
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
  { value: "non_binary", label: "Non-binary" },
  { value: "everyone", label: "Everyone" },
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
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Russian"
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

// ("Ferrets" used to be listed twice.)
const ANIMALS_OPTIONS = [
  "Dogs", "Cats", "Birds", "Fish", "Rabbits", "Hamsters", "Reptiles", "Guinea Pigs",
  "Horses", "Ferrets", "Spiders", "Snakes", "Turtles", "Goats", "Chickens"
]

const PET_PEEVES_OPTIONS = [
  "Loud noises", "Messiness", "Interrupting", "Poor manners", "Dishonesty", "Negativity",
  "Being late", "Loudness", "Rudeness", "Impatience", "Overconfidence", "Neediness",
  "Excessive talking", "Poor hygiene", "Pessimism", "Attention seeking"
]

interface OnboardingData {
  // Step 1 - required
  first_name: string
  last_name: string
  birthdate: string
  gender: string
  location_state: string
  location_city: string
  district_number: string
  agreed_to_guidelines: boolean
  // Step 2 - optional
  bio: string
  occupation: string
  education: string
  interests: string[]
  favorite_music: string[]
  animals: string[]
  pet_peeves: string[]
  looking_for: string[]
  looking_for_description: string
  age_preference_min: string
  age_preference_max: string
  personal_preferences: string
  languages: string[]
  cultural_background: string
  religion: string
  life_goals: string
  // Step 3 - optional
  prompt_good_at: string
  prompt_perfect_weekend: string
  prompt_message_if: string
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
  agreed_to_guidelines: false,
  bio: "",
  occupation: "",
  education: "",
  interests: [],
  favorite_music: [],
  animals: [],
  pet_peeves: [],
  looking_for: [],
  looking_for_description: "",
  age_preference_min: "18",
  age_preference_max: "100",
  personal_preferences: "",
  languages: [],
  cultural_background: "",
  religion: "",
  life_goals: "",
  prompt_good_at: "",
  prompt_perfect_weekend: "",
  prompt_message_if: "",
  hoping_to_find: "",
  great_day: "",
  relationship_values: "",
  show_affection: "",
  build_with_person: "",
}

type Step1Field = "first_name" | "last_name" | "birthdate" | "gender" | "location_state" | "district_number" | "agreed_to_guidelines"

/**
 * Age from a "YYYY-MM-DD" date of birth, counted on the calendar. (The text
 * is deliberately not handed to `new Date()`, which reads it as midnight UTC -
 * the previous evening in the United States - and so got birthdays wrong by a
 * day.)
 */
function ageFrom(birthdate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1
  return age
}

function latestAdultBirthdate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear() - 18}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const clampAge = (value: string, fallback: number) => {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(120, Math.max(18, n))
}

/** A row of large toggle buttons. Each says whether it is chosen (aria-pressed) and shows a tick, not just a colour. */
function ChipGroup({
  legend,
  hint,
  options,
  selected,
  onToggle,
  children,
}: {
  legend: string
  hint?: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  children?: React.ReactNode
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-medium text-foreground">{legend}</legend>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isOn = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isOn}
              onClick={() => onToggle(option.value)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-base transition-colors",
                isOn
                  ? "border-primary bg-primary text-primary-foreground font-medium"
                  : "border-border bg-background text-foreground hover:border-primary/60"
              )}
            >
              {isOn && <Check className="h-4 w-4" aria-hidden="true" />}
              {option.label}
            </button>
          )
        })}
      </div>
      {children}
    </fieldset>
  )
}

/** "Add your own" box under a chip group. */
function AddYourOwn({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("")
  const add = () => {
    const clean = value.trim().slice(0, 40)
    if (!clean) return
    onAdd(clean)
    setValue("")
  }
  return (
    <div className="flex gap-2">
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        maxLength={40}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            add()
          }
        }}
        className="h-11"
      />
      <Button type="button" variant="secondary" className="h-11 gap-1" onClick={add} disabled={!value.trim()} aria-label={`${label} - add`}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add
      </Button>
    </div>
  )
}

function LongAnswer({
  id,
  label,
  placeholder,
  value,
  onChange,
  max,
  tall,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  max: number
  tall?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <Label htmlFor={id} className="text-base">{label}</Label>
        <span id={`${id}-count`} className="shrink-0 text-sm text-muted-foreground">
          {value.length}/{max}<span className="sr-only"> characters used</span>
        </span>
      </div>
      <Textarea
        id={id}
        placeholder={placeholder}
        value={value}
        aria-describedby={`${id}-count`}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        className={cn("resize-none text-base", tall ? "min-h-[120px]" : "min-h-[88px]")}
      />
    </div>
  )
}

const errorId = (field: Step1Field) => `${field}-error`

function FieldError({ field, message }: { field: Step1Field; message?: string }) {
  if (!message) return null
  return (
    <p id={errorId(field)} className="flex items-center gap-1.5 text-sm font-medium text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

const withCustom = (options: string[], selected: string[]) =>
  [...options, ...selected.filter((s) => !options.includes(s))].map((o) => ({ value: o, label: o }))

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

const addTo = (list: string[], value: string) =>
  list.some((v) => v.toLowerCase() === value.toLowerCase()) ? list : [...list, value]

export default function OnboardingPage() {
  const router = useRouter()
  const { setUser, setProfile } = useAuthStore()

  const [ready, setReady] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(initialOnboardingData)
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoStatus, setPhotoStatus] = useState("")
  const [showGuidelines, setShowGuidelines] = useState(false)
  const [showStep1Errors, setShowStep1Errors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }

  // Who is here? Nobody signed in goes to the login screen; someone already
  // set up goes to their profile. Otherwise pick up anything already entered
  // (kept for this browser tab only) and a picture that was already uploaded.
  useEffect(() => {
    let cancelled = false
    const { token, user } = useAuthStore.getState()
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "null")
      if (draft && draft.email === user?.email && draft.data) {
        setData({ ...initialOnboardingData, ...draft.data })
        if (draft.step >= 1 && draft.step <= TOTAL_STEPS) setCurrentStep(draft.step)
      }
    } catch {
      // A damaged draft is simply ignored.
    }
    api.auth.me().then((result) => {
      if (cancelled) return
      const fresh = result.data?.user
      if (fresh?.onboarding_completed) {
        setUser({ ...fresh, id: fresh.id || fresh._id })
        if (result.data?.profile) setProfile(result.data.profile)
        router.replace("/profile")
        return
      }
      const existing = result.data?.profile?.photos?.[0]
      if (existing) setPhoto(existing)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
    // Runs once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      const email = useAuthStore.getState().user?.email
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ email, step: currentStep, data }))
    } catch {
      // Private browsing may refuse storage; the form still works.
    }
  }, [data, currentStep, ready])

  const step1Errors: Partial<Record<Step1Field, string>> = {}
  if (!data.first_name.trim()) step1Errors.first_name = "Please enter your first name"
  if (!data.last_name.trim()) step1Errors.last_name = "Please enter your last name"
  const age = ageFrom(data.birthdate)
  if (!data.birthdate) step1Errors.birthdate = "Please enter your date of birth"
  else if (age === null || age > 120) step1Errors.birthdate = "Please check your date of birth"
  else if (age < 18) step1Errors.birthdate = "You must be at least 18 years old"
  if (!data.gender) step1Errors.gender = "Please choose one"
  if (!data.location_state) step1Errors.location_state = "Please choose your state"
  if (!data.district_number) step1Errors.district_number = "Please choose your district"
  if (!data.agreed_to_guidelines) step1Errors.agreed_to_guidelines = "Please tick the box to agree to the Community Guidelines"
  const step1Valid = Object.keys(step1Errors).length === 0
  const shown = (field: Step1Field) => (showStep1Errors ? step1Errors[field] : undefined)
  // The age rule is shown as soon as a date is typed, not only after "Next".
  const birthdateMessage = shown("birthdate") || (data.birthdate && age !== null && age < 18 ? step1Errors.birthdate : undefined)

  const goToStep = (step: number) => {
    setError(null)
    setCurrentStep(step)
    window.scrollTo({ top: 0 })
    // Move keyboard and screen-reader focus to the new step's heading.
    setTimeout(() => headingRef.current?.focus(), 0)
  }

  const handleNext = () => {
    if (currentStep === 1 && !step1Valid) {
      setShowStep1Errors(true)
      setError("Some required answers are missing. Please look for the messages in red above.")
      const order: Step1Field[] = ["first_name", "last_name", "birthdate", "gender", "location_state", "district_number", "agreed_to_guidelines"]
      const first = order.find((f) => step1Errors[f])
      const target = first === "gender" ? "gender-male" : first === "agreed_to_guidelines" ? "guidelines" : first
      if (target) setTimeout(() => document.getElementById(target)?.focus(), 0)
      return
    }
    if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) goToStep(currentStep - 1)
  }

  // "Complete Setup" and "Skip for now" both save whatever has been entered.
  const handleComplete = async () => {
    if (!step1Valid) {
      setShowStep1Errors(true)
      goToStep(1)
      setError("Please complete the required personal information first")
      return
    }
    setError(null)
    setSaving(true)

    const result = await api.auth.completeOnboarding({
      ...data,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      location_city: data.location_city.trim(),
      age_preference_min: clampAge(data.age_preference_min, 18),
      age_preference_max: clampAge(data.age_preference_max, 100),
    })

    if (result.error || !result.data) {
      setError(result.error || "We could not save your profile just now. Please try again.")
      setSaving(false)
      return
    }

    // Tell the rest of the app that setting up is finished. Without this,
    // someone who had logged in before finishing was sent straight back here.
    const current = useAuthStore.getState().user
    const saved = result.data.user || {}
    setUser({ ...(current || {}), ...saved, id: saved.id || saved._id || current?.id, onboarding_completed: true })
    if (result.data.profile) setProfile(result.data.profile)
    try {
      window.sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // nothing to clear
    }
    router.push("/profile")
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setPhotoStatus("")
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError("That file is not a picture we can use. Please choose a JPG, PNG, WebP or GIF.")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("That picture is too large (over 5 MB). Please choose a smaller one.")
      return
    }

    setPhotoBusy(true)
    setPhotoError(null)

    const formData = new FormData()
    formData.append("photo", file)
    const result = await api.users.uploadPhoto(formData)

    if (result.error || !result.data) {
      setPhotoError(result.error || "We could not upload that picture. Please try again.")
    } else {
      setPhoto(result.data.url)
      setPhotoStatus("Picture added.")
    }
    setPhotoBusy(false)
  }

  // Really deletes the upload from the profile. (This used to clear the
  // preview only, and the picture stayed on the member's profile.)
  const handleRemovePhoto = async () => {
    if (!photo) return
    setPhotoBusy(true)
    setPhotoError(null)
    const result = await api.users.deletePhoto(photo)
    if (result.error) {
      setPhotoError(`The picture was not removed. ${result.error}`)
    } else {
      setPhoto(null)
      setPhotoStatus("Picture removed.")
    }
    setPhotoBusy(false)
  }

  const toggleLookingFor = (value: string) => {
    const current = data.looking_for
    if (value === "everyone") {
      updateData({ looking_for: current.includes("everyone") ? [] : ["everyone"] })
      return
    }
    updateData({ looking_for: toggleIn(current.filter((v) => v !== "everyone"), value) })
  }

  const stepInfo = [
    { title: "Personal Info", subtitle: "A few details we need before you can join in.", required: true },
    { title: "Profile Setup", subtitle: "Tell others about yourself. Everything here is optional - you can add or change it later in My Profile.", required: false },
    { title: "Get to Know Me", subtitle: "Answer as many or as few as you like. These help start conversations.", required: false },
  ][currentStep - 1]

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary fill-primary" aria-hidden="true" />
          <span className="text-xl font-bold text-foreground">D8-LPA</span>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-medium text-foreground">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round((currentStep / TOTAL_STEPS) * 100)}% complete
          </span>
        </div>
        <div
          className="h-2 bg-muted rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Setting up your profile"
          aria-valuemin={0}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={currentStep}
          aria-valuetext={`Step ${currentStep} of ${TOTAL_STEPS}: ${STEP_LABELS[currentStep - 1]}`}
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <ol className="flex justify-between mt-2 gap-2">
          {STEP_LABELS.map((label, i) => (
            <li
              key={label}
              aria-current={i + 1 === currentStep ? "step" : undefined}
              className={cn(
                "text-sm",
                i === 1 && "text-center",
                i === 2 && "text-right",
                i + 1 === currentStep ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {label}
            </li>
          ))}
        </ol>
      </div>

      {/* Form Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-xl p-5 md:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-foreground outline-none">{stepInfo.title}</h1>
              {stepInfo.required ? (
                <span className="text-sm bg-destructive/10 text-destructive px-2 py-1 rounded">Required</span>
              ) : (
                <span className="text-sm bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
              )}
            </div>
            <p className="text-muted-foreground">{stepInfo.subtitle}</p>
          </div>

          {/* Step 1: Personal Info (Required) */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Boxes marked <span className="text-destructive font-semibold">*</span> are needed.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-base">First Name <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <Input
                    id="first_name"
                    autoComplete="given-name"
                    placeholder="e.g. Mary"
                    value={data.first_name}
                    maxLength={50}
                    required
                    aria-invalid={!!shown("first_name")}
                    aria-describedby={shown("first_name") ? errorId("first_name") : undefined}
                    onChange={(e) => updateData({ first_name: e.target.value })}
                    className="h-12"
                  />
                  <FieldError field="first_name" message={shown("first_name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-base">Last Name <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <Input
                    id="last_name"
                    autoComplete="family-name"
                    placeholder="e.g. Johnson"
                    value={data.last_name}
                    maxLength={50}
                    required
                    aria-invalid={!!shown("last_name")}
                    aria-describedby={shown("last_name") ? errorId("last_name") : undefined}
                    onChange={(e) => updateData({ last_name: e.target.value })}
                    className="h-12"
                  />
                  <FieldError field="last_name" message={shown("last_name")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthdate" className="text-base">Birthday <span className="text-destructive" aria-hidden="true">*</span></Label>
                <Input
                  id="birthdate"
                  type="date"
                  autoComplete="bday"
                  value={data.birthdate}
                  required
                  aria-invalid={!!birthdateMessage}
                  aria-describedby={birthdateMessage ? errorId("birthdate") : "birthdate-hint"}
                  onChange={(e) => updateData({ birthdate: e.target.value })}
                  className="h-12"
                  min="1900-01-01"
                  max={latestAdultBirthdate()}
                />
                <p id="birthdate-hint" className="text-sm text-muted-foreground">
                  Type the month, day and year, or use the calendar. Members see your age, not your birthday. You must be 18 or older.
                </p>
                <FieldError field="birthdate" message={birthdateMessage} />
              </div>

              <fieldset className="space-y-2" aria-describedby={shown("gender") ? errorId("gender") : undefined}>
                <legend className="text-base font-medium">Gender <span className="text-destructive" aria-hidden="true">*</span></legend>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {GENDER_OPTIONS.map((option) => {
                    const isOn = data.gender === option.value
                    return (
                      <button
                        key={option.value}
                        id={`gender-${option.value}`}
                        type="button"
                        aria-pressed={isOn}
                        onClick={() => updateData({ gender: option.value })}
                        className={cn(
                          "flex min-h-12 items-center justify-center gap-1.5 rounded-lg border-2 p-3 text-center text-base transition-colors",
                          isOn
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {isOn && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <FieldError field="gender" message={shown("gender")} />
              </fieldset>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location_state" className="text-base">State <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <Select
                    value={data.location_state}
                    onValueChange={(value) => updateData({ location_state: value })}
                  >
                    <SelectTrigger
                      id="location_state"
                      className="h-12 w-full text-base"
                      aria-invalid={!!shown("location_state")}
                      aria-describedby={shown("location_state") ? errorId("location_state") : undefined}
                    >
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
                  <FieldError field="location_state" message={shown("location_state")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location_city" className="text-base">City or town</Label>
                  <Input
                    id="location_city"
                    autoComplete="address-level2"
                    placeholder="e.g. Tulsa (optional)"
                    value={data.location_city}
                    maxLength={80}
                    onChange={(e) => updateData({ location_city: e.target.value })}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="district_number" className="text-base">District Number <span className="text-destructive" aria-hidden="true">*</span></Label>
                <Select
                  value={data.district_number}
                  onValueChange={(value) => updateData({ district_number: value })}
                >
                  <SelectTrigger
                    id="district_number"
                    className="h-12 w-full text-base"
                    aria-invalid={!!shown("district_number")}
                    aria-describedby={shown("district_number") ? errorId("district_number") : "district-hint"}
                  >
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
                <p id="district-hint" className="text-sm text-muted-foreground">Your LPA district. Not sure? Choose the one you usually attend events in.</p>
                <FieldError field="district_number" message={shown("district_number")} />
              </div>

              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="guidelines"
                    className="mt-0.5 h-6 w-6"
                    checked={data.agreed_to_guidelines}
                    aria-invalid={!!shown("agreed_to_guidelines")}
                    aria-describedby={shown("agreed_to_guidelines") ? errorId("agreed_to_guidelines") : undefined}
                    onCheckedChange={(checked) => updateData({ agreed_to_guidelines: checked === true })}
                  />
                  <Label htmlFor="guidelines" className="cursor-pointer text-base leading-snug block">
                    I agree to the Community Guidelines <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                </div>
                <FieldError field="agreed_to_guidelines" message={shown("agreed_to_guidelines")} />
                <button
                  type="button"
                  onClick={() => setShowGuidelines(true)}
                  className="min-h-11 rounded text-base text-primary underline"
                >
                  Read Community Guidelines
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Profile Setup (Optional) */}
          {currentStep === 2 && (
            <div className="space-y-10">
              <section aria-labelledby="sec-photo" className="space-y-5">
                <h2 id="sec-photo" className="text-xl font-semibold text-foreground border-b border-border pb-2">Your photo and introduction</h2>

                <div className="space-y-3">
                  <p id="photo-label" className="text-base font-medium text-foreground">Profile Picture</p>
                  <p className="text-sm text-muted-foreground">
                    A clear, recent photo of you helps people feel comfortable saying hello. JPG, PNG, WebP or GIF, up to 5 MB. You can add or change it later in My Profile.
                  </p>
                  {photo ? (
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
                      <img
                        src={photo}
                        alt="Your profile picture"
                        className="h-48 w-48 rounded-xl object-cover border border-border"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemovePhoto}
                        disabled={photoBusy}
                        className="min-h-11 gap-2 text-destructive hover:text-destructive"
                      >
                        {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                        Remove photo
                      </Button>
                    </div>
                  ) : (
                    <label
                      className={cn(
                        "flex flex-col items-center justify-center w-full min-h-40 border-2 border-dashed border-border rounded-xl cursor-pointer p-4 text-center transition-colors",
                        "hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring"
                      )}
                    >
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handlePhotoUpload}
                        className="sr-only"
                        disabled={photoBusy}
                        aria-labelledby="photo-label"
                        aria-describedby={photoError ? "photo-error" : undefined}
                      />
                      {photoBusy ? (
                        <>
                          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-2" aria-hidden="true" />
                          <span className="text-base text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-muted-foreground mb-2" aria-hidden="true" />
                          <span className="text-base font-medium text-primary underline">Click to upload profile picture</span>
                        </>
                      )}
                    </label>
                  )}
                  {photoError && (
                    <p id="photo-error" role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {photoError}
                    </p>
                  )}
                  <p role="status" aria-live="polite" className={photoStatus && !photoError ? "text-sm text-success font-medium" : "sr-only"}>
                    {photoError ? "" : photoStatus}
                  </p>
                </div>

                <LongAnswer
                  id="bio"
                  label="Short bio about yourself"
                  placeholder="Tell others a bit about yourself..."
                  value={data.bio}
                  onChange={(bio) => updateData({ bio })}
                  max={300}
                  tall
                />

                <div className="space-y-2">
                  <Label htmlFor="occupation" className="text-base">Occupation</Label>
                  <Input
                    id="occupation"
                    placeholder="e.g. Teacher, nurse, business owner, retired"
                    value={data.occupation}
                    maxLength={100}
                    onChange={(e) => updateData({ occupation: e.target.value })}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="education" className="text-base">Education</Label>
                  <Input
                    id="education"
                    placeholder="e.g. High school, trade school, college degree"
                    value={data.education}
                    maxLength={100}
                    onChange={(e) => updateData({ education: e.target.value })}
                    className="h-12"
                  />
                </div>
              </section>

              <section aria-labelledby="sec-interests" className="space-y-6">
                <h2 id="sec-interests" className="text-xl font-semibold text-foreground border-b border-border pb-2">Things you enjoy</h2>

                <ChipGroup
                  legend="Pick a few interests/hobbies"
                  hint="Tap any that fit. Tap again to remove."
                  options={withCustom(INTEREST_OPTIONS, data.interests)}
                  selected={data.interests}
                  onToggle={(v) => updateData({ interests: toggleIn(data.interests, v) })}
                >
                  <AddYourOwn
                    label="Add your own interest"
                    placeholder="Add your own interest..."
                    onAdd={(v) => updateData({ interests: addTo(data.interests, v) })}
                  />
                </ChipGroup>

                <ChipGroup
                  legend="Favorite Music"
                  options={withCustom(FAVORITE_MUSIC_OPTIONS, data.favorite_music)}
                  selected={data.favorite_music}
                  onToggle={(v) => updateData({ favorite_music: toggleIn(data.favorite_music, v) })}
                >
                  <AddYourOwn
                    label="Add your own music"
                    placeholder="Add your own kind of music..."
                    onAdd={(v) => updateData({ favorite_music: addTo(data.favorite_music, v) })}
                  />
                </ChipGroup>

                <ChipGroup
                  legend="Favorite Animals"
                  options={withCustom(ANIMALS_OPTIONS, data.animals)}
                  selected={data.animals}
                  onToggle={(v) => updateData({ animals: toggleIn(data.animals, v) })}
                >
                  <AddYourOwn
                    label="Add your own animal"
                    placeholder="Add your own animal..."
                    onAdd={(v) => updateData({ animals: addTo(data.animals, v) })}
                  />
                </ChipGroup>

                <ChipGroup
                  legend="Pet Peeves"
                  hint="Small things that bother you."
                  options={withCustom(PET_PEEVES_OPTIONS, data.pet_peeves)}
                  selected={data.pet_peeves}
                  onToggle={(v) => updateData({ pet_peeves: toggleIn(data.pet_peeves, v) })}
                >
                  <AddYourOwn
                    label="Add your own pet peeve"
                    placeholder="Add your own pet peeve..."
                    onAdd={(v) => updateData({ pet_peeves: addTo(data.pet_peeves, v) })}
                  />
                </ChipGroup>
              </section>

              <section aria-labelledby="sec-meet" className="space-y-6">
                <h2 id="sec-meet" className="text-xl font-semibold text-foreground border-b border-border pb-2">Who you would like to meet</h2>

                <ChipGroup
                  legend="Looking For (Gender)"
                  hint="Select all that apply"
                  options={LOOKING_FOR_GENDER_OPTIONS}
                  selected={data.looking_for}
                  onToggle={toggleLookingFor}
                />

                <div className="space-y-2">
                  <Label htmlFor="looking_for_description" className="text-base">What I&apos;m Looking For</Label>
                  <Select
                    value={data.looking_for_description}
                    onValueChange={(value) => updateData({ looking_for_description: value })}
                  >
                    <SelectTrigger id="looking_for_description" className="h-12 w-full text-base">
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

                <fieldset className="space-y-2">
                  <legend className="text-base font-medium">Age Range You&apos;re Looking For</legend>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="age_min" className="text-sm text-muted-foreground">Min Age</Label>
                      <Input
                        id="age_min"
                        type="number"
                        inputMode="numeric"
                        min={18}
                        max={120}
                        value={data.age_preference_min}
                        onChange={(e) => updateData({ age_preference_min: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                        onBlur={() => {
                          // Tidied when leaving the box, so typing "45" is not
                          // turned into something else half-way through.
                          const min = clampAge(data.age_preference_min, 18)
                          const max = Math.max(min, clampAge(data.age_preference_max, 100))
                          updateData({ age_preference_min: String(min), age_preference_max: String(max) })
                        }}
                        className="h-12"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="age_max" className="text-sm text-muted-foreground">Max Age</Label>
                      <Input
                        id="age_max"
                        type="number"
                        inputMode="numeric"
                        min={18}
                        max={120}
                        value={data.age_preference_max}
                        onChange={(e) => updateData({ age_preference_max: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                        onBlur={() => {
                          const max = clampAge(data.age_preference_max, 100)
                          const min = Math.min(max, clampAge(data.age_preference_min, 18))
                          updateData({ age_preference_min: String(min), age_preference_max: String(max) })
                        }}
                        className="h-12"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    Age range: {clampAge(data.age_preference_min, 18)} - {clampAge(data.age_preference_max, 100)}
                  </p>
                </fieldset>

                <LongAnswer
                  id="personal_preferences"
                  label="Personal Preferences"
                  placeholder="What matters to you in a partner or friend? (e.g. a sense of humor, shared values, loves to travel...)"
                  value={data.personal_preferences}
                  onChange={(personal_preferences) => updateData({ personal_preferences })}
                  max={500}
                  tall
                />
              </section>

              <section aria-labelledby="sec-background" className="space-y-6">
                <h2 id="sec-background" className="text-xl font-semibold text-foreground border-b border-border pb-2">Your background</h2>

                <ChipGroup
                  legend="Languages"
                  hint="Select all languages you speak"
                  options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))}
                  selected={data.languages}
                  onToggle={(v) => updateData({ languages: toggleIn(data.languages, v) })}
                />

                <div className="space-y-2">
                  <Label htmlFor="cultural_background" className="text-base">Cultural Background</Label>
                  <Input
                    id="cultural_background"
                    placeholder="e.g. Italian-American, Cherokee, Mexican-American"
                    value={data.cultural_background}
                    maxLength={100}
                    onChange={(e) => updateData({ cultural_background: e.target.value })}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="religion" className="text-base">Religion</Label>
                  <Select
                    value={data.religion}
                    onValueChange={(value) => updateData({ religion: value })}
                  >
                    <SelectTrigger id="religion" className="h-12 w-full text-base">
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
                  <Label htmlFor="life_goals" className="text-base">Life Goals</Label>
                  <Select
                    value={data.life_goals}
                    onValueChange={(value) => updateData({ life_goals: value })}
                  >
                    <SelectTrigger id="life_goals" className="h-12 w-full text-base">
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
              </section>
            </div>
          )}

          {/* Step 3: Get to Know Me (Optional) */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <LongAnswer
                id="prompt_good_at"
                label="I'm weirdly good at..."
                placeholder="e.g. Remembering the words to every song from the 70s"
                value={data.prompt_good_at}
                onChange={(prompt_good_at) => updateData({ prompt_good_at })}
                max={500}
              />
              <LongAnswer
                id="prompt_weekend"
                label="A perfect weekend looks like..."
                placeholder="e.g. Morning coffee, an afternoon in the garden, a good movie in the evening"
                value={data.prompt_perfect_weekend}
                onChange={(prompt_perfect_weekend) => updateData({ prompt_perfect_weekend })}
                max={500}
              />
              <LongAnswer
                id="prompt_message"
                label="You should message me if..."
                placeholder="e.g. You want to debate the best pizza toppings"
                value={data.prompt_message_if}
                onChange={(prompt_message_if) => updateData({ prompt_message_if })}
                max={500}
              />
              <LongAnswer
                id="hoping_to_find"
                label="My ideal type of connection is..."
                placeholder="e.g. Someone who enjoys road trips and long conversations"
                value={data.hoping_to_find}
                onChange={(hoping_to_find) => updateData({ hoping_to_find })}
                max={500}
              />
              <LongAnswer
                id="great_day"
                label="A great day for me includes..."
                placeholder="e.g. Good food, laughter, and time with someone special"
                value={data.great_day}
                onChange={(great_day) => updateData({ great_day })}
                max={500}
              />
              <LongAnswer
                id="relationship_values"
                label="In a relationship, I value..."
                placeholder="e.g. Honesty, humor, and supporting each other"
                value={data.relationship_values}
                onChange={(relationship_values) => updateData({ relationship_values })}
                max={500}
              />
              <LongAnswer
                id="show_affection"
                label="I show I care by..."
                placeholder="e.g. Thoughtful messages, a home-cooked meal, being there"
                value={data.show_affection}
                onChange={(show_affection) => updateData({ show_affection })}
                max={500}
              />
              <LongAnswer
                id="build_with_person"
                label="My vision for the future is..."
                placeholder="e.g. A life with good company, new places and plenty of laughter"
                value={data.build_with_person}
                onChange={(build_with_person) => updateData({ build_with_person })}
                max={500}
              />
            </div>
          )}

          {/* Messages sit next to the buttons, where the member is looking. */}
          {error && (
            <div role="alert" className="mt-8 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-base flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className={cn("flex flex-col-reverse gap-3 pt-6 border-t border-border sm:flex-row sm:items-center sm:justify-between", error ? "mt-4" : "mt-8")}>
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={saving}
                  className="min-h-11 w-full gap-2 text-base sm:w-auto"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              {currentStep === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleComplete}
                  disabled={saving}
                  className="min-h-11 text-base"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  Skip for now
                </Button>
              )}

              {currentStep < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  className="min-h-11 gap-2 text-base"
                >
                  Next
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleComplete}
                  disabled={saving}
                  className="min-h-11 gap-2 text-base"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Completing...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          {currentStep === 2 && (
            <p className="mt-3 text-sm text-muted-foreground sm:text-right">
              &quot;Skip for now&quot; saves what you have entered and takes you to your profile.
            </p>
          )}
        </div>
      </main>

      {/* Community Guidelines Dialog */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>D8-LPA Community Guidelines</DialogTitle>
            <DialogDescription>
              Please read and agree to our community guidelines
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-base text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground mb-1">1. Respect &amp; Kindness</h3>
              <p>Treat all members with respect and kindness. Harassment, bullying, hate speech, or discrimination of any kind will not be tolerated.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">2. Authentic Profiles</h3>
              <p>Use real, recent photos of yourself. Impersonation or catfishing is strictly prohibited. Your profile should accurately represent who you are.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">3. Privacy &amp; Safety</h3>
              <p>Protect your personal information and respect others&apos; privacy. Do not share others&apos; personal information without consent.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">4. Appropriate Content</h3>
              <p>Keep all content appropriate and respectful. Explicit, offensive, or inappropriate content is not allowed.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">5. LPA Community Values</h3>
              <p>As a platform for the LPA community, we expect all members to uphold the values of our community and support fellow members.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">6. Reporting</h3>
              <p>If you encounter any violations of these guidelines, please report them immediately. We take all reports seriously.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">7. Consequences</h3>
              <p>Violations of these guidelines may result in warnings, temporary suspension, or permanent removal from the platform.</p>
            </section>
          </div>
          <div className="pt-4">
            <Button onClick={() => setShowGuidelines(false)} className="w-full min-h-11 text-base">
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
