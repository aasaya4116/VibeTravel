import { streamObject } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { getWikipediaImage } from "@/lib/wikipedia-image"
import { getAttractionImage } from "@/lib/attraction-images"
import {
  isConfigured as isGooglePlacesConfigured,
  searchVerifiedPlaces,
  type PlaceResult,
} from "@/lib/travel-apis/google-places"
import type { Attraction } from "@/lib/types"
import { normalizeRecommendationFeedback } from "@/lib/recommendation-personalization"

// Search waits for Google candidates before AI ranks them, then streams the
// verified results as the ranking is generated.
export const maxDuration = 30

const recommendationSchema = z.object({
  placeId: z.string().describe("An exact placeId from the supplied candidate list"),
  vibes: z.array(z.string()).describe("2-4 short vibe tags"),
  ageRange: z.string().describe("A cautious planning suggestion, not an admission rule"),
  sensoryNotes: z
    .string()
    .nullable()
    .describe("A cautious planning consideration; null when the candidate data does not support one"),
  estimatedDuration: z.string().describe("A clearly approximate visit duration"),
  tips: z
    .array(z.string())
    .describe("Up to two planning tips; advise checking the venue for changing details"),
  familyFitReason: z
    .string()
    .describe("One concise sentence explaining why this place fits the supplied family profile and search"),
  familyFitSignals: z
    .array(
      z.object({
        type: z.enum(["age", "sensory", "pace", "style", "budget", "dietary", "general"]),
        label: z.string().describe("A compact, plain-language fit reason of 2-6 words"),
      })
    )
    .max(3)
    .describe("The strongest profile factors that influenced this recommendation"),
})

type AiRecommendation = z.infer<typeof recommendationSchema>

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

function fallbackRecommendation(place: PlaceResult): AiRecommendation {
  const type = place.primaryTypeLabel?.toLowerCase() || "attraction"
  return {
    placeId: place.id,
    vibes: ["family option", "verified place"],
    ageRange: "Check venue guidance",
    sensoryNotes: null,
    estimatedDuration: "Plan 1–3 hours",
    tips: ["Confirm current hours and ticket requirements before visiting."],
    familyFitReason: `${place.name} matches this search and is verified by Google. Check current venue guidance against your family's needs.`,
    familyFitSignals: [],
  }
}

async function toAttraction(
  place: PlaceResult,
  recommendation: AiRecommendation,
  personalizedForFamily: boolean
): Promise<Attraction> {
  const category = categoryForPlace(place)
  const wikiImage = place.photoUrl
    ? null
    : await getWikipediaImage(place.name, place.address)
  const imageSource = place.photoUrl ? "google" : wikiImage ? "wikipedia" : "fallback"

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
      wikiImage ||
      getAttractionImage(category, place.name),
    rating: place.rating ?? undefined,
    userRatingCount: place.userRatingCount,
    tips: recommendation.tips,
    familyFitReason: recommendation.familyFitReason,
    familyFitSignals: recommendation.familyFitSignals,
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
  const filters = body?.filters
  const familyVibe = body?.familyVibe
  const hasFamilyContext = Boolean(
    familyVibe &&
      ((Array.isArray(familyVibe.kids) && familyVibe.kids.length > 0) ||
        (Array.isArray(familyVibe.travel_style) && familyVibe.travel_style.length > 0) ||
        (Array.isArray(familyVibe.sensory_needs) && familyVibe.sensory_needs.length > 0) ||
        familyVibe.pace ||
        familyVibe.budget_preference)
  )
  const preferenceFeedback = normalizeRecommendationFeedback(
    body?.preferenceFeedback,
    10
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
  const providerQuery = [
    query || "family-friendly attractions",
    filters?.category,
    effectiveBudget === "Free" || effectiveBudget === "free" ? "free" : null,
  ]
    .filter(Boolean)
    .join(" ")

  let candidates: PlaceResult[]
  try {
    candidates = await searchVerifiedPlaces(providerQuery, destination, 12)
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

  const candidateById = new Map(candidates.map((place) => [place.id, place]))
  const candidateData = candidates.map((place) => ({
    placeId: place.id,
    name: place.name,
    address: place.address,
    type: place.primaryTypeLabel,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    price: place.priceLevel,
    accessibleEntrance: place.accessibleEntrance,
    businessStatus: place.businessStatus,
  }))

  const filterContext = `Requested filters: age=${filters?.ageRange || "any"}, verified step-free entrance=${filters?.strollerFriendly ? "required" : "any"}, budget=${effectiveBudget}, category=${filters?.category || "any"}`
  const vibeContext = hasFamilyContext
    ? `Family context: kids=${JSON.stringify(familyVibe.kids)}, style=${familyVibe.travel_style?.join(", ") || "any"}, sensory=${familyVibe.sensory_needs?.join(", ") || "none"}, pace=${familyVibe.pace || "moderate"}, dietary=${familyVibe.dietary?.join(", ") || "none"}`
    : "No family profile is available; give general family planning guidance."
  const feedbackContext = preferenceFeedback.length
    ? `Earlier recommendation feedback from this device (use it to downrank similar mismatches):\n${preferenceFeedback
        .map(
          (item) =>
            `- ${item.reason}: category=${item.category || "unknown"}, vibes=${item.vibes.join(", ") || "unknown"}, price=${item.priceRange || "unknown"}, age guidance=${item.ageRange || "unknown"}`
        )
        .join("\n")}`
    : "No earlier recommendation feedback is available."

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
        recommendation: AiRecommendation,
        personalizedForFamily: boolean
      ) => {
        if (streamCancelled || emittedIds.has(place.id)) return
        emittedIds.add(place.id)
        const attraction = await toAttraction(
          place,
          recommendation,
          personalizedForFamily
        )
        enqueue(JSON.stringify(attraction) + "\n")
      }

      try {
        if (candidates.length > 0) {
          const { elementStream } = streamObject({
            model: anthropic("claude-haiku-4-5-20251001"),
            output: "array",
            schema: recommendationSchema,
            system: `You rank a closed list of Google-verified places for family travel.

Non-negotiable rules:
- Select ONLY exact placeId values from the supplied candidate list.
- Never invent, rename, merge, or add a venue.
- Rank by query relevance and family fit.
- Use earlier feedback to downrank similar places that were too busy, too expensive, or not age-appropriate.
- Treat name, address, rating, review count, price, accessibility, and business status as immutable provider facts.
- Age fit, duration, sensory notes, tips, and vibes are planning guidance, not verified venue facts. Use cautious language and never claim specific facilities, policies, schedules, prices, or accessibility unless present in the candidate data.
- Make familyFitReason explicitly connect the place to the supplied family profile. Mention a child by name only when that child exists in the supplied profile.
- familyFitSignals must contain at most three short reasons grounded in the supplied profile. If no profile is available, return one general search-match signal and do not imply personalization.
- Return each selected placeId at most once.`,
            prompt: `Destination: ${destination}
Search: ${query || "family-friendly attractions"}
${filterContext}
${vibeContext}
${feedbackContext}

Verified candidates:
${JSON.stringify(candidateData)}`,
          })

          try {
            for await (const recommendation of elementStream) {
              if (streamCancelled) break
              const place = candidateById.get(recommendation.placeId)
              if (place) await emit(place, recommendation, hasFamilyContext)
            }
          } catch (error) {
            if (!streamCancelled) {
              console.error("[search] AI ranking error; using verified provider order:", error)
            }
          }

          // Reliability fallback: if AI omits candidates or fails, still return
          // real Google places in provider relevance order.
          for (const place of candidates) {
            if (streamCancelled) break
            if (!emittedIds.has(place.id)) {
              await emit(place, fallbackRecommendation(place), false)
            }
          }

          enqueue(
            JSON.stringify({
              summary: `${candidates.length} Google-verified place${candidates.length === 1 ? "" : "s"} in ${destination}, ${hasFamilyContext ? "ranked using your Family Vibe" : "ranked for this search"}.`,
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
    },
  })
}
