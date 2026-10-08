import {
  destinationCards,
  type DestinationCard,
} from "./destinations"
import { absoluteMediaUrl, apiUrl } from "./media"

/**
 * A destination is only verified when the resolver gives us a stable place ID
 * and coordinates. `recognized` remains as a compatibility alias for older UI,
 * while `resolved` is the source of truth for saving typed destinations.
 */
export interface DestinationOption {
  label: string
  canonicalLabel: string
  city: string
  region: string
  country: string
  placeId: string
  latitude: number | null
  longitude: number | null
  imageUrl?: string
  provider: "google" | "curated"
  resolved: boolean
  recognized: boolean
  recommended: boolean
}

export interface DestinationOptionPayload {
  label?: unknown
  canonicalLabel?: unknown
  city?: unknown
  region?: unknown
  country?: unknown
  placeId?: unknown
  googlePlaceId?: unknown
  latitude?: unknown
  longitude?: unknown
  lat?: unknown
  lng?: unknown
  imageUrl?: unknown
  provider?: unknown
  resolved?: unknown
  recognized?: unknown
  recommended?: unknown
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function coordinateValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function destinationOptionFromCard(card: DestinationCard): DestinationOption {
  return {
    label: card.destination,
    canonicalLabel: card.destination,
    city: card.name,
    region: card.country,
    country: card.country,
    placeId: `curated:${card.slug}`,
    latitude: card.latitude ?? null,
    longitude: card.longitude ?? null,
    imageUrl: card.imageUrl,
    provider: "curated",
    // Editorial cards are inspiration only. The traveler must still choose a
    // provider-verified result before this can become a trip destination.
    resolved: false,
    recognized: true,
    recommended: true,
  }
}

export function normalizeDestinationOption(raw: DestinationOptionPayload): DestinationOption | null {
  const city = textValue(raw.city)
  const region = textValue(raw.region)
  const country = textValue(raw.country) || region
  const label = textValue(raw.canonicalLabel)
    || textValue(raw.label)
    || [city, country].filter(Boolean).join(", ")
  if (!label || !city) return null

  const placeId = textValue(raw.placeId) || textValue(raw.googlePlaceId)
  const latitude = coordinateValue(raw.latitude ?? raw.lat)
  const longitude = coordinateValue(raw.longitude ?? raw.lng)
  const hasResolvedIdentity = Boolean(placeId && latitude !== null && longitude !== null)
  const resolved = raw.resolved === true && hasResolvedIdentity

  return {
    label,
    canonicalLabel: label,
    city,
    region: region || country,
    country,
    placeId,
    latitude,
    longitude,
    imageUrl: absoluteMediaUrl(textValue(raw.imageUrl) || undefined),
    provider: raw.provider === "google" ? "google" : "curated",
    resolved,
    recognized: resolved || raw.recognized === true,
    recommended: raw.recommended === true,
  }
}

function localMatches(query: string): DestinationOption[] {
  const normalized = query.trim().toLowerCase()
  return destinationCards
    .filter((card) => !normalized || `${card.name} ${card.country}`.toLowerCase().includes(normalized))
    .slice(0, 8)
    .map(destinationOptionFromCard)
}

export function isVerifiedDestinationOption(option: DestinationOption | null | undefined) {
  return Boolean(
    option?.resolved
    && option.provider === "google"
    && option.placeId
    && !option.placeId.startsWith("curated:")
    && option.latitude !== null
    && option.longitude !== null
  )
}

export function needsTripDestinationConfirmation(
  destination: string | null | undefined,
  cachedOption?: DestinationOption | null,
) {
  const normalized = destination?.trim() ?? ""
  if (!normalized) return true
  if (
    cachedOption
    && isVerifiedDestinationOption(cachedOption)
    && cachedOption.label.toLocaleLowerCase() === normalized.toLocaleLowerCase()
  ) return false

  if (destinationCards.some((card) => (
    card.destination.toLocaleLowerCase() === normalized.toLocaleLowerCase()
    || card.name.toLocaleLowerCase() === normalized.toLocaleLowerCase()
  ))) return false

  // Older trips only stored a string. A city + region/country pair is safe for
  // the server resolver; a fragment such as "Nair" is not.
  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean)
  return parts.length < 2 || parts.some((part) => part.length < 2)
}

export async function searchDestinationOptions(
  query: string,
  accessToken?: string | null,
  signal?: AbortSignal,
): Promise<DestinationOption[]> {
  const normalized = query.trim()
  if (!normalized) return localMatches("")

  try {
    const response = await fetch(`${apiUrl}/api/destinations?q=${encodeURIComponent(normalized)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal,
    })
    if (!response.ok) throw new Error("Destination lookup unavailable")
    const payload = await response.json()
    return (Array.isArray(payload.options) ? payload.options : [])
      .map((option: DestinationOptionPayload) => normalizeDestinationOption(option))
      .filter((option: DestinationOption | null): option is DestinationOption => Boolean(option))
  } catch (error) {
    throw error
  }
}

