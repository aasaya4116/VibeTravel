import { describe, expect, it } from "vitest"
import type { ItineraryDay } from "./types"
import {
  getActiveStop,
  getTripModeDayIndex,
  setItineraryItemStatus,
  shiftRemainingStops,
} from "./trip-mode"

const itinerary: ItineraryDay[] = [
  {
    date: "2026-10-02",
    items: [
      { id: "museum", attraction_name: "Museum", start_time: "09:00", end_time: "11:00" },
      { id: "lunch", attraction_name: "Lunch", start_time: "12:00", end_time: "13:00" },
      { id: "park", attraction_name: "Park", start_time: "14:00", end_time: "16:00" },
    ],
  },
  { date: "2026-10-03", items: [] },
]

describe("trip mode helpers", () => {
  it("opens the current day, then the next future day, then the final day", () => {
    expect(getTripModeDayIndex(itinerary, new Date(2026, 9, 2))).toBe(0)
    expect(getTripModeDayIndex(itinerary, new Date(2026, 9, 1))).toBe(0)
    expect(getTripModeDayIndex(itinerary, new Date(2026, 9, 8))).toBe(1)
  })

  it("finds the next unfinished stop based on the current time", () => {
    const now = new Date(2026, 9, 2, 11, 30)
    expect(getActiveStop(itinerary[0], now)?.id).toBe("lunch")
    const withLunchDone = setItineraryItemStatus(itinerary, 0, "lunch", "completed")
    expect(getActiveStop(withLunchDone[0], now)?.id).toBe("park")
  })

  it("updates a stop without mutating the original itinerary", () => {
    const next = setItineraryItemStatus(itinerary, 0, "museum", "completed")
    expect(next[0].items[0].status).toBe("completed")
    expect(itinerary[0].items[0].status).toBeUndefined()
  })

  it("shifts only the active and remaining unfinished stops", () => {
    const done = setItineraryItemStatus(itinerary, 0, "museum", "completed")
    const shifted = shiftRemainingStops(done, 0, "lunch", 30)
    expect(shifted[0].items.map((item) => item.start_time)).toEqual([
      "09:00",
      "12:30",
      "14:30",
    ])
  })
})
