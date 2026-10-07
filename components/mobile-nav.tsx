"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Users, MessageCircle, User, Calendar, Bell, LogOut, Shield, Menu, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/store/auth-store"
import { useNotificationStore, type BadgeCounts } from "@/lib/store/notification-store"
import { useLogout } from "@/lib/use-logout"
import { secondaryNavItems, badgeText, isNavActive } from "@/components/app-sidebar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type Item = { href: string; label: string; icon: typeof User; badgeKey: keyof BadgeCounts | null }

// The four places people go most, plus "More". Every item has a word under
// its icon.
const navItems: Item[] = [
  { href: "/browse", label: "Browse", icon: Compass, badgeKey: null },
  { href: "/matches", label: "Matches", icon: Users, badgeKey: "matches" },
  { href: "/messages", label: "Messages", icon: MessageCircle, badgeKey: "messages" },
  { href: "/profile", label: "Profile", icon: User, badgeKey: null },
]

const moreItems: Item[] = [
  { href: "/events", label: "Events", icon: Calendar, badgeKey: "events" },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/saved", label: "Saved", icon: Bookmark, badgeKey: null },
  ...secondaryNavItems,
]

export function MobileNav() {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const badgeCounts = useNotificationStore((state) => state.counts)

  const moreBadgeTotal = badgeCounts.events + badgeCounts.notifications

  const renderBadge = (count: number) =>
    count > 0 ? (
      <span className="absolute -right-2 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
        <span aria-hidden="true">{count > 9 ? "9+" : count}</span>
        <span className="sr-only">{count} new</span>
      </span>
    ) : null

  const tabClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors",
      active ? "font-bold text-primary" : "text-foreground hover:bg-muted"
    )

  return (
    <nav
      aria-label="Main"
      data-tour="nav-mobile"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex items-stretch justify-around px-1 py-1">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href)
          const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <span className="relative">
                <item.icon className={cn("h-6 w-6", active && "fill-primary/20")} aria-hidden="true" />
                {renderBadge(count)}
              </span>
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}

        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={tabClass(moreItems.some((i) => isNavActive(pathname, i.href)) || pathname === "/admin")}
            >
              <span className="relative">
                <Menu className="h-6 w-6" aria-hidden="true" />
                {renderBadge(moreBadgeTotal)}
              </span>
              <span className="text-xs">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>More</SheetTitle>
              <SheetDescription className="sr-only">Other parts of the app</SheetDescription>
            </SheetHeader>
            <ul className="mt-2 space-y-1 pb-4">
              {[
                ...moreItems,
                ...(user?.role === "admin"
                  ? [{ href: "/admin", label: "Admin", icon: Shield, badgeKey: null } as Item]
                  : []),
              ].map((item) => {
                const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0
                const active = isNavActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-lg px-4 py-3 text-lg font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-sm font-bold text-primary-foreground">
                          <span aria-hidden="true">{badgeText(count)}</span>
                          <span className="sr-only">{count} new</span>
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false)
                    logout()
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg px-4 py-3 text-lg font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <LogOut className="h-6 w-6 shrink-0" aria-hidden="true" />
                  Log Out
                </button>
              </li>
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
