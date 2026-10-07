import React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { DevBanner } from "@/components/dev-banner"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { TEXT_SIZE_BOOT_SCRIPT } from "@/lib/preferences"

// next/font generates hashed family names, so globals.css cannot reference
// "Geist" literally — it has to go through these CSS variables.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: {
    default: "D8-LPA Community",
    template: "%s | D8-LPA Community",
  },
  description:
    "A friendly place for members of Little People of America District 8 to meet, talk and find community events.",
  applicationName: "D8-LPA",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "D8-LPA", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom: some members rely on it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1216" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <DevBanner />
          {children}
          <Toaster position="top-center" richColors closeButton duration={6000} />
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
