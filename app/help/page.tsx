"use client"

import Link from "next/link"
import { LifeBuoy, PlayCircle, Smartphone } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { replayTour } from "@/components/welcome-tour"

type HowTo = { question: string; steps: string[]; link?: { href: string; label: string } }

const SECTIONS: { title: string; items: HowTo[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        question: "How do I make the text bigger?",
        steps: ["Open Settings.", "Under “Display”, choose Large or Extra large.", "The whole app changes straight away."],
        link: { href: "/settings#display", label: "Open display settings" },
      },
      {
        question: "How do I switch between a light and a dark screen?",
        steps: ["Open Settings.", "Under “Display”, choose Light, Dark, or Same as my device."],
        link: { href: "/settings#display", label: "Open display settings" },
      },
      {
        question: "How do I change my profile or add photos?",
        steps: [
          "Open My Profile.",
          "Choose “Edit Profile”, change what you like, then choose “Save”.",
          "To add a photo, choose “Add photo”. Clear, recent pictures of you smiling work best.",
        ],
        link: { href: "/profile", label: "Open My Profile" },
      },
    ],
  },
  {
    title: "Meeting people",
    items: [
      {
        question: "How do likes and matches work?",
        steps: [
          "In Browse, choose “Like” on someone you would enjoy talking to.",
          "They are told that somebody liked them, but not who.",
          "If they like you too, you match. You both get a notification and can start writing.",
        ],
        link: { href: "/browse", label: "Open Browse" },
      },
      {
        question: "What is “Save”?",
        steps: [
          "Save is a private bookmark, for a profile you want to find again.",
          "The other person is never told. It is not a like.",
          "Find your saved profiles under “Saved” in the menu.",
        ],
        link: { href: "/saved", label: "Open Saved" },
      },
      {
        question: "How do I send a message?",
        steps: [
          "Open Messages and choose a person.",
          "Type in the box at the bottom, then choose “Send”.",
          "Stuck for words? Choose one of the suggested openers above the box and change it however you like.",
        ],
        link: { href: "/messages", label: "Open Messages" },
      },
      {
        question: "Can I change or take back a message?",
        steps: [
          "Under a message you sent, choose “Edit” to change it, or “Unsend” to take it back.",
          "The other person sees “Edited”, or “Message unsent”.",
        ],
      },
      {
        question: "What do “Seen” and “typing…” mean?",
        steps: [
          "“Seen” under your message means the other person has opened it.",
          "“typing…” means they are writing to you right now.",
          "You can switch off “Seen” for your own reading in Settings, under Privacy.",
        ],
      },
    ],
  },
  {
    title: "Events",
    items: [
      {
        question: "How do I say I am going to an event?",
        steps: [
          "Open Events and choose an event.",
          "Choose “I'm going”. You can change your mind with “I can't go”.",
          "Choose “Add to my calendar” to save the date on your phone or computer.",
        ],
        link: { href: "/events", label: "Open Events" },
      },
      {
        question: "How do I offer or ask for a lift?",
        steps: [
          "After choosing “I'm going”, write a short note - for example “Driving from Tulsa, two seats free”.",
          "Your note appears beside your name under “Who's going”.",
        ],
      },
    ],
  },
  {
    title: "Notifications and quiet time",
    items: [
      {
        question: "How do I turn the notification sound on or off?",
        steps: ["Open Settings.", "Under “Notifications”, switch “Notification sound” on or off."],
        link: { href: "/settings#notifications", label: "Open notification settings" },
      },
      {
        question: "What are quiet hours?",
        steps: [
          "During quiet hours the app makes no sound.",
          "Messages still arrive and the numbers in the menu still update.",
          "Set the times in Settings, under “Notifications”.",
        ],
        link: { href: "/settings#notifications", label: "Open notification settings" },
      },
    ],
  },
  {
    title: "Privacy and your account",
    items: [
      {
        question: "How do I block or report someone?",
        steps: [
          "Open their profile or your conversation with them.",
          "Choose “Block” or “Report”.",
          "They are never told. You can unblock later in Settings.",
        ],
        link: { href: "/safety", label: "Read the Safety Centre" },
      },
      {
        question: "How do I hide my profile for a while?",
        steps: [
          "Open Settings.",
          "Under “Privacy”, switch off “Show my profile in Browse”.",
          "Your matches and messages stay. Switch it back on whenever you like.",
        ],
        link: { href: "/settings#privacy", label: "Open privacy settings" },
      },
      {
        question: "I forgot my password",
        steps: [
          "On the Log In page, choose “Forgot password?”.",
          "Enter your email address. We send you a link.",
          "Open the link and choose a new password. Check your spam folder if the email does not arrive.",
        ],
      },
    ],
  },
]

export default function HelpPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <LifeBuoy className="h-8 w-8 text-primary" aria-hidden="true" />
            Help
          </h1>
          <p className="text-lg text-muted-foreground">Short answers to common questions. Choose a question to open it.</p>
        </header>

        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg">New here, or want a reminder of where everything is?</p>
            <Button onClick={replayTour} size="lg">
              <PlayCircle aria-hidden="true" />
              Take the tour
            </Button>
          </CardContent>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {section.items.map((item) => (
                  <AccordionItem key={item.question} value={item.question}>
                    <AccordionTrigger className="min-h-12 text-left text-lg font-medium">{item.question}</AccordionTrigger>
                    <AccordionContent>
                      <ol className="list-decimal space-y-2 pl-6 text-lg">
                        {item.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      {item.link && (
                        <Button asChild variant="outline" className="mt-4">
                          <Link href={item.link.href}>{item.link.label}</Link>
                        </Button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Smartphone className="h-6 w-6 text-primary" aria-hidden="true" />
              Put D8-LPA on your home screen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-lg">
            <p>You can open D8-LPA like any other app, without typing the address.</p>
            <p>
              <strong>iPhone or iPad (Safari):</strong> tap the Share button (a square with an arrow), then “Add to Home
              Screen”.
            </p>
            <p>
              <strong>Android (Chrome):</strong> tap the three dots at the top right, then “Add to Home screen” or
              “Install app”.
            </p>
            <p>
              <strong>Computer (Chrome or Edge):</strong> look for the small install icon at the right of the address
              bar.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5 text-lg">
            <p className="font-semibold">Still stuck?</p>
            <p>
              Write to <a href="mailto:d8lpa.community@gmail.com">d8lpa.community@gmail.com</a> and a volunteer will
              help you.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
