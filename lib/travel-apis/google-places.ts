import { createHash } from "node:crypto"

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
const DEFAULT_SEARCH_TIMEOUT_MS = 6_000
const DEFAULT_DESTINATION_TIMEOUT_MS = 4_000
const DESTINATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000
const EMPTY_DESTINATION_CACHE_TTL_MS = 5 * 60 * 1_000
const DESTINATION_CACHE_LIMIT = 250
const GOOGLE_LOCATION_BIAS_RADIUS_METERS = 50_000
const TEXT_SEARCH_CACHE_TTL_MS = 10 * 60 * 1_000
const EMPTY_TEXT_SEARCH_CACHE_TTL_MS = 30 * 1_000
const TEXT_SEARCH_CACHE_LIMIT = 200

export function isConfigured() {
  return !!API_KEY
}

export interface DestinationAnchor {
  label: string
  canonicalLabel: string
  city: string
  region: string
  country: string
  placeId: string
  latitude: number
  longitude: number
  resolved: true
  recognized: true
  primaryType: string | null
  types: string[]
  /** Maximum distance used for our strict result post-filter. */
  radiusMeters: number
}

export interface PlaceResult {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
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
  addressComponents?: Array<{
    longText?: string
    shortText?: string
    types?: string[]
  }>
  location?: { latitude?: number; longitude?: number }
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  businessStatus?: PlaceResult["businessStatus"]
  currentOpeningHours?: { openNow?: boolean }
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  photos?: GooglePlacePhoto[]
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean }
  googleMapsUri?: string
  websiteUri?: string
  primaryType?: string
  primaryTypeDisplayName?: { text?: string }
  types?: string[]
}

type GooglePlacePhoto = {
  name?: string
  widthPx?: number
  heightPx?: number
}

// Cards render as landscape imagery. Requesting a larger rendition cannot make
// a small provider original sharper, so only accept photos that can cover both
// web and high-density mobile cards without upscaling.
const MIN_PLACE_PHOTO_WIDTH = 1_200
const MIN_PLACE_PHOTO_HEIGHT = 800
const MIN_PLACE_PHOTO_ASPECT_RATIO = 1.1
const MAX_PLACE_PHOTO_ASPECT_RATIO = 2.4

function highResolutionLandscapePhoto(photos: GooglePlacePhoto[] | undefined) {
  return photos?.find((photo) => {
    const width = photo.widthPx
    const height = photo.heightPx
    if (
      !photo.name ||
      typeof width !== "number" ||
      typeof height !== "number" ||
      width < MIN_PLACE_PHOTO_WIDTH ||
      height < MIN_PLACE_PHOTO_HEIGHT
    ) {
      return false
    }

    const aspectRatio = width / height
    return (
      aspectRatio >= MIN_PLACE_PHOTO_ASPECT_RATIO &&
      aspectRatio <= MAX_PLACE_PHOTO_ASPECT_RATIO
    )
  })
}

type GoogleAutocompletePrediction = {
  placeId?: string
  text?: { text?: string }
  structuredFormat?: {
    mainText?: { text?: string }
    secondaryText?: { text?: string }
  }
  types?: string[]
}

type DestinationCacheEntry = {
  expiresAt: number
  values: DestinationAnchor[]
}

const destinationCache = new Map<string, DestinationCacheEntry>()

type TextSearchCacheEntry = {
  expiresAt: number
  values: PlaceResult[]
}

// Keys are irreversible digests, so raw traveler searches never remain in the
// long-lived process map. Values are Google's factual candidates only.
const textSearchCache = new Map<string, TextSearchCacheEntry>()

const CITY_TYPES = new Set([
  "locality",
  "postal_town",
  "sublocality",
  "administrative_area_level_3",
])

const REGION_TYPES = new Set([
  "administrative_area_level_1",
  "administrative_area_level_2",
  "country",
  "natural_feature",
  "national_park",
  "park",
])

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function clonePlaceResult(place: PlaceResult): PlaceResult {
  return {
    ...place,
    weekdayHours: place.weekdayHours ? [...place.weekdayHours] : null,
    types: [...place.types],
  }
}

function textSearchCacheKey(
  query: string,
  canonicalDestination: string,
  limit: number,
  anchor: DestinationAnchor | null
) {
  const normalizedAnchor = anchor
    ? [
        normalize(anchor.canonicalLabel),
        normalize(anchor.placeId),
        anchor.latitude.toFixed(5),
        anchor.longitude.toFixed(5),
        String(anchor.radiusMeters),
      ].join("|")
    : normalize(canonicalDestination)
  const material = JSON.stringify([
    normalizedAnchor,
    normalize(query || "family-friendly attractions"),
    limit,
  ])
  return createHash("sha256").update(material).digest("hex")
}

function cacheTextSearchResults(key: string, values: PlaceResult[]) {
  const now = Date.now()
  for (const [candidateKey, entry] of textSearchCache) {
    if (entry.expiresAt <= now) textSearchCache.delete(candidateKey)
  }

  if (textSearchCache.has(key)) textSearchCache.delete(key)
  while (textSearchCache.size >= TEXT_SEARCH_CACHE_LIMIT) {
    const oldest = textSearchCache.keys().next().value
    if (!oldest) break
    textSearchCache.delete(oldest)
  }
  textSearchCache.set(key, {
    expiresAt:
      now +
      (values.length > 0
        ? TEXT_SEARCH_CACHE_TTL_MS
        : EMPTY_TEXT_SEARCH_CACHE_TTL_MS),
    values: values.map(clonePlaceResult),
  })
}

function cachedTextSearchResults(key: string) {
  const cached = textSearchCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    textSearchCache.delete(key)
    return null
  }

  // Refresh insertion order for a small LRU-style bound without extending TTL.
  textSearchCache.delete(key)
  textSearchCache.set(key, cached)
  return cached.values.map(clonePlaceResult)
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const deadline = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, deadline]) : deadline
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError")
  }
}

function cacheDestinationResults(key: string, values: DestinationAnchor[]) {
  if (destinationCache.size >= DESTINATION_CACHE_LIMIT) {
    const oldest = destinationCache.keys().next().value
    if (oldest) destinationCache.delete(oldest)
  }
  destinationCache.set(key, {
    expiresAt:
      Date.now() +
      (values.length > 0
        ? DESTINATION_CACHE_TTL_MS
        : EMPTY_DESTINATION_CACHE_TTL_MS),
    values,
  })
}

function cachedDestinationResults(key: string) {
  const cached = destinationCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    destinationCache.delete(key)
    return null
  }
  return cached.values
}

function addressPart(place: GooglePlace, type: string) {
  return place.addressComponents?.find((component) =>
    component.types?.includes(type)
  )?.longText?.trim() ?? ""
}

function destinationRadius(types: string[]) {
  if (types.some((type) => CITY_TYPES.has(type))) return 75_000
  if (types.includes("country")) return 1_000_000
  if (types.some((type) => REGION_TYPES.has(type))) return 250_000
  return 100_000
}

function toDestinationAnchor(
  prediction: GoogleAutocompletePrediction,
  place: GooglePlace
): DestinationAnchor | null {
  const placeId = place.id?.trim() || prediction.placeId?.trim()
  const latitude = place.location?.latitude
  const longitude = place.location?.longitude
  if (
    !placeId ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null
  }

  const types = Array.from(new Set([...(place.types ?? []), ...(prediction.types ?? [])]))
  if (!types.some((type) => CITY_TYPES.has(type) || REGION_TYPES.has(type))) {
    return null
  }

  const city =
    addressPart(place, "locality") ||
    addressPart(place, "postal_town") ||
    addressPart(place, "administrative_area_level_3") ||
    prediction.structuredFormat?.mainText?.text?.trim() ||
    place.displayName?.text?.trim() ||
    ""
  const region =
    addressPart(place, "administrative_area_level_1") ||
    addressPart(place, "administrative_area_level_2")
  const country = addressPart(place, "country")
  const label =
    prediction.text?.text?.trim() ||
    place.formattedAddress?.trim() ||
    [city, region, country].filter(Boolean).join(", ")
  if (!label || !city) return null

  return {
    label,
    canonicalLabel: label,
    city,
    region,
    country,
    placeId,
    latitude,
    longitude,
    resolved: true,
    recognized: true,
    primaryType: place.primaryType ?? null,
    types,
    radiusMeters: destinationRadius(types),
  }
}

async function getPlaceDetails(
  prediction: GoogleAutocompletePrediction,
  signal: AbortSignal
): Promise<DestinationAnchor | null> {
  const placeId = prediction.placeId?.trim()
  if (!API_KEY || !placeId) return null

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": [
          "id",
          "displayName",
          "formattedAddress",
          "addressComponents",
          "location",
          "primaryType",
          "types",
        ].join(","),
      },
      signal,
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error(
      `[google-places] Destination details failed (${res.status}):`,
      detail.slice(0, 300)
    )
    throw new Error(`Google destination details failed with status ${res.status}`)
  }

  return toDestinationAnchor(prediction, (await res.json()) as GooglePlace)
}

/**
 * Worldwide destination autocomplete backed by Google Places. Predictions are
 * hydrated with Place Details before they are returned, so callers never have
 * to treat raw typed text as a verified destination.
 */
export async function autocompleteDestinations(
  input: string,
  limit = 6,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<DestinationAnchor[]> {
  const query = input.trim().slice(0, 100)
  if (!API_KEY || query.length < 2) return []

  const cacheKey = normalize(query)
  const cached = cachedDestinationResults(cacheKey)
  if (cached) return cached.slice(0, limit)

  const signal = requestSignal(
    options.signal,
    options.timeoutMs ?? DEFAULT_DESTINATION_TIMEOUT_MS
  )
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": [
        "suggestions.placePrediction.placeId",
        "suggestions.placePrediction.text",
        "suggestions.placePrediction.structuredFormat",
        "suggestions.placePrediction.types",
      ].join(","),
    },
    body: JSON.stringify({
      input: query,
      includeQueryPredictions: false,
      includedPrimaryTypes: ["(regions)"],
      languageCode: "en",
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error(
      `[google-places] Destination autocomplete failed (${res.status}):`,
      detail.slice(0, 300)
    )
    throw new Error(`Google destination autocomplete failed with status ${res.status}`)
  }

  const payload = (await res.json()) as {
    suggestions?: Array<{ placePrediction?: GoogleAutocompletePrediction }>
  }
  const predictions = (payload.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is GoogleAutocompletePrediction =>
      Boolean(prediction?.placeId)
    )
    .slice(0, Math.max(1, Math.min(limit, 8)))

  const hydrated = await Promise.all(
    predictions.map((prediction) => getPlaceDetails(prediction, signal))
  )
  const seen = new Set<string>()
  const destinations = hydrated.filter((destination): destination is DestinationAnchor => {
    if (!destination || seen.has(destination.placeId)) return false
    seen.add(destination.placeId)
    return true
  })
  cacheDestinationResults(cacheKey, destinations)
  return destinations
}

/**
 * Resolve the exact Google place selected by the traveler. The provider place
 * ID is authoritative; client-supplied coordinates are never trusted.
 */
export async function resolveDestinationPlaceId(
  placeId: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<DestinationAnchor | null> {
  const id = placeId.trim().slice(0, 300)
  if (!API_KEY || !id || id.startsWith("curated:")) return null

  const cacheKey = `place:${id}`
  const cached = cachedDestinationResults(cacheKey)
  if (cached) return cached[0] ?? null

  const signal = requestSignal(
    options.signal,
    options.timeoutMs ?? DEFAULT_DESTINATION_TIMEOUT_MS
  )
  const destination = await getPlaceDetails({ placeId: id }, signal)
  if (destination) cacheDestinationResults(cacheKey, [destination])
  return destination
}

/** Resolve a stored canonical string (or repair legacy partial text) to a geo anchor. */
export async function resolveDestination(
  destination: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<DestinationAnchor | null> {
  const input = destination.trim().slice(0, 200)
  if (!input) return null
  const matches = await autocompleteDestinations(input, 6, options)
  if (matches.length === 0) return null

  const target = normalize(input)
  return (
    matches.find(
      (match) =>
        normalize(match.label) === target || normalize(match.city) === target
    ) ?? matches[0]
  )
}

function toPlaceResult(place: GooglePlace): PlaceResult | null {
  const id = place.id?.trim()
  const name = place.displayName?.text?.trim()
  if (!id || !name) return null

  // Preserve Google's relevance ordering while skipping originals that would
  // look soft or crop poorly in the landscape result cards.
  const photoRef = highResolutionLandscapePhoto(place.photos)?.name

  return {
    id,
    name,
    address: place.formattedAddress ?? "",
    latitude:
      typeof place.location?.latitude === "number"
        ? place.location.latitude
        : null,
    longitude:
      typeof place.location?.longitude === "number"
        ? place.location.longitude
        : null,
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

function distanceMeters(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusMeters = 6_371_000
  const latitudeDelta = radians(right.latitude - left.latitude)
  const longitudeDelta = radians(right.longitude - left.longitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
}

/**
 * Returns Google Places candidates for a destination search. Google owns every
 * identity and factual field in this result; callers may rank or summarize the
 * candidates, but must not invent additional venues.
 */
export async function searchVerifiedPlaces(
  query: string,
  destination: string,
  limit = 10,
  options: {
    signal?: AbortSignal
    timeoutMs?: number
    destinationAnchor?: DestinationAnchor | null
  } = {}
): Promise<PlaceResult[]> {
  if (!API_KEY || !destination.trim()) return []

  try {
    // One deadline covers both destination resolution and venue search.
    const signal = requestSignal(
      options.signal,
      options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS
    )
    const anchor =
      options.destinationAnchor === undefined
        ? await resolveDestination(destination, { signal })
        : options.destinationAnchor
    throwIfAborted(signal)
    const canonicalDestination = anchor?.canonicalLabel || destination.trim()
    const pageSize = Math.max(1, Math.min(limit, 20))
    const cacheKey = textSearchCacheKey(
      query,
      canonicalDestination,
      pageSize,
      anchor
    )
    let places = cachedTextSearchResults(cacheKey)

    if (!places) {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.location",
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
          textQuery: `${query || "family-friendly attractions"} in ${canonicalDestination}`,
          pageSize,
          languageCode: "en",
          ...(anchor
            ? {
                locationBias: {
                  circle: {
                    center: {
                      latitude: anchor.latitude,
                      longitude: anchor.longitude,
                    },
                    radius: GOOGLE_LOCATION_BIAS_RADIUS_METERS,
                  },
                },
              }
            : {}),
        }),
        signal,
      })

      if (!res.ok) {
        await res.text().catch(() => "")
        console.error(`[google-places] Search failed (${res.status})`)
        throw new Error(`Google Places search failed with status ${res.status}`)
      }

      const data = await res.json()
      throwIfAborted(signal)
      const providerPlaces = ((data.places ?? []) as GooglePlace[])
        .map(toPlaceResult)
        .filter((place): place is PlaceResult => {
          if (!place) return false
          return place.businessStatus !== "CLOSED_PERMANENTLY" && place.businessStatus !== "FUTURE_OPENING"
        })
      // Text Search locationBias influences ranking but is not a hard boundary.
      // Cache only destination-scoped results so an all-out-of-area response
      // receives the intentionally brief empty-result TTL.
      places = anchor
        ? providerPlaces.filter((place) => {
            if (place.latitude === null || place.longitude === null) return false
            return distanceMeters(anchor, {
              latitude: place.latitude,
              longitude: place.longitude,
            }) <= anchor.radiusMeters
          })
        : providerPlaces
      cacheTextSearchResults(cacheKey, places)
    }

    return places.map(clonePlaceResult)
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    if (errorName !== "AbortError") {
      console.error(`[google-places] Search error (${errorName})`)
    }
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
