import {
  mockUser,
  mockProfile,
  mockBrowseProfiles,
  mockMatches,
  mockConversations,
  mockMessages,
  mockEvents,
  mockNotifications,
  mockStats,
} from "./mock-data"

// Set to true to use mock data, false to use real API
const USE_MOCK_DATA = false

// For local development with separate BE server, use: http://localhost:5001/api
// For v0 preview or when using Next.js API routes, use: /api
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("spark-auth") || "{}")?.state?.token
      : null

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  console.log(`[API_REQUEST] Endpoint: ${endpoint}, Token present: ${!!token}, Token value: ${token ? token.substring(0, 20) + '...' : 'null'}`)

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })
    const data = await response.json()

    if (!response.ok) {
      if (response.status === 401) {
        // Don't redirect on login endpoint - let the component handle the error
        if (endpoint !== "/auth/login" && endpoint !== "/auth/signup") {
          if (typeof window !== "undefined") {
            localStorage.removeItem("spark-auth")
            window.location.href = "/login"
          }
        }
      }
      // Handle 403 (banned/suspended) - show message but stay on current page
      if (response.status === 403 && data.message?.includes("suspended or banned")) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("spark-auth")
          // Don't redirect, let the component show the error
        }
      }
      return { error: data.message || "An error occurred" }
    }

    return { data }
  } catch (error) {
    console.error('[API] Network error:', error)
    return { error: "Network error. Please try again." }
  }
}

async function apiRequestFormData<T>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("spark-auth") || "{}")?.state?.token
      : null

  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.message || "An error occurred" }
    }

    return { data }
  } catch {
    return { error: "Network error. Please try again." }
  }
}

// API with mock data support
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return {
          data: {
            user: { ...mockUser, email },
            profile: mockProfile,
            token: "mock-token-12345",
          },
        }
      }
      console.log('[API.AUTH.LOGIN] Making real API request to /auth/login')
      return apiRequest<{ user: any; profile: any; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
    },
    signup: async (data: { email: string; password: string }) => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return {
          data: {
            user_id: "new-user-id",
            email: data.email,
            token: "mock-token-12345",
          },
        }
      }
      return apiRequest<{ user_id: string; email: string; token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    me: async () => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { user: mockUser, profile: mockProfile } }
      }
      return apiRequest<{ user: any; profile: any }>("/auth/me")
    },
    verifyEmail: async (data: { email: string; code: string }) => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return { data: { message: "Email verified successfully" } }
      }
      return apiRequest<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    resendVerification: async (data: { email: string }) => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return { data: { message: "Verification code sent" } }
      }
      return apiRequest<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    forgotPassword: async (data: { email: string }) => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return { data: { message: "If an account exists, a reset link will be sent" } }
      }
      return apiRequest<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    resetPassword: async (data: { token: string; password: string }) => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return { data: { message: "Password reset successfully" } }
      }
      return apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    completeOnboarding: async (data: any) => {
      if (USE_MOCK_DATA) {
        await delay(800)
        return {
          data: {
            user: { ...mockUser, ...data, onboarding_completed: true },
            profile: { ...mockProfile, ...data },
          },
        }
      }
      return apiRequest<{ user: any; profile: any }>("/auth/complete-onboarding", {
        method: "PUT",
        body: JSON.stringify(data),
      })
    },
  },
  users: {
    getProfile: async () => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { user: mockUser, profile: mockProfile, stats: mockStats } }
      }
      return apiRequest<any>("/users/profile")
    },
    getById: async (userId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { user: mockUser, profile: mockProfile } }
      }
      return apiRequest<any>(`/users/${userId}`)
    },
    updateProfile: async (data: any) => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return {
          data: {
            user: { ...mockUser, ...data },
            profile: { ...mockProfile, ...data },
          },
        }
      }
      return apiRequest<any>("/users/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      })
    },
    deleteAccount: async () => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return { data: { success: true } }
      }
      return apiRequest<any>("/users/profile", {
        method: "DELETE",
      })
    },
    uploadPhoto: async (formData: FormData) => {
      if (USE_MOCK_DATA) {
        await delay(1000)
        // Return a random placeholder URL
        const randomId = Math.floor(Math.random() * 1000)
        return {
          data: {
            url: `https://images.unsplash.com/photo-150700321116${randomId}?w=400&h=500&fit=crop`,
          },
        }
      }
      return apiRequestFormData<{ url: string }>("/users/photos", formData)
    },
    deletePhoto: async (photoUrl: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { success: true } }
      }
      return apiRequest<any>("/users/photos", {
        method: "DELETE",
        body: JSON.stringify({ url: photoUrl }),
      })
    },
  },
  browse: {
    getProfiles: async () => {
      if (USE_MOCK_DATA) {
        await delay(500)
        return { data: mockBrowseProfiles }
      }
      return apiRequest<any[]>("/browse")
    },
    like: async (userId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        // 30% chance of match
        const isMatch = Math.random() < 0.3
        return {
          data: {
            success: true,
            is_match: isMatch,
            match: isMatch
              ? {
                  id: `match-${Date.now()}`,
                  user: mockBrowseProfiles.find((p) => p.id === userId),
                }
              : null,
          },
        }
      }
      return apiRequest<any>(`/browse/${userId}/like`, {
        method: "POST",
      })
    },
    pass: async (userId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/browse/${userId}/pass`, {
        method: "POST",
      })
    },
    superLike: async (userId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        // 50% chance of match with superlike
        const isMatch = Math.random() < 0.5
        return {
          data: {
            success: true,
            is_match: isMatch,
            match: isMatch
              ? {
                  id: `match-${Date.now()}`,
                  user: mockBrowseProfiles.find((p) => p.id === userId),
                }
              : null,
          },
        }
      }
      return apiRequest<any>(`/browse/${userId}/superlike`, {
        method: "POST",
      })
    },
    getLikedProfiles: async () => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: mockBrowseProfiles.slice(0, 3).map(p => ({ ...p, like_id: `like-${p.id}`, liked_at: new Date().toISOString(), type: 'like' })) }
      }
      return apiRequest<any[]>("/browse/liked")
    },
    unlike: async (likeId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/browse/liked/${likeId}`, { method: "DELETE" })
    },
    block: async (userId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/browse/${userId}/block`, { method: "POST" })
    },
    getBlockedList: async () => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: [] }
      }
      return apiRequest<any[]>("/browse/blocked-list")
    },
    unblock: async (userId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/browse/${userId}/unblock`, { method: "DELETE" })
    },
    report: async (userId: string, reason: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/browse/${userId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
    },
  },
  matches: {
    getAll: async () => {
      if (USE_MOCK_DATA) {
        await delay(400)
        return { data: mockMatches }
      }
      return apiRequest<any[]>("/matches")
    },
    getOne: async (matchId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        const match = mockMatches.find((m) => m.id === matchId)
        return { data: match || mockMatches[0] }
      }
      return apiRequest<any>(`/matches/${matchId}`)
    },
    unmatch: async (matchId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/matches/${matchId}`, { method: "DELETE" })
    },
  },
  messages: {
    getConversations: async () => {
      if (USE_MOCK_DATA) {
        await delay(400)
        return { data: mockConversations }
      }
      return apiRequest<any[]>("/messages")
    },
    getMessages: async (conversationId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        // Try to find messages by match ID
        const messages = mockMessages[conversationId] || mockMessages["match-1"] || []
        return { data: messages }
      }
      return apiRequest<any[]>(`/messages/${conversationId}`)
    },
    send: async (conversationId: string, content: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return {
          data: {
            id: `msg-${Date.now()}`,
            sender_id: mockUser.id,
            content,
            created_at: new Date().toISOString(),
          },
        }
      }
      return apiRequest<any>(`/messages/${conversationId}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      })
    },
    deleteConversation: async (conversationId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/messages/${conversationId}`, {
        method: "DELETE",
      })
    },
  },
  events: {
    getAll: async () => {
      if (USE_MOCK_DATA) {
        await delay(400)
        return { data: mockEvents }
      }
      return apiRequest<any[]>("/events")
    },
    getOne: async (eventId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        const event = mockEvents.find((e) => e.id === eventId)
        return { data: event || mockEvents[0] }
      }
      return apiRequest<any>(`/events/${eventId}`)
    },
    join: async (eventId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { success: true, is_joined: true } }
      }
      return apiRequest<any>(`/events/${eventId}/join`, {
        method: "POST",
      })
    },
    leave: async (eventId: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { success: true, is_joined: false } }
      }
      return apiRequest<any>(`/events/${eventId}/leave`, {
        method: "POST",
      })
    },
  },
  notifications: {
    getAll: async () => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: mockNotifications }
      }
      return apiRequest<any[]>("/notifications")
    },
    markAsRead: async (notificationId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/notifications/${notificationId}/read`, {
        method: "PUT",
      })
    },
    delete: async (notificationId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/notifications/${notificationId}`, {
        method: "DELETE",
      })
    },
    markAllAsRead: async () => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>("/notifications/mark-all-read", {
        method: "PUT",
      })
    },
  },
  stats: {
    get: async () => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: mockStats }
      }
      return apiRequest<any>("/stats")
    },
  },
  settings: {
    get: async () => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return {
          data: {
            notifications: {
              matches: true,
              messages: true,
              likes: true,
              events: true,
              admin_news: true,
            },
            privacy: {
              profileVisible: true,
              selectiveMode: false,
            },
          },
        }
      }
      return apiRequest<any>("/settings")
    },
    update: async (settings: {
      lookingFor?: string[]
      notifications: {
        matches: boolean
        messages: boolean
        likes: boolean
        events: boolean
        admin_news: boolean
      }
      privacy: {
        profileVisible: boolean
        selectiveMode: boolean
      }
    }) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: settings }
      }
      return apiRequest<any>("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      })
    },
    disableAccount: async (data: { reason: string; password: string }) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { success: true } }
      }
      return apiRequest<any>("/settings/disable", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    deleteAccount: async (data: { reason: string; password: string }) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { success: true } }
      }
      return apiRequest<any>("/settings/delete", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
  },
  admin: {
    // Get all users
    getUsers: async () => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: [] }
      }
      return apiRequest<any[]>("/admin/users")
    },
    // User actions (warn, suspend, ban, unban)
    userAction: async (userId: string, action: 'warn' | 'suspend' | 'ban' | 'unban' | 'remove_warning' | 'unsuspend', message?: string) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/admin/users/${userId}/action`, {
        method: "POST",
        body: JSON.stringify({ action, message }),
      })
    },
    // Notes CRUD
    getNotes: async (userId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: [] }
      }
      return apiRequest<any[]>(`/admin/users/${userId}/notes`)
    },
    addNote: async (userId: string, content: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { id: '1', content, created_at: new Date().toISOString() } }
      }
      return apiRequest<any>(`/admin/users/${userId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      })
    },
    updateNote: async (userId: string, noteId: string, content: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { id: noteId, content } }
      }
      return apiRequest<any>(`/admin/users/${userId}/notes`, {
        method: "PUT",
        body: JSON.stringify({ noteId, content }),
      })
    },
    deleteNote: async (userId: string, noteId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/admin/users/${userId}/notes?noteId=${noteId}`, {
        method: "DELETE",
      })
    },
    // Announcements
    getAnnouncements: async () => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: [] }
      }
      return apiRequest<any[]>("/admin/news")
    },
    createAnnouncement: async (title: string, message: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { id: '1', title, message, created_at: new Date().toISOString() } }
      }
      return apiRequest<any>("/admin/news", {
        method: "POST",
        body: JSON.stringify({ title, message }),
      })
    },
    deleteAnnouncement: async (announcementId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/admin/news?id=${announcementId}`, {
        method: "DELETE",
      })
    },
    // Toggle event visibility
    toggleEventVisibility: async (eventId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true, is_hidden: true } }
      }
      return apiRequest<any>(`/admin/events/${eventId}/toggle-visibility`, {
        method: "PUT",
      })
    },
    // Create event
    createEvent: async (eventData: any) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { id: '1', ...eventData } }
      }
      return apiRequest<any>("/admin/events", {
        method: "POST",
        body: JSON.stringify(eventData),
      })
    },
    uploadEventPhoto: async (file: File) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { url: "/placeholder.svg" } }
      }
      const formData = new FormData();
      formData.append('photo', file);
      return apiRequestFormData<any>("/admin/events/photo", formData);
    },
    // Update event
    updateEvent: async (eventId: string, eventData: any) => {
      if (USE_MOCK_DATA) {
        await delay(300)
        return { data: { id: eventId, ...eventData } }
      }
      return apiRequest<any>(`/admin/events/${eventId}`, {
        method: "PUT",
        body: JSON.stringify(eventData),
      })
    },
    // Delete event
    deleteEvent: async (eventId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/admin/events/${eventId}`, {
        method: "DELETE",
      })
    },
    // Cancel event
    cancelEvent: async (eventId: string) => {
      if (USE_MOCK_DATA) {
        await delay(200)
        return { data: { success: true } }
      }
      return apiRequest<any>(`/admin/events/${eventId}/cancel`, {
        method: "PUT",
      })
    },
  },
}
