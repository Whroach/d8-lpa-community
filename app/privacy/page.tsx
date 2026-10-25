import { redirect } from "next/navigation"

// The privacy policy lives on the same page as the terms.
export default function PrivacyPage() {
  redirect("/terms")
}
