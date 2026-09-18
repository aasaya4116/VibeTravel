import { describe, expect, it } from "vitest"
import type { ItineraryDay } from "./types"
import {
  distanceBetweenKm,
  estimateTravelMinutes,
  getTravelSegments,
  optimizeDayForTravel,
  parseTimeToMinutes,
} from "./itinerary-logistics"

const locations = {
  Museum: { lat: 40.7813, lng: -73.974 },
  Park: { lat: 40.7678, lng: -73.9718 },
  Cafe: { lat: 40.775, lng: -73.98 },
}

const day: ItineraryDay = {
  date: "2026-10-02",
  items: [
    { id: "museum", attraction_name: "Museum", start_time: "09:00", end_time: "11:00" },
    { id: "park", attraction_name: "Park", start_time: "11:05", end_time: "12:05" },
  ],
}

describe("itinerary logistics", () => {
  it("parses 24-hour and 12-hour times", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570)
    expect(parseTimeToMinutes("2:15 PM")).toBe(855)
    expect(parseTimeToMinutes("12 AM")).toBe(0)
  })

  it("estimates distance and mode-specific travel time", () => {
    const distance = distanceBetweenKm(locations.Museum, locations.Park)
    expect(distance).toBeGreaterThan(1)
    expect(estimateTravelMinutes(distance, "walking")).toBeGreaterThan(
      estimateTravelMinutes(distance, "driving")
    )
  })

  it("flags a connection that does not leave enough travel time", () => {
    const [segment] = getTravelSegments(day, locations, "walking")
    expect(segment.status).toBe("tight")
    expect(segment.gapMinutes).toBe(5)
  })

  it("optimizes nearby stops and rebuilds times with travel buffers", () => {
    const unoptimized: ItineraryDay = {
      date: day.date,
      items: [
        day.items[0],
        day.items[1],
        { id: "cafe", attraction_name: "Cafe", start_time: "12:00", end_time: "13:00" },
      ],
    }
    const optimized = optimizeDayForTravel(unoptimized, locations, "walking")
    expect(optimized.items.map((item) => item.id)).toEqual(["museum", "cafe", "park"])
    expect(parseTimeToMinutes(optimized.items[1].start_time)).toBeGreaterThan(
      parseTimeToMinutes(optimized.items[0].end_time)!
    )
  })
})
