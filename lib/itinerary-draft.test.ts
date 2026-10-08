import { describe, expect, it } from "vitest"
import type { Attraction } from "./types"
import {
  buildSavedPicksDraft,
  mergeSavedPicksIntoItinerary,
} from "./itinerary-draft"

function attraction(
  name: string,
  plannedDate?: string
): Attraction {
  return {
    name,
    plannedDate,
    description: `${name} description`,
    category: "Attraction",
    vibes: [],
    ageRange: "All ages",
    strollerFriendly: null,
    estimatedDuration: "1 hour",
    priceRange: null,
    location: "Test city",
  }
}

describe("saved-picks itinerary draft", () => {
  it("places every saved attraction exactly once and honors preferred dates", () => {
    const attractions: Attraction[] = [
      attraction("Museum", "2026-10-08"),
      attraction("Market"),
      attraction("Garden"),
    ]

    const draft = buildSavedPicksDraft(
      ["2026-10-07", "2026-10-08"],
      attractions
    )
    const items = draft.flatMap((day) => day.items)

    expect(items.map((item) => item.attraction_name).sort()).toEqual([
      "Garden",
      "Market",
      "Museum",
    ])
    expect(items.every((item) => item.recommended === false)).toBe(true)
    expect(
      draft.find((day) => day.date === "2026-10-08")?.items
        .filter((item) => item.attraction_name === "Museum")
    ).toHaveLength(1)
  })

  it("returns dated empty days when there are no saves for a section", () => {
    expect(buildSavedPicksDraft(["2026-10-07"], [])).toEqual([
      { date: "2026-10-07", items: [] },
    ])
  })

  it("adds saves to an existing plan without replacing edits or suggestions", () => {
    const existing = [
      {
        date: "2026-10-07",
        items: [
          {
            id: "edited-cafe",
            attraction_name: "Cafe",
            start_time: "09:45",
            end_time: "10:45",
            notes: "Meet by the side entrance.",
            recommended: true,
            status: "completed" as const,
          },
        ],
      },
    ]
    const saved: Attraction[] = [
      attraction("Museum"),
      attraction("Garden", "2026-10-08"),
    ]

    const next = mergeSavedPicksIntoItinerary(
      existing,
      saved,
      ["2026-10-07", "2026-10-08"]
    )

    expect(next[0].items[0]).toEqual(existing[0].items[0])
    expect(next.map((day) => day.date)).toEqual(["2026-10-07", "2026-10-08"])
    expect(
      next[1].items.filter((item) => item.attraction_name === "Garden")
    ).toHaveLength(1)
    expect(
      next.flatMap((day) => day.items).filter((item) => item.attraction_name === "Museum")
    ).toHaveLength(1)
  })
})
