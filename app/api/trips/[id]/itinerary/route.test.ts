import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/itinerary-editing", () => ({
  ensureSavedAttractionsInDay: vi.fn(),
  mergeItinerarySection: vi.fn(),
  mergeRegeneratedDay: vi.fn(),
  pinSavedAttractionsToDates: vi.fn(),
  reconcileSavedAttractionsInItinerary: vi.fn(),
}))
vi.mock("@/lib/itinerary-batching", () => ({
  assignAttractionsToBatches: vi.fn(),
  batchTripDates: vi.fn(),
  enumerateTripDates: vi.fn(),
  MAX_GENERATION_DAYS: 14,
  MAX_ITINERARY_DAYS: 60,
}))
vi.mock("@/lib/itinerary-intelligence", () => ({
  cleanFitSignals: vi.fn(),
  enforcePaceLimit: vi.fn(),
  PACE_GUIDES: {},
}))
vi.mock("@/lib/itinerary-draft", () => ({
  buildSavedPicksDraft: vi.fn(),
  mergeSavedPicksIntoItinerary: vi.fn(),
}))
vi.mock("@/lib/travel-apis/openweather", () => ({
  getWeatherForecast: vi.fn(),
}))

describe("itinerary generation launch protection", () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.doUnmock("@/lib/supabase/request")
    vi.doUnmock("@/lib/rate-limit")
  })

  it("rejects signed-out requests before reading the request body", async () => {
    const enforceRateLimit = vi.fn()
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({
        supabase: {},
        user: null,
      }),
    }))
    vi.doMock("@/lib/rate-limit", () => ({
      RATE_LIMIT_TIERS: {
        ITINERARY_GENERATION: "itinerary-generation",
        ITINERARY_DRAFT: "itinerary-draft",
      },
      enforceRateLimit,
      rateLimitResponse: vi.fn(),
    }))
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/trips/trip-1/itinerary", {
      method: "POST",
      body: "not-json",
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: "trip-1" }),
    })

    expect(response.status).toBe(401)
    expect(enforceRateLimit).not.toHaveBeenCalled()
  })

  it("stops before database and model work when the quota is exhausted", async () => {
    const from = vi.fn()
    const rateLimitResponse = vi.fn().mockReturnValue(
      Response.json(
        { error: "Too many itinerary requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    )
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({
        supabase: { from },
        user: { id: "user-1" },
      }),
    }))
    vi.doMock("@/lib/rate-limit", () => ({
      RATE_LIMIT_TIERS: {
        ITINERARY_GENERATION: "itinerary-generation",
        ITINERARY_DRAFT: "itinerary-draft",
      },
      enforceRateLimit: vi.fn().mockResolvedValue({
        allowed: false,
        status: 429,
        body: { error: "Too many itinerary requests" },
        headers: { "Retry-After": "60" },
      }),
      rateLimitResponse,
    }))
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/trips/trip-1/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: "trip-1" }),
    })

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
    expect(from).not.toHaveBeenCalled()
    expect(rateLimitResponse).toHaveBeenCalledOnce()
  })

  it("rejects malformed itinerary instructions before database or model work", async () => {
    const from = vi.fn()
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({
        supabase: { from },
        user: { id: "user-1" },
      }),
    }))
    const enforceRateLimit = vi.fn().mockResolvedValue({
      allowed: true,
      headers: { "RateLimit-Remaining": "5" },
    })
    vi.doMock("@/lib/rate-limit", () => ({
      RATE_LIMIT_TIERS: {
        ITINERARY_GENERATION: "itinerary-generation",
        ITINERARY_DRAFT: "itinerary-draft",
      },
      enforceRateLimit,
      rateLimitResponse: vi.fn(),
    }))
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/trips/trip-1/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: ["not-a-date"], unexpected: true }),
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: "trip-1" }),
    })

    expect(response.status).toBe(400)
    expect(from).not.toHaveBeenCalled()
    expect(enforceRateLimit).not.toHaveBeenCalled()
  })

  it("uses the relaxed local-draft quota for deterministic fast drafts", async () => {
    const from = vi.fn()
    const enforceRateLimit = vi.fn().mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "30" },
    })
    const rateLimitResponse = vi
      .fn()
      .mockReturnValue(
        Response.json({ error: "Too many draft requests" }, { status: 429 })
      )
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({
        supabase: { from },
        user: { id: "user-1" },
      }),
    }))
    vi.doMock("@/lib/rate-limit", () => ({
      RATE_LIMIT_TIERS: {
        ITINERARY_GENERATION: "itinerary-generation",
        ITINERARY_DRAFT: "itinerary-draft",
      },
      enforceRateLimit,
      rateLimitResponse,
    }))
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/trips/trip-1/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fastDraft: true }),
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: "trip-1" }),
    })

    expect(response.status).toBe(429)
    expect(enforceRateLimit).toHaveBeenCalledWith(
      request,
      "itinerary-draft",
      { userId: "user-1" }
    )
    expect(from).not.toHaveBeenCalled()
  })
})
