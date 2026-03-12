import { generateText, Output } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { getWikipediaImages } from "@/lib/wikipedia-image"
import { getAttractionImage } from "@/lib/attraction-images"
import { searchPlacesBatch } from "@/lib/travel-apis/google-places"

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

const searchResultSchema = z.object({
  attractions: z.array(attractionSchema).describe("Return 12-16 results, ranked by relevance to the query"),
  searchSummary: z.string().describe("1 sentence summary"),
})

export async function POST(req: Request) {
  const { query, destination, filters, familyVibe } = await req.json()

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

  const result = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    output: Output.object({ schema: searchResultSchema }),
    system: `You are VibeTravel's attraction search engine. Return REAL attractions that exist in the destination.

Rules:
- QUERY RELEVANCE IS THE TOP PRIORITY. If the user mentions specific interests (Disney, Nintendo, anime, etc.), the most iconic matching attractions MUST appear first.
- Return 12-16 real, family-friendly attractions ranked by how well they match the query
- Never omit a famous, highly-relevant attraction in favor of generic alternatives
- Theme parks, brand experiences, and entertainment venues are valid and important results
- Keep descriptions to 2-3 sentences, tips to 1-2 per attraction
- Use one of these categories: Museum, Nature, Creative Play, Playground, Cultural, Adventure, Restaurant, Aquarium, Zoo, Theme Park, Entertainment`,
    messages: [
      {
        role: "user",
        content: `Find family attractions in ${destination || "the area"} that match this query: "${query}"
${filterContext}
${vibeContext}`.trim(),
      },
    ],
  })

  const output = result.output as { attractions: { name: string; location: string; category: string; rating: number | null; priceRange: string }[]; searchSummary: string } | undefined

  if (!output?.attractions?.length) {
    return Response.json({ attractions: [], searchSummary: "No results found." })
  }

  // Fetch Wikipedia images + Google Places data in parallel
  // Google Places covers all categories including restaurants — no Yelp needed
  const [wikiImages, placesData] = await Promise.all([
    getWikipediaImages(
      output.attractions.map((a) => ({ name: a.name, location: a.location }))
    ),
    searchPlacesBatch(
      output.attractions.map((a) => ({ name: a.name, destination: destination || a.location }))
    ),
  ])

  // Enrich each attraction with real data where available
  const enriched = output.attractions.map((attraction) => {
    const place = placesData.get(attraction.name)
    const wikiImage = wikiImages.get(attraction.name)

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
  })

  return Response.json({
    attractions: enriched,
    searchSummary: output.searchSummary,
  })
}
