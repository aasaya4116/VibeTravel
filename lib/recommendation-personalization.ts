import type { Attraction, FamilyVibe } from "./types"

type DiscoveryVibe = Pick<FamilyVibe, "travel_style" | "dietary"> | null | undefined

const STYLE_DISCOVERY_QUERIES: Record<string, string> = {
  "cultural explorer": "family-friendly museums cultural attractions historic neighborhoods",
  cultural: "family-friendly museums cultural attractions historic neighborhoods",
  "nature lover": "family-friendly parks gardens nature trails",
  nature: "family-friendly parks gardens nature trails",
  "foodie family": "family-friendly restaurants food markets bakeries cooking experiences",
  foodie: "family-friendly restaurants food markets bakeries cooking experiences",
  "urban adventurer": "family-friendly city neighborhoods landmarks interactive experiences",
  urban: "family-friendly city neighborhoods landmarks interactive experiences",
  "beach & relaxation": "family-friendly beaches waterfront relaxed activities",
  beach: "family-friendly beaches waterfront relaxed activities",
  "off the beaten path": "family-friendly hidden gems local neighborhoods",
  "history buff": "family-friendly historic sites history museums landmarks",
  history: "family-friendly historic sites history museums landmarks",
  "art & design": "family-friendly art museums galleries architecture design",
  art: "family-friendly art museums galleries architecture design",
  "active & outdoorsy": "family-friendly outdoor adventures hikes bike rides parks",
  active: "family-friendly outdoor adventures hikes bike rides parks",
  "slow travel": "family-friendly walkable neighborhoods cafes parks leisurely experiences",
  relaxed: "family-friendly walkable neighborhoods cafes parks leisurely experiences",
}

function normalizedStyles(familyVibe: DiscoveryVibe) {
  return Array.isArray(familyVibe?.travel_style)
    ? familyVibe.travel_style
        .filter((style): style is string => typeof style === "string")
        .map((style) => style.trim().toLowerCase())
        .filter(Boolean)
    : []
}

function destinationSearch(label: string, destination?: string | null) {
  return destination?.trim() ? `${label} in ${destination.trim()}` : label
}

export function getVibeDiscoveryQuery(familyVibe: DiscoveryVibe): string {
  const styles = normalizedStyles(familyVibe)
  const styleQueries = styles
    .map((style) => STYLE_DISCOVERY_QUERIES[style])
    .filter((query): query is string => Boolean(query))
    .slice(0, 2)

  if (styleQueries.length === 0) return "family-friendly attractions"

  const isFoodie = styles.some((style) => style === "foodie family" || style === "foodie")
  const dietary = Array.isArray(familyVibe?.dietary)
    ? familyVibe.dietary
        .filter((need): need is string => typeof need === "string")
        .map((need) => need.trim())
        .filter(Boolean)
        .slice(0, 2)
    : []

  return `${styleQueries.join(" ")}${isFoodie && dietary.length ? ` ${dietary.join(" ")} options` : ""}`
}

export function getVibeSuggestedSearches(
  familyVibe: DiscoveryVibe,
  destination?: string | null
): string[] {
  const styles = normalizedStyles(familyVibe)
  let suggestions: string[]

  if (styles.some((style) => style === "foodie family" || style === "foodie")) {
    suggestions = [
      "Family-friendly restaurants",
      "Food markets and food halls",
      "Bakeries and dessert spots",
      "Family cooking classes",
      "Kid-friendly local specialties",
    ]
  } else if (styles.some((style) => style.includes("nature") || style.includes("outdoors"))) {
    suggestions = [
      "Family-friendly parks and gardens",
      "Easy nature trails",
      "Outdoor adventures with kids",
      "Wildlife and botanical gardens",
      "Scenic picnic spots",
    ]
  } else if (styles.some((style) => style.includes("art") || style.includes("cultural") || style.includes("history"))) {
    suggestions = [
      "Kid-friendly museums",
      "Hands-on cultural experiences",
      "Historic neighborhoods to explore",
      "Family art and design activities",
      "Local landmarks with kids",
    ]
  } else {
    suggestions = [
      "Kid-friendly museums",
      "Parks and playgrounds",
      "Rainy day activities",
      "Best restaurants for families",
      "Free things to do",
    ]
  }

  return suggestions.map((suggestion) => destinationSearch(suggestion, destination))
}

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
