import { streamObject, generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { getWikipediaImage } from "@/lib/wikipedia-image"
import { getAttractionImage } from "@/lib/attraction-images"
import { searchPlaces } from "@/lib/travel-apis/google-places"

// Search streams results as they generate; keep headroom over the default
// serverless limit while the model (Haiku) stays fast.
export const maxDuration = 30

const attractionSchema = z.object({
  name: z.string(),
  description: z.string().describe("2-3 sentences max"),
  category: z.string().describe("One of: Museum, Nature, Creative Play, Playground, Cultural, Adventure, Restaurant, Aquarium, Zoo, Theme Park, Entertainment"),
  vibes: z.array(z.string()).describe("2-4 vibe tags"),
  ageRange: z.string(),
  strollerFriendly: z.boolean(),
  sensoryNotes: z.string().nullable().describe("Brief noise/crowd note or null"),
  estimatedDuration: z.string(),
  priceRange: z.string(),
  location: z.string(),
  rating: z.number().nullable(),
  tips: z.array(z.string()).describe("1-2 short insider tips"),
})

type AiAttraction = z.infer<typeof attractionSchema>

// Enrich one AI-generated attraction with real photo/rating/hours data.
// Falls back gracefully when a provider misses or isn't configured.
async function enrichAttraction(attraction: AiAttraction, destination: string) {
  const [place, wikiImage] = await Promise.all([
    searchPlaces(attraction.name, destination || attraction.location),
    getWikipediaImage(attraction.name, attraction.location),
  ])

  const imageSource = place?.photoUrl ? "google" : wikiImage ? "wikipedia" : "fallback"
  const ratingSource = place?.rating != null ? "google" : "ai"

  return {
    ...attraction,
    rating: place?.rating ?? attraction.rating,
    priceRange: place?.priceLevel ?? attraction.priceRange,
    imageUrl:
      place?.photoUrl ||
      wikiImage ||
      getAttractionImage(attraction.category, attraction.name),
    ...(place && {
      openNow: place.openNow,
      weekdayHours: place.weekdayHours,
      googleMapsUri: place.googleMapsUri,
      accessibleEntrance: place.accessibleEntrance,
    }),
    _sources: { image: imageSource, rating: ratingSource },
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  // Clamp user-controlled inputs on this public, unauthenticated endpoint.
  const query = String(body?.query ?? "").slice(0, 300)
  const destination = String(body?.destination ?? "").slice(0, 200)
  const filters = body?.filters
  const familyVibe = body?.familyVibe

  // Explicit filter budget takes precedence; fall back to profile budget preference
  const effectiveBudget = filters?.budget || familyVibe?.budget_preference || "any"

  const filterContext = filters
    ? `Filters: age=${filters.ageRange || "any"}, stroller=${filters.strollerFriendly ? "yes" : "any"}, budget=${effectiveBudget}, category=${filters.category || "any"}`
    : effectiveBudget !== "any"
      ? `Filters: budget=${effectiveBudget}`
      : ""

  const vibeContext = familyVibe
    ? `Family: kids=${JSON.stringify(familyVibe.kids)}, style=${familyVibe.travel_style?.join(", ") || "any"}, sensory=${familyVibe.sensory_needs?.join(", ") || "none"}, pace=${familyVibe.pace || "moderate"}, dietary=${familyVibe.dietary?.join(", ") || "none"}`
    : ""

  // Kick off a one-line summary in parallel — cheap and doesn't block results.
  const summaryPromise = generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    prompt: `In one warm, concise sentence (max 20 words, no preamble), summarize a family-friendly attraction search for "${query || "family activities"}"${destination ? ` in ${destination}` : ""}.`,
  })
    .then((r) => r.text.trim())
    .catch(() => "")

  // Stream the attractions array element-by-element; each completed element is
  // enriched with real data and pushed to the client as one NDJSON line.
  const { elementStream } = streamObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    output: "array",
    schema: attractionSchema,
    system: `You are VibeTravel's attraction search engine. Return REAL attractions that exist in the destination.

Rules:
- QUERY RELEVANCE IS THE TOP PRIORITY. If the user mentions specific interests (Disney, Nintendo, anime, etc.), the most iconic matching attractions MUST appear first.
- Return 8-10 real, family-friendly attractions ranked by how well they match the query
- Never omit a famous, highly-relevant attraction in favor of generic alternatives
- Theme parks, brand experiences, and entertainment venues are valid and important results
- Keep descriptions to 2-3 sentences, tips to 1-2 per attraction
- Use one of these categories: Museum, Nature, Creative Play, Playground, Cultural, Adventure, Restaurant, Aquarium, Zoo, Theme Park, Entertainment`,
    prompt: `Find family attractions in ${destination || "the area"} that match this query: "${query}"
${filterContext}
${vibeContext}`.trim(),
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const attraction of elementStream) {
          const enriched = await enrichAttraction(attraction, destination || "")
          controller.enqueue(encoder.encode(JSON.stringify(enriched) + "\n"))
        }
        // Summary arrives last so it never delays the first results.
        const summary = await summaryPromise
        if (summary) {
          controller.enqueue(encoder.encode(JSON.stringify({ summary }) + "\n"))
        }
      } catch (err) {
        console.error("[search] stream error:", err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  })
}
