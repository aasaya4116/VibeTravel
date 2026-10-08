import {
  reconcileSavedAttractionsInItinerary,
} from "./itinerary-editing"
import type { Attraction, ItineraryDay } from "./types"

/**
 * Builds a usable itinerary without a model or a network call. The draft is
 * deliberately limited to traveler saves: AI suggestions can be added by a
 * later refinement, while every explicit choice is available immediately.
 */
export function buildSavedPicksDraft(
  dates: string[],
  savedAttractions: Attraction[],
  createId: (attraction: Attraction) => string = (() => {
    let id = 0
    return (attraction: Attraction) => `saved-draft-${attraction.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id++}`
  })()
): ItineraryDay[] {
  return reconcileSavedAttractionsInItinerary(
    dates.map((date) => ({ date, items: [] })),
    savedAttractions,
    createId
  )
}

/** Add new traveler saves without rebuilding or discarding an existing plan. */
export function mergeSavedPicksIntoItinerary(
  existing: ItineraryDay[],
  savedAttractions: Attraction[],
  tripDates: string[],
  createId: (attraction: Attraction) => string = (() => {
    let id = 0
    return (attraction: Attraction) => `saved-merge-${attraction.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id++}`
  })()
): ItineraryDay[] {
  const existingDates = new Set(existing.map((day) => day.date))
  const missingPreferredDates = new Set(
    savedAttractions
      .map((attraction) => attraction.plannedDate)
      .filter(
        (date): date is string =>
          Boolean(date) && tripDates.includes(date as string) && !existingDates.has(date as string)
      )
  )
  const dateOrder = new Map(tripDates.map((date, index) => [date, index]))
  const withRequiredDates = [
    ...existing,
    ...Array.from(missingPreferredDates, (date) => ({ date, items: [] })),
  ].sort(
    (a, b) =>
      (dateOrder.get(a.date) ?? Number.MAX_SAFE_INTEGER) -
      (dateOrder.get(b.date) ?? Number.MAX_SAFE_INTEGER)
  )

  return reconcileSavedAttractionsInItinerary(
    withRequiredDates,
    savedAttractions,
    createId
  )
}
