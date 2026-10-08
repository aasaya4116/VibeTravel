import { getAttractionImage } from "@/lib/attraction-images"
import {
  isConfigured as isGooglePlacesConfigured,
  resolveDestination,
  resolveDestinationPlaceId,
  searchVerifiedPlaces,
  type PlaceResult,
} from "@/lib/travel-apis/google-places"
import type { Attraction } from "@/lib/types"
import { getVibeDiscoveryQuery } from "@/lib/recommendation-personalization"

// Google returns a relevance-ranked, closed candidate set. Stream those
// verified results directly so model latency never blocks discovery.
export const maxDuration = 15

type Recommendation = {
  placeId: string
  vibes: string[]
  ageRange: string
  sensoryNotes: string | null
  estimatedDuration: string
  tips: string[]
  familyFitReason: string
  familyFitSignals: Array<{
    type: "age" | "sensory" | "pace" | "style" | "budget" | "dietary" | "general"
    label: string
  }>
}

function categoryForPlace(place: PlaceResult): string {
  const toCategory = (type: string | null | undefined) => {
    if (!type) return null
    if (type === "aquarium") return "Aquarium"
    if (["zoo", "wildlife_park"].includes(type)) return "Zoo"
    if (["museum", "art_museum", "science_museum", "childrens_museum"].includes(type)) return "Museum"
    if (["botanical_garden", "garden", "park", "national_park", "state_park"].includes(type)) return "Nature"
    if (type === "playground") return "Playground"
    if (["amusement_park", "theme_park"].includes(type)) return "Theme Park"
    if (["restaurant", "cafe", "coffee_shop", "bakery"].includes(type)) return "Restaurant"
    if (["performing_arts_theater", "cultural_center", "historical_place"].includes(type)) return "Cultural"
    if (["tourist_attraction", "visitor_center", "amusement_center"].includes(type)) return "Adventure"
    return null
  }

  // Prefer Google's primary type so broad secondary tags do not override it.
  const primaryCategory = toCategory(place.primaryType)
  if (primaryCategory) return primaryCategory

  for (const type of place.types) {
    const category = toCategory(type)
    if (category) return category
  }

  return place.primaryTypeLabel || "Attraction"
}

function fallbackRecommendation(
  place: PlaceResult,
  familyVibe: Record<string, unknown> | null | undefined,
  effectiveQuery: string
): Recommendation {
  const styles = Array.isArray(familyVibe?.travel_style)
    ? familyVibe.travel_style.filter((style): style is string => typeof style === "string")
    : []
  const pace = typeof familyVibe?.pace === "string" ? familyVibe.pace : null
  const strongestStyle = styles[0]
  const category = categoryForPlace(place)
  const queryLabel = effectiveQuery
    .split(",")[0]
    .trim()
    .slice(0, 40)
  const signals: Recommendation["familyFitSignals"] = []
  if (strongestStyle) {
    signals.push({ type: "style", label: strongestStyle.slice(0, 40) })
  }
  if (pace) {
    signals.push({ type: "pace", label: `${pace} pace`.slice(0, 40) })
  }
  signals.push({ type: "general", label: `${category} match`.slice(0, 40) })

  return {
    placeId: place.id,
    vibes: [...styles.slice(0, 2), "verified place"],
    ageRange: "Check venue guidance",
    sensoryNotes: null,
    estimatedDuration: "Plan 1–3 hours",
    tips: ["Confirm current hours and ticket requirements before visiting."],
    familyFitReason: strongestStyle
      ? `${place.name} is a Google-verified ${category.toLowerCase()} matching your ${strongestStyle.toLowerCase()} interests and this ${queryLabel || "family"} search.`
      : `${place.name} is a Google-verified ${category.toLowerCase()} matching this ${queryLabel || "family"} search.`,
    familyFitSignals: signals.slice(0, 3),
  }
}

function toAttraction(
  place: PlaceResult,
  recommendation: Recommendation,
  personalizedForFamily: boolean
): Attraction {
  const category = categoryForPlace(place)
  // Search results should never wait on a secondary image provider. Google
  // photos are already lazy-loaded through our proxy; category art is the
  // deterministic fallback when a venue has no provider photo.
  const imageSource = place.photoUrl ? "google" : "fallback"

  return {
    googlePlaceId: place.id,
    name: place.name,
    description: `${place.name} is a Google-verified ${place.primaryTypeLabel?.toLowerCase() || "attraction"}${place.address ? ` at ${place.address}` : ""}.`,
    category,
    vibes: recommendation.vibes,
    ageRange: recommendation.ageRange,
    // Google exposes verified entrance accessibility, not stroller policy.
    // Keep this unknown instead of presenting an AI inference as a fact.
    strollerFriendly: null,
    sensoryNotes: recommendation.sensoryNotes ?? undefined,
    estimatedDuration: recommendation.estimatedDuration,
    priceRange: place.priceLevel,
    location: place.address,
    imageUrl:
      place.photoUrl ||
      getAttractionImage(category, place.name),
    rating: place.rating ?? undefined,
    userRatingCount: place.userRatingCount,
    tips: recommendation.tips,
    familyFitReason: recommendation.familyFitReason,
    // Anthropic structured outputs do not support JSON Schema maxItems.
    // Keep the schema provider-compatible and enforce the product limit here.
    familyFitSignals: recommendation.familyFitSignals.slice(0, 3),
    personalizedForFamily,
    verifiedPlace: true,
    openNow: place.openNow,
    weekdayHours: place.weekdayHours,
    googleMapsUri: place.googleMapsUri,
    websiteUri: place.websiteUri,
    accessibleEntrance: place.accessibleEntrance,
    businessStatus: place.businessStatus,
    primaryType: place.primaryTypeLabel,
    _sources: {
      image: imageSource,
      rating: "google",
    },
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  // Clamp user-controlled inputs on this public endpoint.
  const query = String(body?.query ?? "").trim().slice(0, 300)
  const destination = String(body?.destination ?? "").trim().slice(0, 200)
  const destinationPlaceId = String(body?.destinationPlaceId ?? "").trim().slice(0, 300)
  const filters = body?.filters
  const familyVibe = body?.familyVibe
  const ownerName = String(body?.ownerName ?? "").trim().slice(0, 80)
  const hasFamilyContext = Boolean(
    ownerName ||
    (familyVibe &&
      ((Array.isArray(familyVibe.kids) && familyVibe.kids.length > 0) ||
        (Array.isArray(familyVibe.travelers) && familyVibe.travelers.length > 0) ||
        (Array.isArray(familyVibe.travel_style) && familyVibe.travel_style.length > 0) ||
        (Array.isArray(familyVibe.sensory_needs) && familyVibe.sensory_needs.length > 0) ||
        familyVibe.pace ||
        familyVibe.budget_preference))
  )
  if (!destination) {
    return Response.json(
      { error: "Choose a city or region so every result can be verified in the right place." },
      { status: 400 }
    )
  }

  if (!isGooglePlacesConfigured()) {
    return Response.json(
      { error: "Verified place search is temporarily unavailable." },
      { status: 503 }
    )
  }

  const effectiveBudget = filters?.budget || familyVibe?.budget_preference || "any"
  const isGenericDiscovery =
    !query ||
    query.toLowerCase() === "family-friendly attractions" ||
    query.toLowerCase() === "family-friendly activities"
  const effectiveQuery = isGenericDiscovery ? getVibeDiscoveryQuery(familyVibe) : query
  const providerQuery = [
    effectiveQuery,
    filters?.category,
    effectiveBudget === "Free" || effectiveBudget === "free" ? "free" : null,
  ]
    .filter(Boolean)
    .join(" ")

  let candidates: PlaceResult[]
  let resolvedDestination = destination
  try {
    const providerDeadline = AbortSignal.timeout(6_000)
    const providerSignal = AbortSignal.any([req.signal, providerDeadline])
    let destinationAnchor = destinationPlaceId
      ? await resolveDestinationPlaceId(destinationPlaceId, {
          signal: providerSignal,
          timeoutMs: 6_000,
        })
      : await resolveDestination(destination, {
          signal: providerSignal,
          timeoutMs: 6_000,
        })
    const normalizeDestinationLabel = (value: string) => value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
    if (
      destinationPlaceId
      && destinationAnchor
      && normalizeDestinationLabel(destinationAnchor.canonicalLabel) !== normalizeDestinationLabel(destination)
    ) {
      destinationAnchor = await resolveDestination(destination, {
        signal: providerSignal,
        timeoutMs: 6_000,
      })
    }
    if (!destinationAnchor) {
      return Response.json(
        { error: "Confirm this destination before searching so results stay in the right place." },
        { status: 422 }
      )
    }
    resolvedDestination = destinationAnchor.canonicalLabel
    candidates = await searchVerifiedPlaces(providerQuery, resolvedDestination, 12, {
      signal: providerSignal,
      timeoutMs: 6_000,
      destinationAnchor,
    })
  } catch {
    return Response.json(
      { error: "We couldn't verify places with Google right now. Please try again shortly." },
      { status: 502 }
    )
  }

  // The former stroller filter is now grounded in Google's verified entrance
  // accessibility field. Never infer physical access from an AI description.
  if (filters?.strollerFriendly) {
    candidates = candidates.filter((place) => place.accessibleEntrance === true)
  }

  const encoder = new TextEncoder()
  let streamCancelled = false
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emittedIds = new Set<string>()

      const enqueue = (value: string) => {
        if (streamCancelled || controller.desiredSize === null) return false
        try {
          controller.enqueue(encoder.encode(value))
          return true
        } catch {
          // The browser can cancel a streamed search when the user navigates or
          // starts another search. That is expected, so stop work quietly.
          streamCancelled = true
          return false
        }
      }

      const emit = async (
        place: PlaceResult,
        recommendation: Recommendation,
        personalizedForFamily: boolean
      ) => {
        if (streamCancelled || emittedIds.has(place.id)) return
        emittedIds.add(place.id)
        const attraction = toAttraction(
          place,
          recommendation,
          personalizedForFamily
        )
        enqueue(JSON.stringify(attraction) + "\n")
      }

      try {
        if (candidates.length > 0) {
          // Google has already ranked this closed, verified candidate set for
          // the vibe-aware query. Emit it immediately so a slow model can
          // never hold the user's results—or the end of the stream—open.
          // Do not launch fire-and-forget enrichment here: serverless work is
          // not guaranteed to continue after the response closes.
          for (const place of candidates) {
            if (streamCancelled) break
            if (!emittedIds.has(place.id)) {
              await emit(
                place,
                fallbackRecommendation(place, familyVibe, effectiveQuery),
                hasFamilyContext
              )
            }
          }

          enqueue(
            JSON.stringify({
              summary: `${candidates.length} Google-verified place${candidates.length === 1 ? "" : "s"} in ${resolvedDestination}, ${hasFamilyContext ? "matched using your Family Vibe" : "matched to this search"}.`,
            }) + "\n"
          )
        }
      } catch (error) {
        if (!streamCancelled) console.error("[search] stream error:", error)
      } finally {
        if (!streamCancelled && controller.desiredSize !== null) {
          try {
            controller.close()
          } catch {
            // The client disconnected between the state check and close.
          }
        }
      }
    },
    cancel() {
      streamCancelled = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      "X-VibeTravel-Result-Source": "google-places",
      "Server-Timing": "search;desc=verified-provider-results",
    },
  })
}
