import { NextRequest } from "next/server"
import { searchVerifiedPlaces } from "@/lib/travel-apis/google-places"
import { enforceRateLimit, rateLimitResponse, RATE_LIMIT_TIERS } from "@/lib/rate-limit"

export const maxDuration = 15

const MAX_FALLBACK_PLACES = 6
const PROVIDER_TIMEOUT_MS = 4_000

function cleanText(value: string, maximum: number) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum)
}

async function reserveProviderQuota(req: NextRequest, units: number) {
  for (let unit = 0; unit < units; unit += 1) {
    const limit = await enforceRateLimit(req, RATE_LIMIT_TIERS.PROVIDER_SEARCH)
    if (!limit.allowed) return limit
  }
  return null
}

async function geocodeOne(
  place: string,
  dest: string,
  signal: AbortSignal
): Promise<{ lat: number; lng: number } | null> {
  const [match] = await searchVerifiedPlaces(place, dest, 1, {
    signal,
    timeoutMs: PROVIDER_TIMEOUT_MS,
    // The query already includes the trip's canonical destination. Skipping
    // a second destination lookup keeps this fallback to one paid call.
    destinationAnchor: null,
  })
  const lat = match?.latitude
  const lng = match?.longitude
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) return null
  return { lat, lng }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const seen = new Set<string>()
  const places = searchParams
    .getAll("place")
    .map((place) => cleanText(place, 140))
    .filter((place) => {
      const key = place.toLocaleLowerCase("en")
      if (!place || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_FALLBACK_PLACES)
  const dest = cleanText(searchParams.get("dest") || "", 160)

  if (places.length === 0) {
    return Response.json({ results: {} })
  }

  const denied = await reserveProviderQuota(req, places.length)
  if (denied) return rateLimitResponse(denied)

  const results: Record<string, { lat: number; lng: number } | null> = {}
  let resolved: Array<{
    place: string
    coordinates: { lat: number; lng: number } | null
  }>
  try {
    resolved = await Promise.all(
      places.map(async (place) => ({
        place,
        coordinates: await geocodeOne(
          place,
          dest,
          AbortSignal.any([req.signal, AbortSignal.timeout(PROVIDER_TIMEOUT_MS)])
        ),
      }))
    )
  } catch {
    return Response.json(
      { error: "Map locations are temporarily unavailable." },
      {
        status: req.signal.aborted ? 499 : 502,
        headers: { "Cache-Control": "private, no-store" },
      }
    )
  }
  for (const { place, coordinates } of resolved) results[place] = coordinates

  return Response.json(
    { results },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
