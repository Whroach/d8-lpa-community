"use client"

import React from "react"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/store/auth-store"
import { api } from "@/lib/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, checkSession, logout, token, user, setUser, setProfile, refreshSession } = useAuthStore()
  const [isMounted, setIsMounted] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const timedOut = useRef(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    // Check if session is still valid
    const isSessionValid = checkSession()

    // If user is not authenticated or session expired, redirect to login
    if (!isAuthenticated || !isSessionValid || !token) {
      if (isAuthenticated && !isSessionValid) {
        // Signing out re-runs this effect; remember why, so the plain
        // redirect below does not replace the one that carries the
        // explanation. (It used to, and the member was signed out after
        // eight hours with no word about why.)
        timedOut.current = true
        logout()
        router.replace("/login?expired=1")
        return
      }
      if (timedOut.current) return
      router.push("/login")
      return
    }

    // Someone who has not finished setting up their profile goes back to it,
    // instead of wandering the app with an empty profile.
    if (user && user.onboarding_completed === false && user.role !== "admin") {
      router.push("/onboarding")
      return
    }

    // Verify user status with backend, and pick up anything that changed on
    // another device (for example the welcome tour already being done).
    let cancelled = false
    const verifyUserStatus = async () => {
      const result = await api.auth.me()
      if (cancelled) return
      if (result.error && result.error.includes("suspended or banned")) {
        setShowBanModal(true)
        logout()
        return
      }
      if (result.data?.user) {
        const fresh = result.data.user
        // Using the app keeps the session alive; it only times out after
        // eight hours of not being used.
        refreshSession()
        const current = useAuthStore.getState().user
        if (
          current &&
          (current.has_seen_tour !== fresh.has_seen_tour ||
            current.onboarding_completed !== fresh.onboarding_completed ||
            current.role !== fresh.role)
        ) {
          setUser({ ...current, ...fresh, id: fresh.id || fresh._id })
          if (result.data.profile) setProfile(result.data.profile)
        }
      }
    }
    verifyUserStatus()
    return () => {
      cancelled = true
    }
    // `pathname` is here on purpose: the checks run again on each navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isMounted, token, pathname])

  // Show loading spinner while checking authentication. (This used to also
  // wait on a shared "isLoading" flag that some screens set and never
  // cleared, which left a spinner on screen forever.)
  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  // If not authenticated, don't render children (user will be redirected)
  if (!isAuthenticated && !showBanModal) {
    return null
  }

  return (
    <>
      <AlertDialog open={showBanModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Suspended or Banned</AlertDialogTitle>
            <AlertDialogDescription>
              Your account has been suspended or banned. Please contact d8lpa.community@gmail.com for more info.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => router.push("/login")}>Go to Login</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
      {!showBanModal && children}
    </>
  )
}
