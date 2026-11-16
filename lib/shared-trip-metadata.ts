import type { Metadata } from "next"
import type { SharedTrip } from "@/lib/types"

type SharePreviewTrip = Pick<SharedTrip, "title" | "destination">

export function buildSharedTripMetadata(trip: SharePreviewTrip): Metadata {
  const shareTitle = `${trip.title} — ${trip.destination}`
  const description = `A shared VibeTravel itinerary for ${trip.destination}.`

  return {
    title: `${shareTitle} | VibeTravel`,
    description,
    openGraph: {
      title: shareTitle,
      description,
      siteName: "VibeTravel",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
    },
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  }
}
