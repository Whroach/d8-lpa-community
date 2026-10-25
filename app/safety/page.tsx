"use client"

import Link from "next/link"
import { ShieldCheck, Ban, Flag, HandCoins, MapPin, Lock, Phone, Eye } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const SCAM_SIGNS = [
  "They ask for money, gift cards, or help with a bill, a ticket or a “customs fee” - however sad or urgent the story.",
  "They talk about an investment or crypto that is sure to make money.",
  "They want to move to WhatsApp, Telegram, text or email almost straight away.",
  "They say “I love you” very quickly, but always have a reason they cannot meet or video call.",
  "Their story changes, or their pictures look like a model's photos.",
  "They ask for your password, a code sent to your phone, or bank details.",
]

const MEETING_TIPS = [
  "Meet somewhere public and busy the first few times - a cafe, a restaurant, or a District event.",
  "Tell a friend or relative who you are meeting, where and when. Arrange to check in with them afterwards.",
  "Make your own way there and back, so you can leave whenever you want.",
  "Keep your phone charged and with you.",
  "Take your time. Someone who is right for you will be happy to go at your pace.",
  "If anything feels wrong, leave. You do not owe anyone an explanation.",
]

export default function SafetyPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
            Safety Centre
          </h1>
          <p className="text-lg text-muted-foreground">
            Most people here are exactly who they say they are. These simple habits protect you from the few who are not.
          </p>
        </header>

        <Card className="border-2 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <HandCoins className="h-6 w-6 text-primary" aria-hidden="true" />
              The one rule that matters most
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-lg">
            <p className="font-semibold">Never send money, gift cards or crypto to someone you met online.</p>
            <p>
              Not for an emergency, not as a loan, not “just this once”. People who run romance scams are patient and
              kind for weeks before they ask. If someone asks, stop replying and report them.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-6 w-6 text-primary" aria-hidden="true" />
              Signs of a romance scam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-6 text-lg">
              {SCAM_SIGNS.map((sign) => (
                <li key={sign}>{sign}</li>
              ))}
            </ul>
            <p className="mt-4 text-base text-muted-foreground">
              The app shows a small private note in a conversation if a message mentions money, gift cards, crypto or
              moving to another app. Only you see it, and it never stops a message being sent.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
              Meeting in person
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-6 text-lg">
              {MEETING_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Ban className="h-6 w-6 text-primary" aria-hidden="true" />
              Block someone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-lg">
            <p>
              Open their profile, or your conversation with them, and choose <strong>Block</strong>. They can no longer
              see you or write to you, and they are not told.
            </p>
            <p>
              Changed your mind? Go to <Link href="/settings#blocked">Settings, then Blocked Members</Link>, and choose
              Unblock.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Flag className="h-6 w-6 text-primary" aria-hidden="true" />
              Report someone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-lg">
            <p>
              Open their profile, or your conversation with them, and choose <strong>Report</strong>. Pick what
              happened and send. A moderator reads every report. The other person is never told who reported them.
            </p>
            <p>Reporting and blocking are separate: you can do either, or both.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Lock className="h-6 w-6 text-primary" aria-hidden="true" />
              Your privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-lg">
            <p>In Settings, under Privacy, you decide:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>whether your profile appears in Browse at all</li>
              <li>whether only people you have liked can see you</li>
              <li>whether others can see when you are online</li>
              <li>whether others can see that you have read their message</li>
            </ul>
            <p>Other members see your first name, your age and what you wrote on your profile - never your email address or date of birth.</p>
            <Button asChild>
              <Link href="/settings#privacy">Open privacy settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Phone className="h-6 w-6 text-primary" aria-hidden="true" />
              If you need help now
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-lg">
            <p>
              If you are in danger, call <strong>911</strong>.
            </p>
            <p>
              If you have sent money to someone you now think was a scammer, contact your bank straight away, then
              report it to the Federal Trade Commission at reportfraud.ftc.gov. It happens to careful, intelligent
              people; there is no shame in it.
            </p>
            <p>
              To reach the D8-LPA moderators, write to{" "}
              <a href="mailto:d8lpa.community@gmail.com">d8lpa.community@gmail.com</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
