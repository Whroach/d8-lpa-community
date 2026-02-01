"use client"

import React from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { useSidebarStore } from "@/lib/store/sidebar-store"
import { cn } from "@/lib/utils"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isCollapsed } = useSidebarStore()

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <main
          className={cn(
            "pb-20 md:pb-0 transition-all duration-300",
            isCollapsed ? "md:ml-[72px]" : "md:ml-64"
          )}
        >
          {children}
        </main>
        <MobileNav />
      </div>
    </ProtectedRoute>
  )
}
