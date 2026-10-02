import type { Metadata } from "next"
import { LegalSection, PublicLegalPage } from "@/components/public-legal-page"

export const metadata: Metadata = {
  title: "Support — VibeTravel",
  description: "Get help with your VibeTravel account and family trip plans.",
}

export default function SupportPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  return (
    <PublicLegalPage eyebrow="We’re here to help" title="VibeTravel Support">
      <LegalSection title="Get help">
        {supportEmail ? (
          <p>Email <a className="font-semibold text-primary hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> with the trip name, the device you are using, and what you expected to happen.</p>
        ) : (
          <p>Sign in and use <strong className="text-foreground">Give feedback</strong> in the VibeTravel header. The public support mailbox is being configured before the App Store release.</p>
        )}
      </LegalSection>
      <LegalSection title="Account and privacy requests"><p>The iOS app provides account deletion under Profile. For access, correction, consent, or other privacy requests, use the support contact above.</p></LegalSection>
      <LegalSection title="Protect your information"><p>Never send your password, full payment details, or private booking confirmation codes in a support message.</p></LegalSection>
      <LegalSection title="Service status"><p>VibeTravel’s trip data is stored in Supabase and the web/API service is hosted by Vercel. If the app reports a connection problem, confirm your connection and try again before contacting support.</p></LegalSection>
    </PublicLegalPage>
  )
}
