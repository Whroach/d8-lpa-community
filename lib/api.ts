// For local development with separate BE server, use: http://localhost:5001/api
// For v0 preview or when using Next.js API routes, use: /api
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
  /** HTTP status of a failed request. */
  status?: number
  /** True when the request never reached the server (offline, timeout). */
  network?: boolean
  /** The server's full error body (for example `errors` or `requiresVerification`). */
  details?: any
}

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

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })
    // A proxy error page or an empty reply is not JSON; don't let that turn
    // into an unhandled exception and a blank screen.
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 401) {
        // Don't redirect on login endpoint - let the component handle the error
        if (endpoint !== "/auth/login" && endpoint !== "/auth/signup" && token) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("spark-auth")
            // A full page load on purpose: it also clears whatever the signed-out screens still hold in memory.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/login?expired=1"
          }
        }
      }
      if (response.status === 429) {
        return { error: data.message || "You are going a little fast. Please wait a minute and try again.", status: 429 }
      }
      // Handle 403 (banned/suspended) - show message but stay on current page
      // Suspended or banned: nothing to do here. The page shell shows the
      // explanation and signs the member out. (Clearing the session at this
      // point made the other requests on the page fail as "not signed in",
      // which redirected to the login screen before the explanation showed.)
      // A session left open elsewhere after the account was disabled or
      // deleted would otherwise sit there failing every request. Send it back
      // to the login screen, which is also where reactivating happens.
      if (
        response.status === 403 &&
        (data.message?.includes("disabled") || data.message?.includes("deleted"))
      ) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("spark-auth")
          if (!window.location.pathname.startsWith("/login")) {
            // A full page load on purpose (this file has no router, and the page state must be dropped).
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/login"
          }
        }
      }
      return {
        error: data.message || data.error || "Something went wrong. Please try again.",
        status: response.status,
        details: data,
      }
    }

    return { data }
  } catch {
    return { error: "We can't reach D8-LPA right now. Please check your internet connection and try again.", network: true }
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

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return { error: data.message || data.error || "We could not upload that. Please try again.", status: response.status }
    }

    return { data }
  } catch {
    return { error: "We can't reach D8-LPA right now. Please check your internet connection and try again.", network: true }
  }
}

// Every call the web app makes to the API.
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      return apiRequest<{ user: any; profile: any; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
    },
    signup: async (data: { email: string; password: string }) => {
      return apiRequest<{ user_id: string; email: string; token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    me: async () => {
      return apiRequest<{ user: any; profile: any }>("/auth/me")
    },
    verifyEmail: async (data: { email: string; code: string }) => {
      return apiRequest<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    resendVerification: async (data: { email: string }) => {
      return apiRequest<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    forgotPassword: async (data: { email: string }) => {
      return apiRequest<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    resetPassword: async (data: { token: string; password: string }) => {
      return apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    completeOnboarding: async (data: any) => {
      return apiRequest<{ user: any; profile: any }>("/auth/complete-onboarding", {
        method: "PUT",
        body: JSON.stringify(data),
      })
    },
    changePassword: async (data: { current_password: string; new_password: string }) => {
      return apiRequest<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
  },
  users: {
    getProfile: async () => {
      return apiRequest<any>("/users/profile")
    },
    getById: async (userId: string) => {
      return apiRequest<any>(`/users/${userId}`)
    },
    updateProfile: async (data: any) => {
      return apiRequest<any>("/users/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      })
    },
    deleteAccount: async () => {
      return apiRequest<any>("/users/profile", {
        method: "DELETE",
      })
    },
    uploadPhoto: async (formData: FormData) => {
      return apiRequestFormData<{ url: string }>("/users/photos", formData)
    },
    deletePhoto: async (photoUrl: string) => {
      return apiRequest<any>("/users/photos", {
        method: "DELETE",
        body: JSON.stringify({ url: photoUrl }),
      })
    },
    // Persists photo order. The first photo is used as the profile picture
    // everywhere else in the app, so keep profile_picture_url in sync.
    savePhotoOrder: async (photos: string[]) => {
      const result = await apiRequest<any>("/users/profile", {
        method: "PUT",
        body: JSON.stringify({ photos }),
      })
      if (!result.error && photos.length > 0) {
        await apiRequest<any>("/users/profile-picture", {
          method: "PUT",
          body: JSON.stringify({ photoUrl: photos[0] }),
        })
      }
      return result
    },
  },
  browse: {
    getProfiles: async () => {
      return apiRequest<any[]>("/browse")
    },
    like: async (userId: string) => {
      return apiRequest<any>(`/browse/${userId}/like`, {
        method: "POST",
      })
    },
    pass: async (userId: string) => {
      return apiRequest<any>(`/browse/${userId}/pass`, {
        method: "POST",
      })
    },
    superLike: async (userId: string) => {
      return apiRequest<any>(`/browse/${userId}/superlike`, {
        method: "POST",
      })
    },
    getLikedProfiles: async () => {
      return apiRequest<any[]>("/browse/liked")
    },
    unlike: async (likeId: string) => {
      return apiRequest<any>(`/browse/liked/${likeId}`, { method: "DELETE" })
    },
    block: async (userId: string) => {
      return apiRequest<any>(`/browse/${userId}/block`, { method: "POST" })
    },
    getBlockedList: async () => {
      return apiRequest<any[]>("/browse/blocked-list")
    },
    unblock: async (userId: string) => {
      return apiRequest<any>(`/browse/${userId}/unblock`, { method: "DELETE" })
    },
    report: async (
      userId: string,
      reason: string,
      extra: { category?: string; source?: "profile" | "chat" | "browse" | "matches"; match_id?: string } = {}
    ) => {
      return apiRequest<any>(`/browse/${userId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason, ...extra }),
      })
    },
  },
  /** Saved profiles: a private bookmark, never shown to the other person. */
  favorites: {
    getAll: async () => apiRequest<any[]>("/favorites"),
    add: async (userId: string) => apiRequest<any>(`/favorites/${userId}`, { method: "PUT" }),
    remove: async (userId: string) => apiRequest<any>(`/favorites/${userId}`, { method: "DELETE" }),
  },
  matches: {
    // The server splits matches into active/inactive; older builds returned a
    // bare array, so callers should handle both shapes.
    getAll: async () => {
      return apiRequest<any>("/matches")
    },
    getOne: async (matchId: string) => {
      return apiRequest<any>(`/matches/${matchId}`)
    },
    unmatch: async (matchId: string) => {
      return apiRequest<any>(`/matches/${matchId}`, { method: "DELETE" })
    },
  },
  messages: {
    getConversations: async () => {
      return apiRequest<any[]>("/messages")
    },
    getMessages: async (conversationId: string) => {
      return apiRequest<any[]>(`/messages/${conversationId}`)
    },
    send: async (conversationId: string, content: string) => {
      return apiRequest<any>(`/messages/${conversationId}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      })
    },
    deleteConversation: async (conversationId: string) => {
      return apiRequest<any>(`/messages/${conversationId}`, {
        method: "DELETE",
      })
    },
    /** Edit one of your own messages. The other user sees an "Edited" marker. */
    edit: async (conversationId: string, messageId: string, content: string) => {
      return apiRequest<any>(`/messages/${conversationId}/${messageId}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      })
    },
    /** Unsend one of your own messages, leaving a tombstone in the thread. */
    unsend: async (conversationId: string, messageId: string) => {
      return apiRequest<any>(`/messages/${conversationId}/${messageId}`, {
        method: "DELETE",
      })
    },
  },
  events: {
    getAll: async () => {
      return apiRequest<any[]>("/events")
    },
    getOne: async (eventId: string) => {
      return apiRequest<any>(`/events/${eventId}`)
    },
    join: async (eventId: string) => {
      return apiRequest<any>(`/events/${eventId}/join`, {
        method: "POST",
      })
    },
    leave: async (eventId: string) => {
      return apiRequest<any>(`/events/${eventId}/leave`, {
        method: "POST",
      })
    },
    /** Who's going: first name, picture and optional note. */
    getAttendees: async (eventId: string) => apiRequest<any[]>(`/events/${eventId}/attendees`),
    /** Carpool / meet-up note shown beside your name. Empty string removes it. */
    saveNote: async (eventId: string, note: string) =>
      apiRequest<any>(`/events/${eventId}/note`, { method: "PUT", body: JSON.stringify({ note }) }),
  },
  notifications: {
    getAll: async () => {
      return apiRequest<any[]>("/notifications")
    },
    markAsRead: async (notificationId: string) => {
      return apiRequest<any>(`/notifications/${notificationId}/read`, {
        method: "PUT",
      })
    },
    // keepalive lets the request finish even while the page is being left.
    delete: async (notificationId: string, keepalive = false) => {
      return apiRequest<any>(`/notifications/${notificationId}`, {
        method: "DELETE",
        keepalive,
      })
    },
    markAllAsRead: async () => {
      return apiRequest<any>("/notifications/mark-all-read", {
        method: "PUT",
      })
    },
  },
  stats: {
    get: async () => {
      return apiRequest<any>("/stats")
    },
  },
  settings: {
    get: async () => {
      return apiRequest<any>("/settings")
    },
    update: async (settings: {
      lookingFor?: string[]
      agePreferenceMin?: number
      agePreferenceMax?: number
      notifications?: {
        matches?: boolean
        messages?: boolean
        likes?: boolean
        events?: boolean
        admin_news?: boolean
        sound?: boolean
        quiet_hours_enabled?: boolean
        quiet_hours_start?: string
        quiet_hours_end?: string
        email_digest?: boolean
      }
      privacy?: {
        profileVisible?: boolean
        selectiveMode?: boolean
        showOnline?: boolean
        readReceipts?: boolean
      }
    }) => {
      return apiRequest<any>("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      })
    },
    disableAccount: async (data: { reason: string; password: string }) => {
      return apiRequest<any>("/settings/disable", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    deleteAccount: async (data: { reason: string; password: string }) => {
      return apiRequest<any>("/settings/delete", {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
  },
  admin: {
    // Get all users
    getUsers: async (params?: { page?: number; limit?: number; q?: string; status?: string }) => {
      // Server may return a bare array or { users: [...] }.
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(params || {})) {
        if (value !== undefined && value !== "") query.set(key, String(value))
      }
      const suffix = query.toString()
      return apiRequest<{ users?: any[] } & any[]>(`/admin/users${suffix ? `?${suffix}` : ""}`)
    },
    // User actions (warn, suspend, ban, unban). `message` is the reason; it is
    // required for suspend and ban. `extra.report_id` closes that report with
    // the outcome; `extra.reopen_report` (Undo) puts it back in the queue.
    userAction: async (
      userId: string,
      action: 'warn' | 'suspend' | 'ban' | 'unban' | 'remove_warning' | 'unsuspend',
      message?: string,
      extra?: { report_id?: string; reopen_report?: boolean }
    ) => {
      return apiRequest<any>(`/admin/users/${userId}/action`, {
        method: "POST",
        body: JSON.stringify({ action, message, ...extra }),
      })
    },
    // One page of member reports, with the counts for each filter.
    getReportsPage: async (params: { page: number; limit?: number; q?: string; status?: string }) => {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") query.set(key, String(value))
      }
      return apiRequest<any>(`/admin/reports?${query.toString()}`)
    },
    // The admin activity log: who did what to whom, when and why.
    getAuditLog: async (params: { page?: number; limit?: number; q?: string; action?: string; user_id?: string } = {}) => {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") query.set(key, String(value))
      }
      return apiRequest<any>(`/admin/audit-log?${query.toString()}`)
    },
    // Notes CRUD
    getNotes: async (userId: string) => {
      return apiRequest<any[]>(`/admin/users/${userId}/notes`)
    },
    addNote: async (userId: string, content: string) => {
      return apiRequest<any>(`/admin/users/${userId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      })
    },
    updateNote: async (userId: string, noteId: string, content: string) => {
      return apiRequest<any>(`/admin/users/${userId}/notes`, {
        method: "PUT",
        body: JSON.stringify({ noteId, content }),
      })
    },
    deleteNote: async (userId: string, noteId: string) => {
      return apiRequest<any>(`/admin/users/${userId}/notes?noteId=${noteId}`, {
        method: "DELETE",
      })
    },
    // Announcements
    getAnnouncements: async () => {
      return apiRequest<any[]>("/admin/news")
    },
    createAnnouncement: async (title: string, message: string) => {
      return apiRequest<any>("/admin/news", {
        method: "POST",
        body: JSON.stringify({ title, message }),
      })
    },
    deleteAnnouncement: async (announcementId: string) => {
      return apiRequest<any>(`/admin/news?id=${announcementId}`, {
        method: "DELETE",
      })
    },
    // Member reports waiting for a moderator
    getReports: async (status: string = "pending") => apiRequest<any[]>(`/admin/reports?status=${status}`),
    updateReport: async (reportId: string, status: string, action_taken?: string) =>
      apiRequest<any>(`/admin/reports/${reportId}`, {
        method: "PUT",
        body: JSON.stringify({ status, action_taken }),
      }),
    // Toggle event visibility
    toggleEventVisibility: async (eventId: string) => {
      return apiRequest<any>(`/admin/events/${eventId}/toggle-visibility`, {
        method: "PUT",
      })
    },
    // Create event
    createEvent: async (eventData: any) => {
      return apiRequest<any>("/admin/events", {
        method: "POST",
        body: JSON.stringify(eventData),
      })
    },
    uploadEventPhoto: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      return apiRequestFormData<any>("/admin/events/photo", formData);
    },
    // Update event
    updateEvent: async (eventId: string, eventData: any) => {
      return apiRequest<any>(`/admin/events/${eventId}`, {
        method: "PUT",
        body: JSON.stringify(eventData),
      })
    },
    // Delete event
    deleteEvent: async (eventId: string) => {
      return apiRequest<any>(`/admin/events/${eventId}`, {
        method: "DELETE",
      })
    },
    // Cancel event
    cancelEvent: async (eventId: string) => {
      return apiRequest<any>(`/admin/events/${eventId}/cancel`, {
        method: "PUT",
      })
    },
    // Reinstate a cancelled event
    uncancelEvent: async (eventId: string) => {
      return apiRequest<any>(`/admin/events/${eventId}/uncancel`, {
        method: "PUT",
      })
    },
    getEventAttendees: async (eventId: string) => {
      return apiRequest<any[]>(`/admin/events/${eventId}/attendees`)
    },
  },
}
