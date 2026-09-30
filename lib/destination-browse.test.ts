import { describe, expect, it } from "vitest"
import {
  destinationBrowseCards,
  getDefaultDestinationLens,
  getDestinationsForLens,
} from "./destination-browse"
import type { FamilyVibe } from "./types"

function vibe(styles: string[]): FamilyVibe {
  return {
    id: "vibe-1",
    user_id: "user-1",
    family_name: "Test family",
    kids: [],
    travel_style: styles,
    sensory_needs: [],
    mobility_notes: null,
    dietary: [],
    pace: "moderate",
    budget_preference: "any",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  }
}

describe("destination browsing", () => {
  it("makes food visible by default for foodie families", () => {
    expect(getDefaultDestinationLens(vibe(["Foodie Family"]))).toBe(
      "Food + culture"
    )
  })

  it("keeps the general personalized lens for other styles", () => {
    expect(getDefaultDestinationLens(vibe(["City explorer"]))).toBe(
      "Your vibe"
    )
  })

  it("returns only destinations that match the active lens", () => {
    const foodDestinations = getDestinationsForLens("Food + culture")
    expect(foodDestinations.length).toBeGreaterThan(0)
    expect(
      foodDestinations.every((destination) =>
        destination.lenses.includes("Food + culture")
      )
    ).toBe(true)
  })

  it("includes coordinates for every mapped destination", () => {
    expect(
      destinationBrowseCards.every(
        (destination) =>
          Number.isFinite(destination.latitude) &&
          Number.isFinite(destination.longitude)
      )
    ).toBe(true)
  })
})

