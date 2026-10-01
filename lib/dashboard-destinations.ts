import {
  destinationBrowseCards,
  type DestinationBrowseCard,
} from "./destination-browse"
import { destinations } from "./destinations"

export interface DashboardDestinationOption {
  label: string
  city: string
  region: string
  imageUrl: string
  fallbackImageUrl: string
  familyFitReason: string | null
  recent: boolean
  recommended: boolean
}

export function getDashboardDestinationPhotoUrl(destination: string) {
  return `/api/destination-photo?destination=${encodeURIComponent(destination.trim())}`
}

export function getDashboardExploreUrl(destination: string) {
  const normalizedDestination = destination.trim()
  const params = new URLSearchParams({ dest: normalizedDestination })
  const curated = findDashboardDestinationCard(normalizedDestination)
  if (curated) params.set("q", curated.query)
  return `/search?${params.toString()}`
}

export function normalizeDestination(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function splitDestination(value: string) {
  const [city, ...regionParts] = value.split(",").map((part) => part.trim())
  return {
    city: city || value,
    region: regionParts.join(", "),
  }
}

export function findDashboardDestinationCard(value: string) {
  const normalized = normalizeDestination(value)

  return (
    destinationBrowseCards.find(
      (card) => normalizeDestination(card.destination) === normalized
    ) ??
    destinationBrowseCards.find((card) => {
      const name = normalizeDestination(card.name)
      return normalized === name || normalized.startsWith(`${name} `)
    }) ??
    null
  )
}

function toOption(
  label: string,
  recentDestinations: Set<string>
): DashboardDestinationOption {
  const card = findDashboardDestinationCard(label)
  const { city, region } = splitDestination(label)
  const fallbackImageUrl = getDashboardDestinationPhotoUrl(label)

  return {
    label,
    city,
    region,
    imageUrl: card?.imageUrl ?? fallbackImageUrl,
    fallbackImageUrl,
    familyFitReason: card?.familyFitReason ?? null,
    recent: recentDestinations.has(normalizeDestination(label)),
    recommended: card !== null,
  }
}

export function getDashboardDestinationOptions(
  recentValues: string[],
  query = ""
) {
  const recentDestinations = new Set(recentValues.map(normalizeDestination))
  const seen = new Set<string>()
  const ordered = [
    ...recentValues,
    ...destinationBrowseCards.map((card) => card.destination),
    ...destinations,
  ].filter((value) => {
    const key = normalizeDestination(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const normalizedQuery = normalizeDestination(query)
  return ordered
    .map((value) => toOption(value, recentDestinations))
    .filter((option) => {
      if (!normalizedQuery) return true
      return normalizeDestination(option.label).includes(normalizedQuery)
    })
}

export function getRecommendedDashboardDestinations(
  travelStyles: string[]
): DestinationBrowseCard[] {
  const normalizedStyles = travelStyles.map((style) => style.toLowerCase())

  return [...destinationBrowseCards].sort((left, right) => {
    const score = (card: DestinationBrowseCard) =>
      card.tags.reduce((total, tag) => {
        const normalizedTag = tag.toLowerCase()
        return (
          total +
          (normalizedStyles.some(
            (style) =>
              normalizedTag.includes(style) ||
              style.includes(normalizedTag.split(" ")[0])
          )
            ? 1
            : 0)
        )
      }, 0)

    return score(right) - score(left)
  })
}
