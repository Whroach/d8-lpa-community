"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Compass, Heart, MessageCircle, Calendar, ShieldCheck, Settings, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/lib/store/auth-store"
import { api } from "@/lib/api"

export const START_TOUR_EVENT = "d8lpa:start-tour"

/** Call from anywhere inside the app to show the tour again. */
export function replayTour() {
  window.dispatchEvent(new Event(START_TOUR_EVENT))
}

const STEPS = [
  {
    icon: PartyPopper,
    title: "Welcome to D8-LPA",
    body: "This is a short tour of the main parts of the app. It takes about a minute, and you can see it again any time from the Help page.",
  },
  {
    icon: Compass,
    title: "Browse: meet other members",
    body: "Browse shows members one card at a time. Tap a card to read the whole profile. Tap Like if you would enjoy talking to them - they are only told who you are if they like you too.",
  },
  {
    icon: Heart,
    title: "Matches: you both said yes",
    body: "When you and another member like each other, that is a match. Matches is the list of everyone you can now write to.",
  },
  {
    icon: MessageCircle,
    title: "Messages: have a conversation",
    body: "Write to your matches here. A number beside Messages means someone has written to you. You can edit or take back a message you sent.",
  },
  {
    icon: Calendar,
    title: "Events: get together",
    body: "See picnics, chapter meetings and socials. Tap “I'm going” to RSVP, add the event to your calendar, and see who else is going.",
  },
  {
    icon: ShieldCheck,
    title: "Staying safe",
    body: "You can block or report anyone from their profile or from a conversation. Never send money or gift cards to someone you met online. The Safety page has plain advice.",
  },
  {
    icon: Settings,
    title: "Make it comfortable",
    body: "In Settings you can make the text larger, switch to a dark screen, choose which notifications you get, and decide who can see you.",
  },
]

/**
 * A short welcome walkthrough shown once after a member first signs in, and
 * again whenever they ask for it from Help.
 */
export function WelcomeTour() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  // First sign-in: only once the profile exists and the flag says "not yet".
  useEffect(() => {
    if (user && user.onboarding_completed && user.has_seen_tour === false) {
      setStep(0)
      setOpen(true)
    }
    // Only react to a change of member or of the flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.has_seen_tour])

  useEffect(() => {
    const start = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(START_TOUR_EVENT, start)
    return () => window.removeEventListener(START_TOUR_EVENT, start)
  }, [])

  const finish = useCallback(() => {
    setOpen(false)
    const current = useAuthStore.getState().user
    if (current && current.has_seen_tour !== true) {
      setUser({ ...current, has_seen_tour: true })
      void api.users.updateProfile({ has_seen_tour: true })
    }
  }, [setUser])

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const Icon = current.icon

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : finish())}>
      <DialogContent className="max-w-lg" data-testid="welcome-tour">
        <DialogHeader className="items-center text-center sm:text-center">
          <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
          </span>
          <DialogTitle className="text-2xl">{current.title}</DialogTitle>
          <DialogDescription className="text-lg leading-relaxed text-foreground">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        {isLast && (
          <p className="text-center text-base">
            <Link href="/settings" className="font-semibold text-primary underline" onClick={finish}>
              Open Settings now
            </Link>
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          Step {step + 1} of {STEPS.length}
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={finish} className={isLast ? "invisible" : undefined}>
            Skip the tour
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button onClick={finish}>Finish</Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
