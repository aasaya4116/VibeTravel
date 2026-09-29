import type { Attraction } from "@/lib/types"

const DAY_MS = 24 * 60 * 60 * 1000

export const MAX_ITINERARY_DAYS = 90
export const MAX_GENERATION_DAYS = 14
export const ITINERARY_BATCH_DAYS = 8

export function enumerateTripDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return []
  }

  const dayCount = Math.min(
    MAX_ITINERARY_DAYS,
    Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1
  )

  return Array.from({ length: dayCount }, (_, index) =>
    new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10)
  )
}

export function batchTripDates(
  dates: string[],
  batchSize = ITINERARY_BATCH_DAYS
): string[][] {
  const batches: string[][] = []
  for (let index = 0; index < dates.length; index += batchSize) {
    batches.push(dates.slice(index, index + batchSize))
  }
  return batches
}

/**
 * Each saved place belongs to exactly one generation batch. Preferred-date
 * places stay in their requested window; flexible places are spread evenly so
 * one model call does not receive the entire saved-place list.
 */
export function assignAttractionsToBatches(
  attractions: Attraction[],
  batches: string[][]
): Attraction[][] {
  const assignments = batches.map(() => [] as Attraction[])
  if (assignments.length === 0) return assignments

  let flexibleIndex = 0
  for (const attraction of attractions) {
    const plannedBatch = attraction.plannedDate
      ? batches.findIndex((dates) => dates.includes(attraction.plannedDate as string))
      : -1
    if (attraction.plannedDate && plannedBatch < 0) continue
    const batchIndex = plannedBatch >= 0 ? plannedBatch : flexibleIndex++ % batches.length
    assignments[batchIndex].push(attraction)
  }

  return assignments
}
