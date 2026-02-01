"use client"

import React from "react"

import { useState } from "react"
import Image from "next/image"
import { MapPin, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ProfileCardProps {
  profile: {
    id: string
    name: string
    age: number
    location: string
    bio: string
    interests: string[]
    photos: string[]
  }
  className?: string
}

export function ProfileCard({ profile, className }: ProfileCardProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const photos = profile.photos?.length > 0 ? profile.photos : ["/placeholder-user.jpg"]

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  return (
    <div
      className={cn(
        "relative w-full max-w-sm mx-auto aspect-[3/4] rounded-2xl overflow-hidden shadow-xl bg-card",
        className
      )}
    >
      {/* Photo */}
      <div className="absolute inset-0">
        <Image
          src={photos[currentPhotoIndex] || "/placeholder.svg"}
          alt={profile.name}
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Photo navigation dots */}
      {photos.length > 1 && (
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 px-4">
          {photos.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                index === currentPhotoIndex ? "bg-white" : "bg-white/40"
              )}
            />
          ))}
        </div>
      )}

      {/* Photo navigation buttons */}
      {photos.length > 1 && (
        <>
          <button
            onClick={prevPhoto}
            className="absolute left-0 top-0 bottom-24 w-1/3 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-8 w-8 text-white drop-shadow-lg" />
          </button>
          <button
            onClick={nextPhoto}
            className="absolute right-0 top-0 bottom-24 w-1/3 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Next photo"
          >
            <ChevronRight className="h-8 w-8 text-white drop-shadow-lg" />
          </button>
        </>
      )}

      {/* Profile info */}
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <div className="mb-3">
          <h2 className="text-2xl font-bold">
            {profile.name}, {profile.age}
          </h2>
          <div className="flex items-center gap-1.5 text-white/80 mt-1">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">{profile.location}</span>
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-white/90 line-clamp-2 mb-3">{profile.bio}</p>
        )}

        {profile.interests?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.interests.slice(0, 4).map((interest) => (
              <Badge
                key={interest}
                variant="secondary"
                className="bg-white/20 text-white border-0 hover:bg-white/30"
              >
                {interest}
              </Badge>
            ))}
            {profile.interests.length > 4 && (
              <Badge
                variant="secondary"
                className="bg-white/20 text-white border-0"
              >
                +{profile.interests.length - 4}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
