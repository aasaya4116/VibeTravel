import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { searchPlaces, searchPlacesBatch } from "@/lib/travel-apis/google-places"
import { getWeatherForecast } from "@/lib/travel-apis/openweather"
import { searchTours } from "@/lib/travel-apis/viator"
import { searchHotels } from "@/lib/travel-apis/expedia"
import { createClient } from "@/lib/supabase/server"
import { enforceRateLimit, rateLimitResponse, RATE_LIMIT_TIERS } from "@/lib/rate-limit"

const MAX_BODY_BYTES = 96_000

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string().max(20_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(60),
    z.record(jsonValueSchema).refine((value) => Object.keys(value).length <= 60, {
      message: "Object has too many fields",
    }),
  ])
)

const messagePartSchema = z
  .object({
    type: z.string().trim().min(1).max(80),
  })
  .catchall(jsonValueSchema)

const messageSchema = z
  .object({
    id: z.string().trim().min(1).max(160).optional(),
    role: z.enum(["user", "assistant"]),
    metadata: jsonValueSchema.optional(),
    parts: z.array(messagePartSchema).min(1).max(30),
  })
  .strict()

const familyVibeSchema = z
  .object({
    id: z.string().max(160),
    user_id: z.string().max(160),
    family_name: z.string().trim().max(120).nullable(),
    kids: z.array(z.record(jsonValueSchema)).max(20),
    travelers: z.array(z.record(jsonValueSchema)).max(20).optional(),
    travel_style: z.array(z.string().trim().max(80)).max(20),
    sensory_needs: z.array(z.string().trim().max(120)).max(20),
    mobility_notes: z.string().trim().max(2_000).nullable(),
    dietary: z.array(z.string().trim().max(120)).max(20),
    pace: z.enum(["slow", "moderate", "fast"]),
    budget_preference: z.enum(["free", "$", "$$", "$$$", "any"]),
    created_at: z.string().max(80),
    updated_at: z.string().max(80),
  })
  .strict()

const currentTripSchema = z
  .object({
    id: z.string().max(160),
    user_id: z.string().max(160),
    title: z.string().trim().min(1).max(200),
    destination: z.string().trim().min(1).max(200),
    start_date: z.string().max(40).nullable(),
    end_date: z.string().max(40).nullable(),
    accommodation_area: z.string().max(300).nullable(),
    status: z.enum(["planning", "active", "completed"]),
    itinerary: z.array(jsonValueSchema).max(60),
    created_at: z.string().max(80),
    updated_at: z.string().max(80),
  })
  .strict()

const chatRequestSchema = z
  .object({
    id: z.string().trim().min(1).max(160).optional(),
    messages: z.array(messageSchema).min(1).max(60),
    familyVibe: familyVibeSchema.nullable().optional(),
    currentTrip: currentTripSchema.nullable().optional(),
    tripId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const lastMessage = value.messages.at(-1)
    const hasUserText = lastMessage?.parts.some((part) => {
      const text = (part as Record<string, unknown>).text
      return part.type === "text" && typeof text === "string" && text.trim().length > 0
    })
    if (lastMessage?.role !== "user" || !hasUserText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages", value.messages.length - 1],
        message: "The final message must contain user text",
      })
    }
  })

function contentLengthExceedsLimit(req: Request) {
  const value = req.headers.get("content-length")
  if (!value) return false
  const length = Number(value)
  return Number.isFinite(length) && length > MAX_BODY_BYTES
}

function requestTooLargeResponse() {
  return Response.json(
    { error: "This conversation is too long. Start a new chat and try again." },
    { status: 413 }
  )
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { error: "Sign in to use Scout." },
      { status: 401 }
    )
  }
  const userId = user.id

  const rateLimit = await enforceRateLimit(req, RATE_LIMIT_TIERS.AI_CHAT, {
    userId,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  if (contentLengthExceedsLimit(req)) return requestTooLargeResponse()

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return Response.json({ error: "We could not read this chat request." }, { status: 400 })
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return requestTooLargeResponse()
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "This chat request is not valid JSON." }, { status: 400 })
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Check your message and try again." },
      { status: 400 }
    )
  }

  const { familyVibe, currentTrip, tripId } = parsed.data
  const messages = parsed.data.messages as UIMessage[]

  async function reserveProviderQuota(units = 1) {
    for (let unit = 0; unit < Math.max(1, units); unit += 1) {
      const providerLimit = await enforceRateLimit(
        req,
        RATE_LIMIT_TIERS.PROVIDER_SEARCH,
        { userId }
      )
      if (!providerLimit.allowed) {
        return {
          error:
            providerLimit.reason === "unavailable"
              ? "Live travel search is temporarily unavailable. Please try again shortly."
              : "You have reached the live-search limit. Please wait a moment and try again.",
          code:
            providerLimit.reason === "unavailable"
              ? "RATE_LIMIT_UNAVAILABLE"
              : "RATE_LIMITED",
          retryAfter: providerLimit.retryAfterSeconds,
        }
      }
    }
    return null
  }

  // Captured for use inside action tool closures
  const baseUrl = new URL(req.url).origin
  const cookieHeader = req.headers.get("cookie") ?? ""

  const vibeContext = familyVibe
    ? `
The family's travel profile:
- Family name: ${familyVibe.family_name || "Not set"}
- Kids: ${JSON.stringify(familyVibe.kids || [])}
- Other travelers: ${JSON.stringify(familyVibe.travelers || [])}
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
  {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
    const userText = lastUserMsg?.parts
      ?.flatMap((part) => part.type === "text" ? [part.text] : [])
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

Your personality: You're like a well-traveled friend who understands families, multigenerational groups, and adults traveling together. You give honest, specific advice and avoid generic tourist recommendations.

${vibeContext}

${tripContext}

Key behaviors:
- Give specific, actionable recommendations with real place names
- Consider the whole travel group: children's ages, adult and grandparent needs, sensory needs, mobility, and energy levels
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
          const quotaError = await reserveProviderQuota()
          if (quotaError) return quotaError
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
          const quotaError = await reserveProviderQuota(input.attractions.length)
          if (quotaError) return quotaError
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
          const quotaError = await reserveProviderQuota()
          if (quotaError) return quotaError
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
          const quotaError = await reserveProviderQuota()
          if (quotaError) return quotaError
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
          const quotaError = await reserveProviderQuota()
          if (quotaError) return quotaError
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
          const quotaError = await reserveProviderQuota()
          if (quotaError) return quotaError
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

  return result.toUIMessageStreamResponse({ headers: rateLimit.headers })
}
