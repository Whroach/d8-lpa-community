"use client"

import { SelectItem } from "@/components/ui/select"
import { SelectContent } from "@/components/ui/select"
import { SelectValue } from "@/components/ui/select"
import { SelectTrigger } from "@/components/ui/select"
import { Select } from "@/components/ui/select"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Settings,
  Bell,
  Lock,
  ChevronRight,
  Shield,
  HelpCircle,
  FileText,
  Loader2,
  Check,
  Trash2,
  AlertTriangle,
  X,
  Users,
  Volume2
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { useAuthStore } from "@/lib/store/auth-store"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { TermsContent } from "@/components/terms-content"
import { LoadError } from "@/components/load-error"
import { PasswordInput } from "@/components/ui/password-input"
import { TEXT_SIZES, getTextSize, setTextSize, type TextSize } from "@/lib/preferences"
import { useLogout } from "@/lib/use-logout"
import { useNotificationStore } from "@/lib/store/notification-store"
import {
  playNotificationSound,
  unlockNotificationSound,
} from "@/lib/notification-sound"

type BlockedUser = {
  id: string
  first_name: string
  last_name: string
  profile_picture_url: string | null
  blocked_at: string
}

/** What a new password is still missing (same rules as the server). */
function passwordProblems(password: string): string[] {
  const missing: string[] = []
  if (password.length < 8) missing.push("at least 8 characters")
  if (!/[A-Z]/.test(password)) missing.push("a capital letter")
  if (!/[a-z]/.test(password)) missing.push("a small letter")
  if (!/\d/.test(password)) missing.push("a number")
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) missing.push("a symbol such as ! or ?")
  return missing
}

export default function SettingsPage() {
  const router = useRouter()
  const { logout } = useAuthStore()
  const setSoundEnabled = useNotificationStore((state) => state.setSoundEnabled)
  const setQuietHours = useNotificationStore((state) => state.setQuietHours)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Blocked users states
  const [showBlockedUsersDialog, setShowBlockedUsersDialog] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false)
  const [isUnblocking, setIsUnblocking] = useState<string | null>(null)

  // Terms & Privacy Policy state
  const [showTermsDialog, setShowTermsDialog] = useState(false)

  // Password change states
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Disable/Delete account states
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [disableReason, setDisableReason] = useState("")
  const [deleteReason, setDeleteReason] = useState("")
  const [disablePassword, setDisablePassword] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [isDisablingAccount, setIsDisablingAccount] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [disableConfirmed, setDisableConfirmed] = useState(false)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)

  const [settings, setSettings] = useState({
    theme: "light",
    lookingFor: [] as string[],
    agePreferenceMin: 18,
    agePreferenceMax: 100,
    notifications: {
      matches: true,
      messages: true,
      likes: true,
      events: true,
      admin_news: true,
      sound: true,
      quiet_hours_enabled: false,
      quiet_hours_start: "21:00",
      quiet_hours_end: "08:00",
      email_digest: false,
    },
    privacy: {
      profileVisible: true,
      selectiveMode: false,
      showOnline: true,
      readReceipts: true,
    },
  })

  const [originalSettings, setOriginalSettings] = useState(settings)
  // null = still loading, "" = loaded, anything else = the load failed.
  const [loadError, setLoadError] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const [textSize, setTextSizeState] = useState<TextSize>("comfortable")
  const doLogout = useLogout()

  const loadSettings = useCallback(async () => {
    setLoadError(null)
    const result = await api.settings.get()
    if (result.error || !result.data) {
      // Never fall back to defaults here: saving them would overwrite the
      // member's real choices.
      setLoadError(result.error || "Please try again.")
      return
    }
    setLoadError("")
    if (result.data) {
      // Ensure all fields have proper defaults, especially lookingFor
      const loadedSettings = {
        theme: result.data.theme || "light",
        lookingFor: Array.isArray(result.data.lookingFor) ? result.data.lookingFor : [],
        agePreferenceMin: result.data.agePreferenceMin || 18,
        agePreferenceMax: result.data.agePreferenceMax || 100,
        notifications: {
          matches: result.data.notifications?.matches ?? true,
          messages: result.data.notifications?.messages ?? true,
          likes: result.data.notifications?.likes ?? true,
          events: result.data.notifications?.events ?? true,
          admin_news: result.data.notifications?.admin_news ?? true,
          sound: result.data.notifications?.sound ?? true,
          quiet_hours_enabled: result.data.notifications?.quiet_hours_enabled ?? false,
          quiet_hours_start: result.data.notifications?.quiet_hours_start || "21:00",
          quiet_hours_end: result.data.notifications?.quiet_hours_end || "08:00",
          email_digest: result.data.notifications?.email_digest ?? false,
        },
        privacy: {
          profileVisible: result.data.privacy?.profileVisible ?? true,
          selectiveMode: result.data.privacy?.selectiveMode ?? false,
          showOnline: result.data.privacy?.showOnline ?? true,
          readReceipts: result.data.privacy?.readReceipts ?? true,
        },
      }
      setSettings(loadedSettings)
      setOriginalSettings(loadedSettings)
      setHasChanges(false)
      setSaveSuccess(false)
    }
  }, [])

  useEffect(() => {
    setTextSizeState(getTextSize())
    void loadSettings()
    // Jump to a section when arriving from Help or Safety (#privacy, ...).
    const hash = window.location.hash.slice(1)
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 400)
  }, [loadSettings])

  const saveSettings = async () => {
    const toSave = settings
    const min = Math.min(120, Math.max(18, Number(toSave.agePreferenceMin) || 18))
    const max = Math.min(120, Math.max(18, Number(toSave.agePreferenceMax) || 100))
    setIsSaving(true)
    const result = await api.settings.update({
      lookingFor: toSave.lookingFor,
      agePreferenceMin: Math.min(min, max),
      agePreferenceMax: Math.max(min, max),
      notifications: toSave.notifications,
      privacy: toSave.privacy,
    })
    setIsSaving(false)

    // Don't claim success when the request failed — the banner used to show
    // "Saved" regardless of the outcome.
    if (result.error) {
      toast.error(`Your change was not saved. ${result.error}`, { id: "settings-saved" })
      // Put the screen back to what is really stored.
      setSettings(originalSettings)
      setHasChanges(false)
      return
    }

    setOriginalSettings(toSave)
    setQuietHours(
      toSave.notifications.quiet_hours_enabled,
      toSave.notifications.quiet_hours_start,
      toSave.notifications.quiet_hours_end
    )
    setHasChanges(false)
    setSaveSuccess(true)
    toast.success("Saved", { id: "settings-saved", duration: 2500 })
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  // Changes are saved as soon as they are made - there is no Save button to
  // forget. A short pause groups quick changes into one request.
  useEffect(() => {
    if (!hasChanges || loadError !== "") return
    const timer = setTimeout(() => {
      void saveSettings()
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, hasChanges, loadError])

  const handleDisableAccount = async () => {
    if (!disableConfirmed || !disablePassword.trim()) {
      toast.error("Please confirm you want to disable your account and enter your password")
      return
    }

    setIsDisablingAccount(true)
    try {
      const result = await api.settings.disableAccount({
        reason: disableReason,
        password: disablePassword
      })

      if (result.data) {
        toast.success("Your account is paused. Log in again whenever you want to come back.", { duration: 10000 })
        setShowDisableDialog(false)
        doLogout()
      } else if (result.error) {
        toast.error(result.error)
        setDisablePassword("")
      }
    } catch (error) {
      toast.error("We could not pause your account. Please try again.")
      console.error(error)
    } finally {
      setIsDisablingAccount(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirmed || !deletePassword.trim()) {
      toast.error("Please confirm you want to delete your account and enter your password")
      return
    }

    setIsDeletingAccount(true)
    try {
      const result = await api.settings.deleteAccount({
        reason: deleteReason,
        password: deletePassword
      })

      if (result.data) {
        toast.success("Your account has been deleted.", { duration: 10000 })
        setShowDeleteDialog(false)
        doLogout()
      } else if (result.error) {
        toast.error(result.error)
        setDeletePassword("")
      }
    } catch (error) {
      toast.error("We could not delete your account. Please try again.")
      console.error(error)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(false)

    // Validation
    if (!currentPassword.trim()) {
      setPasswordError("Current password is required")
      return
    }
    if (!newPassword.trim()) {
      setPasswordError("New password is required")
      return
    }
    const missing = passwordProblems(newPassword)
    if (missing.length > 0) {
      setPasswordError(`Your new password still needs: ${missing.join(", ")}.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password")
      return
    }

    setIsChangingPassword(true)
    setPasswordError(null)
    try {
      const result = await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })

      if (!result.error) {
        setPasswordSuccess(true)
        // Clear form
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        // Close dialog after 2 seconds
        setTimeout(() => {
          setShowPasswordDialog(false)
          setPasswordSuccess(false)
        }, 2000)
      } else {
        setPasswordError(result.error)
      }
    } catch (error) {
      setPasswordError("Error changing password. Please try again.")
      console.error(error)
    } finally {
      setIsChangingPassword(false)
    }
  }

  // The age boxes hold whatever is being typed; the numbers are tidied up
  // and saved when the member leaves the box. (They used to be forced into
  // range on every keystroke, which made "45" impossible to type.)
  const [ageDraft, setAgeDraft] = useState({ min: "18", max: "100" })
  useEffect(() => {
    setAgeDraft({ min: String(originalSettings.agePreferenceMin), max: String(originalSettings.agePreferenceMax) })
  }, [originalSettings.agePreferenceMin, originalSettings.agePreferenceMax])
  const commitAges = () => {
    const clamp = (value: string, fallback: number) => Math.min(120, Math.max(18, parseInt(value, 10) || fallback))
    const a = clamp(ageDraft.min, 18)
    const b = clamp(ageDraft.max, 100)
    const min = Math.min(a, b)
    const max = Math.max(a, b)
    setAgeDraft({ min: String(min), max: String(max) })
    if (min !== settings.agePreferenceMin || max !== settings.agePreferenceMax) {
      setSettings((prev) => ({ ...prev, agePreferenceMin: min, agePreferenceMax: max }))
      setHasChanges(true)
    }
  }

  const updateNotificationValue = (key: "quiet_hours_start" | "quiet_hours_end", value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return
    setSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }))
    setHasChanges(true)
  }

  const updateSettings = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
    setSaveSuccess(false)
  }

  const updateNotification = (key: keyof typeof settings.notifications) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    }
    setSettings(newSettings)
    setHasChanges(true)
    setSaveSuccess(false)
  }

  // The chime preference is also held in the realtime store so it takes effect
  // immediately, without waiting for Save or a reload.
  const handleToggleSound = () => {
    const next = !settings.notifications.sound
    updateNotification("sound")
    setSoundEnabled(next)
    if (next) {
      // This runs inside a real click, which is what lets the browser unlock
      // audio playback for the rest of the session.
      unlockNotificationSound()
      playNotificationSound()
    }
  }

  const handleTestSound = () => {
    unlockNotificationSound()
    playNotificationSound()
  }

  const updatePrivacy = (key: keyof typeof settings.privacy) => {
    const newSettings = {
      ...settings,
      privacy: {
        ...settings.privacy,
        [key]: !settings.privacy[key],
      },
    }
    setSettings(newSettings)
    setHasChanges(true)
    setSaveSuccess(false)
  }

  const toggleLookingFor = (value: string) => {
    const current = settings.lookingFor || []
    let next: string[] = []

    if (value === "everyone") {
      next = current.includes("everyone") ? [] : ["everyone"]
    } else {
      const withoutEveryone = current.filter((v) => v !== "everyone")
      if (withoutEveryone.includes(value)) {
        next = withoutEveryone.filter((v) => v !== value)
      } else {
        next = [...withoutEveryone, value]
      }
    }

    const newSettings = {
      ...settings,
      lookingFor: next,
    }

    setSettings(newSettings)
    setHasChanges(true)
    setSaveSuccess(false)
  }

  const loadBlockedUsers = async () => {
    setIsLoadingBlocked(true)
    try {
      const result = await api.browse.getBlockedList()
      if (result.data) {
        setBlockedUsers(result.data)
      } else if (result.error) {
        toast.error("Error loading blocked users: " + result.error)
      }
    } catch (error) {
      console.error("Error loading blocked users:", error)
      toast.error("Error loading blocked users")
    } finally {
      setIsLoadingBlocked(false)
    }
  }

  const handleOpenBlockedUsers = async () => {
    setShowBlockedUsersDialog(true)
    await loadBlockedUsers()
  }

  const handleUnblock = async (userId: string) => {
    setIsUnblocking(userId)
    try {
      const result = await api.browse.unblock(userId)
      if (result.data?.success) {
        const unblocked = blockedUsers.find(u => u.id === userId)
        setBlockedUsers(blockedUsers.filter(u => u.id !== userId))
        toast.success(`${unblocked?.first_name || "This member"} is no longer blocked`)
      } else if (result.error) {
        toast.error("Error unblocking user: " + result.error)
      }
    } catch (error) {
      console.error("Error unblocking user:", error)
      toast.error("Error unblocking user")
    } finally {
      setIsUnblocking(null)
    }
  }

  return (
    <AppLayout>
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your app preferences
            </p>
          </div>

          <p className="flex min-h-10 items-center gap-2 text-base text-muted-foreground" aria-live="polite" data-testid="save-status">
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : saveSuccess ? (
              <>
                <Check className="h-5 w-5 text-success" aria-hidden="true" />
                Saved
              </>
            ) : null}
          </p>
        </div>

        {loadError === null ? (
          <div className="flex justify-center py-16" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Loading your settings</span>
          </div>
        ) : loadError ? (
          <LoadError what="your settings" detail={loadError} onRetry={loadSettings} />
        ) : (
        <>
        {/* Display */}
        <Card className="mb-6 scroll-mt-4" id="display">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Display
            </CardTitle>
            <CardDescription className="text-base">
              Make the app comfortable to read. These choices are kept on this device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <fieldset>
              <legend className="mb-2 text-base font-semibold">Text size</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEXT_SIZES.map((size) => (
                  <label
                    key={size.value}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      className="h-5 w-5 shrink-0"
                      name="text-size"
                      value={size.value}
                      checked={textSize === size.value}
                      onChange={() => {
                        setTextSizeState(size.value)
                        setTextSize(size.value)
                        toast.success("Saved", { id: "settings-saved", duration: 2500 })
                      }}
                    />
                    <span>
                      <span className="block text-base font-medium">{size.label}</span>
                      <span className="block text-sm text-muted-foreground">{size.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-base font-semibold">Screen colours</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "Same as my device" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      className="h-5 w-5 shrink-0"
                      name="theme"
                      value={option.value}
                      checked={(theme || "system") === option.value}
                      onChange={() => {
                        setTheme(option.value)
                        toast.success("Saved", { id: "settings-saved", duration: 2500 })
                      }}
                    />
                    <span className="text-base font-medium">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="mb-6 scroll-mt-4" id="notifications">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Choose what notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="matches">New Matches</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when you match with someone
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.matches ? "On" : "Off"}
                </span>
                <Switch
                  id="matches"
                  checked={settings.notifications.matches}
                  onCheckedChange={() => updateNotification("matches")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="messages">Messages</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when you receive a message
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.messages ? "On" : "Off"}
                </span>
                <Switch
                  id="messages"
                  checked={settings.notifications.messages}
                  onCheckedChange={() => updateNotification("messages")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="likes">Likes</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone likes your profile
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.likes ? "On" : "Off"}
                </span>
                <Switch
                  id="likes"
                  checked={settings.notifications.likes}
                  onCheckedChange={() => updateNotification("likes")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="events">Events</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about event updates
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.events ? "On" : "Off"}
                </span>
                <Switch
                  id="events"
                  checked={settings.notifications.events}
                  onCheckedChange={() => updateNotification("events")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="admin_news">Admin Announcements</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about admin news and announcements
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.admin_news ? "On" : "Off"}
                </span>
                <Switch
                  id="admin_news"
                  checked={settings.notifications.admin_news}
                  onCheckedChange={() => updateNotification("admin_news")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="sound">Notification Sound</Label>
                <p className="text-sm text-muted-foreground">
                  Play a chime when a message or alert arrives while you have
                  the app open
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleTestSound}
                  disabled={!settings.notifications.sound}
                  className="gap-1.5"
                >
                  <Volume2 className="h-4 w-4" />
                  Test
                </Button>
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.sound ? "On" : "Off"}
                </span>
                <Switch
                  id="sound"
                  checked={settings.notifications.sound}
                  onCheckedChange={handleToggleSound}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="quiet_hours_enabled">Quiet hours</Label>
                <p className="text-sm text-muted-foreground">
                  No sound between the times below. Messages still arrive and the numbers in the menu still update.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.quiet_hours_enabled ? "On" : "Off"}
                </span>
                <Switch
                  id="quiet_hours_enabled"
                  checked={settings.notifications.quiet_hours_enabled}
                  onCheckedChange={() => updateNotification("quiet_hours_enabled")}
                />
              </div>
            </div>
            {settings.notifications.quiet_hours_enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="quiet_hours_start">Quiet from</Label>
                  <Input
                    id="quiet_hours_start"
                    type="time"
                    value={settings.notifications.quiet_hours_start}
                    onChange={(e) => updateNotificationValue("quiet_hours_start", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quiet_hours_end">Until</Label>
                  <Input
                    id="quiet_hours_end"
                    type="time"
                    value={settings.notifications.quiet_hours_end}
                    onChange={(e) => updateNotificationValue("quiet_hours_end", e.target.value)}
                  />
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="email_digest">Email summary</Label>
                <p className="text-sm text-muted-foreground">
                  An occasional email telling you how many new messages are waiting and which events are coming up.
                  It never includes what a message says.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.notifications.email_digest ? "On" : "Off"}
                </span>
                <Switch
                  id="email_digest"
                  checked={settings.notifications.email_digest}
                  onCheckedChange={() => updateNotification("email_digest")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Looking For */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Looking For
            </CardTitle>
            <CardDescription>
              Choose who you want to see in Browse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {[
                { value: "female", label: "Women" },
                { value: "male", label: "Men" },
                { value: "non_binary", label: "Non-binary" },
                { value: "everyone", label: "Everyone" },
              ].map((option) => {
                const isSelected = Array.isArray(settings.lookingFor) && settings.lookingFor.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    <Label
                      htmlFor={`lookingFor-${option.value}`}
                      className="flex-1 cursor-pointer py-2 text-base font-medium"
                    >
                      {option.label}
                    </Label>
                    <Checkbox
                      id={`lookingFor-${option.value}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleLookingFor(option.value)}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Choosing &quot;Everyone&quot; clears the other choices. Leave all of them empty to see everyone as well.
            </p>
          </CardContent>
        </Card>

        {/* Age Range */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Age Range
            </CardTitle>
            <CardDescription>
              Set the age range you're interested in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ageMin">Minimum Age</Label>
                <Input
                  id="ageMin"
                  type="number"
                  min="18"
                  max="120"
                  inputMode="numeric"
                  value={ageDraft.min}
                  onChange={(e) => setAgeDraft((prev) => ({ ...prev, min: e.target.value }))}
                  onBlur={commitAges}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ageMax">Maximum Age</Label>
                <Input
                  id="ageMax"
                  type="number"
                  min="18"
                  max="120"
                  inputMode="numeric"
                  value={ageDraft.max}
                  onChange={(e) => setAgeDraft((prev) => ({ ...prev, max: e.target.value }))}
                  onBlur={commitAges}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Age range: {settings.agePreferenceMin || 18} - {settings.agePreferenceMax || 100}
            </p>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="mb-6 scroll-mt-4" id="privacy">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Privacy
            </CardTitle>
            <CardDescription>
              Control your profile visibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="profileVisible">Show my profile in Browse</Label>
                <p className="text-sm text-muted-foreground">
                  Switch this off to pause your profile: nobody new will see you. Your matches and messages stay.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.privacy.profileVisible ? "On" : "Off"}
                </span>
                <Switch
                  id="profileVisible"
                  checked={settings.privacy.profileVisible}
                  onCheckedChange={() => updatePrivacy("profileVisible")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="selectiveMode">Only show me to people I have liked</Label>
                <p className="text-sm text-muted-foreground">
                  Your profile is hidden from everyone except members you have liked.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.privacy.selectiveMode ? "On" : "Off"}
                </span>
                <Switch
                  id="selectiveMode"
                  checked={settings.privacy.selectiveMode}
                  onCheckedChange={() => updatePrivacy("selectiveMode")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="showOnline">Show when I am online</Label>
                <p className="text-sm text-muted-foreground">
                  Your matches see a green dot and &quot;Online now&quot; while you are using the app.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.privacy.showOnline ? "On" : "Off"}
                </span>
                <Switch
                  id="showOnline"
                  checked={settings.privacy.showOnline}
                  onCheckedChange={() => updatePrivacy("showOnline")}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="readReceipts">Show when I have read a message</Label>
                <p className="text-sm text-muted-foreground">
                  The other person sees &quot;Seen&quot; under a message once you have opened it.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                  {settings.privacy.readReceipts ? "On" : "Off"}
                </span>
                <Switch
                  id="readReceipts"
                  checked={settings.privacy.readReceipts}
                  onCheckedChange={() => updatePrivacy("readReceipts")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blocked Users */}
        <Card className="mb-6 scroll-mt-4" id="blocked">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Blocked Members
            </CardTitle>
            <CardDescription>
              Manage your blocked users list
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleOpenBlockedUsers}
              variant="outline"
              className="w-full"
            >
              <Users className="h-4 w-4 mr-2" />
              View Blocked Members
            </Button>
          </CardContent>
        </Card>

        </>
        )}

        {/* Contact Us */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Contact Us
            </CardTitle>
            <CardDescription>
              Have questions or need help? Reach out to us
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Email Support</p>
                <a
                  href="mailto:d8lpa.community@gmail.com"
                  className="text-sm text-primary hover:underline"
                >
                  d8lpa.community@gmail.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other Links */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              More
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => setShowTermsDialog(true)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Terms & Privacy Policy</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => {
                setShowPasswordDialog(true)
                setPasswordError(null)
                setPasswordSuccess(false)
                setCurrentPassword("")
                setNewPassword("")
                setConfirmPassword("")
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Change Password</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowDisableDialog(true)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <span className="text-foreground block">Take a Break (Disable Account)</span>
                  <span className="text-xs text-muted-foreground">
                    Hide your profile. Log back in any time to reactivate.
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400 font-medium">Delete Account</span>
              </div>
              <ChevronRight className="h-5 w-5 text-red-600 dark:text-red-400" />
            </button>
          </CardContent>
        </Card>

        {/* Version info */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          D8-LPA v1.0.0
        </p>

        {/* Disable Account Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Disable Your Account
              </DialogTitle>
              <DialogDescription>
                Your profile will be hidden from all users and you won't be able to browse or message.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Note:</strong> You can reactivate your account anytime by simply logging back in with your email and password.
                </p>
              </div>
              <div>
                <Label htmlFor="disable-reason" className="text-base">
                  Why are you disabling your account? (optional)
                </Label>
                <Textarea
                  id="disable-reason"
                  placeholder="Help us improve by telling us why..."
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="disable-password" className="text-base">
                  Enter your password to confirm
                </Label>
                <PasswordInput
                  id="disable-password"
                  
                  placeholder="••••••••"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <Checkbox
                  id="disable-confirm"
                  checked={disableConfirmed}
                  onCheckedChange={(checked) => setDisableConfirmed(checked as boolean)}
                />
                <Label htmlFor="disable-confirm" className="text-sm cursor-pointer">
                  I understand that my profile will be hidden and I'm 100% sure I want to disable my account
                </Label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDisableDialog(false)
                    setDisableReason("")
                    setDisablePassword("")
                    setDisableConfirmed(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisableAccount}
                  disabled={isDisablingAccount || !disableConfirmed || !disablePassword.trim()}
                >
                  {isDisablingAccount ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    "Disable Account"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Account Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
                Delete Your Account
              </DialogTitle>
              <DialogDescription>
                Your profile is removed from the app straight away and you are signed out. Nobody can see you or write to you. To have every record erased, or to use this email address again, write to d8lpa.community@gmail.com.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                  ⚠️ This action is permanent and cannot be reversed.
                </p>
                <p className="text-sm text-red-900 dark:text-red-100">
                  If you have any questions or concerns before deleting your account, please reach out to us at{' '}
                  <a href="mailto:d8lpa.community@gmail.com" className="font-semibold underline hover:opacity-80">
                    d8lpa.community@gmail.com
                  </a>
                </p>
              </div>
              <div>
                <Label htmlFor="delete-reason" className="text-base">
                  Why are you deleting your account? (optional)
                </Label>
                <Textarea
                  id="delete-reason"
                  placeholder="Help us improve by telling us why..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="delete-password" className="text-base">
                  Enter your password to confirm
                </Label>
                <PasswordInput
                  id="delete-password"
                  
                  placeholder="••••••••"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <Checkbox
                  id="delete-confirm"
                  checked={deleteConfirmed}
                  onCheckedChange={(checked) => setDeleteConfirmed(checked as boolean)}
                />
                <Label htmlFor="delete-confirm" className="text-sm cursor-pointer">
                  I understand this is permanent and I'm 100% sure I want to delete my account
                </Label>
              </div>
              <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeleteReason("")
                    setDeletePassword("")
                    setDeleteConfirmed(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || !deleteConfirmed || !deletePassword.trim()}
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Account Permanently"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Blocked Users Dialog */}
        <Dialog open={showBlockedUsersDialog} onOpenChange={setShowBlockedUsersDialog}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Blocked Users
              </DialogTitle>
              <DialogDescription>
                {blockedUsers.length === 0
                  ? "You haven't blocked anyone yet"
                  : `You have blocked ${blockedUsers.length} user${blockedUsers.length === 1 ? "" : "s"}`}
              </DialogDescription>
            </DialogHeader>

            {isLoadingBlocked ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No blocked users</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {user.profile_picture_url ? (
                        <img
                          src={user.profile_picture_url}
                          alt={`${user.first_name} ${user.last_name}`}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {user.first_name[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Blocked on {new Date(user.blocked_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblock(user.id)}
                      disabled={isUnblocking === user.id}
                      className="ml-2 whitespace-nowrap"
                    >
                      {isUnblocking === user.id ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Unblocking...
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3 mr-1" />
                          Unblock
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Terms & Privacy Policy Dialog */}
        <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Terms & Privacy Policy
              </DialogTitle>
            </DialogHeader>
            <TermsContent />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowTermsDialog(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Your Password
              </DialogTitle>
              <DialogDescription>
                Enter your current password, then choose a new one. It needs at least 8 characters, with a capital letter, a small letter, a number and a symbol such as ! or ?.
              </DialogDescription>
            </DialogHeader>

            {passwordSuccess && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-900 dark:text-green-100 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Password changed successfully!
                </p>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-900 dark:text-red-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {passwordError}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="current-password" className="text-base">
                  Current Password <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id="current-password"
                  
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="mt-2 h-10"
                />
              </div>

              <div>
                <Label htmlFor="new-password" className="text-base">
                  New Password <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id="new-password"
                  
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="mt-2 h-10"
                />
                {newPassword && newPassword.length < 8 && (
                  <p className="text-sm text-destructive mt-1">Still needs: {passwordProblems(newPassword).join(", ") || "at least 8 characters"}</p>
                )}
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-base">
                  Confirm New Password <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id="confirm-password"
                  
                  placeholder="Type it again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="mt-2 h-10"
                />
                {confirmPassword && (
                  newPassword === confirmPassword ? (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Passwords match
                    </p>
                  ) : (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <X className="h-3 w-3" /> Passwords do not match
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowPasswordDialog(false)}
                disabled={isChangingPassword}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
    </AppLayout>
  )
}
