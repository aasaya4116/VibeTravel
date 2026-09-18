import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { SearchExplorer } from "@/components/search-explorer"
import type { SavedAttraction, TripOption } from "@/lib/types"

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
  let availableTrips: TripOption[] = []
  let initialSavedAttractions: SavedAttraction[] = []
  let validatedTripId: string | null = null
  let tripDestination: string | null = initialDest

  if (user) {
    const [vibeResult, tripsResult, savedResult] = await Promise.all([
      supabase
        .from("family_vibes")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("trips")
        .select("id, title, destination, start_date, end_date")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("saved_attractions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ])

    familyVibe = vibeResult.data
    availableTrips = (tripsResult.data ?? []) as TripOption[]
    initialSavedAttractions = (savedResult.data ?? []) as SavedAttraction[]

    const selectedTrip = tripId
      ? availableTrips.find((trip) => trip.id === tripId)
      : null
    if (selectedTrip) {
      validatedTripId = selectedTrip.id
      if (!tripDestination) tripDestination = selectedTrip.destination
    }
  }

  return (
    <Suspense>
      <SearchExplorer
        familyVibe={familyVibe}
        initialSavedAttractions={initialSavedAttractions}
        availableTrips={availableTrips}
        isLoggedIn={!!user}
        tripId={validatedTripId}
        initialDestination={tripDestination}
      />
    </Suspense>
  )
}
