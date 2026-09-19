import { describe, expect, it } from "vitest"
import type { ItineraryDay } from "./types"
import {
  createDefaultReadiness,
  getReadinessStats,
  normalizeTripReadiness,
  reconcileBookings,
} from "./trip-readiness"

const itinerary: ItineraryDay[] = [
  {
    date: "2026-10-12",
    items: [
      { id: "museum", attraction_name: "Museum", start_time: "10:00", end_time: "12:00" },
      { id: "market", attraction_name: "Market", start_time: "13:00", end_time: "14:00" },
    ],
  },
]

describe("trip readiness", () => {
  it("starts with a useful private checklist", () => {
    const readiness = createDefaultReadiness()

    expect(readiness.currency).toBe("USD")
    expect(readiness.checklist.length).toBeGreaterThanOrEqual(5)
    expect(readiness.checklist.every((item) => !item.completed)).toBe(true)
  })

  it("normalizes unsafe or malformed stored values", () => {
    const readiness = normalizeTripReadiness({
      currency: "INVALID",
      budget_target: -50,
      bookings: { museum: { status: "unknown", cost: -2 } },
      checklist: [{ id: "one", label: "  Pack snacks  ", category: "invalid", completed: true }],
    })

    expect(readiness.currency).toBe("USD")
    expect(readiness.budget_target).toBeNull()
    expect(readiness.bookings.museum.status).toBe("unreviewed")
    expect(readiness.bookings.museum.cost).toBeNull()
    expect(readiness.checklist[0]).toMatchObject({ label: "Pack snacks", category: "other", completed: true })
  })

  it("calculates booking, checklist, and budget progress", () => {
    const readiness = createDefaultReadiness()
    readiness.budget_target = 500
    readiness.bookings = {
      museum: { status: "booked", cost: 120, confirmation_code: "ABC", booking_url: "" },
      market: { status: "not_needed", cost: null, confirmation_code: "", booking_url: "" },
    }
    readiness.checklist[0] = { ...readiness.checklist[0], completed: true, cost: 250 }

    const stats = getReadinessStats(readiness, itinerary)

    expect(stats.reviewedBookings).toBe(2)
    expect(stats.booked).toBe(1)
    expect(stats.trackedSpend).toBe(370)
    expect(stats.remainingBudget).toBe(130)
    expect(stats.completedTasks).toBe(1)
    expect(stats.progress).toBe(38)
  })

  it("excludes stale bookings after an itinerary changes", () => {
    const readiness = createDefaultReadiness()
    readiness.bookings = {
      museum: { status: "booked", cost: 100, confirmation_code: "", booking_url: "" },
      removed: { status: "booked", cost: 500, confirmation_code: "", booking_url: "" },
    }

    expect(Object.keys(reconcileBookings(itinerary, readiness.bookings))).toEqual(["museum"])
    expect(getReadinessStats(readiness, itinerary).trackedSpend).toBe(100)
  })

  it("preserves an intentionally empty checklist", () => {
    expect(normalizeTripReadiness({ checklist: [] }).checklist).toEqual([])
  })
})
