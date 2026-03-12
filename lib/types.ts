export interface Kid {
  name: string
  age: number
  sensoryNeeds?: string[]
}

export interface FamilyVibe {
  id: string
  user_id: string
  family_name: string | null
  kids: Kid[]
  travel_style: string[]
  sensory_needs: string[]
  mobility_notes: string | null
  dietary: string[]
  pace: "slow" | "moderate" | "fast"
  budget_preference: "free" | "$" | "$$" | "$$$" | "any"
  created_at: string
  updated_at: string
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

export interface ItineraryDay {
  date: string
  items: ItineraryItem[]
}

export interface ItineraryItem {
  id: string
  attraction_name: string
  start_time: string
  end_time: string
  notes?: string
  recommended?: boolean
  attraction_data?: Attraction
}

export interface Attraction {
  name: string
  description: string
  category: string
  vibes: string[]
  ageRange: string
  strollerFriendly: boolean
  sensoryNotes?: string
  estimatedDuration: string
  priceRange: string
  location: string
  imageUrl?: string
  rating?: number
  tips?: string[]
  // Real-data enrichment fields (present when API keys are configured)
  openNow?: boolean | null
  weekdayHours?: string[] | null
  googleMapsUri?: string | null
  accessibleEntrance?: boolean | null
  yelpUrl?: string
  yelpReviewCount?: number
  _sources?: { image: "google" | "wikipedia" | "yelp" | "fallback"; rating: "google" | "yelp" | "ai" }
}

export interface SavedAttraction {
  id: string
  user_id: string
  trip_id: string | null
  attraction_name: string
  attraction_data: Attraction
  notes: string | null
  created_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}
