import { describe, expect, it } from "vitest"
import type { ItineraryDay } from "./types"
import {
  mergeRegeneratedDay,
  moveItineraryItem,
  removeItineraryItem,
  reorderItineraryItem,
  restoreItineraryItem,
  updateItineraryItem,
} from "./itinerary-editing"

const itinerary: ItineraryDay[] = [
  {
    date: "2026-10-02",
    items: [
      { id: "museum", attraction_name: "Museum", start_time: "09:00", end_time: "11:00" },
      { id: "lunch", attraction_name: "Lunch", start_time: "12:00", end_time: "13:00" },
    ],
  },
  {
    date: "2026-10-03",
    items: [
      { id: "park", attraction_name: "Park", start_time: "10:00", end_time: "12:00" },
    ],
  },
]

describe("itinerary editing helpers", () => {
  it("reorders a stop without mutating the original itinerary", () => {
    const next = reorderItineraryItem(itinerary, 0, "lunch", -1)
    expect(next[0].items.map((item) => item.id)).toEqual(["lunch", "museum"])
    expect(itinerary[0].items.map((item) => item.id)).toEqual(["museum", "lunch"])
  })

  it("moves a stop to another day", () => {
    const next = moveItineraryItem(itinerary, 0, "museum", 1)
    expect(next[0].items.map((item) => item.id)).toEqual(["lunch"])
    expect(next[1].items.map((item) => item.id)).toEqual(["park", "museum"])
  })

  it("updates only the editable fields on a stop", () => {
    const next = updateItineraryItem(itinerary, 0, "museum", {
      start_time: "09:30",
      end_time: "11:30",
      notes: "Arrive before the school groups.",
    })
    expect(next[0].items[0]).toMatchObject({
      id: "museum",
      attraction_name: "Museum",
      start_time: "09:30",
      end_time: "11:30",
      notes: "Arrive before the school groups.",
    })
  })

  it("removes and restores a stop at its original position", () => {
    const removed = removeItineraryItem(itinerary, 0, "museum")
    const restored = restoreItineraryItem(removed, 0, itinerary[0].items[0], 0)
    expect(restored).toEqual(itinerary)
  })

  it("rebuilds one day while preserving user picks and every other day", () => {
    const existing: ItineraryDay[] = [
      {
        ...itinerary[0],
        items: itinerary[0].items.map((item) => ({ ...item, recommended: false })),
      },
      itinerary[1],
    ]
    const rebuilt: ItineraryDay = {
      date: "2026-10-02",
      items: [
        {
          id: "museum-generated",
          attraction_name: "Museum",
          start_time: "15:00",
          end_time: "17:00",
          notes: "AI changed this, but the user pick should win.",
          recommended: false,
        },
        {
          id: "cafe",
          attraction_name: "Cafe",
          start_time: "14:00",
          end_time: "15:00",
          recommended: true,
        },
      ],
    }

    const next = mergeRegeneratedDay(existing, "2026-10-02", rebuilt)
    expect(next[0].items.map((item) => item.id)).toEqual(["museum", "lunch", "cafe"])
    expect(next[0].items[0]).toEqual(existing[0].items[0])
    expect(next[1]).toBe(existing[1])
  })
})
