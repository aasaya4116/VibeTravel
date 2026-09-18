import { describe, expect, it } from "vitest"
import {
  estimateDurationHours,
  formatPlannedDate,
  getTripDateOptions,
} from "./trip-planning"
import type { TripOption } from "./types"

const baseTrip: TripOption = {
  id: "trip-1",
  title: "New York Weekend",
  destination: "New York, NY",
  start_date: "2026-10-02",
  end_date: "2026-10-04",
}

describe("trip planning date helpers", () => {
  it("builds one labeled option per trip day", () => {
    expect(getTripDateOptions(baseTrip)).toEqual([
      { value: "2026-10-02", label: "Day 1 · Fri, Oct 2" },
      { value: "2026-10-03", label: "Day 2 · Sat, Oct 3" },
      { value: "2026-10-04", label: "Day 3 · Sun, Oct 4" },
    ])
  })

  it("returns no options until both trip dates exist", () => {
    expect(getTripDateOptions({ ...baseTrip, end_date: null })).toEqual([])
  })

  it("formats a saved planning date", () => {
    expect(formatPlannedDate("2026-10-03")).toBe("Sat, Oct 3")
  })

  it("uses the longer end of a duration range when estimating a day", () => {
    expect(estimateDurationHours("2–4 hours")).toBe(4)
    expect(estimateDurationHours("30 minutes to 1 hour")).toBe(1)
  })

  it("handles full days, minutes, and missing estimates", () => {
    expect(estimateDurationHours("Full day")).toBe(8)
    expect(estimateDurationHours("45 mins")).toBe(0.75)
    expect(estimateDurationHours()).toBe(2)
  })
})
