"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store/auth-store"
import { useNotificationStore } from "@/lib/store/notification-store"
import { disconnectSocket } from "@/lib/socket"

/**
 * Signing out has to do more than clear the token: the live connection and the
 * badge counts belonged to the member who just left. Before, the next person
 * to sign in on the same device inherited both.
 */
export function useLogout() {
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const resetBadges = useNotificationStore((state) => state.reset)

  return useCallback(() => {
    disconnectSocket()
    resetBadges()
    logout()
    router.push("/login")
  }, [logout, resetBadges, router])
}
