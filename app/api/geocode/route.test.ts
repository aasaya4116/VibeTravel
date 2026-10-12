import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { enforceRateLimit, searchVerifiedPlaces } = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  searchVerifiedPlaces: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: { PROVIDER_SEARCH: "provider-search" },
  enforceRateLimit,
  rateLimitResponse: () =>
    Response.json({ error: "Too many requests." }, { status: 429 }),
}))
vi.mock("@/lib/travel-apis/google-places", () => ({ searchVerifiedPlaces }))

describe("fallback geocode API", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("sanitizes location text and returns verified provider coordinates", async () => {
    enforceRateLimit.mockResolvedValue({ allowed: true })
    searchVerifiedPlaces.mockResolvedValue([
      { latitude: -1.2833, longitude: 36.8167 },
    ])
    const { GET } = await import("./route")

    const response = await GET(
      new NextRequest(
        "http://localhost/api/geocode?place=City%0AMarket&dest=Nairobi%2C%20Kenya"
      )
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.results["City Market"]).toEqual({
      lat: -1.2833,
      lng: 36.8167,
    })
    expect(searchVerifiedPlaces).toHaveBeenCalledWith(
      "City Market",
      "Nairobi, Kenya",
      1,
      expect.objectContaining({ destinationAnchor: null, timeoutMs: 4_000 })
    )
  })

  it("charges each fallback place before starting any provider work", async () => {
    enforceRateLimit
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false })
    const { GET } = await import("./route")

    const response = await GET(
      new NextRequest(
        "http://localhost/api/geocode?place=City%20Market&place=National%20Museum&dest=Nairobi"
      )
    )

    expect(response.status).toBe(429)
    expect(enforceRateLimit).toHaveBeenCalledTimes(2)
    expect(searchVerifiedPlaces).not.toHaveBeenCalled()
  })

  it("does not expose invalid coordinates from the provider", async () => {
    enforceRateLimit.mockResolvedValue({ allowed: true })
    searchVerifiedPlaces.mockResolvedValue([
      { latitude: 999, longitude: 36.8167 },
    ])
    const { GET } = await import("./route")

    const response = await GET(
      new NextRequest(
        "http://localhost/api/geocode?place=City%20Market&dest=Nairobi"
      )
    )
    const payload = await response.json()

    expect(payload.results["City Market"]).toBeNull()
  })

  it("surfaces provider outages so the map can offer a retry", async () => {
    enforceRateLimit.mockResolvedValue({ allowed: true })
    searchVerifiedPlaces.mockRejectedValue(new Error("Provider unavailable"))
    const { GET } = await import("./route")

    const response = await GET(
      new NextRequest(
        "http://localhost/api/geocode?place=City%20Market&dest=Nairobi"
      )
    )

    expect(response.status).toBe(502)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
})
