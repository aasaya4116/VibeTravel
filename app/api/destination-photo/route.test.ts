import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

describe("destination photo proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.doUnmock("@/lib/supabase/request")
    vi.doUnmock("@/lib/travel-apis/google-places")
    vi.doUnmock("@/lib/rate-limit")
  })

  it("forwards clamped dimensions to the resolved place photo", async () => {
    vi.doMock("@/lib/rate-limit", () => ({
      RATE_LIMIT_TIERS: { PROVIDER_SEARCH: "provider-search" },
      enforceRateLimit: vi.fn().mockResolvedValue({
        allowed: true,
        headers: { "RateLimit-Remaining": "11" },
      }),
      rateLimitResponse: vi.fn(),
    }))
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    }))
    vi.doMock("@/lib/travel-apis/google-places", () => ({
      isConfigured: () => true,
      searchVerifiedPlaces: vi.fn().mockResolvedValue([
        { photoUrl: null },
        { photoUrl: "/api/place-photo?ref=places%2Fabc%2Fphotos%2F123" },
      ]),
    }))
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      "http://localhost/api/destination-photo?destination=Tokyo&width=99999&height=1"
    ))
    const location = new URL(response.headers.get("location")!)

    expect(response.status).toBe(307)
    expect(location.pathname).toBe("/api/place-photo")
    expect(location.searchParams.get("ref")).toBe("places/abc/photos/123")
    expect(location.searchParams.get("width")).toBe("1600")
    expect(location.searchParams.get("height")).toBe("64")
    expect(response.headers.get("RateLimit-Remaining")).toBe("11")
  })

  it("rejects unauthenticated requests inside the route", async () => {
    const searchVerifiedPlaces = vi.fn()
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({ user: null }),
    }))
    vi.doMock("@/lib/travel-apis/google-places", () => ({
      isConfigured: () => true,
      searchVerifiedPlaces,
    }))
    const enforceRateLimit = vi.fn()
    vi.doMock("@/lib/rate-limit", () => ({
      RATE_LIMIT_TIERS: { PROVIDER_SEARCH: "provider-search" },
      enforceRateLimit,
      rateLimitResponse: vi.fn(),
    }))
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      "http://localhost/api/destination-photo?destination=Tokyo"
    ))

    expect(response.status).toBe(401)
    expect(searchVerifiedPlaces).not.toHaveBeenCalled()
    expect(enforceRateLimit).not.toHaveBeenCalled()
  })

  it("stops before the provider when the request exceeds its quota", async () => {
    const searchVerifiedPlaces = vi.fn()
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    }))
    vi.doMock("@/lib/travel-apis/google-places", () => ({
      isConfigured: () => true,
      searchVerifiedPlaces,
    }))
    vi.doMock("@/lib/rate-limit", () => ({
      RATE_LIMIT_TIERS: { PROVIDER_SEARCH: "provider-search" },
      enforceRateLimit: vi.fn().mockResolvedValue({
        allowed: false,
        status: 429,
        body: { error: "Too many requests" },
        headers: { "Retry-After": "60" },
      }),
      rateLimitResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
      ),
    }))
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      "http://localhost/api/destination-photo?destination=Tokyo"
    ))

    expect(response.status).toBe(429)
    expect(searchVerifiedPlaces).not.toHaveBeenCalled()
  })
})
