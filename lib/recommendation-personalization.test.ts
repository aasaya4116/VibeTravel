import { describe, expect, it } from "vitest"
import type { Attraction, FamilyVibe } from "./types"
import {
  createRecommendationFeedback,
  getFamilyVibeHighlights,
  normalizeRecommendationFeedback,
  recordRecommendationFeedback,
} from "./recommendation-personalization"

const attraction: Attraction = {
  googlePlaceId: "place-1",
  name: "Children's Museum",
  description: "Hands-on museum",
  category: "Museum",
  vibes: ["hands-on", "lively"],
  ageRange: "2-8",
  strollerFriendly: null,
  estimatedDuration: "2 hours",
  priceRange: "$$",
  location: "Atlanta, GA",
}

describe("recommendation personalization", () => {
  it("records one current feedback reason per place", () => {
    const first = createRecommendationFeedback(
      attraction,
      "too_busy",
      new Date("2026-09-19T12:00:00Z")
    )
    const replacement = createRecommendationFeedback(
      attraction,
      "too_expensive",
      new Date("2026-09-19T12:01:00Z")
    )
    const next = recordRecommendationFeedback([first], replacement)
    expect(next).toHaveLength(1)
    expect(next[0].reason).toBe("too_expensive")
  })

  it("sanitizes malformed stored feedback and enforces the limit", () => {
    const valid = createRecommendationFeedback(attraction, "too_busy")
    expect(normalizeRecommendationFeedback([null, { reason: "invalid" }, valid], 2)).toEqual([
      valid,
    ])
  })

  it("summarizes the family profile without overcrowding the UI", () => {
    const vibe: FamilyVibe = {
      id: "vibe",
      user_id: "user",
      family_name: "The Johnsons",
      kids: [
        { name: "Maya", age: 4 },
        { name: "Noah", age: 8 },
      ],
      travel_style: ["cultural", "relaxed"],
      sensory_needs: ["quiet spaces"],
      mobility_notes: null,
      dietary: [],
      pace: "slow",
      budget_preference: "$$",
      created_at: "",
      updated_at: "",
    }
    expect(getFamilyVibeHighlights(vibe)).toEqual([
      "Maya, 4 · Noah, 8",
      "cultural + relaxed",
      "Sensory needs considered",
      "slow pace",
    ])
  })
})
