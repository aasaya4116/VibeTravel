import { createRequestClient } from "@/lib/supabase/request"
import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import type { Attraction, ItineraryDay } from "@/lib/types"
import {
  ensureSavedAttractionsInDay,
  mergeItinerarySection,
  mergeRegeneratedDay,
  pinSavedAttractionsToDates,
} from "@/lib/itinerary-editing"
import {
  assignAttractionsToBatches,
  batchTripDates,
  enumerateTripDates,
  MAX_GENERATION_DAYS,
  MAX_ITINERARY_DAYS,
} from "@/lib/itinerary-batching"
import { getWeatherForecast } from "@/lib/travel-apis/openweather"
import {
  cleanFitSignals,
  enforcePaceLimit,
  PACE_GUIDES,
  type TravelPace,
} from "@/lib/itinerary-intelligence"

export const maxDuration = 60

const ITINERARY_MODEL = "claude-sonnet-4-5-20250929"
const ITINERARY_DEADLINE_MS = 48_000

const itineraryItemSchema = z.object({
  attraction_name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  notes: z.string().optional(),
  recommended: z.boolean().describe("true if this is an AI-recommended activity, false if it was saved by the user"),
  item_type: z.enum(["place", "neighborhood", "meal", "downtime"]).default("place"),
  // Anthropic structured outputs reject JSON Schema maxItems. The response is
  // capped by cleanFitSignals before it is stored.
  fit_signals: z.array(z.string().max(60)).default([]),
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
  const requestStartedAt = Date.now()
  const requestId = crypto.randomUUID()
  const { id: tripId } = await params
  const body = await req.json().catch(() => ({}))
  const deltaInstruction: string | undefined = body?.instruction
  const targetDayDate: string | undefined = body?.dayDate
  const targetDayInstruction: string | undefined = body?.dayInstruction
  const requestedDates: string[] | null = Array.isArray(body?.dates)
    ? Array.from(new Set<string>(
        (body.dates as unknown[]).filter(
          (date: unknown): date is string => typeof date === "string"
        )
      ))
    : null
  const { supabase, user } = await createRequestClient(req)

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
  const pace: TravelPace = ["slow", "moderate", "fast"].includes(familyVibe?.pace)
    ? familyVibe.pace
    : "moderate"
  const paceGuide = PACE_GUIDES[pace]

  const attractions: Attraction[] = savedAttractions.map((sa) => ({
    name: sa.attraction_name,
    ...sa.attraction_data,
  })) as Attraction[]

  if (attractions.length < 3 && (!trip.itinerary || trip.itinerary.length === 0)) {
    return NextResponse.json(
      { error: "Save at least 3 attractions to this trip before generating an itinerary." },
      { status: 400 }
    )
  }

  // Refinements require an existing itinerary.
  if ((deltaInstruction || targetDayDate) && (!trip.itinerary || trip.itinerary.length === 0)) {
    return NextResponse.json(
      { error: "No existing itinerary to refine. Generate one first." },
      { status: 400 }
    )
  }

  const targetDay = targetDayDate
    ? (trip.itinerary as ItineraryDay[]).find((day) => day.date === targetDayDate)
    : null
  if (targetDayDate && !targetDay) {
    return NextResponse.json({ error: "Itinerary day not found" }, { status: 404 })
  }

  const savedNames = new Set(attractions.map((a) => a.name.trim().toLowerCase()))
  const targetDaySavedAttractions = targetDayDate
    ? attractions.filter((attraction) => attraction.plannedDate === targetDayDate)
    : []

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

  if (tripDays > MAX_ITINERARY_DAYS) {
    return NextResponse.json(
      { error: `Trips can include up to ${MAX_ITINERARY_DAYS} itinerary days.` },
      { status: 400 }
    )
  }

  const dateRangeDesc =
    trip.start_date && trip.end_date
      ? `from ${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} to ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (${tripDays} days)`
      : "across one or more days"

  const vibeContext = familyVibe
    ? `
Family vibe profile:
- Kids: ${JSON.stringify(familyVibe.kids)}
- Other travelers: ${JSON.stringify(familyVibe.travelers || [])}
- Travel style: ${familyVibe.travel_style?.join(", ") || "not specified"}
- Sensory needs: ${familyVibe.sensory_needs?.join(", ") || "none"}
- Mobility: ${familyVibe.mobility_notes || "no restrictions"}
- Pace: ${familyVibe.pace || "moderate"}
- Dietary: ${familyVibe.dietary?.join(", ") || "none"}
- Budget: ${familyVibe.budget_preference || "any"}
`
    : ""

  const itineraryIntelligenceRules = `
- The saved family pace is ${pace}. Target ${paceGuide.prompt}.
- Never exceed ${paceGuide.maxStops} total scheduled stops in a day unless traveler-picked items alone exceed that number. Traveler picks are required; AI additions are optional.
- Prefer one flexible neighborhood block over several nearby micro-stops when an area itself is worth exploring. Name it "Explore [neighborhood]", set item_type to "neighborhood", and keep its stops walkable.
- Set item_type to "meal" for dedicated meals, "downtime" for rest, and "place" for a named venue.
- For each AI suggestion, return 1-3 fit_signals with short, scannable labels grounded in this profile, such as "Technology interest", "Ages 8–12", "Moderate pace", or "Nut-aware option".
- Keep notes to one concise sentence explaining the practical family fit. Do not repeat the fit signals as a paragraph.`

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

  const isTargetDay = !!targetDayDate && !!targetDay
  const isDelta = !!deltaInstruction && trip.itinerary && trip.itinerary.length > 0
  const fullTripDateValues = trip.start_date && trip.end_date
    ? enumerateTripDates(trip.start_date, trip.end_date)
    : Array.from({ length: tripDays }, (_, index) => {
        const date = new Date(startDate)
        date.setDate(date.getDate() + index)
        return [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-")
      })
  if (requestedDates && (requestedDates.length === 0 || requestedDates.length > MAX_GENERATION_DAYS)) {
    return NextResponse.json(
      { error: `Choose between 1 and ${MAX_GENERATION_DAYS} days to plan at a time.` },
      { status: 400 }
    )
  }
  if (requestedDates?.some((date) => !fullTripDateValues.includes(date))) {
    return NextResponse.json(
      { error: "One or more selected dates are outside this trip." },
      { status: 400 }
    )
  }
  if (!isTargetDay && !isDelta && fullTripDateValues.length > MAX_GENERATION_DAYS && !requestedDates) {
    return NextResponse.json(
      { error: `Choose up to ${MAX_GENERATION_DAYS} trip days before generating a detailed plan.` },
      { status: 400 }
    )
  }
  if (isDelta && fullTripDateValues.length > MAX_GENERATION_DAYS) {
    return NextResponse.json(
      { error: "For longer trips, refresh individual days so the rest of your plan stays intact." },
      { status: 400 }
    )
  }

  const generationDateValues = isTargetDay && targetDayDate
    ? [targetDayDate]
    : requestedDates ?? fullTripDateValues
  const generationBatches = isTargetDay && targetDayDate
    ? [[targetDayDate]]
    : batchTripDates(generationDateValues)
  const existingAttractionNames = new Set(
    ((trip.itinerary ?? []) as ItineraryDay[]).flatMap((day) =>
      day.items.map((item) => item.attraction_name.trim().toLowerCase())
    )
  )
  const pendingAttractions = attractions.filter(
    (attraction) => !existingAttractionNames.has(attraction.name.trim().toLowerCase())
  )
  const attractionAssignments = assignAttractionsToBatches(
    pendingAttractions,
    generationBatches
  )

  console.info(
    `[itinerary:${requestId}] generating ${generationDateValues.length} of ${fullTripDateValues.length} days in ${generationBatches.length} batch(es)`
  )

  let parsed: z.infer<typeof itineraryOutputSchema> | undefined
  try {
    const generatedBatches = await Promise.all(
      generationBatches.map(async (batchDates, batchIndex) => {
        const remainingGenerationMs =
          ITINERARY_DEADLINE_MS - (Date.now() - requestStartedAt)
        if (remainingGenerationMs < 3_000) {
          throw new DOMException("Itinerary request deadline reached", "TimeoutError")
        }

        const batchAttractions = attractionAssignments[batchIndex]
        const existingBatch = isDelta
          ? (trip.itinerary as ItineraryDay[]).filter((day) =>
              batchDates.includes(day.date)
            )
          : []
        const exactDates = batchDates.join(", ")

        const system = isTargetDay
          ? `You are VibeTravel's single-day itinerary planner. Rebuild only the requested day of an existing family trip.

Rules:
- Return exactly one day using the requested date.
- KEEP every user-picked item where recommended is false, including its current times and notes.
- INCLUDE every newly saved place explicitly assigned to this date. Use its exact name and mark it recommended: false.
- KEEP every completed or skipped item exactly as-is. Never reschedule or remove it.
- Replace or improve the AI-suggested items where recommended is true.
- Build a realistic day with reasonable meal, rest, and travel buffers.
- Recommended activities must be REAL places that actually exist in ${trip.destination}.
- Match the whole travel group's ages, interests, sensory needs, mobility needs, and pace.
${itineraryIntelligenceRules}
- date must be YYYY-MM-DD.
${weatherContext ? "- Use the weather forecast when choosing indoor versus outdoor activities." : ""}`
          : isDelta
            ? `You are VibeTravel's itinerary refinement assistant. Improve only the supplied portion of an existing itinerary.

Rules:
- Return each of these dates exactly once and no other dates: ${exactDates}.
- KEEP all existing itinerary items exactly as-is, especially user-saved attractions marked recommended: false.
- Apply the requested improvement by adding, adjusting, or swapping only AI-suggested items.
- Do NOT remove user-saved, completed, or skipped items.
- Recommended activities must be REAL places that actually exist in ${trip.destination}.
- Match additions to the whole travel group's ages, interests, and sensory/mobility needs.
${itineraryIntelligenceRules}
- date must be YYYY-MM-DD for each day.
${weatherContext ? "- Use the weather forecast when placing outdoor versus indoor activities." : ""}`
            : `You are VibeTravel's itinerary builder. Create a realistic, family-friendly plan for one date window of a longer trip.

Rules:
- Return each of these dates exactly once and no other dates: ${exactDates}.
- Include every saved attraction supplied for this window, using its exact name and recommended: false.
- If a saved attraction has a preferred date, schedule it on that exact date.
- Fill gaps with real activities, restaurants, cafes, parks, or experiences in ${trip.destination}, marked recommended: true.
- Lighter or rest days are welcome on long trips.
- Match recommendations to the whole travel group's ages, interests, dietary needs, mobility needs, and sensory needs.
- Include realistic meal, rest, and travel buffers and use reasonable start and end times.
${itineraryIntelligenceRules}
- date must be YYYY-MM-DD for each day.
${weatherContext ? "- Use the weather forecast when placing outdoor versus indoor activities." : ""}`

        const content = isTargetDay
          ? `Trip: ${trip.title}, destination: ${trip.destination}. Rebuild date: ${targetDayDate}.
${accommodationContext}
${vibeContext}${weatherContext}
Current day:
${JSON.stringify(targetDay, null, 2)}
${targetDaySavedAttractions.length ? `
Saved places assigned to this date (MUST include each exact name and mark recommended: false):
${targetDaySavedAttractions.map((attraction) => `- ${attraction.name} (${attraction.estimatedDuration || "1-2 hours"})`).join("\n")}` : ""}
${targetDayInstruction ? `\nSpecific request: ${targetDayInstruction}` : ""}

Return only the rebuilt day for ${targetDayDate}. Preserve every user-picked, completed, and skipped item.`
          : isDelta
            ? `Trip: ${trip.title}, destination: ${trip.destination}. Full trip: ${dateRangeDesc}.
Dates in this batch: ${exactDates}.
${accommodationContext}
${vibeContext}${weatherContext}
Improvement request: ${deltaInstruction}

Existing days in this batch:
${JSON.stringify(existingBatch, null, 2)}

Return every supplied date, including unchanged dates.`
            : `Trip: ${trip.title}, destination: ${trip.destination}. Full trip: ${dateRangeDesc}.
Dates in this batch: ${exactDates}.
${accommodationContext}
${vibeContext}${weatherContext}
${batchAttractions.length ? `Saved attractions assigned to this window (use exact names and mark recommended: false):
${batchAttractions.map((attraction) => `- ${attraction.name} (${attraction.estimatedDuration || "1-2 hours"})${attraction.plannedDate ? ` — preferred date: ${attraction.plannedDate}` : ""}`).join("\n")}` : "There are no saved attractions assigned to this window."}

Return a complete plan for every listed date. Mark saved places recommended: false and suggestions recommended: true.`

        const result = await generateText({
          model: anthropic(ITINERARY_MODEL),
          maxOutputTokens: Math.min(8_000, Math.max(3_000, batchDates.length * 900)),
          maxRetries: 1,
          abortSignal: AbortSignal.timeout(remainingGenerationMs),
          output: Output.object({ schema: itineraryOutputSchema }),
          system,
          messages: [{ role: "user", content }],
        })
        const output = result.output
        const returnedByDate = new Map(
          output.days
            .filter((day) => batchDates.includes(day.date))
            .map((day) => [day.date, day])
        )
        const missingDates = batchDates.filter((date) => !returnedByDate.has(date))
        if (missingDates.length > 0) {
          throw new Error(`Incomplete itinerary batch: ${missingDates.join(", ")}`)
        }

        return batchDates.map((date) => returnedByDate.get(date)!)
      })
    )

    parsed = { days: generatedBatches.flat() }
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "UnknownError"
    const timedOut = errorName === "AbortError" || errorName === "TimeoutError"
    console.error(`[itinerary:${requestId}] generation failed (${errorName}):`, err)
    return NextResponse.json(
      {
        error: timedOut
          ? "This itinerary is taking longer than expected. Your trip is safe—please try again."
          : "We couldn't build this itinerary right now. Your saved places are safe—please try again.",
        requestId,
      },
      { status: timedOut ? 504 : 502 }
    )
  }

  if (!parsed?.days?.length) {
    return NextResponse.json(
      { error: "Could not generate itinerary" },
      { status: 500 }
    )
  }

  const existingItinerary = (trip.itinerary ?? []) as ItineraryDay[]
  const savedAttractionByName = new Map(
    attractions.map((attraction) => [attraction.name.trim().toLowerCase(), attraction])
  )
  let generatedDays: ItineraryDay[] = parsed.days.map((day) => ({
    date: day.date,
    items: day.items.map((item, i) => {
      const existingItem = existingItinerary
        .find((existingDay) => existingDay.date === day.date)
        ?.items.find(
          (existing) =>
            existing.attraction_name.toLowerCase() === item.attraction_name.toLowerCase()
        )
      const savedAttraction = savedAttractionByName.get(
        item.attraction_name.trim().toLowerCase()
      )
      const savedSignals = savedAttraction?.familyFitSignals?.map((signal) => signal.label)

      return {
        id: existingItem?.id ?? `item-${day.date}-${i}-${crypto.randomUUID()}`,
        attraction_name: item.attraction_name,
        start_time: item.start_time,
        end_time: item.end_time,
        notes: item.notes,
        item_type: savedAttraction ? "place" : item.item_type,
        fit_signals: cleanFitSignals(savedSignals?.length ? savedSignals : item.fit_signals),
        status: existingItem?.status,
        recommended: !(
          savedNames.has(item.attraction_name.trim().toLowerCase()) ||
          existingItem?.recommended === false ||
          (isTargetDay && targetDay?.items.some(
            (existing) =>
              existing.recommended === false &&
              existing.attraction_name.toLowerCase() === item.attraction_name.toLowerCase()
          ))
        ),
      }
    }),
  }))

  generatedDays = pinSavedAttractionsToDates(
    generatedDays,
    attractions,
    () => `item-${crypto.randomUUID()}`
  )

  // A model response should contain every saved place, but do not let an
  // omission drop a traveler pick. Add any missing place to a day in the same
  // generation window before saving the assembled itinerary.
  if (!isTargetDay && !isDelta) {
    const returnedNames = new Set(
      generatedDays.flatMap((day) =>
        day.items.map((item) => item.attraction_name.trim().toLowerCase())
      )
    )
    const missingByDate = new Map<string, Attraction[]>()

    attractionAssignments.forEach((batchAttractions, batchIndex) => {
      const batchDates = generationBatches[batchIndex]
      batchAttractions
        .filter((attraction) => !returnedNames.has(attraction.name.trim().toLowerCase()))
        .forEach((attraction, attractionIndex) => {
          const preferredDate = attraction.plannedDate && batchDates.includes(attraction.plannedDate)
            ? attraction.plannedDate
            : batchDates[attractionIndex % batchDates.length]
          missingByDate.set(preferredDate, [
            ...(missingByDate.get(preferredDate) ?? []),
            attraction,
          ])
          returnedNames.add(attraction.name.trim().toLowerCase())
        })
    })

    generatedDays = generatedDays.map((day) =>
      ensureSavedAttractionsInDay(
        day,
        missingByDate.get(day.date) ?? [],
        () => `item-${day.date}-${crypto.randomUUID()}`
      )
    )
  }

  if (!isTargetDay) {
    generatedDays = generatedDays.map((day) => enforcePaceLimit(day, pace))
  }

  let itinerary = generatedDays
  if (isTargetDay && targetDayDate && targetDay) {
    const generatedDay = generatedDays.find((day) => day.date === targetDayDate)
    const rebuiltDay = generatedDay
      ? enforcePaceLimit(
          ensureSavedAttractionsInDay(
            generatedDay,
            targetDaySavedAttractions,
            () => `item-${targetDayDate}-${crypto.randomUUID()}`
          ),
          pace
        )
      : null
    if (!rebuiltDay) {
      return NextResponse.json(
        { error: "Could not regenerate the selected day" },
        { status: 500 }
      )
    }

    itinerary = mergeRegeneratedDay(
      trip.itinerary as ItineraryDay[],
      targetDayDate,
      rebuiltDay
    )
  } else if (isDelta) {
    itinerary = generatedDays.reduce(
      (current, rebuiltDay) =>
        mergeRegeneratedDay(current, rebuiltDay.date, rebuiltDay),
      existingItinerary
    )
  } else if (requestedDates) {
    itinerary = mergeItinerarySection(
      existingItinerary,
      generatedDays,
      fullTripDateValues
    )
  }

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
