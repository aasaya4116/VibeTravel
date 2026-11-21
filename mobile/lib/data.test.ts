import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("./supabase", () => ({ supabase: {} }))
vi.mock("./observability", () => ({ startOperationTiming: vi.fn() }))

import { cacheTripItinerary, readTripCache } from "./data"
import { DASHBOARD_TRIP_SELECT, getReadinessPercent } from "./dashboard-data"

describe("mobile dashboard data", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps heavyweight itinerary JSON out of the dashboard trip query", () => {
    expect(DASHBOARD_TRIP_SELECT.split(",")).not.toContain("itinerary")
  })

  it("calculates readiness from stored bookings when summary trips omit itineraries", () => {
    expect(getReadinessPercent({
      currency: "USD",
      budget_target: null,
      bookings: {
        hotel: { status: "booked" },
        museum: { status: "pending" },
      },
      checklist: [
        { id: "passport", completed: true },
        { id: "packing", completed: false },
      ],
    }, [])).toBe(50)
  })

  it("caches a generated itinerary before the trip screen opens", () => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
    const trip = {
      id: "trip-1",
      user_id: "user-1",
      title: "Tokyo family trip",
      destination: "Tokyo, Japan",
      start_date: "2027-04-01",
      end_date: "2027-04-03",
      accommodation_area: null,
      status: "planning" as const,
      itinerary: [],
      created_at: "2026-11-21T00:00:00.000Z",
      updated_at: "2026-11-21T00:00:00.000Z",
    }
    const itinerary = [{ date: "2027-04-01", items: [{
      id: "stop-1",
      attraction_name: "TeamLab Planets",
      start_time: "09:00",
      end_time: "11:00",
      recommended: false,
    }] }]

    cacheTripItinerary("user-1", trip, itinerary)

    expect(readTripCache("user-1", "trip-1")?.trip.itinerary).toEqual(itinerary)
  })
})
