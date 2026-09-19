import { describe, expect, it } from "vitest"
import { buildOfflineTripHtml, getDepartureStatus, offlineTripFilename } from "./departure-center"
import { createDefaultReadiness } from "./trip-readiness"
import type { Trip } from "./types"

const trip: Trip = {
  id: "trip-1",
  user_id: "user-1",
  title: "Tokyo <Adventure>",
  destination: "Tokyo, Japan",
  start_date: "2026-10-20",
  end_date: "2026-10-24",
  accommodation_area: "Shinjuku",
  status: "planning",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  itinerary: [
    {
      date: "2026-10-20",
      items: [
        {
          id: "museum",
          attraction_name: "Museum & Gardens",
          start_time: "10:00 AM",
          end_time: "12:00 PM",
          notes: "PRIVATE-NOTE-999",
          attraction_data: {
            name: "Museum & Gardens",
            description: "A museum",
            category: "Museum",
            vibes: [],
            ageRange: "All",
            strollerFriendly: true,
            estimatedDuration: "2 hours",
            priceRange: "$$",
            location: "Ueno",
          },
        },
      ],
    },
  ],
}

describe("departure center", () => {
  it("moves from planning to final checks as departure approaches", () => {
    const readiness = createDefaultReadiness()

    expect(getDepartureStatus(trip, readiness, new Date("2026-09-01T12:00:00")).phase).toBe("planning")
    expect(getDepartureStatus(trip, readiness, new Date("2026-10-01T12:00:00")).phase).toBe("booking")
    expect(getDepartureStatus(trip, readiness, new Date("2026-10-18T12:00:00")).phase).toBe("final_checks")
    expect(getDepartureStatus(trip, readiness, new Date("2026-10-20T12:00:00")).phase).toBe("departure_day")
  })

  it("only reports ready when bookings and checklist are resolved", () => {
    const readiness = createDefaultReadiness()
    readiness.bookings.museum = {
      status: "booked",
      cost: 45,
      confirmation_code: "SECRET-CODE-123",
      booking_url: "https://private.example/reservation",
    }
    readiness.checklist = readiness.checklist.map((item) => ({ ...item, completed: true }))

    expect(getDepartureStatus(trip, readiness, new Date("2026-10-18T12:00:00")).ready).toBe(true)
  })

  it("creates a standalone pack without private readiness or notes", () => {
    const readiness = createDefaultReadiness()
    readiness.bookings.museum = {
      status: "booked",
      cost: 45,
      confirmation_code: "SECRET-CODE-123",
      booking_url: "https://private.example/reservation",
    }

    const html = buildOfflineTripHtml(trip, readiness, new Date("2026-10-01T12:00:00"))

    expect(html).toContain("Museum &amp; Gardens")
    expect(html).toContain("Ueno")
    expect(html).toContain("10:00 AM")
    expect(html).not.toContain("SECRET-CODE-123")
    expect(html).not.toContain("private.example")
    expect(html).not.toContain("PRIVATE-NOTE-999")
    expect(html).not.toContain(">45<")
  })

  it("escapes user text and creates a safe filename", () => {
    const html = buildOfflineTripHtml(trip, createDefaultReadiness())

    expect(html).toContain("Tokyo &lt;Adventure&gt;")
    expect(html).not.toContain("<Adventure>")
    expect(offlineTripFilename("Tokyo: Family Trip! 2026")).toBe("tokyo-family-trip-2026-offline.html")
  })
})
