import { describe, expect, it } from "vitest"
import type { Attraction, ItineraryDay } from "./types"
import {
  ensureSavedAttractionsInDay,
  mergeItinerarySection,
  mergeRegeneratedDay,
  moveItineraryItem,
  pinSavedAttractionsToDates,
  reconcileSavedAttractionsInItinerary,
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

  it("keeps completed and skipped stops when refreshing a day", () => {
    const existing: ItineraryDay[] = [
      {
        date: "2026-10-02",
        items: [
          { ...itinerary[0].items[0], recommended: true, status: "completed" },
          { ...itinerary[0].items[1], recommended: true, status: "skipped" },
        ],
      },
    ]
    const rebuilt: ItineraryDay = {
      date: "2026-10-02",
      items: [
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
    expect(next[0].items[0].status).toBe("completed")
    expect(next[0].items[1].status).toBe("skipped")
  })

  it("adds a newly saved day-assigned place when the model omits it", () => {
    const rebuilt: ItineraryDay = {
      date: "2026-10-02",
      items: [
        {
          id: "museum",
          attraction_name: "Museum",
          start_time: "09:00",
          end_time: "11:00",
          recommended: true,
        },
      ],
    }

    const next = ensureSavedAttractionsInDay(
      rebuilt,
      [
        {
          name: "Nintendo Tokyo",
          description: "A saved family stop.",
          category: "Shopping",
          vibes: ["games"],
          ageRange: "all ages",
          strollerFriendly: null,
          estimatedDuration: "1-2 hours",
          priceRange: null,
          location: "Tokyo",
          plannedDate: "2026-10-02",
        },
      ],
      () => "saved-nintendo"
    )

    expect(next.items).toHaveLength(2)
    expect(next.items[1]).toMatchObject({
      id: "saved-nintendo",
      attraction_name: "Nintendo Tokyo",
      recommended: false,
      start_time: "11:30",
      end_time: "12:30",
    })
  })

  it("adds a later generated section without replacing previously planned days", () => {
    const existing: ItineraryDay[] = [
      {
        date: "2026-10-02",
        items: [
          {
            id: "museum",
            attraction_name: "Museum",
            start_time: "09:00",
            end_time: "11:00",
            recommended: false,
          },
        ],
      },
      {
        date: "2026-10-04",
        items: [
          {
            id: "park",
            attraction_name: "Park",
            start_time: "10:00",
            end_time: "12:00",
            recommended: true,
          },
        ],
      },
    ]
    const rebuilt: ItineraryDay[] = [
      {
        date: "2026-10-02",
        items: [
          {
            id: "cafe",
            attraction_name: "Cafe",
            start_time: "12:00",
            end_time: "13:00",
            recommended: true,
          },
        ],
      },
      {
        date: "2026-10-03",
        items: [
          {
            id: "zoo",
            attraction_name: "Zoo",
            start_time: "09:00",
            end_time: "12:00",
            recommended: true,
          },
        ],
      },
    ]

    const next = mergeItinerarySection(existing, rebuilt, [
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ])

    expect(next.map((day) => day.date)).toEqual([
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ])
    expect(next[0].items.map((item) => item.id)).toEqual(["museum", "cafe"])
    expect(next[2]).toBe(existing[1])
  })

  it("moves a saved place back to its traveler-selected day", () => {
    const generated: ItineraryDay[] = [
      {
        date: "2026-10-02",
        items: [
          {
            id: "pick-1",
            attraction_name: "Museum",
            start_time: "09:00",
            end_time: "10:30",
            recommended: false,
          },
          {
            id: "pick-2",
            attraction_name: "Market",
            start_time: "11:00",
            end_time: "12:30",
            recommended: false,
          },
        ],
      },
      {
        date: "2026-10-03",
        items: [
          {
            id: "misplaced-pick",
            attraction_name: "Observation Deck",
            start_time: "09:00",
            end_time: "10:30",
            recommended: false,
          },
        ],
      },
    ]
    const saved = [
      {
        name: "Observation Deck",
        plannedDate: "2026-10-02",
        estimatedDuration: "1.5 hours",
        description: "Saved by the traveler.",
      } as Attraction,
    ]

    const corrected = pinSavedAttractionsToDates(
      generated,
      saved,
      () => "restored-pick"
    )

    expect(corrected[0].items.map((item) => item.attraction_name)).toEqual([
      "Museum",
      "Market",
      "Observation Deck",
    ])
    expect(corrected[0].items.at(-1)).toMatchObject({
      id: "restored-pick",
      recommended: false,
    })
    expect(corrected[1].items).toHaveLength(0)
  })

  it("does not move a dated place when its selected day is outside this section", () => {
    const generated: ItineraryDay[] = [
      {
        date: "2026-10-03",
        items: [
          {
            id: "existing",
            attraction_name: "Observation Deck",
            start_time: "09:00",
            end_time: "10:30",
            recommended: false,
          },
        ],
      },
    ]
    const saved = [
      {
        name: "Observation Deck",
        plannedDate: "2026-10-02",
      } as Attraction,
    ]

    expect(
      pinSavedAttractionsToDates(generated, saved, () => "unused")
    ).toBe(generated)
  })

  it("guarantees every saved place appears exactly once after a full rebuild", () => {
    const rebuilt: ItineraryDay[] = [
      {
        date: "2026-10-02",
        items: [
          { id: "museum-ai", attraction_name: "Museum", start_time: "09:00", end_time: "10:00", recommended: true },
          { id: "museum-duplicate", attraction_name: "Museum", start_time: "11:00", end_time: "12:00", recommended: false },
        ],
      },
      { date: "2026-10-03", items: [] },
    ]
    const saved = [
      { name: "Museum", estimatedDuration: "1 hour" } as Attraction,
      { name: "Market", estimatedDuration: "1 hour", plannedDate: "2026-10-03" } as Attraction,
      { name: "Coffee Ceremony", estimatedDuration: "1 hour" } as Attraction,
    ]

    const next = reconcileSavedAttractionsInItinerary(rebuilt, saved, (attraction) => `saved-${attraction.name}`)
    const names = next.flatMap((day) => day.items.map((item) => item.attraction_name))

    expect(names.filter((name) => name === "Museum")).toHaveLength(1)
    expect(names).toEqual(expect.arrayContaining(["Museum", "Market", "Coffee Ceremony"]))
    expect(next[1].items.some((item) => item.attraction_name === "Market")).toBe(true)
    expect(next.flatMap((day) => day.items).filter((item) => saved.some((place) => place.name === item.attraction_name)).every((item) => item.recommended === false)).toBe(true)
  })
})
