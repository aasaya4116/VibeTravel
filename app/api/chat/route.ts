import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { searchPlaces, searchPlacesBatch } from "@/lib/travel-apis/google-places"
import { getWeatherForecast } from "@/lib/travel-apis/openweather"
import { searchTours } from "@/lib/travel-apis/viator"
import { searchHotels } from "@/lib/travel-apis/expedia"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const { messages, familyVibe, currentTrip, tripId } = await req.json()

  // Guard this public, unauthenticated endpoint against runaway cost/abuse.
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 })
  }
  if (messages.length > 60 || JSON.stringify(messages).length > 100_000) {
    return Response.json(
      { error: "This conversation is too long — start a new chat." },
      { status: 413 }
    )
  }

  // Captured for use inside action tool closures
  const baseUrl = new URL(req.url).origin
  const cookieHeader = req.headers.get("cookie") ?? ""

  const vibeContext = familyVibe
    ? `
The family's travel profile:
- Family name: ${familyVibe.family_name || "Not set"}
- Kids: ${JSON.stringify(familyVibe.kids || [])}
- Travel style: ${(familyVibe.travel_style || []).join(", ") || "not specified"}
- Sensory needs: ${(familyVibe.sensory_needs || []).join(", ") || "none"}
- Mobility: ${familyVibe.mobility_notes || "no restrictions"}
- Pace: ${familyVibe.pace || "moderate"}
- Dietary: ${(familyVibe.dietary || []).join(", ") || "none"}
`
    : "No family profile set up yet."

  const tripContext = currentTrip
    ? `
Current trip being planned:
- Title: ${currentTrip.title}
- Trip ID: ${currentTrip.id}
- Destination: ${currentTrip.destination}
- Dates: ${currentTrip.start_date || "not set"} to ${currentTrip.end_date || "not set"}
- Status: ${currentTrip.status}
`
    : "No active trip selected."

  // Save the incoming user message
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")
    const userText = lastUserMsg?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("") ?? ""
    if (userText) {
      const { error: saveErr } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        trip_id: tripId ?? null,
        role: "user",
        content: userText,
      })
      if (saveErr) console.error("[chat] Failed to save user message:", saveErr.message)
    }
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: `You are Scout, VibeTravel's AI travel assistant — warm, knowledgeable, and thoughtful. You help design-conscious families plan trips that work for everyone.

Your personality: You're like a well-traveled friend who happens to have kids. You give honest, specific advice and avoid generic tourist recommendations. You understand that parents want sophistication AND kid-friendliness.

${vibeContext}

${tripContext}

Key behaviors:
- Give specific, actionable recommendations with real place names
- Consider the whole family: kids' ages, sensory needs, energy levels
- Suggest day plans that include downtime and backup options
- Be honest about what's actually stroller-friendly vs what claims to be
- Recommend meals, snacks, and rest stops alongside activities
- Keep responses concise and scannable (use numbered lists for attractions/activities, short paragraphs)
- If asked about timing, factor in realistic family pace (getting ready, bathroom breaks, meltdowns)
- Use your tools to look up real data when the user asks about specific places, weather, restaurants, tours, or hotels
- For restaurants, use find_restaurants with a food type query (e.g. "Italian", "breakfast", "sushi")
- When suggesting 2 or more named attractions or restaurants, call search_attractions_batch with those place names so real photos and details are shown to the user — do this before writing your text response

You can take actions on the user's behalf:

Single actions:
- Use save_attraction when the user asks to save, add, or remember a specific place to their trip. Use the current trip ID from context. After saving, confirm: "Done — I've saved [name] to your [trip title]."
- Use generate_itinerary when the user asks to generate, create, or refresh their itinerary. After triggering, confirm it's building and tell them to check the trip page. At least 3 saved attractions are required.
- Always confirm actions after they complete. Never silently perform an action without telling the user.

Full trip planning (agentic mode):
When the user asks you to "plan a trip to X", "set up a trip to Y", or "create a trip for us to Z", orchestrate the full sequence automatically:
1. Call create_trip with a descriptive title (e.g. "Tokyo Family Adventure"), the destination, dates if provided, and accommodation area if mentioned.
2. Call save_attraction 5–8 times to save the best family-friendly places you know for that destination — mix of parks, museums, restaurants, cultural sites, and anything that fits their family vibe and kids' ages.
3. Call generate_itinerary with the new trip ID to build the day-by-day plan.
4. Report back with a summary: what you named the trip, how many places you saved, and a 2–3 line teaser of what the itinerary covers. Tell them to open the trip to see the full plan.
Do all of this without asking for confirmation first — just do it, then report back.`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(15),
    tools: {
      search_attraction: {
        description:
          "Look up real details for a specific attraction: rating, hours, accessibility, Google Maps link.",
        inputSchema: z.object({
          name: z.string().describe("Attraction or place name"),
          destination: z.string().describe("City or destination"),
        }),
        execute: async (input: { name: string; destination: string }) => {
          const result = await searchPlaces(input.name, input.destination)
          return result ?? { error: "Place not found or Google Places API not configured." }
        },
      },

      search_attractions_batch: {
        description:
          "Look up real photos and details for multiple attractions or restaurants at once. Use this whenever you suggest a list of 2 or more named places.",
        inputSchema: z.object({
          attractions: z
            .array(
              z.object({
                name: z.string().describe("Attraction or place name"),
                destination: z.string().describe("City or destination"),
              })
            )
            .max(5)
            .describe("List of places to look up (max 5)"),
        }),
        execute: async (input: { attractions: { name: string; destination: string }[] }) => {
          const map = await searchPlacesBatch(input.attractions)
          return input.attractions.map(({ name }) => map.get(name) ?? { name, error: "Not found" })
        },
      },

      get_weather: {
        description: "Get a weather forecast for a destination over a date range.",
        inputSchema: z.object({
          destination: z.string(),
          startDate: z.string().describe("YYYY-MM-DD"),
          endDate: z.string().describe("YYYY-MM-DD"),
        }),
        execute: async (input: { destination: string; startDate: string; endDate: string }) => {
          const forecast = await getWeatherForecast(input.destination, input.startDate, input.endDate)
          return forecast ?? { error: "Could not get forecast. OpenWeather API may not be configured." }
        },
      },

      find_restaurants: {
        description: "Search Google Places for real restaurants in a destination.",
        inputSchema: z.object({
          destination: z.string(),
          query: z
            .string()
            .optional()
            .describe("Type of food or restaurant name (e.g. 'ramen', 'pizza', 'breakfast spot')"),
        }),
        execute: async (input: { destination: string; query?: string }) => {
          const searchQuery = input.query ? `${input.query} restaurant` : "restaurant"
          const result = await searchPlaces(searchQuery, input.destination)
          return result ?? { error: "No results found or Google Places API not configured." }
        },
      },

      find_tours: {
        description: "Search Viator for bookable tours and experiences.",
        inputSchema: z.object({
          destination: z.string(),
          query: z.string().optional().describe("Activity type (e.g. 'cooking class', 'city tour')"),
          minChildAge: z.number().optional(),
        }),
        execute: async (input: { destination: string; query?: string; minChildAge?: number }) => {
          const results = await searchTours(input.destination, input.query, { minAge: input.minChildAge })
          return results.length > 0 ? results : { error: "No tours found or Viator API not configured." }
        },
      },

      find_hotels: {
        description: "Search Hotels.com for available accommodation.",
        inputSchema: z.object({
          destination: z.string(),
          checkin: z.string().describe("YYYY-MM-DD"),
          checkout: z.string().describe("YYYY-MM-DD"),
          budget: z.enum(["$", "$$", "$$$", "any"]).optional(),
          adults: z.number().optional(),
          children: z.number().optional(),
        }),
        execute: async (input: {
          destination: string
          checkin: string
          checkout: string
          budget?: "$" | "$$" | "$$$" | "any"
          adults?: number
          children?: number
        }) => {
          const results = await searchHotels(
            input.destination,
            input.checkin,
            input.checkout,
            input.budget,
            input.adults,
            input.children
          )
          return results.length > 0 ? results : { error: "No hotels found or Expedia API not configured." }
        },
      },

      create_trip: {
        description:
          "Create a new trip for the user. Use when the user asks to plan, set up, or create a trip to a destination. Returns the new trip ID to use with save_attraction and generate_itinerary.",
        inputSchema: z.object({
          title: z.string().describe("Descriptive trip title, e.g. 'Tokyo Family Adventure' or 'Kenya Safari 2026'"),
          destination: z.string().describe("City, region, or country"),
          start_date: z.string().optional().describe("YYYY-MM-DD start date, if the user mentioned one"),
          end_date: z.string().optional().describe("YYYY-MM-DD end date, if the user mentioned one"),
          accommodation_area: z.string().optional().describe("Hotel area or neighborhood, if mentioned"),
        }),
        execute: async (input: {
          title: string
          destination: string
          start_date?: string
          end_date?: string
          accommodation_area?: string
        }) => {
          try {
            const res = await fetch(`${baseUrl}/api/trips`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: cookieHeader,
              },
              body: JSON.stringify(input),
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              return { error: err.error ?? "Could not create trip." }
            }
            const { data } = await res.json()
            return { created: true, trip_id: data.id, title: data.title, destination: data.destination }
          } catch {
            return { error: "Could not create trip." }
          }
        },
      },

      save_attraction: {
        description:
          "Save a specific attraction or place to the user's current trip. Use when the user asks to save, add, bookmark, or remember a place for their trip.",
        inputSchema: z.object({
          attraction_name: z.string().describe("Full name of the attraction or place"),
          destination: z.string().describe("City or destination where the attraction is located"),
          trip_id: z.string().describe("ID of the trip to save to — use the current trip ID from context"),
          category: z
            .string()
            .optional()
            .describe("Category: Restaurant, Museum, Park, Beach, Theme Park, etc."),
          description: z
            .string()
            .optional()
            .describe("Brief description of why this place is worth visiting for families"),
        }),
        execute: async (input: {
          attraction_name: string
          destination: string
          trip_id: string
          category?: string
          description?: string
        }) => {
          try {
            const supabase = await createClient()
            const {
              data: { user },
            } = await supabase.auth.getUser()
            if (!user) return { error: "Not signed in." }

            const attractionData = {
              name: input.attraction_name,
              destination: input.destination,
              category: input.category ?? "Attraction",
              description: input.description ?? "",
              rating: null,
              priceRange: null,
            }

            const { error } = await supabase
              .from("saved_attractions")
              .upsert(
                {
                  user_id: user.id,
                  attraction_name: input.attraction_name,
                  attraction_data: attractionData,
                  trip_id: input.trip_id,
                },
                { onConflict: "user_id,attraction_name,trip_id" }
              )

            if (error) return { error: error.message }
            return { saved: true, name: input.attraction_name }
          } catch {
            return { error: "Failed to save attraction." }
          }
        },
      },

      generate_itinerary: {
        description:
          "Trigger AI itinerary generation for the current trip. Use when the user asks to generate, create, build, or refresh their day-by-day itinerary. Requires at least 3 saved attractions.",
        inputSchema: z.object({
          trip_id: z.string().describe("ID of the trip — use the current trip ID from context"),
        }),
        execute: async (input: { trip_id: string }) => {
          try {
            const res = await fetch(`${baseUrl}/api/trips/${input.trip_id}/itinerary`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: cookieHeader,
              },
            })

            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              return {
                error:
                  err.error ??
                  "Could not generate itinerary. Make sure you have at least 3 saved attractions.",
              }
            }

            return { triggered: true, trip_id: input.trip_id }
          } catch {
            return { error: "Could not reach the itinerary service. Please try from the trip page." }
          }
        },
      },
    },
    onFinish: async ({ text }: { text: string }) => {
      if (user && text) {
        const { error: saveErr } = await supabase.from("chat_messages").insert({
          user_id: user.id,
          trip_id: tripId ?? null,
          role: "assistant",
          content: text,
        })
        if (saveErr) console.error("[chat] Failed to save assistant message:", saveErr.message)
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
