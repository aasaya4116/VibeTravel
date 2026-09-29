import { describe, expect, it } from "vitest"
import type { Attraction } from "./types"
import {
  assignAttractionsToBatches,
  batchTripDates,
  enumerateTripDates,
} from "./itinerary-batching"

describe("itinerary batching", () => {
  it("splits a 32-day trip into four bounded generation calls", () => {
    const dates = enumerateTripDates("2026-10-28", "2026-11-28")
    const batches = batchTripDates(dates)

    expect(dates).toHaveLength(32)
    expect(batches.map((batch) => batch.length)).toEqual([8, 8, 8, 8])
    expect(batches.flat()).toEqual(dates)
  })

  it("keeps dated places in their window and assigns every flexible place once", () => {
    const batches = batchTripDates(
      enumerateTripDates("2026-10-28", "2026-11-28")
    )
    const attractions = [
      { name: "Sydney Opera House", plannedDate: "2026-11-20" },
      { name: "Taronga Zoo" },
      { name: "Bondi Beach" },
      { name: "Powerhouse Museum" },
    ] as Attraction[]

    const assigned = assignAttractionsToBatches(attractions, batches)

    expect(assigned[2].map((item) => item.name)).toContain("Sydney Opera House")
    expect(assigned.flat().map((item) => item.name).sort()).toEqual(
      attractions.map((item) => item.name).sort()
    )
  })
})
