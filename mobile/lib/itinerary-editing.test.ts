import { describe, expect, it } from "vitest"
import type { ItineraryDay } from "./types"
import { moveItineraryItem, reorderItineraryItem, updateItineraryItem } from "./itinerary-editing"

const itinerary: ItineraryDay[] = [
  {
    date: "2027-01-01",
    items: [
      { id: "museum", attraction_name: "Museum", start_time: "09:00", end_time: "10:00" },
      { id: "market", attraction_name: "Market", start_time: "11:00", end_time: "12:00" },
    ],
  },
  { date: "2027-01-02", items: [] },
]

describe("mobile itinerary editing", () => {
  it("supports reorder, edit, and move without mutating the original", () => {
    const reordered = reorderItineraryItem(itinerary, 0, "market", -1)
    const edited = updateItineraryItem(reordered, 0, "market", { start_time: "10:30", end_time: "11:30", notes: "Arrive hungry." })
    const moved = moveItineraryItem(edited, 0, "market", 1)

    expect(moved[1].items[0]).toMatchObject({ id: "market", start_time: "10:30", notes: "Arrive hungry." })
    expect(itinerary[0].items.map((item) => item.id)).toEqual(["museum", "market"])
  })
})

