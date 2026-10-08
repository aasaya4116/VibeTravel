import { describe, expect, it } from "vitest"
import { mergeOnboardingChoices, toVibeDraft } from "./family-vibe-options"
import type { FamilyVibe } from "./types"

describe("mobile Family Vibe draft", () => {
  it("starts with neutral, editable defaults", () => {
    expect(toVibeDraft(null)).toEqual({
      family_name: "",
      kids: [],
      travelers: [],
      travel_style: [],
      sensory_needs: [],
      mobility_notes: null,
      dietary: [],
      pace: "moderate",
      budget_preference: "any",
    })
  })

  it("preserves family details that the short onboarding flow does not edit", () => {
    const vibe: FamilyVibe = {
      id: "vibe-1",
      user_id: "user-1",
      family_name: "The Asayas",
      kids: [{ name: "Child 1", age: 8, sensoryNeeds: ["Quiet breaks"] }],
      travelers: [{ name: "Partner", role: "partner", age: 38 }],
      travel_style: ["Foodie family", "Technology & innovation"],
      sensory_needs: ["Noise sensitive"],
      mobility_notes: "Avoid long stair routes",
      dietary: ["Nut allergy"],
      pace: "slow",
      budget_preference: "$$",
    }

    expect(toVibeDraft(vibe)).toEqual({
      family_name: "The Asayas",
      kids: vibe.kids,
      travelers: vibe.travelers,
      travel_style: vibe.travel_style,
      sensory_needs: vibe.sensory_needs,
      mobility_notes: vibe.mobility_notes,
      dietary: vibe.dietary,
      pace: vibe.pace,
      budget_preference: vibe.budget_preference,
    })
  })

  it("merges onboarding choices over the latest hidden family details", () => {
    const latestVibe: FamilyVibe = {
      id: "vibe-1",
      user_id: "user-1",
      family_name: "Latest family name",
      kids: [{ name: "Child 1", age: 9 }],
      travelers: [{ name: "Grandparent", role: "grandparent", age: 68 }],
      travel_style: ["History buff"],
      sensory_needs: ["Needs quiet spaces"],
      mobility_notes: "Use step-free entrances",
      dietary: ["Vegetarian"],
      pace: "slow",
      budget_preference: "$",
    }
    const choices = {
      ...toVibeDraft(null),
      travel_style: ["Foodie family", "Art & design"],
      dietary: ["Nut allergy"],
      pace: "fast" as const,
      budget_preference: "$$$" as const,
    }

    expect(mergeOnboardingChoices(latestVibe, choices)).toEqual({
      family_name: latestVibe.family_name,
      kids: latestVibe.kids,
      travelers: latestVibe.travelers,
      sensory_needs: latestVibe.sensory_needs,
      mobility_notes: latestVibe.mobility_notes,
      travel_style: choices.travel_style,
      dietary: choices.dietary,
      pace: choices.pace,
      budget_preference: choices.budget_preference,
    })
  })
})
