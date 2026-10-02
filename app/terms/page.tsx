import type { Metadata } from "next"
import { LegalSection, PublicLegalPage } from "@/components/public-legal-page"

export const metadata: Metadata = {
  title: "Terms of Use — VibeTravel",
  description: "Terms governing use of the VibeTravel family trip-planning service.",
}

export default function TermsPage() {
  return (
    <PublicLegalPage eyebrow="Using VibeTravel" title="Terms of Use" updated="October 2, 2026">
      <LegalSection title="The service"><p>VibeTravel helps adults discover destinations and organize family trips. You must provide accurate account information and keep your login credentials secure.</p></LegalSection>
      <LegalSection title="Travel information"><p>Recommendations, schedules, travel estimates, availability, prices, weather, opening hours, and accessibility details may change or be incomplete. Verify critical details directly with the venue or provider before traveling or purchasing.</p></LegalSection>
      <LegalSection title="AI-assisted planning"><p>Scout and itinerary generation use artificial intelligence. Outputs may be inaccurate and should be treated as planning suggestions, not guarantees or professional advice.</p></LegalSection>
      <LegalSection title="Bookings and external services"><p>VibeTravel may link to third-party maps, venues, booking providers, or travel services. Those providers have their own terms and are responsible for their transactions and services.</p></LegalSection>
      <LegalSection title="Acceptable use"><p>Do not misuse the service, attempt unauthorized access, interfere with other users, or submit unlawful or harmful content.</p></LegalSection>
      <LegalSection title="Availability"><p>We work to keep VibeTravel reliable but do not guarantee uninterrupted access. Features may change as the product improves.</p></LegalSection>
      <LegalSection title="Ending your account"><p>You may stop using VibeTravel or delete your account at any time from the iOS Profile screen. We may suspend abusive or unlawful use.</p></LegalSection>
    </PublicLegalPage>
  )
}
