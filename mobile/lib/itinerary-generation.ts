import type { GenerateItineraryOptions, GenerateItineraryResult } from "./data"
import type { ItineraryDay } from "./types"

const addSavedPlacesInstruction = "Add every saved place to the itinerary. Preserve all existing traveler picks and manual edits; adjust only suggestions as needed."

/**
 * The first itinerary must use the full planner. A fast draft only arranges
 * traveler picks and must never be presented as a completed itinerary.
 */
export function itineraryGenerationOptions(hasItinerary: boolean): GenerateItineraryOptions {
  return hasItinerary
    ? {
        fastDraft: true,
        instruction: addSavedPlacesInstruction,
      }
    : {}
}

export function isCompleteItineraryGeneration(result: GenerateItineraryResult) {
  return result.inclusion?.generationMode !== "saved-picks-only"
}

function normalizedPlaceName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ")
}

/**
 * Older fast drafts predate persisted generation metadata. Their reliable
 * signature is that every scheduled item is a traveler pick and every item
 * still belongs to the trip's saved-place set.
 */
export function isSavedPlaceDraft(itinerary: ItineraryDay[], savedPlaceNames: Iterable<string>) {
  const items = itinerary.flatMap((day) => day.items)
  if (items.length === 0) return false
  const savedNames = new Set(Array.from(savedPlaceNames, normalizedPlaceName))
  return items.every((item) => (
    item.recommended === false
    && savedNames.has(normalizedPlaceName(item.attraction_name))
  ))
}
