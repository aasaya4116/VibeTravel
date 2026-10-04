import { destinationCards } from "./destinations"
import { absoluteMediaUrl, apiUrl } from "./media"

export interface DestinationOption {
  label: string
  city: string
  region: string
  imageUrl?: string
  recognized: boolean
  recommended: boolean
}

function localMatches(query: string): DestinationOption[] {
  const normalized = query.trim().toLowerCase()
  return destinationCards
    .filter((card) => !normalized || `${card.name} ${card.country}`.toLowerCase().includes(normalized))
    .slice(0, 8)
    .map((card) => ({
      label: card.destination,
      city: card.name,
      region: card.country,
      imageUrl: card.imageUrl,
      recognized: true,
      recommended: true,
    }))
}

export async function searchDestinationOptions(
  query: string,
  accessToken?: string | null
): Promise<DestinationOption[]> {
  const normalized = query.trim()
  if (!normalized) return localMatches("")

  try {
    const response = await fetch(`${apiUrl}/api/destinations?q=${encodeURIComponent(normalized)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    if (!response.ok) throw new Error("Destination lookup unavailable")
    const payload = await response.json()
    return (Array.isArray(payload.options) ? payload.options : []).map((option: DestinationOption) => ({
      ...option,
      imageUrl: absoluteMediaUrl(option.imageUrl),
    }))
  } catch {
    return localMatches(normalized)
  }
}

