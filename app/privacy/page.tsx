import type { Metadata } from "next"
import { LegalSection, PublicLegalPage } from "@/components/public-legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy — VibeTravel",
  description: "How VibeTravel collects, uses, protects, and deletes personal information.",
}

export default function PrivacyPage() {
  return (
    <PublicLegalPage eyebrow="Your information" title="Privacy Policy" updated="October 2, 2026">
      <LegalSection title="What VibeTravel collects">
        <p>We collect account information, family travel preferences, trip plans, saved places, readiness details, feedback, and conversations you choose to have with Scout. Family preferences can include children’s first names, ages, dietary needs, sensory needs, and mobility notes.</p>
      </LegalSection>
      <LegalSection title="How information is used">
        <p>We use this information to authenticate your account, personalize recommendations, build and maintain itineraries, keep trips available across devices, support private trip sharing, respond to support requests, and improve VibeTravel.</p>
      </LegalSection>
      <LegalSection title="Service providers">
        <p>VibeTravel uses providers such as Supabase for authentication and storage, Vercel for hosting, Anthropic for AI-assisted planning, and travel-data providers for places, maps, weather, restaurants, tours, and articles. These providers process only the information needed to deliver their services and are subject to their own privacy commitments.</p>
      </LegalSection>
      <LegalSection title="Sharing and tracking">
        <p>We do not sell personal information or use it for cross-app advertising. A private trip link exposes the itinerary and stop notes to anyone who has that link, but not your profile, readiness details, costs, booking links, or confirmation codes. You can revoke a link at any time.</p>
      </LegalSection>
      <LegalSection title="Retention and deletion">
        <p>Information is retained while your account is active. In the iOS app, choose Profile → Delete account to permanently delete the account and associated data. Some limited records may be retained when legally required.</p>
      </LegalSection>
      <LegalSection title="Children">
        <p>VibeTravel is designed for adults planning family travel and is not directed to children. Adults should provide only the family information needed to personalize a trip.</p>
      </LegalSection>
      <LegalSection title="Your choices">
        <p>You can edit family preferences, revoke shared links, sign out, or delete your account. Contact Support for access, correction, consent, or privacy questions.</p>
      </LegalSection>
    </PublicLegalPage>
  )
}
