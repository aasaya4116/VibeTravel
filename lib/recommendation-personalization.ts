import type { Attraction, FamilyVibe } from "./types"

export type RecommendationFeedbackReason =
  | "too_busy"
  | "too_expensive"
  | "not_age_appropriate"

export interface RecommendationFeedback {
  placeKey: string
  reason: RecommendationFeedbackReason
  category: string
  vibes: string[]
  priceRange: string | null
  ageRange: string
  createdAt: string
}

const FEEDBACK_REASONS = new Set<RecommendationFeedbackReason>([
  "too_busy",
  "too_expensive",
  "not_age_appropriate",
])

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export function placeFeedbackKey(attraction: Attraction) {
  return attraction.googlePlaceId || attraction.name.toLowerCase()
}

export function createRecommendationFeedback(
  attraction: Attraction,
  reason: RecommendationFeedbackReason,
  now = new Date()
): RecommendationFeedback {
  return {
    placeKey: placeFeedbackKey(attraction),
    reason,
    category: attraction.category,
    vibes: attraction.vibes.slice(0, 5),
    priceRange: attraction.priceRange,
    ageRange: attraction.ageRange,
    createdAt: now.toISOString(),
  }
}

export function normalizeRecommendationFeedback(
  value: unknown,
  limit = 20
): RecommendationFeedback[] {
  if (!Array.isArray(value)) return []
  return value
    .map((candidate): RecommendationFeedback | null => {
      if (!candidate || typeof candidate !== "object") return null
      const entry = candidate as Record<string, unknown>
      const reason = entry.reason
      const placeKey = cleanText(entry.placeKey, 200)
      if (!placeKey || !FEEDBACK_REASONS.has(reason as RecommendationFeedbackReason)) {
        return null
      }
      return {
        placeKey,
        reason: reason as RecommendationFeedbackReason,
        category: cleanText(entry.category, 80),
        vibes: Array.isArray(entry.vibes)
          ? entry.vibes.map((vibe) => cleanText(vibe, 60)).filter(Boolean).slice(0, 5)
          : [],
        priceRange: cleanText(entry.priceRange, 20) || null,
        ageRange: cleanText(entry.ageRange, 80),
        createdAt: cleanText(entry.createdAt, 60) || new Date(0).toISOString(),
      }
    })
    .filter((entry): entry is RecommendationFeedback => entry !== null)
    .slice(-limit)
}

export function recordRecommendationFeedback(
  existing: RecommendationFeedback[],
  entry: RecommendationFeedback,
  limit = 20
) {
  return [...existing.filter((item) => item.placeKey !== entry.placeKey), entry].slice(
    -limit
  )
}

export function getFamilyVibeHighlights(familyVibe: FamilyVibe): string[] {
  const highlights: string[] = []
  if (familyVibe.kids?.length) {
    highlights.push(
      familyVibe.kids
        .slice(0, 2)
        .map((kid) => `${kid.name}, ${kid.age}`)
        .join(" · ")
    )
  }
  if (familyVibe.travel_style?.length) {
    highlights.push(familyVibe.travel_style.slice(0, 2).join(" + "))
  }
  if (familyVibe.sensory_needs?.length) highlights.push("Sensory needs considered")
  if (familyVibe.pace) highlights.push(`${familyVibe.pace} pace`)
  if (familyVibe.budget_preference && familyVibe.budget_preference !== "any") {
    highlights.push(`${familyVibe.budget_preference} budget`)
  }
  return highlights.slice(0, 4)
}
