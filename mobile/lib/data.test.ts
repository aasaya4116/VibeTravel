import { describe, expect, it } from "vitest"
import { DASHBOARD_TRIP_SELECT, getReadinessPercent } from "./dashboard-data"

describe("mobile dashboard data", () => {
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
})
