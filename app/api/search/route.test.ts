import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DestinationAnchor, PlaceResult } from "@/lib/travel-apis/google-places"

const { resolveDestination, resolveDestinationPlaceId, searchVerifiedPlaces } = vi.hoisted(() => ({
  resolveDestination: vi.fn(),
  resolveDestinationPlaceId: vi.fn(),
  searchVerifiedPlaces: vi.fn(),
}))
const { enforceRateLimit } = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }))

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: { PROVIDER_SEARCH: "provider-search" },
  enforceRateLimit,
  rateLimitResponse: () => Response.json(
    { error: "Too many requests.", code: "RATE_LIMITED", retryAfter: 60 },
    { status: 429, headers: { "Retry-After": "60" } }
  ),
}))

vi.mock("@/lib/travel-apis/google-places", () => ({
  isConfigured: () => true,
  resolveDestination,
  resolveDestinationPlaceId,
  searchVerifiedPlaces,
}))

vi.mock("@/lib/attraction-images", () => ({
  getAttractionImage: (_category: string, name: string) => `/fallback/${name}.jpg`,
}))

vi.mock("@/lib/recommendation-personalization", () => ({
  getVibeDiscoveryQuery: () => "family culture",
  buildFamilyMatchExplanation: () => ({
    reason: "This matched your search. It adds a clear museum stop to the trip.",
    signals: [{ type: "general", label: "Museum match" }],
    tips: ["Confirm current hours and ticket requirements before visiting."],
    sensoryNotes: null,
    personalized: false,
  }),
}))

const anchor: DestinationAnchor = {
  label: "Nairobi, Kenya",
  canonicalLabel: "Nairobi, Kenya",
  city: "Nairobi",
  region: "Nairobi County",
  country: "Kenya",
  placeId: "nairobi-id",
  latitude: -1.286389,
  longitude: 36.817223,
  resolved: true,
  recognized: true,
  primaryType: "locality",
  types: ["locality"],
  radiusMeters: 75_000,
}

function place(id: string, name: string, latitude: number, longitude: number): PlaceResult {
  return {
    id,
    name,
    address: `${name}, Nairobi, Kenya`,
    latitude,
    longitude,
    rating: 4.7,
    userRatingCount: 120,
    priceLevel: "$$",
    openNow: true,
    weekdayHours: ["Monday: 9:00 AM – 5:00 PM"],
    photoUrl: `/api/place-photo?ref=${id}`,
    accessibleEntrance: true,
    googleMapsUri: `https://maps.google.com/?cid=${id}`,
    websiteUri: null,
    businessStatus: "OPERATIONAL",
    primaryType: "museum",
    primaryTypeLabel: "Museum",
    types: ["museum", "tourist_attraction"],
  }
}

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue({ allowed: true })
    resolveDestination.mockResolvedValue(anchor)
    resolveDestinationPlaceId.mockResolvedValue(anchor)
    searchVerifiedPlaces.mockResolvedValue([
      place("first-place", "First Museum", -1.2733, 36.8146),
      place("second-place", "Second Museum", -1.2812, 36.8219),
    ])
  })

  it("streams ordered places with coordinates before exactly one summary", async () => {
    const { POST } = await import("./route")
    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: "Nairobi, Kenya",
        destinationPlaceId: "nairobi-id",
        query: "museums",
        filters: {},
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-vibetravel-result-source")).toBe("google-places")

    const records = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    const summaries = records.filter((record) => typeof record.summary === "string")
    const places = records.filter((record) => typeof record.summary !== "string")

    expect(summaries).toHaveLength(1)
    expect(records.at(-1)).toEqual(summaries[0])
    expect(places.map((record) => record.googlePlaceId)).toEqual([
      "first-place",
      "second-place",
    ])
    expect(places[0]).toMatchObject({
      googlePlaceId: "first-place",
      latitude: -1.2733,
      longitude: 36.8146,
    })
    expect(places[1]).toMatchObject({
      googlePlaceId: "second-place",
      latitude: -1.2812,
      longitude: 36.8219,
    })
  })

  it("terminates a successful empty result with one summary record", async () => {
    searchVerifiedPlaces.mockResolvedValue([])
    const { POST } = await import("./route")
    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "Nairobi, Kenya", query: "rare request" }),
    }))

    expect(response.status).toBe(200)
    const records = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(records).toHaveLength(1)
    expect(records[0].summary).toMatch(/^0 Google-verified places in Nairobi, Kenya/)
  })

  it("rejects malformed and oversized bodies before calling Google", async () => {
    const { POST } = await import("./route")
    const malformed = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      body: "[]",
    }))
    const oversized = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({ destination: "x".repeat(33_000) }),
    }))

    expect(malformed.status).toBe(400)
    expect(oversized.status).toBe(413)
    expect(resolveDestination).not.toHaveBeenCalled()
    expect(searchVerifiedPlaces).not.toHaveBeenCalled()
  })

  it("returns 429 before paid provider work when the search limit is exhausted", async () => {
    enforceRateLimit.mockResolvedValueOnce({ allowed: false })
    const { POST } = await import("./route")

    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({ destination: "Nairobi, Kenya", query: "museums" }),
    }))

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    expect(resolveDestination).not.toHaveBeenCalled()
    expect(searchVerifiedPlaces).not.toHaveBeenCalled()
  })

  it("ignores a malformed provider place ID and sanitizes user search text", async () => {
    const { POST } = await import("./route")
    const response = await POST(new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: "Nairobi,\nKenya",
        destinationPlaceId: "not/a/place/id",
        query: "  family\u0000 museums  ",
      }),
    }))

    expect(response.status).toBe(200)
    expect(resolveDestinationPlaceId).not.toHaveBeenCalled()
    expect(resolveDestination).toHaveBeenCalledWith(
      "Nairobi, Kenya",
      expect.objectContaining({ timeoutMs: 6_000 })
    )
    expect(searchVerifiedPlaces).toHaveBeenCalledWith(
      "family museums",
      "Nairobi, Kenya",
      12,
      expect.any(Object)
    )
  })
})
