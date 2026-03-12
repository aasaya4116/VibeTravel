import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { TripDetail } from "@/components/trip-detail"
import { ArticlesSidebar, ArticlesSidebarSkeleton } from "@/components/articles-sidebar"
import { getWikipediaImage } from "@/lib/wikipedia-image"
import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"

async function generateTripSummary(
  trip: { title: string; destination: string; start_date: string | null; end_date: string | null; itinerary: { items: { attraction_name: string }[] }[] },
  familyVibe: { kids?: { name?: string; age: number }[]; travel_style?: string[]; pace?: string } | null
): Promise<string | null> {
  if (!trip.itinerary?.length) return null

  const allAttractions = trip.itinerary
    .flatMap((d) => d.items.map((i) => i.attraction_name))
    .slice(0, 12)

  const vibeContext = familyVibe
    ? `Family: kids aged ${familyVibe.kids?.map((k) => k.age).join(", ") || "unknown"}, travel style: ${familyVibe.travel_style?.join(", ") || "any"}, pace: ${familyVibe.pace || "moderate"}.`
    : ""

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt: `You are a warm, knowledgeable travel writer. Write a 3-4 sentence trip preview for a family trip to ${trip.destination}.

${vibeContext}
Planned highlights: ${allAttractions.join(", ")}.

Predict what this family will experience — the moments, feelings, and memories they'll create. Be specific to the places listed. Speak directly to the family in second person ("You'll..."). Keep it vivid and concise, no more than 4 sentences.`,
    })
    return result.text.trim()
  } catch {
    return null
  }
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const [tripRes, savedRes, vibeRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("saved_attractions").select("*").eq("user_id", user.id).eq("trip_id", id),
    supabase.from("family_vibes").select("*").eq("user_id", user.id).single(),
  ])

  if (!tripRes.data) notFound()

  const trip = tripRes.data
  const familyVibe = vibeRes.data

  // Fetch banner image and trip summary in parallel
  const [bannerImage, tripSummary] = await Promise.all([
    getWikipediaImage(trip.destination),
    generateTripSummary(trip, familyVibe),
  ])

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <TripDetail
          trip={trip}
          savedAttractions={savedRes.data ?? []}
          bannerImage={bannerImage}
          tripSummary={tripSummary}
        />
      </div>

      <aside className="hidden lg:flex lg:flex-col lg:border-l lg:border-border lg:px-6 lg:py-8 sticky top-0 max-h-screen overflow-y-auto">
        <Suspense fallback={<ArticlesSidebarSkeleton />}>
          <ArticlesSidebar destination={trip.destination} />
        </Suspense>
      </aside>
    </div>
  )
}
