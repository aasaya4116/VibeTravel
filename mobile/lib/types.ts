export interface Kid {
  name: string
  age: number
  sensoryNeeds?: string[]
}

export interface Traveler {
  name: string
  role: "partner" | "adult" | "grandparent" | "extended_family" | "friend"
  age?: number | null
}

export interface FamilyVibe {
  id: string
  user_id: string
  family_name: string | null
  kids: Kid[]
  travelers?: Traveler[]
  travel_style: string[]
  sensory_needs: string[]
  mobility_notes: string | null
  dietary: string[]
  pace: "slow" | "moderate" | "fast"
  budget_preference: "free" | "$" | "$$" | "$$$" | "any"
}

export interface Attraction {
  googlePlaceId?: string
  name: string
  description: string
  category: string
  location: string
  imageUrl?: string
  googleMapsUri?: string | null
  familyFitReason?: string
  familyFitSignals?: Array<{
    type: "age" | "sensory" | "pace" | "style" | "budget" | "dietary" | "general"
    label: string
  }>
  vibes?: string[]
  ageRange?: string
  strollerFriendly?: boolean | null
  sensoryNotes?: string
  estimatedDuration?: string
  priceRange?: string | null
  rating?: number
  userRatingCount?: number | null
  tips?: string[]
  personalizedForFamily?: boolean
  verifiedPlace?: boolean
  websiteUri?: string | null
  accessibleEntrance?: boolean | null
  primaryType?: string | null
  plannedDate?: string | null
}

export interface SavedAttraction {
  id: string
  user_id: string
  trip_id: string | null
  attraction_name: string
  attraction_data: Attraction
  created_at: string
}

export interface ItineraryItem {
  id: string
  attraction_name: string
  start_time: string
  end_time: string
  notes?: string
  recommended?: boolean
  item_type?: "place" | "neighborhood" | "meal" | "downtime"
  fit_signals?: string[]
  status?: "planned" | "completed" | "skipped"
  attraction_data?: Attraction
}

export interface ItineraryDay {
  date: string
  items: ItineraryItem[]
}

export interface Trip {
  id: string
  user_id: string
  title: string
  destination: string
  start_date: string | null
  end_date: string | null
  accommodation_area: string | null
  status: "planning" | "active" | "completed"
  itinerary: ItineraryDay[]
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export interface TripReadinessState {
  currency: string
  budget_target: number | null
  bookings: Record<string, { status?: string }>
  checklist: Array<{ id: string; completed: boolean }>
}

export interface DashboardData {
  profile: Profile | null
  familyVibe: FamilyVibe | null
  trips: Trip[]
  readinessByTrip: Record<string, TripReadinessState>
  offline: boolean
}
