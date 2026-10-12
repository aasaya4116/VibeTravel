import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  anthropic,
  convertToModelMessages,
  enforceRateLimit,
  getUser,
  insert,
  sendSlackWebhook,
  streamText,
} = vi.hoisted(() => ({
  anthropic: vi.fn(() => "mock-model"),
  convertToModelMessages: vi.fn(async () => []),
  enforceRateLimit: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(async () => ({ error: null })),
  sendSlackWebhook: vi.fn(),
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: () => new Response("stream", { status: 200 }),
  })),
}))

vi.mock("@ai-sdk/anthropic", () => ({ anthropic }))
vi.mock("ai", () => ({ convertToModelMessages, streamText }))
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: { AI_CHAT: "ai-chat" },
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
vi.mock("@/lib/slack", () => ({
  escapeSlackText: (value: string) => value,
  sendSlackWebhook,
}))

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/feedback/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

const validBody = {
  id: "feedback-1",
  messages: [
    { id: "message-1", role: "user", parts: [{ type: "text", text: "The trip setup was easy" }] },
  ],
  familyVibe: null,
  currentTrip: null,
  tripId: null,
}

describe("POST /api/feedback/chat", () => {
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
    await expect(response.json()).resolves.toEqual({
      error: "Sign in to share feedback with Scout.",
    })
    expect(streamText).not.toHaveBeenCalled()
    expect(anthropic).not.toHaveBeenCalled()
  })

  it("rejects malformed or oversized payloads before invoking the model", async () => {
    const { POST } = await import("./route")

    const malformed = await POST(request({ messages: [] }))
    const oversized = await POST(request(validBody, { "Content-Length": "48001" }))

    expect(malformed.status).toBe(400)
    expect(oversized.status).toBe(413)
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

  it("streams feedback chat for a valid signed-in request", async () => {
    const { POST } = await import("./route")

    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(convertToModelMessages).toHaveBeenCalledOnce()
    expect(streamText).toHaveBeenCalledOnce()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      role: "user",
      content: "The trip setup was easy",
    }))
  })
})
