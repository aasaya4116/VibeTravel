import { describe, expect, it } from "vitest"
import type { Attraction, FamilyVibe } from "./types"
import {
  buildFamilyMatchExplanation,
  createRecommendationFeedback,
  getFamilyVibeHighlights,
  getVibeDiscoveryQuery,
  getVibeSuggestedSearches,
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

  it("turns a Foodie Family vibe into food-first discovery", () => {
    const vibe: FamilyVibe = {
      id: "vibe",
      user_id: "user",
      family_name: "The Johnsons",
      kids: [],
      travel_style: ["Foodie Family"],
      sensory_needs: [],
      mobility_notes: null,
      dietary: ["nut-free"],
      pace: "moderate",
      budget_preference: "any",
      created_at: "",
      updated_at: "",
    }

    expect(getVibeDiscoveryQuery(vibe)).toContain("restaurants")
    expect(getVibeDiscoveryQuery(vibe)).toContain("nut-free options")
    expect(getVibeSuggestedSearches(vibe, "Tokyo")[0]).toBe(
      "Family-friendly restaurants in Tokyo"
    )
    expect(getVibeSuggestedSearches(vibe, "Tokyo")).toContain(
      "Food markets and food halls in Tokyo"
    )
  })

  it("keeps a general discovery fallback when no style is set", () => {
    expect(getVibeDiscoveryQuery(null)).toBe("family-friendly attractions")
    expect(getVibeSuggestedSearches(null)).toHaveLength(5)
  })

  it("explains the match with selected style and pace instead of provider metadata", () => {
    const match = buildFamilyMatchExplanation(
      { name: "City Art Museum", category: "Museum", priceRange: "$$" },
      {
        travel_style: ["Cultural Explorer"],
        pace: "moderate",
        dietary: [],
        sensory_needs: [],
        budget_preference: "any",
      }
    )

    expect(match.personalized).toBe(true)
    expect(match.reason).toContain("You chose Cultural Explorer and a moderate pace")
    expect(match.reason).toContain("focused indoor anchor")
    expect(match.reason).not.toContain("Google")
    expect(match.signals).toEqual([
      { type: "style", label: "Cultural Explorer" },
      { type: "pace", label: "moderate pace" },
    ])
  })

  it("uses dietary needs as a verification prompt, never a suitability claim", () => {
    const match = buildFamilyMatchExplanation(
      { name: "Market Kitchen", category: "Restaurant", priceRange: "$$" },
      {
        travel_style: ["Foodie Family"],
        pace: "slow",
        dietary: ["Nut allergy"],
        sensory_needs: [],
        budget_preference: "$$",
      }
    )

    expect(match.reason).toContain("Confirm current Nut allergy handling directly")
    expect(match.reason).not.toMatch(/safe|suitable|allergy-friendly/i)
    expect(match.signals).toContainEqual({ type: "dietary", label: "Nut allergy" })
    expect(match.tips.join(" ")).toContain("cross-contact")
  })

  it("labels an unpersonalized result honestly", () => {
    const match = buildFamilyMatchExplanation(
      { name: "City View", category: "Attraction" },
      null
    )

    expect(match.personalized).toBe(false)
    expect(match.reason).toBe(
      "This matched your search. It adds a clear attraction stop to the trip."
    )
    expect(match.signals).toEqual([{ type: "general", label: "Attraction match" }])
  })
})
