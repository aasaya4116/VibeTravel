import { describe, expect, it } from "vitest"

import { scrubSentryEvent, scrubSentryText } from "./sentry-privacy"

describe("Sentry privacy scrubber", () => {
  it("removes traveler identifiers and URL parameters", () => {
    expect(scrubSentryText(
      "https://example.com/api/trips/870d225d-d2f1-441d-9288-bf91f9355405?destination=Lagos aasay412@gmail.com",
    )).toBe("https://example.com/api/trips/[trip_id] [email]")
  })

  it("drops identity and request contents while retaining a safe route shape", () => {
    const event = scrubSentryEvent({
      message: "failed for Adebowale",
      transaction: "/api/trips/870d225d-d2f1-441d-9288-bf91f9355405/itinerary?mode=full",
      user: { id: "traveler-1", email: "aasay412@gmail.com" },
      request: {
        url: "https://example.com/api/search?destination=Lagos",
        headers: { authorization: "Bearer secret" },
        data: { prompt: "private family details" },
        cookies: { session: "secret" },
        query_string: "destination=Lagos",
      },
      extra: { destination: "Lagos", result_count: 4 },
    } as unknown as Parameters<typeof scrubSentryEvent>[0])

    expect(event.user).toBeUndefined()
    expect(event.message).toBe("[redacted error message]")
    expect(event.transaction).toBe("/api/trips/[trip_id]/itinerary")
    expect(event.request).toMatchObject({
      url: "https://example.com/api/search",
      headers: undefined,
      data: undefined,
      cookies: undefined,
      query_string: undefined,
    })
    expect(event.extra).toEqual({ destination: "[redacted]", result_count: 4 })
  })
})
