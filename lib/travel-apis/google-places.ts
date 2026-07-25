const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export function isConfigured() {
  return !!API_KEY
}

export interface PlaceResult {
  name: string
  address: string
  rating: number | null
  priceLevel: string | null // "PRICE_LEVEL_FREE" | "PRICE_LEVEL_INEXPENSIVE" | etc.
  openNow: boolean | null
  weekdayHours: string[] | null
  photoUrl: string | null
  accessibleEntrance: boolean | null
  googleMapsUri: string | null
}

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
}

export async function searchPlaces(
  query: string,
  destination: string
): Promise<PlaceResult | null> {
  if (!API_KEY) return null

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.currentOpeningHours,places.regularOpeningHours,places.photos,places.accessibilityOptions,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: `${query} ${destination}`,
        maxResultCount: 1,
        languageCode: "en",
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const place = data.places?.[0]
    if (!place) return null

    const photoRef = place.photos?.[0]?.name
    // Route through our own proxy so the Google API key is never exposed to the client.
    const photoUrl = photoRef
      ? `/api/place-photo?ref=${encodeURIComponent(photoRef)}`
      : null

    return {
      name: place.displayName?.text ?? query,
      address: place.formattedAddress ?? null,
      rating: place.rating ?? null,
      priceLevel: place.priceLevel ? (PRICE_MAP[place.priceLevel] ?? null) : null,
      openNow: place.currentOpeningHours?.openNow ?? null,
      weekdayHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
      photoUrl,
      accessibleEntrance: place.accessibilityOptions?.wheelchairAccessibleEntrance ?? null,
      googleMapsUri: place.googleMapsUri ?? null,
    }
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
