"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function NotificationsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to browse page as notifications tab is disabled
    router.replace("/browse")
  }, [router])

  return null
}

