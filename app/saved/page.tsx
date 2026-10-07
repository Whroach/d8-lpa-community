"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bookmark, Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadError } from "@/components/load-error"
import { api } from "@/lib/api"

interface SavedProfile {
  id: string
  first_name: string
  age: number | null
  profile_picture_url: string | null
  location_city: string
  location_state: string
  bio: string
}

export default function SavedPage() {
  const [profiles, setProfiles] = useState<SavedProfile[] | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    const result = await api.favorites.getAll()
    if (result.error) {
      setError(result.error)
      return
    }
    setProfiles(result.data || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (profile: SavedProfile) => {
    const before = profiles || []
    setProfiles(before.filter((p) => p.id !== profile.id))
    const result = await api.favorites.remove(profile.id)
    if (result.error) {
      setProfiles(before)
      toast.error(`We could not remove ${profile.first_name}. ${result.error}`)
      return
    }
    toast.success(`${profile.first_name} removed from Saved`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await api.favorites.add(profile.id)
          if (undo.error) toast.error("We could not undo that.")
          else void load()
        },
      },
    })
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Bookmark className="h-8 w-8 text-primary" aria-hidden="true" />
            Saved
          </h1>
          <p className="text-lg text-muted-foreground">
            Profiles you want to find again. This list is private - nobody is told you saved them.
          </p>
        </header>

        {error ? (
          <LoadError what="your saved profiles" detail={error} onRetry={load} />
        ) : profiles === null ? (
          <div className="flex justify-center py-16" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Loading your saved profiles</span>
          </div>
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <Bookmark className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-xl font-semibold">Nothing saved yet</h2>
              <p className="text-lg text-muted-foreground">
                When you see a profile you would like to come back to, choose “Save”.
              </p>
              <Button asChild size="lg">
                <Link href="/browse">Browse members</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <Card>
                  <CardContent className="flex gap-4 p-4">
                    <img
                      src={profile.profile_picture_url || "/placeholder.svg"}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="text-xl font-semibold">
                        {profile.first_name}
                        {profile.age ? `, ${profile.age}` : ""}
                      </h2>
                      {(profile.location_city || profile.location_state) && (
                        <p className="flex items-center gap-1 text-base text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {[profile.location_city, profile.location_state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button asChild size="sm">
                          <Link href={`/profile/${profile.id}`}>View {profile.first_name}&apos;s profile</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => remove(profile)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
