import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import type {
  Attraction,
  DashboardData,
  FamilyVibe,
  ItineraryDay,
  Profile,
  SavedAttraction,
  Trip,
  TripReadinessState,
} from "./types"

const CACHE_PREFIX = "vibetravel:mobile:v1"

function readCache<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(`${CACHE_PREFIX}:${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeCache(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify(value))
  } catch {
    // A failed cache write should never block live trip data.
  }
}

export async function loadDashboard(user: User): Promise<DashboardData> {
  const cacheKey = `dashboard:${user.id}`
  try {
    const [profileResult, vibeResult, tripsResult, readinessResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("family_vibes").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("trips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("trip_readiness")
        .select("trip_id, currency, budget_target, bookings, checklist")
        .eq("user_id", user.id),
    ])

    const error = profileResult.error ?? vibeResult.error ?? tripsResult.error ?? readinessResult.error
    if (error) throw error

    const readinessByTrip = Object.fromEntries(
      (readinessResult.data ?? []).map((row) => [
        row.trip_id,
        {
          currency: row.currency,
          budget_target: row.budget_target,
          bookings: row.bookings ?? {},
          checklist: row.checklist ?? [],
        } as TripReadinessState,
      ])
    )

    const data: DashboardData = {
      profile: profileResult.data as Profile | null,
      familyVibe: vibeResult.data as FamilyVibe | null,
      trips: (tripsResult.data ?? []) as Trip[],
      readinessByTrip,
      offline: false,
    }
    writeCache(cacheKey, data)
    return data
  } catch (error) {
    const cached = readCache<DashboardData>(cacheKey)
    if (cached) return { ...cached, offline: true }
    throw error
  }
}

export async function updateProfileDisplayName(userId: string, displayName: string) {
  const normalizedName = displayName.trim()
  if (!normalizedName) throw new Error("Enter your name before saving.")

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: normalizedName,
      },
      { onConflict: "id" }
    )
    .select("id, display_name, avatar_url")
    .single()

  if (error) throw error
  return data as Profile
}

export async function loadTrip(userId: string, tripId: string) {
  const cacheKey = `trip:${userId}:${tripId}`
  try {
    const [tripResult, savedResult] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).eq("user_id", userId).single(),
      supabase
        .from("saved_attractions")
        .select("*")
        .eq("user_id", userId)
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true }),
    ])
    if (tripResult.error) throw tripResult.error
    if (savedResult.error) throw savedResult.error
    const result = {
      trip: tripResult.data as Trip,
      savedAttractions: (savedResult.data ?? []) as SavedAttraction[],
    }
    writeCache(cacheKey, result)
    return { ...result, offline: false }
  } catch (error) {
    const cached = readCache<{ trip: Trip; savedAttractions: SavedAttraction[] } | Trip>(cacheKey)
    if (cached && "trip" in cached) return { ...cached, offline: true }
    if (cached) return { trip: cached, savedAttractions: [], offline: true }
    throw error
  }
}

export async function saveAttractionToTrip(
  userId: string,
  tripId: string,
  attraction: Attraction,
  plannedDate: string | null = null
) {
  const attractionData = { ...attraction, plannedDate }
  const { data, error } = await supabase
    .from("saved_attractions")
    .upsert(
      {
        user_id: userId,
        trip_id: tripId,
        attraction_name: attraction.name,
        attraction_data: attractionData,
      },
      { onConflict: "user_id,attraction_name,trip_id" }
    )
    .select("*")
    .single()
  if (error) throw error
  return data as SavedAttraction
}

export async function generateTripItinerary(accessToken: string, tripId: string) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"
  const response = await fetch(`${apiUrl}/api/trips/${tripId}/itinerary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "We couldn't build this itinerary right now.")
  return body.itinerary as ItineraryDay[]
}

export async function saveItinerary(userId: string, trip: Trip, itinerary: ItineraryDay[]) {
  const { data, error } = await supabase
    .from("trips")
    .update({ itinerary, updated_at: new Date().toISOString() })
    .eq("id", trip.id)
    .eq("user_id", userId)
    .select("*")
    .single()
  if (error) throw error
  writeCache(`trip:${userId}:${trip.id}`, data)
  return data as Trip
}

export async function createTrip(
  userId: string,
  input: Pick<Trip, "title" | "destination" | "start_date" | "end_date">
) {
  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: userId,
      title: input.title,
      destination: input.destination,
      start_date: input.start_date,
      end_date: input.end_date,
      status: "planning",
      itinerary: [],
    })
    .select("*")
    .single()
  if (error) throw error
  return data as Trip
}

export function getReadinessPercent(state: TripReadinessState | undefined, itinerary: ItineraryDay[]) {
  if (!state) return 0
  const bookingItems = itinerary.flatMap((day) => day.items)
  const bookingValues = bookingItems.map((item) => state.bookings[item.id]?.status === "booked")
  const checklistValues = (state.checklist ?? []).map((item) => item.completed)
  const all = [...bookingValues, ...checklistValues]
  if (all.length === 0) return 0
  return Math.round((all.filter(Boolean).length / all.length) * 100)
}
