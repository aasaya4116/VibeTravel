import type { FamilyVibe } from "@/lib/types"

export type FamilyVibeDraft = Omit<FamilyVibe, "id" | "user_id">

export const travelStyleOptions = [
  "Cultural explorer",
  "Nature lover",
  "Foodie family",
  "Urban adventurer",
  "Beach & relaxation",
  "Off the beaten path",
  "History buff",
  "Art & design",
  "Active & outdoorsy",
  "Slow travel",
  "Technology & innovation",
] as const

export const dietaryOptions = [
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
  "Halal",
  "Kosher",
] as const

export const paceOptions: Array<FamilyVibeDraft["pace"]> = ["slow", "moderate", "fast"]

export const paceDetails: Array<{
  value: FamilyVibeDraft["pace"]
  label: string
  description: string
  icon: "leaf-outline" | "partly-sunny-outline" | "flash-outline"
}> = [
  {
    value: "slow",
    label: "Slow & spacious",
    description: "A few anchors with room to wander.",
    icon: "leaf-outline",
  },
  {
    value: "moderate",
    label: "Balanced",
    description: "Enough variety without rushing.",
    icon: "partly-sunny-outline",
  },
  {
    value: "fast",
    label: "Full & lively",
    description: "More stops and quicker transitions.",
    icon: "flash-outline",
  },
]

export const budgetOptions: Array<{
  value: FamilyVibeDraft["budget_preference"]
  label: string
  description: string
}> = [
  { value: "free", label: "Free", description: "Public spaces" },
  { value: "$", label: "$", description: "Value" },
  { value: "$$", label: "$$", description: "Balanced" },
  { value: "$$$", label: "$$$", description: "Premium" },
  { value: "any", label: "Mix", description: "Flexible" },
]

export function toVibeDraft(vibe: FamilyVibe | null | undefined): FamilyVibeDraft {
  return {
    family_name: vibe?.family_name ?? "",
    kids: vibe?.kids ?? [],
    travelers: vibe?.travelers ?? [],
    travel_style: vibe?.travel_style ?? [],
    sensory_needs: vibe?.sensory_needs ?? [],
    mobility_notes: vibe?.mobility_notes ?? null,
    dietary: vibe?.dietary ?? [],
    pace: vibe?.pace ?? "moderate",
    budget_preference: vibe?.budget_preference ?? "any",
  }
}

/**
 * Apply the short onboarding choices over the latest server copy so fields the
 * flow does not edit (family members and access notes) are never overwritten
 * by an older dashboard snapshot.
 */
export function mergeOnboardingChoices(
  latestVibe: FamilyVibe | null | undefined,
  choices: FamilyVibeDraft,
): FamilyVibeDraft {
  return {
    ...toVibeDraft(latestVibe),
    travel_style: [...choices.travel_style],
    dietary: [...choices.dietary],
    pace: choices.pace,
    budget_preference: choices.budget_preference,
  }
}
