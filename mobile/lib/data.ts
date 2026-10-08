import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import { DASHBOARD_TRIP_SELECT } from "./dashboard-data"
import {
  isVerifiedDestinationOption,
  normalizeDestinationOption,
  type DestinationOption,
  type DestinationOptionPayload,
} from "./destination-options"
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
export { DASHBOARD_TRIP_SELECT, getReadinessPercent } from "./dashboard-data"

const dashboardRequests = new Map<string, Promise<DashboardData>>()
const familyPaceRequests = new Map<string, Promise<FamilyVibe["pace"]>>()
const tripRequests = new Map<string, Promise<TripData>>()

interface TripData {
  trip: Trip
  savedAttractions: SavedAttraction[]
  offline: boolean
}

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

function tripDestinationCacheKey(userId: string, tripId: string) {
  return `trip-destination:${userId}:${tripId}`
}

export function readTripDestinationOption(userId: string, tripId: string) {
  const cached = readCache<DestinationOptionPayload>(tripDestinationCacheKey(userId, tripId))
  return cached ? normalizeDestinationOption(cached) : null
}

function writeTripDestinationOption(userId: string, tripId: string, option?: DestinationOption | null) {
  if (isVerifiedDestinationOption(option)) writeCache(tripDestinationCacheKey(userId, tripId), option)
}

function withoutDashboardItineraries(data: DashboardData): DashboardData {
  return {
    ...data,
    trips: data.trips.map((trip) => ({ ...trip, itinerary: [] })),
  }
}

export function readDashboardCache(userId: string): DashboardData | null {
  const cached = readCache<DashboardData>(`dashboard:${userId}`)
  return cached ? withoutDashboardItineraries(cached) : null
}

function writeDashboardCache(userId: string, data: DashboardData) {
  writeCache(`dashboard:${userId}`, withoutDashboardItineraries(data))
  if (data.familyVibe?.pace) writeCache(`family-pace:${userId}`, data.familyVibe.pace)
}

export async function loadDashboard(user: User): Promise<DashboardData> {
  const existing = dashboardRequests.get(user.id)
  if (existing) return existing

  const request = (async () => {
    try {
      const [profileResult, vibeResult, tripsResult, readinessResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("family_vibes").select("*").eq("user_id", user.id).maybeSingle(),
        // Itineraries can be large. Dashboard and trip-list cards only need trip metadata.
        supabase.from("trips").select(DASHBOARD_TRIP_SELECT).eq("user_id", user.id).order("created_at", { ascending: false }),
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
        // Keep the existing Trip shape for callers while deliberately omitting the
        // heavyweight JSON from the network response.
        trips: (tripsResult.data ?? []).map((trip) => ({ ...trip, itinerary: [] })) as Trip[],
        readinessByTrip,
        offline: false,
      }
      writeDashboardCache(user.id, data)
      return data
    } catch (error) {
      const cached = readDashboardCache(user.id)
      if (cached) return { ...cached, offline: true }
      throw error
    }
  })()

  dashboardRequests.set(user.id, request)
  try {
    return await request
  } finally {
    if (dashboardRequests.get(user.id) === request) dashboardRequests.delete(user.id)
  }
}

export function readFamilyPaceCache(userId: string): FamilyVibe["pace"] | null {
  return readCache<FamilyVibe["pace"]>(`family-pace:${userId}`)
    ?? readDashboardCache(userId)?.familyVibe?.pace
    ?? null
}

export async function loadFamilyPace(userId: string): Promise<FamilyVibe["pace"]> {
  const existing = familyPaceRequests.get(userId)
  if (existing) return existing

  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from("family_vibes")
        .select("pace")
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw error
      const pace = (data?.pace ?? "moderate") as FamilyVibe["pace"]
      writeCache(`family-pace:${userId}`, pace)
      return pace
    } catch {
      return readFamilyPaceCache(userId) ?? "moderate"
    }
  })()

  familyPaceRequests.set(userId, request)
  try {
    return await request
  } finally {
    if (familyPaceRequests.get(userId) === request) familyPaceRequests.delete(userId)
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
  const cached = readDashboardCache(userId)
  if (cached) writeDashboardCache(userId, { ...cached, profile: data as Profile })
  return data as Profile
}

export async function updateFamilyVibe(
  userId: string,
  vibe: Omit<FamilyVibe, "id" | "user_id">
) {
  const { data, error } = await supabase
    .from("family_vibes")
    .upsert(
      {
        user_id: userId,
        family_name: vibe.family_name?.trim() || null,
        kids: vibe.kids ?? [],
        travelers: vibe.travelers ?? [],
        travel_style: vibe.travel_style ?? [],
        sensory_needs: vibe.sensory_needs ?? [],
        mobility_notes: vibe.mobility_notes?.trim() || null,
        dietary: vibe.dietary ?? [],
        pace: vibe.pace,
        budget_preference: vibe.budget_preference,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single()

  if (error) throw error
  const cached = readDashboardCache(userId)
  if (cached) writeDashboardCache(userId, { ...cached, familyVibe: data as FamilyVibe })
  writeCache(`family-pace:${userId}`, (data as FamilyVibe).pace)
  return data as FamilyVibe
}

export function readTripCache(userId: string, tripId: string): TripData | null {
  const cached = readCache<{ trip: Trip; savedAttractions: SavedAttraction[] } | Trip>(`trip:${userId}:${tripId}`)
  if (!cached) return null
  if ("trip" in cached) return { ...cached, offline: false }
  return { trip: cached, savedAttractions: [], offline: false }
}

export async function loadTrip(userId: string, tripId: string) {
  const cacheKey = `trip:${userId}:${tripId}`
  const requestKey = `${userId}:${tripId}`
  const existing = tripRequests.get(requestKey)
  if (existing) return existing

  const request = (async (): Promise<TripData> => {
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
      const cached = readTripCache(userId, tripId)
      if (cached) return { ...cached, offline: true }
      throw error
    }
  })()

  tripRequests.set(requestKey, request)
  try {
    return await request
  } finally {
    if (tripRequests.get(requestKey) === request) tripRequests.delete(requestKey)
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
  const cacheKey = `trip:${userId}:${tripId}`
  const cached = readCache<{ trip: Trip; savedAttractions: SavedAttraction[] } | Trip>(cacheKey)
  if (cached && "trip" in cached) {
    const savedAttractions = cached.savedAttractions.filter((saved) => saved.id !== data.id)
    writeCache(cacheKey, { ...cached, savedAttractions: [...savedAttractions, data as SavedAttraction] })
  }
  return data as SavedAttraction
}

export interface GenerateItineraryOptions {
  instruction?: string
  dayDate?: string
  dayInstruction?: string
  dates?: string[]
  fastDraft?: boolean
}

export interface GenerateItineraryResult {
  itinerary: ItineraryDay[]
  inclusion?: {
    savedCount: number
    includedCount: number
    missingNames: string[]
    requestId: string
    generationMode?: "full" | "saved-picks-only"
  }
}

export async function generateTripItinerary(
  accessToken: string,
  tripId: string,
  options: GenerateItineraryOptions = {}
): Promise<GenerateItineraryResult> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"
  const response = await fetch(`${apiUrl}/api/trips/${tripId}/itinerary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "We couldn't build this itinerary right now.")
  return {
    itinerary: body.itinerary as ItineraryDay[],
    inclusion: body.inclusion,
  }
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
  const cacheKey = `trip:${userId}:${trip.id}`
  const cached = readCache<{ trip: Trip; savedAttractions: SavedAttraction[] } | Trip>(cacheKey)
  writeCache(cacheKey, {
    trip: data as Trip,
    savedAttractions: cached && "trip" in cached ? cached.savedAttractions : [],
  })
  return data as Trip
}

export async function updateTripDestination(
  userId: string,
  tripId: string,
  option: DestinationOption,
) {
  const destination = option.canonicalLabel.trim() || option.label.trim()
  if (!destination || !option.resolved) {
    throw new Error("Choose a verified destination before continuing.")
  }

  const { data, error } = await supabase
    .from("trips")
    .update({ destination, updated_at: new Date().toISOString() })
    .eq("id", tripId)
    .eq("user_id", userId)
    .select("*")
    .single()
  if (error) throw error

  const updatedTrip = data as Trip
  const cacheKey = `trip:${userId}:${tripId}`
  const cached = readCache<{ trip: Trip; savedAttractions: SavedAttraction[] } | Trip>(cacheKey)
  writeCache(cacheKey, {
    trip: updatedTrip,
    savedAttractions: cached && "trip" in cached ? cached.savedAttractions : [],
  })
  writeTripDestinationOption(userId, tripId, option)

  const dashboard = readDashboardCache(userId)
  if (dashboard) {
    writeDashboardCache(userId, {
      ...dashboard,
      trips: dashboard.trips.map((trip) => trip.id === tripId
        ? { ...trip, destination, updated_at: updatedTrip.updated_at }
        : trip),
    })
  }
  return updatedTrip
}

export interface CreateTripInput extends Pick<Trip, "title" | "destination" | "start_date" | "end_date"> {
  destinationOption?: DestinationOption
}

export async function createTrip(
  userId: string,
  input: CreateTripInput,
) {
  const destination = input.destinationOption?.canonicalLabel.trim()
    || input.destinationOption?.label.trim()
    || input.destination.trim()
  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: userId,
      title: input.title,
      destination,
      start_date: input.start_date,
      end_date: input.end_date,
      status: "planning",
      itinerary: [],
    })
    .select("*")
    .single()
  if (error) throw error
  const cached = readDashboardCache(userId)
  if (cached) {
    writeDashboardCache(userId, {
      ...cached,
      trips: [{ ...(data as Trip), itinerary: [] }, ...cached.trips.filter((trip) => trip.id !== data.id)],
    })
  }
  writeCache(`trip:${userId}:${data.id}`, { trip: data as Trip, savedAttractions: [] })
  writeTripDestinationOption(userId, data.id, input.destinationOption)
  return data as Trip
}
