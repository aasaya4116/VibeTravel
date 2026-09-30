import { describe, expect, it } from "vitest"
import type { ItineraryDay } from "./types"
import { assessDayPace, cleanFitSignals, enforcePaceLimit } from "./itinerary-intelligence"

function item(id: string, recommended: boolean, itemType: "place" | "neighborhood" | "meal" = "place") {
  return {
    id,
    attraction_name: id,
    start_time: "09:00",
    end_time: "10:30",
    recommended,
    item_type: itemType,
  }
}

describe("itinerary intelligence", () => {
  it("keeps every traveler pick while limiting optional suggestions for a moderate day", () => {
    const day: ItineraryDay = {
      date: "2026-10-02",
      items: [
        item("pick-1", false),
        item("pick-2", false),
        item("pick-3", false),
        item("extra-place", true),
        item("walkable-area", true, "neighborhood"),
        item("extra-meal", true, "meal"),
      ],
    }

    const paced = enforcePaceLimit(day, "moderate")
    expect(paced.items.map((candidate) => candidate.id)).toEqual([
      "pick-1",
      "pick-2",
      "pick-3",
      "walkable-area",
    ])
  })

  it("reports a day that exceeds the selected pace", () => {
    const day: ItineraryDay = {
      date: "2026-10-02",
      items: [item("1", false), item("2", false), item("3", false), item("4", false)],
    }
    expect(assessDayPace(day, "slow")).toMatchObject({ fits: false, stopOverage: 1 })
  })

  it("does not add optional stops when traveler picks already consume the time budget", () => {
    const longItem = (id: string, recommended: boolean) => ({
      ...item(id, recommended),
      start_time: "09:00",
      end_time: "11:00",
    })
    const day: ItineraryDay = {
      date: "2026-10-02",
      items: [
        longItem("pick-1", false),
        longItem("pick-2", false),
        longItem("pick-3", false),
        longItem("optional", true),
      ],
    }

    expect(enforcePaceLimit(day, "moderate").items.map((candidate) => candidate.id))
      .toEqual(["pick-1", "pick-2", "pick-3"])
  })

  it("keeps fit signals short and scannable", () => {
    expect(cleanFitSignals([" Foodie family ", "Age 8–12", "Moderate pace", "Extra"]))
      .toEqual(["Foodie family", "Age 8–12", "Moderate pace"])
  })
})
