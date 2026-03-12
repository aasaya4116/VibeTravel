import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { SearchExplorer } from "@/components/search-explorer"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string; dest?: string }>
}) {
  const params = await searchParams
  const tripId = params?.trip ?? null
  const initialDest = params?.dest ?? null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let familyVibe = null
  let savedNames: string[] = []
  let tripTitle: string | null = null
  let tripDestination: string | null = initialDest

  if (user) {
    const { data: vibe } = await supabase
      .from("family_vibes")
      .select("*")
      .eq("user_id", user.id)
      .single()
    familyVibe = vibe

    if (tripId) {
      const { data: trip } = await supabase
        .from("trips")
        .select("id, title, destination")
        .eq("id", tripId)
        .eq("user_id", user.id)
        .single()
      if (trip) {
        tripTitle = trip.title
        if (!tripDestination) tripDestination = trip.destination
        const { data: savedForTrip } = await supabase
          .from("saved_attractions")
          .select("attraction_name")
          .eq("user_id", user.id)
          .eq("trip_id", tripId)
        savedNames = (savedForTrip ?? []).map((s) => s.attraction_name)
      }
    } else {
      const { data: savedAttractions } = await supabase
        .from("saved_attractions")
        .select("attraction_name")
        .eq("user_id", user.id)
        .is("trip_id", null)
      savedNames = (savedAttractions ?? []).map((s) => s.attraction_name)
    }
  }

  return (
    <Suspense>
      <SearchExplorer
        familyVibe={familyVibe}
        savedAttractionNames={savedNames}
        tripId={tripId}
        tripTitle={tripTitle}
        initialDestination={tripDestination}
      />
    </Suspense>
  )
}
