import { describe, expect, it, vi } from "vitest"
import type { Event } from "@sentry/react-native"
import * as Sentry from "@sentry/react-native"

vi.mock("@sentry/react-native", () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  startInactiveSpan: vi.fn(() => ({
    end: vi.fn(),
    setAttributes: vi.fn(),
    setStatus: vi.fn(),
  })),
}))

import {
  sanitizeObservabilityAttributes,
  initializeObservability,
  scrubObservabilityText,
  scrubSentryEvent,
} from "./observability"

describe("mobile observability privacy", () => {
  it("normalizes private routes and removes query strings and tokens", () => {
    expect(scrubObservabilityText(
      "POST https://vibetravel.test/api/trips/870d225d-d2f1-441d-9288-bf91f9355405/itinerary?destination=Lagos"
    )).toBe("POST https://vibetravel.test/api/trips/[trip_id]/itinerary")

    expect(scrubObservabilityText(
      "Open https://vibetravel.test/share/a_long_private_share_token_123?preview=true"
    )).toBe("Open https://vibetravel.test/share/[share_token]")

    expect(scrubObservabilityText(
      "POST /api/trips/870d225d-d2f1-441d-9288-bf91f9355405/itinerary?query=food"
    )).toBe("POST /api/trips/[trip_id]/itinerary")
  })

  it("removes request payloads, identity, auth headers, and sensitive context", () => {
    const event = scrubSentryEvent({
      user: { id: "person-1", email: "traveler@example.com" },
      message: "Search failed for Lagos",
      request: {
        url: "https://vibetravel.test/trips/870d225d-d2f1-441d-9288-bf91f9355405?query=food",
        headers: {
          Authorization: "Bearer private-access-token",
          Cookie: "session=private",
          "Content-Type": "application/json",
        },
        data: { destination: "Lagos", familyVibe: { kids: [8] } },
        query_string: "query=food",
        cookies: { session: "private" },
      },
      extra: {
        destination: "Lagos",
        query: "family-friendly food",
        tripId: "870d225d-d2f1-441d-9288-bf91f9355405",
        safe: "https://vibetravel.test/share/a_long_private_share_token_123",
      },
      exception: {
        values: [{ type: "Error", value: "Lagos failed" }],
      },
    } as Event)

    expect(event.user).toBeUndefined()
    expect(event.message).toBe("[redacted error message]")
    expect(event.request?.url).toBe("https://vibetravel.test/trips/[trip_id]")
    expect(event.request?.headers).toEqual({ "Content-Type": "application/json" })
    expect(event.request?.data).toBeUndefined()
    expect(event.request?.query_string).toBeUndefined()
    expect(event.extra).toEqual({
      destination: "[redacted]",
      query: "[redacted]",
      tripId: "[redacted]",
      safe: "https://vibetravel.test/share/[share_token]",
    })
    expect(event.exception?.values?.[0]?.value).toBe("[redacted error message]")
  })

  it("keeps only low-cardinality allowlisted measurements", () => {
    const attributes = sanitizeObservabilityAttributes(Object.assign({
      cache_hit: true,
      offline: false,
      http_status: 200,
    }, {
      destination: "Lagos",
      query: "food",
      trip_id: "private",
    }) as never)

    expect(attributes).toEqual({ cache_hit: true, offline: false, http_status: 200 })
  })

  it("initializes production telemetry with privacy-safe sampling", () => {
    const previousDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.ingest.sentry.io/1"
    vi.stubGlobal("__DEV__", false)

    expect(initializeObservability()).toBe(true)
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      sampleRate: 1,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      maxBreadcrumbs: 0,
    }))

    vi.unstubAllGlobals()
    if (previousDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN
    else process.env.EXPO_PUBLIC_SENTRY_DSN = previousDsn
  })
})
