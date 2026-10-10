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
  if (familyVibe.travelers?.length) {
    const labels = familyVibe.travelers
      .slice(0, 2)
      .map((traveler) => traveler.role.replace("_", " "))
    highlights.push(labels.join(" · "))
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

export interface FamilyMatchPlaceFacts {
  name: string
  category: string
  priceRange?: string | null
  accessibleEntrance?: boolean | null
}

export interface FamilyMatchExplanation {
  reason: string
  signals: Array<{
    type: "age" | "sensory" | "pace" | "style" | "budget" | "dietary" | "general"
    label: string
  }>
  tips: string[]
  sensoryNotes: string | null
  personalized: boolean
}

const STYLE_CATEGORY_TERMS: Record<string, string[]> = {
  "foodie family": ["Restaurant"],
  foodie: ["Restaurant"],
  "cultural explorer": ["Museum", "Cultural"],
  cultural: ["Museum", "Cultural"],
  "history buff": ["Museum", "Cultural"],
  history: ["Museum", "Cultural"],
  "art & design": ["Museum", "Cultural"],
  art: ["Museum", "Cultural"],
  "nature lover": ["Nature", "Zoo"],
  nature: ["Nature", "Zoo"],
  "active & outdoorsy": ["Nature", "Adventure", "Playground"],
  active: ["Nature", "Adventure", "Playground"],
  "urban adventurer": ["Adventure", "Cultural", "Museum"],
  urban: ["Adventure", "Cultural", "Museum"],
  "beach & relaxation": ["Nature"],
  beach: ["Nature"],
  "off the beaten path": ["Adventure", "Cultural"],
  "slow travel": ["Nature", "Cultural", "Restaurant"],
  relaxed: ["Nature", "Cultural", "Restaurant"],
}

const CATEGORY_VALUE: Record<string, string> = {
  Restaurant: "It gives the day a deliberate food stop instead of leaving a meal to chance",
  Museum: "It can serve as one focused indoor anchor in the day",
  Cultural: "It adds local context beyond a checklist of landmarks",
  Nature: "It adds open-air breathing room between structured stops",
  Playground: "It adds a low-structure break where kids can reset",
  Zoo: "It offers a shared, easy-to-understand experience across ages",
  Aquarium: "It offers a visual indoor stop that works across ages",
  "Theme Park": "It can be the day's main high-energy anchor",
  Adventure: "It adds an active counterpoint to sightseeing",
}

function readableList(values: string[]) {
  if (values.length <= 1) return values[0] ?? ""
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`
}

function cleanPreferenceList(value: unknown, limit = 3) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit)
    : []
}

function bestStyleForCategory(styles: string[], category: string) {
  return (
    styles.find((style) =>
      STYLE_CATEGORY_TERMS[style.toLowerCase()]?.includes(category)
    ) ?? styles[0] ?? null
  )
}

/**
 * Build a concise, deterministic explanation from traveler-selected preferences
 * and provider facts. It deliberately avoids inferring age, dietary, stroller, or
 * sensory suitability that the place provider has not verified.
 */
export function buildFamilyMatchExplanation(
  place: FamilyMatchPlaceFacts,
  familyVibe: Partial<FamilyVibe> | null | undefined
): FamilyMatchExplanation {
  const styles = cleanPreferenceList(familyVibe?.travel_style, 2)
  const dietary = cleanPreferenceList(familyVibe?.dietary, 2)
  const sensory = cleanPreferenceList(familyVibe?.sensory_needs, 2)
  const pace = ["slow", "moderate", "fast"].includes(String(familyVibe?.pace))
    ? String(familyVibe?.pace)
    : null
  const budget = typeof familyVibe?.budget_preference === "string"
    ? familyVibe.budget_preference
    : null
  const style = bestStyleForCategory(styles, place.category)
  const signals: FamilyMatchExplanation["signals"] = []

  if (style) signals.push({ type: "style", label: style.slice(0, 40) })
  if (pace) signals.push({ type: "pace", label: `${pace} pace` })
  if (place.category === "Restaurant" && dietary.length) {
    signals.push({ type: "dietary", label: dietary.join(" + ").slice(0, 40) })
  } else if (sensory.length) {
    signals.push({ type: "sensory", label: "Sensory needs noted" })
  }
  if (
    budget &&
    budget !== "any" &&
    place.priceRange &&
    (budget.toLowerCase() === place.priceRange.toLowerCase() ||
      (budget.toLowerCase() === "free" && place.priceRange.toLowerCase() === "free"))
  ) {
    signals.push({ type: "budget", label: `${budget} budget` })
  }
  if (signals.length === 0) {
    signals.push({ type: "general", label: `${place.category} match`.slice(0, 40) })
  }

  const opening = style
    ? `You chose ${style}${pace ? ` and a ${pace} pace` : ""}.`
    : pace
      ? `You chose a ${pace} pace.`
      : `This matched your search.`
  const value = CATEGORY_VALUE[place.category] ??
    `It adds a clear ${place.category.toLowerCase()} stop to the trip`
  const paceGuidance = pace === "slow"
    ? "; keep it as an unrushed anchor rather than stacking nearby stops"
    : pace === "fast"
      ? "; it can add variety to a fuller day"
      : ""

  const cautions: string[] = []
  const tips = ["Confirm current hours and ticket requirements before visiting."]
  if (place.category === "Restaurant" && dietary.length) {
    const needs = readableList(dietary)
    cautions.push(`Confirm current ${needs} handling directly with the venue`)
    tips.push(`Ask the venue about current ${needs} preparation and cross-contact practices.`)
  }
  if (sensory.length) {
    cautions.push("Check current crowd and noise conditions before you go")
    tips.push("Check the venue's quiet hours or lower-crowd times before visiting.")
  }
  if (place.accessibleEntrance === true) {
    tips.push("Google currently lists a wheelchair-accessible entrance; confirm details with the venue.")
  }

  return {
    reason: `${opening} ${value}${paceGuidance}.${cautions.length ? ` ${cautions.join(". ")}.` : ""}`,
    signals: signals.slice(0, 3),
    tips: tips.slice(0, 3),
    sensoryNotes: sensory.length
      ? `Your ${readableList(sensory)} preferences are noted; current conditions still need venue confirmation.`
      : null,
    personalized: signals.some((signal) => signal.type !== "general"),
  }
}
