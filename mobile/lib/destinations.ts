import type { FamilyVibe } from "./types"

export type DestinationLens = "Your vibe" | "Food + culture" | "Easy with kids" | "Nature reset"

export interface DestinationCard {
  slug: string
  name: string
  country: string
  destination: string
  imageUrl: string
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
    destination: "Tokyo, Japan",
    imageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1400&h=1100&fit=crop",
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
    destination: "Lisbon, Portugal",
    imageUrl: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1400&h=1100&fit=crop",
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
    destination: "Copenhagen, Denmark",
    imageUrl: "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1400&h=1100&fit=crop",
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
    destination: "Mexico City, Mexico",
    imageUrl: "https://images.unsplash.com/photo-1518659526054-190340b32735?w=1400&h=1100&fit=crop",
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
    destination: "Kyoto, Japan",
    imageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1400&h=1100&fit=crop",
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
    destination: "San Diego, CA",
    imageUrl: "https://images.unsplash.com/photo-1538964173425-93884d739596?w=1400&h=1100&fit=crop",
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
    destination: "Seoul, South Korea",
    imageUrl: "https://images.unsplash.com/photo-1538485399081-7c897f905d6d?w=1400&h=1100&fit=crop",
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
    destination: "Singapore",
    imageUrl: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1400&h=1100&fit=crop",
    headline: "Big wonder, simple logistics",
    familyFitReason: "Science, gardens, and hawker food come with unusually easy city logistics for families.",
    tags: ["Food halls", "Hands-on learning", "Easy transit"],
    energy: "Polished and easy",
    idealStay: "3–5 days",
    query: "family science, gardens, hawker food, and easy city activities",
    lenses: ["Food + culture", "Easy with kids", "Nature reset"],
  },
]

export function getDefaultDestinationLens(familyVibe: FamilyVibe | null): DestinationLens {
  const styles = familyVibe?.travel_style ?? []
  if (styles.some((style) => /food|culinary|culture/i.test(style))) return "Food + culture"
  if (styles.some((style) => /nature|outdoor|beach|slow/i.test(style))) return "Nature reset"
  return "Your vibe"
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

export function getTripImage(destination: string) {
  return findDestinationCard(destination)?.imageUrl ?? "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1400&h=1000&fit=crop"
}
