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
  AlertTriangle
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

export default function SettingsPage() {
  const router = useRouter()
  const { logout } = useAuthStore()
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
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
              <Switch
                id="matches"
                checked={settings.notifications.matches}
                onCheckedChange={() => updateNotification("matches")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="messages">Messages</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when you receive a message
                </p>
              </div>
              <Switch
                id="messages"
                checked={settings.notifications.messages}
                onCheckedChange={() => updateNotification("messages")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="likes">Likes</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone likes your profile
                </p>
              </div>
              <Switch
                id="likes"
                checked={settings.notifications.likes}
                onCheckedChange={() => updateNotification("likes")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="events">Events</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about event updates
                </p>
              </div>
              <Switch
                id="events"
                checked={settings.notifications.events}
                onCheckedChange={() => updateNotification("events")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="admin_news">Admin Announcements</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about admin news and announcements
                </p>
              </div>
              <Switch
                id="admin_news"
                checked={settings.notifications.admin_news}
                onCheckedChange={() => updateNotification("admin_news")}
              />
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
              ].map((option) => (
                <div key={option.value} className="flex items-center justify-between">
                  <Label htmlFor={`lookingFor-${option.value}`}>{option.label}</Label>
                  <Checkbox
                    id={`lookingFor-${option.value}`}
                    checked={Array.isArray(settings.lookingFor) && settings.lookingFor.includes(option.value)}
                    onCheckedChange={() => toggleLookingFor(option.value)}
                  />
                </div>
              ))}
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
              <Switch
                id="profileVisible"
                checked={settings.privacy.profileVisible}
                onCheckedChange={() => updatePrivacy("profileVisible")}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="selectiveMode">Selective Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Only show your profile to users you have liked. Hidden from users you have not liked.
                </p>
              </div>
              <Switch
                id="selectiveMode"
                checked={settings.privacy.selectiveMode}
                onCheckedChange={() => updatePrivacy("selectiveMode")}
              />
            </div>
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
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Safety Center</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Help & Support</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Terms & Privacy Policy</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Danger Zone - Account Management */}
        <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              Irreversible actions - proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-950 border border-red-200 dark:border-red-800">
              <div>
                <Label className="text-base font-semibold text-red-600 dark:text-red-400">Disable Account</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Your profile will be hidden from all users. You can re-enable it later by logging in.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDisableDialog(true)}
                className="whitespace-nowrap ml-4"
              >
                Disable
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-950 border border-red-200 dark:border-red-800">
              <div>
                <Label className="text-base font-semibold text-red-600 dark:text-red-400">Delete Account</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="whitespace-nowrap ml-4"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
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
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
}
