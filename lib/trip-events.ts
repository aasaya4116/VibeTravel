import type { ItineraryDay } from "@/lib/types"

export const ITINERARY_SAVED_EVENT = "vibetravel:itinerary-saved"

export interface ItinerarySavedDetail {
  tripId: string
  itinerary: ItineraryDay[]
}

export function announceItinerarySaved(tripId: string, itinerary: ItineraryDay[]) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<ItinerarySavedDetail>(ITINERARY_SAVED_EVENT, {
      detail: { tripId, itinerary },
    })
  )
}
