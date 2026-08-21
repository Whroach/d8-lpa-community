"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Compass,
  Users,
  MessageCircle,
  User,
  Calendar,
  Bell,
  Settings,
  LogOut,
  Shield,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/store/auth-store"
import { useNotificationStore } from "@/lib/store/notification-store"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// The five primary destinations. Everything else lives behind "More" — on
// mobile there is no sidebar, so without that menu Events, Notifications and
// Settings were unreachable entirely.
const navItems = [
  { href: "/browse", label: "Browse", icon: Compass, badgeKey: null },
  { href: "/matches", label: "Matches", icon: Users, badgeKey: "matches" },
  { href: "/messages", label: "Chat", icon: MessageCircle, badgeKey: "messages" },
  { href: "/profile", label: "Profile", icon: User, badgeKey: null },
] as const

const moreItems = [
  { href: "/events", label: "Events", icon: Calendar, badgeKey: "events" },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/settings", label: "Settings", icon: Settings, badgeKey: null },
] as const

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  // Same source as the desktop sidebar — RealtimeProvider loads these once and
  // keeps them live, so the two navs can no longer disagree.
  const badgeCounts = useNotificationStore((state) => state.counts)

  const moreBadgeTotal =
    badgeCounts.events + badgeCounts.notifications

  const renderBadge = (count: number) =>
    count > 0 ? (
      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
        {count > 9 ? "9+" : count}
      </span>
    ) : null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const count = item.badgeKey
            ? badgeCounts[item.badgeKey as keyof typeof badgeCounts]
            : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                // min-h-14 keeps every tap target comfortably above the 44px
                // accessibility floor.
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-14 px-1 py-1.5 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative">
                <item.icon className={cn("h-6 w-6", isActive && "fill-primary/20")} />
                {renderBadge(count)}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}

        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-14 px-1 py-1.5 rounded-lg transition-colors",
                moreItems.some((i) => i.href === pathname)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative">
                <Menu className="h-6 w-6" />
                {renderBadge(moreBadgeTotal)}
              </span>
              <span className="text-xs font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {moreItems.map((item) => {
                const count = item.badgeKey
                  ? badgeCounts[item.badgeKey as keyof typeof badgeCounts]
                  : 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-4 rounded-lg text-base font-medium transition-colors",
                      pathname === item.href
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                )
              })}

              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-4 rounded-lg text-base font-medium transition-colors",
                    pathname === "/admin"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Shield className="h-5 w-5 shrink-0" />
                  Admin
                </Link>
              )}

              <button
                onClick={() => {
                  setIsMoreOpen(false)
                  logout()
                  router.push("/login")
                }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-lg text-base font-medium text-white bg-destructive hover:bg-destructive/90 transition-colors"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Log Out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
