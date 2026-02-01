import { create } from "zustand"
import { persist } from "zustand/middleware"
import { mockUser, mockProfile } from "@/lib/mock-data"

// Set to true to use mock data for demo purposes
const USE_MOCK_DATA = false

export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  birthdate?: string
  gender?: "male" | "female" | "non_binary"
  looking_for?: ("male" | "female" | "non_binary")[]
  bio?: string
  verified?: boolean
  active?: boolean
  phone?: string
  avatar?: string
  photos?: string[]
  onboarding_completed?: boolean
  role?: "user" | "admin"
  is_banned?: boolean
  is_suspended?: boolean
  has_warning?: boolean
}

export interface Profile {
  height?: number
  body_type?: "athletic" | "average" | "curvy" | "slim" | "prefer_not_to_say"
  ethnicity?: string
  religion?: string
  interests?: string[]
  occupation?: string
  education?: string
  drinking?: "never" | "rarely" | "sometimes" | "often" | "prefer_not_to_say"
  smoking?: "never" | "rarely" | "sometimes" | "often" | "prefer_not_to_say"
  wants_kids?: "yes" | "no" | "maybe" | "unsure"
  location?: {
    city?: string
    state?: string
    country?: string
  }
  location_city?: string
  location_state?: string
  distance_preference?: number
  age_preference_min?: number
  age_preference_max?: number
  looking_for_relationship?: "dating" | "hookup" | "relationship" | "friendship"
  looking_for_description?: string
  life_goals?: string
  languages?: string[]
  cultural_background?: string
  personal_preferences?: string
  bio?: string
  favorite_music?: string
  animals?: string
  pet_peeves?: string
}

export interface OnboardingData {
  // Step 1: Basic Info
  first_name: string
  last_name: string
  birthdate: string
  // Step 2: Looking For
  gender: "male" | "female" | "non_binary" | ""
  looking_for: ("male" | "female" | "non_binary")[]
  looking_for_relationship: "dating" | "hookup" | "relationship" | "friendship" | ""
  // Step 3: Profile Details
  bio: string
  height: number | null
  body_type: "athletic" | "average" | "curvy" | "slim" | "prefer_not_to_say" | ""
  ethnicity: string
  occupation: string
  education: string
  religion: string
  // Step 4: Lifestyle
  drinking: "never" | "rarely" | "sometimes" | "often" | "prefer_not_to_say" | ""
  smoking: "never" | "rarely" | "sometimes" | "often" | "prefer_not_to_say" | ""
  wants_kids: "yes" | "no" | "maybe" | "unsure" | ""
  interests: string[]
  // Step 5: Preferences
  distance_preference: number
  age_preference_min: number
  age_preference_max: number
  // Step 6: Location
  location_city: string
  location_state: string
  location_country: string
  // Step 7: Photos
  photos: string[]
}

// Session timeout in milliseconds (8 hours)
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000

interface AuthState {
  user: User | null
  profile: Profile | null
  token: string | null
  sessionTimestamp: number | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  onboardingData: OnboardingData
  onboardingStep: number
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setToken: (token: string | null) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  setOnboardingData: (data: Partial<OnboardingData>) => void
  setOnboardingStep: (step: number) => void
  resetOnboarding: () => void
  logout: () => void
  checkSession: () => boolean
  refreshSession: () => void
}

const initialOnboardingData: OnboardingData = {
  first_name: "",
  last_name: "",
  birthdate: "",
  gender: "",
  looking_for: [],
  looking_for_relationship: "",
  bio: "",
  height: null,
  body_type: "",
  ethnicity: "",
  occupation: "",
  education: "",
  religion: "",
  drinking: "",
  smoking: "",
  wants_kids: "",
  interests: [],
  distance_preference: 50,
  age_preference_min: 18,
  age_preference_max: 50,
  location_city: "",
  location_state: "",
  location_country: "",
  photos: [],
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: USE_MOCK_DATA ? (mockUser as User) : null,
      profile: USE_MOCK_DATA ? (mockProfile as Profile) : null,
      token: USE_MOCK_DATA ? "mock-token-12345" : null,
      sessionTimestamp: USE_MOCK_DATA ? Date.now() : null,
      isAuthenticated: USE_MOCK_DATA,
      isLoading: false,
      error: null,
      onboardingData: initialOnboardingData,
      onboardingStep: 1,
      setUser: (user) =>
        set({ user, isAuthenticated: !!user, sessionTimestamp: user ? Date.now() : null }),
      setProfile: (profile) =>
        set({ profile }),
      setToken: (token) =>
        set({ token, sessionTimestamp: token ? Date.now() : null }),
      setError: (error) =>
        set({ error }),
      setLoading: (isLoading) =>
        set({ isLoading }),
      setOnboardingData: (data) =>
        set((state) => ({
          onboardingData: { ...state.onboardingData, ...data },
        })),
      setOnboardingStep: (onboardingStep) =>
        set({ onboardingStep }),
      resetOnboarding: () =>
        set({ onboardingData: initialOnboardingData, onboardingStep: 1 }),
      logout: () =>
        set({
          user: null,
          profile: null,
          token: null,
          sessionTimestamp: null,
          isAuthenticated: false,
          error: null,
          onboardingData: initialOnboardingData,
          onboardingStep: 1,
        }),
      checkSession: () => {
        const state = get()
        if (!state.sessionTimestamp || !state.token) {
          return false
        }
        const elapsed = Date.now() - state.sessionTimestamp
        if (elapsed > SESSION_TIMEOUT) {
          // Session expired, logout
          get().logout()
          return false
        }
        return true
      },
      refreshSession: () => {
        set({ sessionTimestamp: Date.now() })
      },
    }),
    {
      name: "spark-auth",
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        token: state.token,
        sessionTimestamp: state.sessionTimestamp,
        isAuthenticated: state.isAuthenticated,
        onboardingData: state.onboardingData,
        onboardingStep: state.onboardingStep,
      }),
    }
  )
)
