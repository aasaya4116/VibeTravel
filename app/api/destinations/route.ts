import { NextRequest, NextResponse } from "next/server"
import {
  getDashboardDestinationOptions,
  getDashboardDestinationPhotoUrl,
  normalizeDestination,
} from "../../../lib/dashboard-destinations"
import {
  autocompleteDestinations,
  isConfigured as isGooglePlacesConfigured,
  type DestinationAnchor,
} from "../../../lib/travel-apis/google-places"

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
}

const FALLBACK_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60",
}

function stableFallbackId(label: string) {
  const slug = normalizeDestination(label).replace(/\s+/g, "-")
  return `curated:${slug}`
}

function curatedOptions(query: string, limit: number) {
  return getDashboardDestinationOptions([], query)
    .slice(0, limit)
    .map((option) => ({
      label: option.label,
      canonicalLabel: option.label,
      city: option.city,
      region: option.region,
      country: option.region,
      placeId: stableFallbackId(option.label),
      latitude: null,
      longitude: null,
      // Curated results keep browsing useful during a provider interruption,
      // but only Google-hydrated options are safe geographic anchors.
      resolved: false,
      recognized: true,
      provider: "curated" as const,
      recommended: option.recommended,
      imageUrl: option.imageUrl,
    }))
}

function resolvedOption(option: DestinationAnchor) {
  return {
    label: option.canonicalLabel,
    canonicalLabel: option.canonicalLabel,
    city: option.city,
    region: option.region,
    country: option.country,
    placeId: option.placeId,
    latitude: option.latitude,
    longitude: option.longitude,
    resolved: true,
    recognized: true,
    provider: "google" as const,
    recommended: false,
    imageUrl: getDashboardDestinationPhotoUrl(option.canonicalLabel),
  }
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100)
  const local = curatedOptions(query, query ? 8 : 12)

  // Preserve the curated browse list before the user has typed enough for a
  // useful worldwide provider request.
  if (query.length < 2) {
    return NextResponse.json(
      { options: local, fallback: true },
      { headers: CACHE_HEADERS }
    )
  }

  if (!isGooglePlacesConfigured()) {
    return NextResponse.json(
      { error: "Verified destination search is temporarily unavailable." },
      { status: 503, headers: FALLBACK_CACHE_HEADERS }
    )
  }

  try {
    const remote = await autocompleteDestinations(query, 6, {
      signal: req.signal,
      timeoutMs: 4_000,
    })
    const seen = new Set<string>()
    const options = [...remote.map(resolvedOption), ...local]
      .filter((option) => {
        const key = normalizeDestination(option.canonicalLabel)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 8)

    return NextResponse.json(
      { options, fallback: remote.length === 0 },
      { headers: remote.length > 0 ? CACHE_HEADERS : FALLBACK_CACHE_HEADERS }
    )
  } catch (error) {
    if (!req.signal.aborted) {
      console.error("[destinations] Worldwide lookup failed; using curated fallback:", error)
    }
    return NextResponse.json(
      { error: "Verified destination search is temporarily unavailable." },
      { status: 503, headers: FALLBACK_CACHE_HEADERS }
    )
  }
}
