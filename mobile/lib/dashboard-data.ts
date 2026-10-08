import type { ItineraryDay, TripReadinessState } from "./types"

export const DASHBOARD_TRIP_SELECT = "id,user_id,title,destination,start_date,end_date,accommodation_area,status,created_at,updated_at"

export function getReadinessPercent(state: TripReadinessState | undefined, itinerary: ItineraryDay[]) {
  if (!state) return 0
  const bookingItems = itinerary.flatMap((day) => day.items)
  const bookingValues = bookingItems.length
    ? bookingItems.map((item) => state.bookings[item.id]?.status === "booked")
    : Object.values(state.bookings).map((booking) => booking.status === "booked")
  const checklistValues = (state.checklist ?? []).map((item) => item.completed)
  const all = [...bookingValues, ...checklistValues]
  if (all.length === 0) return 0
  return Math.round((all.filter(Boolean).length / all.length) * 100)
}
