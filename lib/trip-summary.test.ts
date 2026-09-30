import { describe, expect, it } from "vitest"
import { buildTripSummary } from "./trip-summary"

describe("buildTripSummary", () => {
  it("returns null before an itinerary exists", () => {
    expect(buildTripSummary({ destination: "Tokyo", itinerary: [] }, null)).toBeNull()
  })

  it("builds a fast family-specific summary without an external request", () => {
    const summary = buildTripSummary(
      {
        destination: "Tokyo",
        itinerary: [
          {
            items: [
              { attraction_name: "Akihabara" },
              { attraction_name: "Ueno Park" },
              { attraction_name: "Akihabara" },
            ],
          },
        ],
      },
      {
        kids: [{ name: "Mekhi", age: 9 }],
        travel_style: ["Foodie Family", "Cultural Explorer"],
        pace: "Moderate",
      }
    )

    expect(summary).toContain("foodie family and cultural explorer")
    expect(summary).toContain("Akihabara and Ueno Park")
    expect(summary).toContain("moderate pace")
  })
})
