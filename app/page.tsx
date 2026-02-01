"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Heart, Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/store/auth-store"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    // Small delay to allow hydration
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.push("/dashboard")
      } else {
        router.push("/login")
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <Heart className="h-12 w-12 text-primary fill-primary animate-pulse" />
          <span className="text-4xl font-bold text-foreground">D8-LPA</span>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}
