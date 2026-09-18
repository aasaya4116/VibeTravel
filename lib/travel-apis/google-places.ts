const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export function isConfigured() {
  return !!API_KEY
}

export interface PlaceResult {
  id: string
  name: string
  address: string
  rating: number | null
  userRatingCount: number | null
  priceLevel: string | null // "PRICE_LEVEL_FREE" | "PRICE_LEVEL_INEXPENSIVE" | etc.
  openNow: boolean | null
  weekdayHours: string[] | null
  photoUrl: string | null
  accessibleEntrance: boolean | null
  googleMapsUri: string | null
  websiteUri: string | null
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "FUTURE_OPENING" | null
  primaryType: string | null
  primaryTypeLabel: string | null
  types: string[]
}

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  businessStatus?: PlaceResult["businessStatus"]
  currentOpeningHours?: { openNow?: boolean }
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  photos?: { name?: string }[]
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean }
  googleMapsUri?: string
  websiteUri?: string
  primaryType?: string
  primaryTypeDisplayName?: { text?: string }
  types?: string[]
}

function toPlaceResult(place: GooglePlace): PlaceResult | null {
  const id = place.id?.trim()
  const name = place.displayName?.text?.trim()
  if (!id || !name) return null

  const photoRef = place.photos?.[0]?.name

  return {
    id,
    name,
    address: place.formattedAddress ?? "",
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ? (PRICE_MAP[place.priceLevel] ?? null) : null,
    openNow: place.currentOpeningHours?.openNow ?? null,
    weekdayHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    photoUrl: photoRef
      ? `/api/place-photo?ref=${encodeURIComponent(photoRef)}`
      : null,
    accessibleEntrance:
      place.accessibilityOptions?.wheelchairAccessibleEntrance ?? null,
    googleMapsUri: place.googleMapsUri ?? null,
    websiteUri: place.websiteUri ?? null,
    businessStatus: place.businessStatus ?? null,
    primaryType: place.primaryType ?? null,
    primaryTypeLabel: place.primaryTypeDisplayName?.text ?? null,
    types: place.types ?? [],
  }
}

/**
 * Returns Google Places candidates for a destination search. Google owns every
 * identity and factual field in this result; callers may rank or summarize the
 * candidates, but must not invent additional venues.
 */
export async function searchVerifiedPlaces(
  query: string,
  destination: string,
  limit = 10
): Promise<PlaceResult[]> {
  if (!API_KEY || !destination.trim()) return []

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.rating",
          "places.userRatingCount",
          "places.priceLevel",
          "places.businessStatus",
          "places.currentOpeningHours",
          "places.regularOpeningHours",
          "places.photos",
          "places.accessibilityOptions",
          "places.googleMapsUri",
          "places.websiteUri",
          "places.primaryType",
          "places.primaryTypeDisplayName",
          "places.types",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: `${query || "family-friendly attractions"} in ${destination}`,
        pageSize: Math.max(1, Math.min(limit, 20)),
        languageCode: "en",
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error(`[google-places] Search failed (${res.status}):`, detail.slice(0, 300))
      throw new Error(`Google Places search failed with status ${res.status}`)
    }

    const data = await res.json()
    return ((data.places ?? []) as GooglePlace[])
      .map(toPlaceResult)
      .filter((place): place is PlaceResult => {
        if (!place) return false
        return place.businessStatus !== "CLOSED_PERMANENTLY" && place.businessStatus !== "FUTURE_OPENING"
      })
  } catch (error) {
    console.error("[google-places] Search error:", error)
    throw error
  }
}

export async function searchPlaces(
  query: string,
  destination: string
): Promise<PlaceResult | null> {
  try {
    const results = await searchVerifiedPlaces(query, destination, 1)
    return results[0] ?? null
  } catch {
    return null
  }
}

export async function searchPlacesBatch(
  items: { name: string; destination: string }[]
): Promise<Map<string, PlaceResult>> {
  if (!API_KEY) return new Map()

  const results = await Promise.all(
    items.map(async ({ name, destination }) => {
      const result = await searchPlaces(name, destination)
      return { name, result }
    })
  )

  const map = new Map<string, PlaceResult>()
  for (const { name, result } of results) {
    if (result) map.set(name, result)
  }
  return map
}
