"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Heart,
  Users,
  MessageCircle,
  User,
  Calendar,
  Bell,
  Settings,
  Shield,
  LogOut,
  Compass,
  Bookmark,
  LifeBuoy,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/store/auth-store"
import { useNotificationStore, type BadgeCounts } from "@/lib/store/notification-store"
import { useLogout } from "@/lib/use-logout"

type NavItem = {
  href: string
  label: string
  icon: typeof User
  badgeKey: keyof BadgeCounts | null
}

export const mainNavItems: NavItem[] = [
  { href: "/browse", label: "Browse", icon: Compass, badgeKey: null },
  { href: "/matches", label: "Matches", icon: Users, badgeKey: "matches" },
  { href: "/messages", label: "Messages", icon: MessageCircle, badgeKey: "messages" },
  { href: "/events", label: "Events", icon: Calendar, badgeKey: "events" },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/saved", label: "Saved", icon: Bookmark, badgeKey: null },
  { href: "/profile", label: "My Profile", icon: User, badgeKey: null },
]

export const secondaryNavItems: NavItem[] = [
  { href: "/safety", label: "Safety", icon: ShieldCheck, badgeKey: null },
  { href: "/help", label: "Help", icon: LifeBuoy, badgeKey: null },
  { href: "/settings", label: "Settings", icon: Settings, badgeKey: null },
]

export const badgeText = (count: number) => (count > 99 ? "99+" : String(count))

/** "/profile" is only active on your own profile, not on "/profile/<id>". */
export const isNavActive = (pathname: string, href: string) =>
  pathname === href || (href !== "/profile" && pathname.startsWith(`${href}/`))

/**
 * Desktop navigation. Always shows a word beside every icon - the old
 * collapsed, icon-only mode is gone: it saved a little space at the cost of
 * people having to remember what each picture meant.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const badgeCounts = useNotificationStore((state) => state.counts)
  const logout = useLogout()

  const renderLink = (item: NavItem) => {
    const isActive = isNavActive(pathname, item.href)
    const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "flex min-h-12 items-center gap-3 rounded-lg px-4 py-2.5 text-base font-medium transition-colors",
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground hover:bg-muted"
          )}
        >
          <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{item.label}</span>
          {count > 0 && (
            <span
              className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                isActive ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
              )}
            >
              <span aria-hidden="true">{badgeText(count)}</span>
              <span className="sr-only">{count} new</span>
            </span>
          )}
        </Link>
      </li>
    )
  }

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <Link href="/browse" className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
        <Heart className="h-8 w-8 shrink-0 fill-primary text-primary" aria-hidden="true" />
        <span className="text-xl font-bold text-sidebar-foreground">D8-LPA</span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4" data-tour="nav">
        <ul className="space-y-1">{mainNavItems.map(renderLink)}</ul>
      </nav>

      <nav aria-label="Help and settings" className="border-t border-sidebar-border p-3">
        <ul className="space-y-1">
          {secondaryNavItems.map(renderLink)}
          {user?.role === "admin" &&
            renderLink({ href: "/admin", label: "Admin", icon: Shield, badgeKey: null })}
          <li>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 py-2.5 text-base font-medium text-sidebar-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              Log Out
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
