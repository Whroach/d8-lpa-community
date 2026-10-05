"use client"

import React from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { RealtimeProvider } from "@/components/realtime-provider"
import { WelcomeTour } from "@/components/welcome-tour"
import { OfflineBanner } from "@/components/offline-banner"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <RealtimeProvider />
        <AppSidebar />
        <main id="main-content" tabIndex={-1} className="pb-24 outline-none md:ml-64 md:pb-0">
          <OfflineBanner />
          {children}
        </main>
        <MobileNav />
        <WelcomeTour />
      </div>
    </ProtectedRoute>
  )
}
