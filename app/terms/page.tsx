import Link from "next/link"
import type { Metadata } from "next"
import { TermsContent } from "@/components/terms-content"

export const metadata: Metadata = { title: "Terms and Privacy" }

/** Public page: the sign-up form links here before an account exists. */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <p>
        <Link href="/signup" className="font-semibold text-primary underline">
          Back to sign up
        </Link>
      </p>
      <h1 className="text-3xl font-bold">Terms of Service and Privacy Policy</h1>
      <TermsContent />
    </main>
  )
}
