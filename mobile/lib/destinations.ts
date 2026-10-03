import type { FamilyVibe } from "./types"

export type DestinationLens = "Your vibe" | "Food + culture" | "Easy with kids" | "Nature reset"

export interface DestinationCard {
  slug: string
  name: string
  country: string
  region: string
  destination: string
  imageUrl: string
  latitude?: number
  longitude?: number
  headline: string
  familyFitReason: string
  tags: string[]
  energy: string
  idealStay: string
  query: string
  lenses: DestinationLens[]
}

export const destinationLenses: DestinationLens[] = [
  "Your vibe",
  "Food + culture",
  "Easy with kids",
  "Nature reset",
]

export const destinationCards: DestinationCard[] = [
  {
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    region: "Asia",
    destination: "Tokyo, Japan",
    imageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1400&h=1100&fit=crop",
    latitude: 35.6762,
    longitude: 139.6503,
    headline: "Electric, playful, delicious",
    familyFitReason: "Technology districts for curious kids, exceptional food, and neighborhoods that work one at a time.",
    tags: ["Tech wonder", "Foodie favorite", "Neighborhood days"],
    energy: "Moderate energy",
    idealStay: "5–8 days",
    query: "family food, technology, games, and walkable neighborhoods",
    lenses: ["Your vibe", "Food + culture", "Easy with kids"],
  },
  {
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    region: "Europe",
    destination: "Lisbon, Portugal",
    imageUrl: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1400&h=1100&fit=crop",
    latitude: 38.7223,
    longitude: -9.1393,
    headline: "Sunny, flavorful, unhurried",
    familyFitReason: "Family food halls, compact historic areas, and easy day trips with room to slow down.",
    tags: ["Food markets", "Easy day trips", "Moderate pace"],
    energy: "Easygoing",
    idealStay: "4–7 days",
    query: "family food markets, culture, viewpoints, and easy day trips",
    lenses: ["Your vibe", "Food + culture", "Easy with kids"],
  },
  {
    slug: "copenhagen",
    name: "Copenhagen",
    country: "Denmark",
    region: "Europe",
    destination: "Copenhagen, Denmark",
    imageUrl: "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1400&h=1100&fit=crop",
    latitude: 55.6761,
    longitude: 12.5683,
    headline: "Designed for family days",
    familyFitReason: "Hands-on museums, playful public spaces, and low-friction transit between compact areas.",
    tags: ["Easy transit", "Playful design", "Kid-friendly"],
    energy: "Easy energy",
    idealStay: "4–6 days",
    query: "hands-on museums, food markets, design, and easy family activities",
    lenses: ["Your vibe", "Easy with kids"],
  },
  {
    slug: "mexico-city",
    name: "Mexico City",
    country: "Mexico",
    region: "North America",
    destination: "Mexico City, Mexico",
    imageUrl: "https://images.unsplash.com/photo-1518659526054-190340b32735?w=1400&h=1100&fit=crop",
    latitude: 19.4326,
    longitude: -99.1332,
    headline: "Big flavor, flexible energy",
    familyFitReason: "Street food, museums, parks, and colorful neighborhoods create options for every age.",
    tags: ["Food adventure", "Culture", "Big parks"],
    energy: "Lively, flexible",
    idealStay: "4–6 days",
    query: "family street food, culture, parks, and colorful neighborhoods",
    lenses: ["Your vibe", "Food + culture", "Easy with kids"],
  },
  {
    slug: "kyoto",
    name: "Kyoto",
    country: "Japan",
    region: "Asia",
    destination: "Kyoto, Japan",
    imageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1400&h=1100&fit=crop",
    latitude: 35.0116,
    longitude: 135.7681,
    headline: "Calm mornings, rich traditions",
    familyFitReason: "Market snacks, crafts, gardens, and beautiful districts reward a slower family pace.",
    tags: ["Food culture", "Crafts", "Calm mornings"],
    energy: "Slow and scenic",
    idealStay: "3–5 days",
    query: "family food markets, crafts, gardens, and calm cultural activities",
    lenses: ["Food + culture", "Nature reset"],
  },
  {
    slug: "san-diego",
    name: "San Diego",
    country: "United States",
    region: "North America",
    destination: "San Diego, CA",
    imageUrl: "https://images.unsplash.com/photo-1538964173425-93884d739596?w=1400&h=1100&fit=crop",
    latitude: 32.7157,
    longitude: -117.1611,
    headline: "Beach time without the friction",
    familyFitReason: "Beaches, family attractions, and mild weather make it easy to protect real downtime.",
    tags: ["Beach days", "Easy logistics", "Built-in rest"],
    energy: "Relaxed",
    idealStay: "4–6 days",
    query: "family beaches, easy attractions, parks, and relaxed food spots",
    lenses: ["Easy with kids", "Nature reset"],
  },
  {
    slug: "seoul",
    name: "Seoul",
    country: "South Korea",
    region: "Asia",
    destination: "Seoul, South Korea",
    imageUrl: "https://images.unsplash.com/photo-1538485399081-7c897f905d6d?w=1400&h=1100&fit=crop",
    latitude: 37.5665,
    longitude: 126.978,
    headline: "Future-facing and full of flavor",
    familyFitReason: "Gaming culture, markets, interactive museums, and seamless transit keep energetic days manageable.",
    tags: ["Tech energy", "Food markets", "Easy transit"],
    energy: "High energy",
    idealStay: "5–7 days",
    query: "family technology, gaming, food markets, and interactive museums",
    lenses: ["Food + culture", "Easy with kids"],
  },
  {
    slug: "singapore",
    name: "Singapore",
    country: "Singapore",
    region: "Asia",
    destination: "Singapore",
    imageUrl: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1400&h=1100&fit=crop",
    latitude: 1.3521,
    longitude: 103.8198,
    headline: "Big wonder, simple logistics",
    familyFitReason: "Science, gardens, and hawker food come with unusually easy city logistics for families.",
    tags: ["Food halls", "Hands-on learning", "Easy transit"],
    energy: "Polished and easy",
    idealStay: "3–5 days",
    query: "family science, gardens, hawker food, and easy city activities",
    lenses: ["Food + culture", "Easy with kids", "Nature reset"],
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    region: "Africa",
    destination: "Cape Town, South Africa",
    imageUrl: "https://images.unsplash.com/photo-1744604030401-b24c5975a574?w=1400&h=1100&fit=crop",
    latitude: -33.9249,
    longitude: 18.4241,
    headline: "Mountains, coast, and creative flavor",
    familyFitReason: "Table Mountain, colorful neighborhoods, beaches, and food markets make nature and culture easy to mix in one family trip.",
    tags: ["Mountain days", "Creative food", "Coastal reset"],
    energy: "Flexible energy",
    idealStay: "5–7 days",
    query: "family food markets, Table Mountain, beaches, wildlife, and cultural neighborhoods",
    lenses: ["Your vibe", "Food + culture", "Easy with kids", "Nature reset"],
  },
  {
    slug: "lagos",
    name: "Lagos",
    country: "Nigeria",
    region: "Africa",
    destination: "Lagos, Nigeria",
    imageUrl: "https://images.unsplash.com/photo-1577948000111-9c970dfe3743?w=1400&h=1100&fit=crop",
    latitude: 6.5244,
    longitude: 3.3792,
    headline: "Bold flavor, art, and coastal energy",
    familyFitReason: "Markets, contemporary art, Nigerian food, beaches, and creative neighborhoods give families a vivid mix of culture and downtime.",
    tags: ["Nigerian food", "Creative culture", "Coastal days"],
    energy: "Lively, flexible",
    idealStay: "4–6 days",
    query: "family-friendly Nigerian restaurants, art, culture, beaches, markets, and hands-on activities",
    lenses: ["Your vibe", "Food + culture", "Easy with kids", "Nature reset"],
  },
  {
    slug: "chicago",
    name: "Chicago",
    country: "United States",
    region: "North America",
    destination: "Chicago, IL",
    imageUrl: "https://images.unsplash.com/photo-1493134799591-2c9eed26201a?w=1400&h=1100&fit=crop",
    latitude: 41.8781,
    longitude: -87.6298,
    headline: "Big-city culture by the lake",
    familyFitReason: "Architecture, museums, neighborhood food, and a walkable waterfront give families variety without changing cities.",
    tags: ["Museums", "Food neighborhoods", "Lakefront"],
    energy: "Lively, flexible",
    idealStay: "3–5 days",
    query: "family museums, architecture, neighborhood food, parks, and lakefront activities",
    lenses: ["Food + culture", "Easy with kids"],
  },
  {
    slug: "seattle",
    name: "Seattle",
    country: "United States",
    region: "North America",
    destination: "Seattle, WA",
    imageUrl: "https://images.unsplash.com/photo-1709751054686-2c4a5822ce47?w=1400&h=1100&fit=crop",
    latitude: 47.6062,
    longitude: -122.3321,
    headline: "Curious city, wild horizon",
    familyFitReason: "Markets, aviation and science, ferries, and mountain views balance curious indoor stops with fresh-air resets.",
    tags: ["Tech + science", "Market food", "Nature nearby"],
    energy: "Moderate energy",
    idealStay: "3–5 days",
    query: "family technology, aviation, food markets, ferries, and nature activities",
    lenses: ["Easy with kids", "Nature reset"],
  },
]

export function getDefaultDestinationLens(familyVibe: FamilyVibe | null): DestinationLens {
  const styles = familyVibe?.travel_style ?? []
  if (styles.some((style) => /food|culinary|culture/i.test(style))) return "Food + culture"
  if (styles.some((style) => /nature|outdoor|beach|slow/i.test(style))) return "Nature reset"
  return "Your vibe"
}

const lensEditorialOrder: Partial<Record<DestinationLens, string[]>> = {
  "Food + culture": ["mexico-city", "lagos", "cape-town", "lisbon", "tokyo", "kyoto", "seoul", "singapore", "chicago"],
  "Easy with kids": ["copenhagen", "cape-town", "lagos", "singapore", "san-diego", "tokyo", "lisbon", "mexico-city", "seoul", "chicago", "seattle"],
  "Nature reset": ["san-diego", "cape-town", "lagos", "kyoto", "seattle", "singapore"],
}

function destinationScore(card: DestinationCard, familyVibe: FamilyVibe | null, lens: DestinationLens) {
  if (!familyVibe) {
    const editorialOrder = lensEditorialOrder[lens]
    const editorialIndex = editorialOrder?.indexOf(card.slug) ?? -1
    return (card.lenses.includes("Your vibe") ? 2 : 0) +
      (editorialOrder && editorialIndex >= 0 ? (editorialOrder.length - editorialIndex) * 20 : 0)
  }

  const profile = [
    ...(familyVibe.travel_style ?? []),
    ...(familyVibe.dietary ?? []),
    familyVibe.pace,
  ].join(" ").toLowerCase()
  const destinationText = [card.headline, card.familyFitReason, ...card.tags, card.query].join(" ").toLowerCase()
  let score = card.lenses.includes("Your vibe") ? 2 : 0

  if (/food|foodie|culinary|culture|history|art|design/.test(profile) && card.lenses.includes("Food + culture")) score += 6
  if (/nature|outdoor|beach|relax|slow/.test(profile) && card.lenses.includes("Nature reset")) score += 6
  if ((familyVibe.kids?.length ?? 0) > 0 && card.lenses.includes("Easy with kids")) score += 4
  if (/urban|city|technology|tech|gaming/.test(profile) && /tech|science|gaming|urban|city/.test(destinationText)) score += 5
  if (familyVibe.pace === "slow" && /slow|calm|relax|easy|scenic|reset/.test(destinationText)) score += 3
  if (familyVibe.pace === "moderate" && /moderate|flexible|easy/.test(destinationText)) score += 2
  if ((familyVibe.dietary?.length ?? 0) > 0 && /food|market|culinary/.test(destinationText)) score += 2

  const editorialOrder = lensEditorialOrder[lens]
  const editorialIndex = editorialOrder?.indexOf(card.slug) ?? -1
  if (editorialOrder && editorialIndex >= 0) score += (editorialOrder.length - editorialIndex) * 20

  return score
}

export function rankDestinationsForVibe(
  familyVibe: FamilyVibe | null,
  lens: DestinationLens = "Your vibe",
) {
  const candidates = lens === "Your vibe"
    ? destinationCards
    : destinationCards.filter((destination) => destination.lenses.includes(lens))

  return [...candidates].sort((a, b) => {
    const scoreDelta = destinationScore(b, familyVibe, lens) - destinationScore(a, familyVibe, lens)
    if (scoreDelta !== 0) return scoreDelta
    return destinationCards.indexOf(a) - destinationCards.indexOf(b)
  })
}

export function describeVibeMatch(familyVibe: FamilyVibe | null) {
  if (!familyVibe) return "Curated family destinations"
  const styles = familyVibe.travel_style?.slice(0, 2) ?? []
  const parts = [...styles, `${familyVibe.pace} pace`]
  return parts.filter(Boolean).join(" · ")
}

export function getDestinationQueryForLens(card: DestinationCard, lens: DestinationLens) {
  if (lens === "Food + culture") return "family-friendly local restaurants, food markets, art, and cultural experiences"
  if (lens === "Easy with kids") return "easy family activities, hands-on museums, parks, and relaxed meals"
  if (lens === "Nature reset") return "family nature, gardens, beaches, parks, and easy outdoor activities"
  return card.query
}

export function findDestinationCard(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  return destinationCards.find((card) => {
    const name = card.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    const destination = card.destination.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    return normalized === destination || normalized === name || normalized.startsWith(`${name} `)
  }) ?? null
}

export function createDestinationCard(value: string): DestinationCard {
  const destination = value.trim()
  const [cityPart, ...countryParts] = destination.split(",").map((part) => part.trim()).filter(Boolean)
  const name = cityPart || destination
  const country = countryParts.join(", ") || "Your destination"
  const slug = destination.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "destination"

  return {
    slug: `custom-${slug}`,
    name,
    country,
    region: "Anywhere",
    destination,
    imageUrl: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1400&h=1100&fit=crop",
    headline: "Build a trip around what your family loves",
    familyFitReason: `Search verified places in ${name} using your Family Vibe, pace, and interests.`,
    tags: ["Your destination", "Vibe-matched", "Verified places"],
    energy: "Set by your vibe",
    idealStay: "Your dates",
    query: "family-friendly food, culture, parks, museums, and memorable local experiences",
    lenses: ["Your vibe", "Food + culture", "Easy with kids", "Nature reset"],
  }
}

export function resolveDestinationCard(value: string | null | undefined) {
  if (!value?.trim()) return null
  return findDestinationCard(value) ?? createDestinationCard(value)
}

export function getTripImage(destination: string) {
  return findDestinationCard(destination)?.imageUrl ?? "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1400&h=1000&fit=crop"
}
