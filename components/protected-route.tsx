"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/store/auth-store"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { isAuthenticated, isLoading, checkSession, logout, token } = useAuthStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted || isLoading) return

    // Check if session is still valid
    const isSessionValid = checkSession()
    
    // If user is not authenticated or session expired, redirect to login
    if (!isAuthenticated || !isSessionValid || !token) {
      if (isAuthenticated && !isSessionValid) {
        // Session expired, log out
        logout()
      }
      router.push('/login')
      return
    }
  }, [isAuthenticated, isLoading, isMounted, router, checkSession, logout, token])

  // Show loading spinner while checking authentication
  if (!isMounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // If not authenticated, don't render children (user will be redirected)
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
