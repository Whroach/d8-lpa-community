"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Shield } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminReports } from "@/components/admin-reports"
import { ActivityLog } from "@/components/admin/activity-log"
import { EventsTab } from "@/components/admin/events-tab"
import { MembersTab } from "@/components/admin/members-tab"
import { NewsTab } from "@/components/admin/news-tab"
import { useAuthStore } from "@/lib/store/auth-store"

// The access check lives in this wrapper so that AdminDashboard — which owns
// all the hooks — is only ever mounted for a confirmed admin. Previously the
// guard sat above the hook calls inside a single component, which both broke
// the Rules of Hooks (hook count changed once `user` hydrated) and called
// router.push() during render, throwing "location is not defined" in SSR.
export default function AdminPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted && !user) {
      router.push("/login")
    }
  }, [isMounted, user, router])

  if (!isMounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (user.role !== "admin") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don&apos;t have admin privileges.</p>
          <Button className="min-h-11" onClick={() => router.push("/browse")}>
            Return to Browse
          </Button>
        </div>
      </main>
    )
  }

  return <AdminDashboard />
}

const TABS = [
  { value: "reports", label: "Reports" },
  { value: "members", label: "Members" },
  { value: "events", label: "Events" },
  { value: "news", label: "News" },
  { value: "activity", label: "Activity log" },
] as const

/**
 * The admin panel. Each tab is its own component under components/admin and
 * loads its own data when it is opened, a page at a time.
 */
function AdminDashboard() {
  const [tab, setTab] = useState<string>("reports")
  const [waiting, setWaiting] = useState<number | null>(null)

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Admin Panel</h1>
          </div>
          <p className="text-base text-muted-foreground">
            Look after the community: answer member reports, manage members, events and announcements, and see what
            admins have done.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="min-h-11 gap-2 px-4 text-base">
                {item.label}
                {item.value === "reports" && waiting !== null && waiting > 0 && (
                  <span className="rounded-full bg-red-700 px-2 py-0.5 text-sm font-semibold text-white" data-testid="reports-waiting">
                    {waiting}
                    <span className="sr-only"> waiting</span>
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="reports">
            <AdminReports onWaiting={setWaiting} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab />
          </TabsContent>
          <TabsContent value="events">
            <EventsTab />
          </TabsContent>
          <TabsContent value="news">
            <NewsTab />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityLog />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
