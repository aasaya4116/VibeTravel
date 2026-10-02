import { LegalDocument, LegalSection } from "@/components/legal-document"

export default function PrivacyScreen() {
  return (
    <LegalDocument title="Privacy Policy" updated="October 2, 2026">
      <LegalSection title="What VibeTravel collects">We collect account information, family travel preferences, trip plans, saved places, readiness details, feedback, and conversations you choose to have with Scout. Family preferences can include children’s first names, ages, dietary needs, sensory needs, and mobility notes.</LegalSection>
      <LegalSection title="How information is used">We use this information to authenticate your account, personalize recommendations, build and maintain itineraries, keep trips available across devices, support private trip sharing, respond to support requests, and improve VibeTravel.</LegalSection>
      <LegalSection title="Service providers">VibeTravel uses providers such as Supabase for authentication and storage, Vercel for hosting, Anthropic for AI-assisted planning, and travel-data providers for places, maps, weather, restaurants, tours, and articles. These providers process only the information needed to deliver their services.</LegalSection>
      <LegalSection title="Sharing and tracking">We do not sell personal information or use it for cross-app advertising. A private trip link exposes the itinerary and stop notes to anyone who has that link, but not your profile, readiness details, costs, booking links, or confirmation codes. You can revoke a link at any time.</LegalSection>
      <LegalSection title="Retention and deletion">Information is retained while your account is active. You can permanently delete the account and its associated data from Profile. Some limited records may be retained when legally required.</LegalSection>
      <LegalSection title="Children">VibeTravel is designed for adults planning family travel and is not directed to children. Adults should provide only the family information needed to personalize a trip.</LegalSection>
      <LegalSection title="Your choices">You can edit family preferences, revoke shared links, sign out, or delete your account. Contact Support from Profile for access, correction, consent, or privacy questions.</LegalSection>
    </LegalDocument>
  )
}
