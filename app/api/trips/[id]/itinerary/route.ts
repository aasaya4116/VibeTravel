import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import type { ItineraryDay } from "@/lib/types"
import { getWeatherForecast } from "@/lib/travel-apis/openweather"

const itineraryItemSchema = z.object({
  attraction_name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  notes: z.string().optional(),
  recommended: z.boolean().describe("true if this is an AI-recommended activity, false if it was saved by the user"),
})

const itineraryDaySchema = z.object({
  date: z.string(),
  items: z.array(itineraryItemSchema),
})

const itineraryOutputSchema = z.object({
  days: z.array(itineraryDaySchema),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  const body = await req.json().catch(() => ({}))
  const deltaInstruction: string | undefined = body?.instruction
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch trip, saved attractions, and family vibe in parallel
  const [tripResult, savedResult, vibeResult] = await Promise.all([
    supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("saved_attractions")
      .select("*")
      .eq("user_id", user.id)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    supabase
      .from("family_vibes")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ])

  if (tripResult.error || !tripResult.data) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  if (savedResult.error) {
    return NextResponse.json(
      { error: "Failed to load saved attractions" },
      { status: 500 }
    )
  }

  const trip = tripResult.data
  const familyVibe = vibeResult.data
  const savedAttractions = savedResult.data ?? []

  const attractions = savedAttractions.map((sa) => ({
    name: sa.attraction_name,
    ...sa.attraction_data,
  }))

  if (attractions.length < 3) {
    return NextResponse.json(
      { error: "Save at least 3 attractions to this trip before generating an itinerary." },
      { status: 400 }
    )
  }

  // Delta mode: requires an existing itinerary to refine
  if (deltaInstruction && (!trip.itinerary || trip.itinerary.length === 0)) {
    return NextResponse.json(
      { error: "No existing itinerary to refine. Generate one first." },
      { status: 400 }
    )
  }

  const savedNames = new Set(attractions.map((a) => a.name))

  const startDate = trip.start_date
    ? new Date(trip.start_date + "T00:00:00")
    : new Date()
  const endDate = trip.end_date
    ? new Date(trip.end_date + "T00:00:00")
    : new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000)

  const tripDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
  )

  const dateRangeDesc =
    trip.start_date && trip.end_date
      ? `from ${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} to ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (${tripDays} days)`
      : "across one or more days"

  const vibeContext = familyVibe
    ? `
Family vibe profile:
- Kids: ${JSON.stringify(familyVibe.kids)}
- Travel style: ${familyVibe.travel_style?.join(", ") || "not specified"}
- Sensory needs: ${familyVibe.sensory_needs?.join(", ") || "none"}
- Mobility: ${familyVibe.mobility_notes || "no restrictions"}
- Pace: ${familyVibe.pace || "moderate"}
- Dietary: ${familyVibe.dietary?.join(", ") || "none"}
- Budget: ${familyVibe.budget_preference || "any"}
`
    : ""

  const accommodationContext = trip.accommodation_area
    ? `Accommodation: The family is staying near "${trip.accommodation_area}". Use this as the geographic anchor — cluster each day's activities around this area or around each other to minimize travel time. Prefer activities nearest to the accommodation for the first and last days.`
    : `Accommodation: Not specified. Group activities so each day covers one distinct neighborhood or area to minimize cross-city travel.`

  // Fetch weather forecast (best-effort — skipped if key missing)
  const weatherForecast = trip.start_date && trip.end_date
    ? await getWeatherForecast(trip.destination, trip.start_date, trip.end_date)
    : null

  const weatherContext = weatherForecast
    ? `
Weather forecast for ${trip.destination}:
${weatherForecast.days.map((d) => `- ${d.date}: ${d.icon} ${d.condition}, ${d.tempLow}–${d.tempHigh}°F, ${d.rainChance}% rain`).join("\n")}
Note: ${weatherForecast.summary}
When rain is likely (>50%), prioritize indoor activities for that day.`
    : ""

  const isDelta = !!deltaInstruction && trip.itinerary && trip.itinerary.length > 0

  const result = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.object({ schema: itineraryOutputSchema }),
    system: isDelta
      ? `You are VibeTravel's itinerary refinement assistant. You receive an existing day-by-day itinerary and a specific improvement request.

Rules:
- KEEP all existing itinerary items exactly as-is (especially user-saved attractions marked as recommended: false).
- Apply the requested improvement by adding, adjusting, or swapping only AI-suggested items (recommended: true).
- Do NOT remove any items where recommended is false.
- Recommended activities must be REAL places that actually exist in ${trip.destination}.
- Match additions to the family's vibe, kids' ages, and sensory/mobility needs.
- Preserve all original dates and day structure. Return ALL days, including unchanged ones.
- date must be YYYY-MM-DD for each day.
${weatherContext ? "- Use the weather forecast when placing outdoor vs indoor activities." : ""}`
      : `You are VibeTravel's itinerary builder. You create complete, realistic, family-friendly day plans.

Rules:
- Build one day per calendar day in the trip range.
- ALWAYS include ALL of the user's saved attractions (marked as recommended: false).
- FILL IN THE GAPS: For each day, recommend additional real activities, restaurants, cafes, parks, or experiences in ${trip.destination} that complement the saved attractions. These are marked as recommended: true.
- Aim for 2-4 activities per day depending on duration and family pace. A full day should have a morning activity, a lunch spot or break, an afternoon activity, and optionally an evening activity.
- Recommended activities must be REAL places that actually exist in ${trip.destination}. Include the full name of the place.
- Match recommendations to the family's vibe, kids' ages, and sensory/mobility needs.
- Include meal/snack breaks, rest time for young kids, and travel time between locations.
- Assign reasonable start_time and end_time (e.g. "09:00", "14:30"). Allow buffer between activities.
- Order activities logically by time of day, location proximity, and energy levels.
- date must be YYYY-MM-DD for each day.
- For recommended items, add a helpful note explaining why this place is a great fit.
${weatherContext ? "- Use the weather forecast to schedule outdoor activities on sunny days and indoor ones on rainy days." : ""}`,
    messages: [
      {
        role: "user",
        content: isDelta
          ? `Trip: ${trip.title}, destination: ${trip.destination}. Dates: ${dateRangeDesc}.
${accommodationContext}
${vibeContext}${weatherContext}
Improvement request: ${deltaInstruction}

Existing itinerary to refine:
${JSON.stringify(trip.itinerary, null, 2)}

Return the COMPLETE updated itinerary with all days. Keep all existing items, only add or adjust AI-suggested items.`
          : `Trip: ${trip.title}, destination: ${trip.destination}. Dates: ${dateRangeDesc}.
${accommodationContext}
${vibeContext}${weatherContext}
The family has saved these ${attractions.length} attractions (use these EXACT names, mark as recommended: false):
${attractions.map((a) => `- ${a.name} (${(a as { estimatedDuration?: string }).estimatedDuration ?? "1-2 hours"})`).join("\n")}

Generate a COMPLETE day-by-day itinerary. Include all saved attractions AND recommend additional real activities, restaurants, and experiences to fill out each day. Mark each item: recommended: false for saved attractions, recommended: true for your suggestions.`,
      },
    ],
  })

  const parsed = result.output as {
    days: {
      date: string
      items: { attraction_name: string; start_time: string; end_time: string; notes?: string; recommended?: boolean }[]
    }[]
  } | undefined

  if (!parsed?.days?.length) {
    return NextResponse.json(
      { error: "Could not generate itinerary" },
      { status: 500 }
    )
  }

  const itinerary: ItineraryDay[] = parsed.days.map((day) => ({
    date: day.date,
    items: day.items.map((item, i) => ({
      id: `item-${day.date}-${i}`,
      attraction_name: item.attraction_name,
      start_time: item.start_time,
      end_time: item.end_time,
      notes: item.notes,
      recommended: item.recommended ?? !savedNames.has(item.attraction_name),
    })),
  }))

  const { error: updateError } = await supabase
    .from("trips")
    .update({
      itinerary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripId)
    .eq("user_id", user.id)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ itinerary })
}
