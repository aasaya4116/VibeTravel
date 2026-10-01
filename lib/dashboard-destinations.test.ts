import { describe, expect, it } from "vitest"
import {
  findDashboardDestinationCard,
  getDashboardDestinationPhotoUrl,
  getDashboardExploreUrl,
  getDashboardDestinationOptions,
  normalizeDestination,
  splitDestination,
} from "./dashboard-destinations"

describe("dashboard destination selection", () => {
  it("normalizes punctuation and spacing for reliable matching", () => {
    expect(normalizeDestination("  Tokyo, Japan ")).toBe("tokyo japan")
    expect(normalizeDestination("Washington, D.C.")).toBe("washington d c")
  })

  it("splits the city from its supporting region", () => {
    expect(splitDestination("Lisbon, Portugal")).toEqual({
      city: "Lisbon",
      region: "Portugal",
    })
    expect(splitDestination("Singapore")).toEqual({ city: "Singapore", region: "" })
  })

  it("matches curated cards using either the full destination or city", () => {
    expect(findDashboardDestinationCard("Tokyo, Japan")?.name).toBe("Tokyo")
    expect(findDashboardDestinationCard("Tokyo")?.name).toBe("Tokyo")
    expect(findDashboardDestinationCard("Washington, DC")).toBeNull()
  })

  it("puts recent locations first and removes duplicates", () => {
    const options = getDashboardDestinationOptions([
      "Washington, DC",
      "Tokyo, Japan",
      "Washington, DC",
    ])

    expect(options.slice(0, 2).map((option) => option.label)).toEqual([
      "Washington, DC",
      "Tokyo, Japan",
    ])
    expect(
      options.filter((option) => option.label === "Washington, DC")
    ).toHaveLength(1)
  })

  it("filters by either city or country", () => {
    expect(
      getDashboardDestinationOptions([], "portugal").map((option) => option.label)
    ).toContain("Lisbon, Portugal")
  })

  it("gives every destination a server-proxied image fallback", () => {
    expect(getDashboardDestinationPhotoUrl("Tulum, Mexico")).toBe(
      "/api/destination-photo?destination=Tulum%2C%20Mexico"
    )

    const tulum = getDashboardDestinationOptions([], "Tulum")[0]
    expect(tulum.imageUrl).toBe(tulum.fallbackImageUrl)
  })

  it("routes curated and non-curated destinations through Explore", () => {
    expect(getDashboardExploreUrl("Tokyo, Japan")).toMatch(
      /^\/search\?dest=Tokyo%2C\+Japan&q=/
    )
    expect(getDashboardExploreUrl("Tulum, Mexico")).toBe(
      "/search?dest=Tulum%2C+Mexico"
    )
  })
})
