import type { Metadata, Viewport } from "next"
import { DM_Sans, DM_Serif_Display } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" })
const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://vibe-travel-six.vercel.app"
  ),
  title: "VibeTravel - Family Travel, Reimagined",
  description:
    "Discover attractions that match your family's unique vibe. Plan smarter trips with AI-powered search and itinerary building.",
  openGraph: {
    title: "VibeTravel — Family travel, by vibe.",
    description:
      "AI trip planning that knows your kids' ages, sensory needs, and travel pace. Real plans, real destinations.",
    siteName: "VibeTravel",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTravel — Family travel, by vibe.",
    description: "AI trip planning for families. Real plans, real destinations.",
  },
}

export const viewport: Viewport = {
  themeColor: "#d4652a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
