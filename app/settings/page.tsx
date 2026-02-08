"use client"

import { SelectItem } from "@/components/ui/select"
import { SelectContent } from "@/components/ui/select"
import { SelectValue } from "@/components/ui/select"
import { SelectTrigger } from "@/components/ui/select"
import { Select } from "@/components/ui/select"
import { useState, useEffect } from "react"
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
  Moon,
  Sun,
  Check,
  Trash2,
  AlertTriangle,
  X,
  Users
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { ProtectedRoute } from "@/components/protected-route"
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
import { Avatar } from "@/components/ui/avatar"

type BlockedUser = {
  id: string
  first_name: string
  last_name: string
  profile_picture_url: string | null
  blocked_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { logout } = useAuthStore()
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
      showOnlineStatus: true,
      showLastActive: true,
      showDistance: true,
    },
  })

  const [originalSettings, setOriginalSettings] = useState(settings)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const result = await api.settings.get()
    if (result.data) {
      // Ensure all fields have proper defaults, especially lookingFor
      const loadedSettings = {
        theme: result.data.theme || "light",
        lookingFor: Array.isArray(result.data.lookingFor) ? result.data.lookingFor : [],
        notifications: {
          matches: result.data.notifications?.matches ?? true,
          messages: result.data.notifications?.messages ?? true,
          likes: result.data.notifications?.likes ?? true,
          events: result.data.notifications?.events ?? true,
          admin_news: result.data.notifications?.admin_news ?? true,
        },
        privacy: {
          profileVisible: result.data.privacy?.profileVisible ?? true,
          selectiveMode: result.data.privacy?.selectiveMode ?? false,
          showOnlineStatus: result.data.privacy?.showOnlineStatus ?? true,
          showLastActive: result.data.privacy?.showLastActive ?? true,
          showDistance: result.data.privacy?.showDistance ?? true,
        },
      }
      setSettings(loadedSettings)
      setOriginalSettings(loadedSettings)
      setHasChanges(false)
      setSaveSuccess(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    await api.settings.update(settings)
    setOriginalSettings(settings)
    setHasChanges(false)
    setSaveSuccess(true)
    setIsSaving(false)
    
    // Clear success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleDisableAccount = async () => {
    if (!disableConfirmed || !disablePassword.trim()) {
      alert("Please confirm you want to disable your account and enter your password")
      return
    }

    setIsDisablingAccount(true)
    try {
      const result = await api.settings.disableAccount({
        reason: disableReason,
        password: disablePassword
      })
      
      if (result.data) {
        alert("Your account has been disabled. You will be logged out.")
        logout()
        router.push("/login")
      } else if (result.error) {
        alert(result.error)
      }
    } catch (error) {
      alert("Error disabling account. Please try again.")
      console.error(error)
    } finally {
      setIsDisablingAccount(false)
      setShowDisableDialog(false)
      setDisableReason("")
      setDisablePassword("")
      setDisableConfirmed(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirmed || !deletePassword.trim()) {
      alert("Please confirm you want to delete your account and enter your password")
      return
    }

    setIsDeletingAccount(true)
    try {
      const result = await api.settings.deleteAccount({
        reason: deleteReason,
        password: deletePassword
      })
      
      if (result.data) {
        alert("Your account has been deleted. You will be logged out.")
        logout()
        router.push("/login")
      } else if (result.error) {
        alert(result.error)
      }
    } catch (error) {
      alert("Error deleting account. Please try again.")
      console.error(error)
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteDialog(false)
      setDeleteReason("")
      setDeletePassword("")
      setDeleteConfirmed(false)
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
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters")
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
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })

      const result = await response.json()

      if (response.ok) {
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
        setPasswordError(result.error || "Failed to change password")
      }
    } catch (error) {
      setPasswordError("Error changing password. Please try again.")
      console.error(error)
    } finally {
      setIsChangingPassword(false)
    }
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
        alert("Error loading blocked users: " + result.error)
      }
    } catch (error) {
      console.error("Error loading blocked users:", error)
      alert("Error loading blocked users")
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
        setBlockedUsers(blockedUsers.filter(u => u.id !== userId))
      } else if (result.error) {
        alert("Error unblocking user: " + result.error)
      }
    } catch (error) {
      console.error("Error unblocking user:", error)
      alert("Error unblocking user")
    } finally {
      setIsUnblocking(null)
    }
  }

  return (
    <ProtectedRoute>
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
          
          {/* Save Button */}
          {hasChanges && (
            <Button
              onClick={saveSettings}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          )}
          
          {saveSuccess && !hasChanges && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check className="h-4 w-4" />
              Saved
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <Card className="mb-6">
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
            <div className="flex items-center justify-between">
              <div>
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
            <div className="flex items-center justify-between">
              <div>
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
            <div className="flex items-center justify-between">
              <div>
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
            <div className="flex items-center justify-between">
              <div>
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
            <div className="flex items-center justify-between">
              <div>
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
                { value: "non-binary", label: "Non-binary" },
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
                    onClick={() => toggleLookingFor(option.value)}
                  >
                    <Label
                      htmlFor={`lookingFor-${option.value}`}
                      className="cursor-pointer font-medium"
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
              Selecting "Everyone" will clear other selections.
            </p>
          </CardContent>
        </Card>

{/* Privacy Settings */}
        <Card className="mb-6">
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
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="profileVisible">Profile Visibility</Label>
                <p className="text-sm text-muted-foreground">
                  Make your profile visible in Browse. If disabled, your profile will be hidden from all users.
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
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="selectiveMode">Selective Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Only show your profile to users you have liked. Hidden from users you have not liked.
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
          </CardContent>
        </Card>

        {/* Blocked Users */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Blocked Users
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
              View Blocked Users
            </Button>
          </CardContent>
        </Card>

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
                <Input
                  id="disable-password"
                  type="password"
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
                This will permanently delete your account and all associated data. This action cannot be undone.
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
                <Input
                  id="delete-password"
                  type="password"
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
              <div className="flex gap-3 pt-4">
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
            <div className="space-y-6 py-4">
              {/* Terms of Service */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Terms of Service</h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Welcome to D8-LPA Community. By accessing and using this platform, you agree to be bound by these terms and conditions.
                  </p>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">1. User Conduct</h4>
                    <p>
                      Users agree to use the platform respectfully and lawfully. Any form of harassment, discrimination, or abusive behavior is strictly prohibited.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">2. Content Responsibility</h4>
                    <p>
                      You are responsible for all content you post. We reserve the right to remove content that violates our guidelines or applicable laws.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">3. Account Security</h4>
                    <p>
                      You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized access.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">4. Limitation of Liability</h4>
                    <p>
                      D8-LPA Community is provided "as is" without warranties. We are not liable for any indirect, incidental, special, or consequential damages.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">5. Termination</h4>
                    <p>
                      We reserve the right to terminate or suspend accounts that violate these terms without prior notice.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Privacy Policy */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Privacy Policy</h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Your privacy is important to us. This policy outlines how we collect, use, and protect your information.
                  </p>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">1. Information Collection</h4>
                    <p>
                      We collect information you provide directly (profile data, photos, preferences) and information collected automatically (device information, usage analytics).
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">2. Data Usage</h4>
                    <p>
                      Your data is used to provide, improve, and personalize our services. We do not sell or share your personal information with third parties without consent.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">3. Security Measures</h4>
                    <p>
                      We implement industry-standard security measures to protect your information from unauthorized access, alteration, and destruction.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">4. Cookies & Tracking</h4>
                    <p>
                      We use cookies and similar technologies to enhance your experience. You can control cookie settings through your browser.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">5. Your Rights</h4>
                    <p>
                      You have the right to access, correct, or delete your personal information. Contact us for any privacy-related requests.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">6. Contact Us</h4>
                    <p>
                      For privacy inquiries, please contact us at d8lpa.community@gmail.com
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Last Updated */}
              <p className="text-xs text-muted-foreground text-center">
                Last updated: February 2026
              </p>
            </div>
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
                Enter your current password and choose a new password. Password must be at least 8 characters.
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
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter your current password"
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
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter a new password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="mt-2 h-10"
                />
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-base">
                  Confirm New Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="mt-2 h-10"
                />
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
    </ProtectedRoute>
  )
}
