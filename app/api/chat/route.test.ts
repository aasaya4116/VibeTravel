import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  anthropic,
  convertToModelMessages,
  enforceRateLimit,
  getUser,
  insert,
  searchPlaces,
  searchPlacesBatch,
  streamText,
} = vi.hoisted(() => ({
  anthropic: vi.fn(() => "mock-model"),
  convertToModelMessages: vi.fn(async () => []),
  enforceRateLimit: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(async () => ({ error: null })),
  searchPlaces: vi.fn(),
  searchPlacesBatch: vi.fn(),
  streamText: vi.fn((_config: unknown) => ({
    toUIMessageStreamResponse: () => new Response("stream", { status: 200 }),
  })),
}))

vi.mock("@ai-sdk/anthropic", () => ({ anthropic }))
vi.mock("ai", () => ({
  convertToModelMessages,
  stepCountIs: vi.fn(() => "stop-condition"),
  streamText,
}))
vi.mock("@/lib/travel-apis/google-places", () => ({
  searchPlaces,
  searchPlacesBatch,
}))
vi.mock("@/lib/travel-apis/openweather", () => ({ getWeatherForecast: vi.fn() }))
vi.mock("@/lib/travel-apis/viator", () => ({ searchTours: vi.fn() }))
vi.mock("@/lib/travel-apis/expedia", () => ({ searchHotels: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: {
    AI_CHAT: "ai-chat",
    PROVIDER_SEARCH: "provider-search",
  },
  enforceRateLimit,
  rateLimitResponse: (result: { headers?: HeadersInit }) => Response.json(
    { error: "Too many requests. Please wait a moment and try again.", code: "RATE_LIMITED" },
    { status: 429, headers: result.headers }
  ),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: vi.fn(() => ({ insert })),
  })),
}))

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

const validBody = {
  id: "chat-1",
  messages: [
    { id: "message-1", role: "user", parts: [{ type: "text", text: "Plan a calm day in Lisbon" }] },
  ],
  familyVibe: null,
  currentTrip: null,
  tripId: null,
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    enforceRateLimit.mockResolvedValue({
      allowed: true,
      headers: { "RateLimit-Remaining": "19" },
    })
  })

  it("rejects signed-out callers before invoking the model", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import("./route")

    const response = await POST(request(validBody))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Sign in to use Scout." })
    expect(streamText).not.toHaveBeenCalled()
    expect(anthropic).not.toHaveBeenCalled()
  })

  it("rejects malformed chat payloads before invoking the model", async () => {
    const { POST } = await import("./route")

    const response = await POST(request({ messages: [{ role: "system", parts: [] }], extra: true }))

    expect(response.status).toBe(400)
    expect(streamText).not.toHaveBeenCalled()
  })

  it("returns 429 without invoking the model when the user exceeds the chat limit", async () => {
    enforceRateLimit.mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "30" },
    })
    const { POST } = await import("./route")

    const response = await POST(request(validBody))

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("30")
    expect(streamText).not.toHaveBeenCalled()
  })

  it("rejects oversized requests before invoking the model", async () => {
    const { POST } = await import("./route")

    const response = await POST(request(validBody, { "Content-Length": "96001" }))

    expect(response.status).toBe(413)
    expect(streamText).not.toHaveBeenCalled()
  })

  it("streams Scout for a valid signed-in request", async () => {
    const { POST } = await import("./route")

    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(convertToModelMessages).toHaveBeenCalledOnce()
    expect(streamText).toHaveBeenCalledOnce()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      role: "user",
      content: "Plan a calm day in Lisbon",
    }))
  })

  it("reserves provider quota before a Scout travel-search tool runs", async () => {
    enforceRateLimit
      .mockResolvedValueOnce({
        allowed: true,
        headers: { "RateLimit-Remaining": "19" },
      })
      .mockResolvedValueOnce({
        allowed: false,
        reason: "rate-limited",
        retryAfterSeconds: 30,
      })
    const { POST } = await import("./route")

    await POST(request(validBody))
    const config = streamText.mock.calls[0][0] as {
      tools: Record<string, { execute: (input: unknown) => Promise<unknown> }>
    }
    const result = await config.tools.search_attraction.execute({
      name: "Oceanarium",
      destination: "Lisbon, Portugal",
    })

    expect(result).toMatchObject({
      code: "RATE_LIMITED",
      retryAfter: 30,
    })
    expect(searchPlaces).not.toHaveBeenCalled()
    expect(enforceRateLimit).toHaveBeenLastCalledWith(
      expect.any(Request),
      "provider-search",
      { userId: "user-1" }
    )
  })

  it("charges each place in a Scout batch against provider quota", async () => {
    searchPlacesBatch.mockResolvedValue(new Map())
    const { POST } = await import("./route")

    await POST(request(validBody))
    const config = streamText.mock.calls[0][0] as {
      tools: Record<string, { execute: (input: unknown) => Promise<unknown> }>
    }
    await config.tools.search_attractions_batch.execute({
      attractions: [
        { name: "Place 1", destination: "Lisbon" },
        { name: "Place 2", destination: "Lisbon" },
        { name: "Place 3", destination: "Lisbon" },
      ],
    })

    expect(enforceRateLimit).toHaveBeenCalledTimes(4)
    expect(searchPlacesBatch).toHaveBeenCalledOnce()
  })
})
