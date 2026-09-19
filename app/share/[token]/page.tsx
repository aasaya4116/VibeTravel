import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getWikipediaImage } from "@/lib/wikipedia-image"
import { isValidShareToken } from "@/lib/trip-sharing"
import type { SharedTripPayload } from "@/lib/types"
import { SharedTripView } from "@/components/shared-trip-view"

export const dynamic = "force-dynamic"

const getSharedTrip = cache(async (token: string): Promise<SharedTripPayload | null> => {
  if (!isValidShareToken(token)) return null

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_shared_trip", { p_token: token })

  if (error || !data || typeof data !== "object") return null
  return data as unknown as SharedTripPayload
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const shared = await getSharedTrip(token)

  if (!shared) {
    return {
      title: "Shared trip unavailable | VibeTravel",
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    }
  }

  return {
    title: `${shared.trip.title} | VibeTravel`,
    description: `A private family trip plan for ${shared.trip.destination}, shared with you on VibeTravel.`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  }
}

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const shared = await getSharedTrip(token)

  if (!shared?.trip) notFound()

  const bannerImage = await getWikipediaImage(shared.trip.destination)

  return <SharedTripView trip={shared.trip} bannerImage={bannerImage} />
}
