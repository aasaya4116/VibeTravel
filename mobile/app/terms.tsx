import { LegalDocument, LegalSection } from "@/components/legal-document"

export default function TermsScreen() {
  return (
    <LegalDocument title="Terms of Use" updated="October 2, 2026">
      <LegalSection title="The service">VibeTravel helps adults discover destinations and organize family trips. You must provide accurate account information and keep your login credentials secure.</LegalSection>
      <LegalSection title="Travel information">Recommendations, schedules, travel estimates, availability, prices, weather, opening hours, and accessibility details may change or be incomplete. Verify critical details directly with the venue or provider before traveling or purchasing.</LegalSection>
      <LegalSection title="AI-assisted planning">Scout and itinerary generation use artificial intelligence. Outputs may be inaccurate and should be treated as planning suggestions, not guarantees or professional advice.</LegalSection>
      <LegalSection title="Bookings and external services">VibeTravel may link to third-party maps, venues, booking providers, or travel services. Those providers have their own terms and are responsible for their transactions and services.</LegalSection>
      <LegalSection title="Acceptable use">Do not misuse the service, attempt unauthorized access, interfere with other users, or submit unlawful or harmful content.</LegalSection>
      <LegalSection title="Availability">We work to keep VibeTravel reliable but do not guarantee uninterrupted access. Features may change as the product improves.</LegalSection>
      <LegalSection title="Ending your account">You may stop using VibeTravel or delete your account at any time from Profile. We may suspend abusive or unlawful use.</LegalSection>
    </LegalDocument>
  )
}
