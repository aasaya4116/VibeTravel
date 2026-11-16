import { describe, expect, it } from "vitest"
import { buildSharedTripMetadata } from "@/lib/shared-trip-metadata"

describe("buildSharedTripMetadata", () => {
  it("puts the trip name and destination in compact link previews", () => {
    const metadata = buildSharedTripMetadata({
      title: "Salvador Art Trip",
      destination: "Salvador, Bahia, Brazil",
    })

    expect(metadata.title).toBe(
      "Salvador Art Trip — Salvador, Bahia, Brazil | VibeTravel"
    )
    expect(metadata.description).toBe(
      "A shared VibeTravel itinerary for Salvador, Bahia, Brazil."
    )
    expect(metadata.openGraph).toMatchObject({
      title: "Salvador Art Trip — Salvador, Bahia, Brazil",
      description: "A shared VibeTravel itinerary for Salvador, Bahia, Brazil.",
      siteName: "VibeTravel",
      type: "website",
    })
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Salvador Art Trip — Salvador, Bahia, Brazil",
      description: "A shared VibeTravel itinerary for Salvador, Bahia, Brazil.",
    })
  })

  it("keeps shared trips out of search engines and strips referrers", () => {
    const metadata = buildSharedTripMetadata({
      title: "Tokyo Family Week",
      destination: "Tokyo, Japan",
    })

    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.referrer).toBe("no-referrer")
  })
})
