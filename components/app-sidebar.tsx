"use client"

import { useRouter } from "next/navigation"

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
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  Compass,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebarStore } from "@/lib/store/sidebar-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuthStore } from "@/lib/store/auth-store" // Import useAuthStore
import { useNotificationStore } from "@/lib/store/notification-store"

const navItems = [
  { href: "/profile", label: "Profile", icon: User, badgeKey: null },
  { href: "/browse", label: "Browse", icon: Compass, badgeKey: null },
  { href: "/messages", label: "Messages", icon: MessageCircle, badgeKey: "messages" },
  { href: "/matches", label: "Matches", icon: Users, badgeKey: "matches" },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/events", label: "Events", icon: Calendar, badgeKey: "events" },
]

const bottomNavItems = [
  { href: "/admin", label: "Admin", icon: Shield },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggleCollapsed } = useSidebarStore()
  const router = useRouter() // Declare router
  const { user, logout } = useAuthStore() // Declare user and logout

  // Counts are loaded and kept live by RealtimeProvider, so the sidebar and
  // the mobile nav always show the same numbers.
  const badgeCounts = useNotificationStore((state) => state.counts)
  const clearCount = useNotificationStore((state) => state.clearCount)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar hidden md:flex flex-col transition-all duration-300",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-2 px-6 py-5 border-b border-sidebar-border",
            isCollapsed && "px-4 justify-center"
          )}
        >
          <Heart className="h-8 w-8 text-primary fill-primary shrink-0" />
          {!isCollapsed && (
            <span className="text-xl font-bold text-sidebar-foreground">
              D8-LPA
            </span>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar shadow-sm hover:bg-sidebar-accent"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const badgeCount = item.badgeKey
              ? badgeCounts[item.badgeKey as keyof typeof badgeCounts]
              : 0
            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  // Clear badge count when clicking the link
                  if (item.badgeKey) {
                    clearCount(item.badgeKey as keyof typeof badgeCounts)
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative",
                  isActive
                    ? "bg-primary text-white shadow-md"
                    : "text-sidebar-foreground hover:bg-primary/10",
                  isCollapsed && "justify-center px-3"
                )}
              >
                {isCollapsed ? (
                  <div className="relative">
                    <item.icon className="h-5 w-5 shrink-0" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            )

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                    {badgeCount > 0 && ` (${badgeCount})`}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return linkContent
          })}
        </nav>

        {/* Admin, Settings & Logout */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {isCollapsed ? (
            <>
              {/* Admin tab - only show for admins */}
              {user?.role === 'admin' && bottomNavItems.map((item) => (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                        pathname === item.href
                          ? "bg-primary text-white shadow-md"
                          : "text-sidebar-foreground hover:bg-primary/10"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ))}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/settings"
                    className={cn(
                      "flex items-center justify-center px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                      pathname === "/settings"
                        ? "bg-primary text-white shadow-md"
                        : "text-sidebar-foreground hover:bg-primary/10"
                    )}
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Settings
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      logout()
                      router.push("/login")
                    }}
                    className="w-full flex items-center justify-center px-3 py-3 rounded-lg text-sm font-medium transition-colors text-white bg-destructive hover:bg-destructive/90 shadow-md"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Logout
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              {/* Admin tab - only show for admins */}
              {user?.role === 'admin' && bottomNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary text-white shadow-md"
                      : "text-sidebar-foreground hover:bg-primary/10"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              <Link
                href="/settings"
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname === "/settings"
                    ? "bg-primary text-white shadow-md"
                    : "text-sidebar-foreground hover:bg-primary/10"
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                onClick={() => {
                  logout()
                  router.push("/login")
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-white bg-destructive hover:bg-destructive/90 shadow-md"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
