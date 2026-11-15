import type { Attraction } from "./types"
import type { DestinationOption } from "./destination-options"

export interface PendingPlaceSave {
  attraction: Attraction
  destinationLabel: string
  destinationOption: DestinationOption | null
}

let pendingPlaceSave: PendingPlaceSave | null = null
let completedPlaceSave: { attractionName: string; tripTitle: string } | null = null

/**
 * Keeps an Explore selection in memory while the traveler creates a trip.
 * The place and destination never need to be placed in a navigation URL.
 */
export function stagePendingPlaceSave(value: PendingPlaceSave) {
  pendingPlaceSave = value
}

export function readPendingPlaceSave() {
  return pendingPlaceSave
}

export function clearPendingPlaceSave() {
  pendingPlaceSave = null
}

export function completePendingPlaceSave(tripTitle: string) {
  if (!pendingPlaceSave) return
  completedPlaceSave = {
    attractionName: pendingPlaceSave.attraction.name,
    tripTitle,
  }
  pendingPlaceSave = null
}

export function consumeCompletedPlaceSave() {
  const result = completedPlaceSave
  completedPlaceSave = null
  return result
}
