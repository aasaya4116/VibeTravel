import { beforeEach, describe, expect, it, vi } from "vitest"

const { enforceRateLimit, getUser, insert, sendSlackWebhook } = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  sendSlackWebhook: vi.fn(async () => undefined),
}))

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: { FEEDBACK_WRITE: "feedback-write" },
  enforceRateLimit,
  rateLimitResponse: (result: { headers?: HeadersInit }) =>
    Response.json(
      { error: "Too many requests.", code: "RATE_LIMITED" },
      { status: 429, headers: result.headers }
    ),
}))
vi.mock("@/lib/slack", () => ({ sendSlackWebhook }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: vi.fn(() => ({ insert })),
  })),
}))

const validBody = {
  step: "trip_created",
  reaction: "great",
  trip_id: "870d225d-d2f1-441d-9288-bf91f9355405",
}

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/feedback/pulse", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

describe("POST /api/feedback/pulse", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    insert.mockResolvedValue({ error: null })
    enforceRateLimit.mockResolvedValue({
      allowed: true,
      headers: { "RateLimit-Remaining": "29" },
    })
  })

  it("authenticates before reading or validating the request body", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/feedback/pulse", {
        method: "POST",
        headers: { "Content-Length": "999999" },
        body: "not-json",
      })
    )

    expect(response.status).toBe(401)
    expect(enforceRateLimit).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("rejects malformed JSON, invalid enums, and invalid UUIDs before limiting", async () => {
    const { POST } = await import("./route")

    const malformed = await POST(
      new Request("http://localhost/api/feedback/pulse", {
        method: "POST",
        body: "{",
      })
    )
    const invalid = await POST(
      request({ step: "unknown", reaction: "excellent", trip_id: "not-a-uuid" })
    )

    expect(malformed.status).toBe(400)
    expect(invalid.status).toBe(400)
    expect(enforceRateLimit).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("enforces both declared and actual 4 KB payload limits", async () => {
    const { POST } = await import("./route")

    const declared = await POST(request(validBody, { "Content-Length": "4097" }))
    const actual = await POST(
      new Request("http://localhost/api/feedback/pulse", {
        method: "POST",
        body: JSON.stringify({ ...validBody, padding: "é".repeat(4_000) }),
      })
    )

    expect(declared.status).toBe(413)
    expect(actual.status).toBe(413)
    expect(enforceRateLimit).not.toHaveBeenCalled()
  })

  it("returns quota denial before writing feedback or notifying Slack", async () => {
    enforceRateLimit.mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "60" },
    })
    const { POST } = await import("./route")

    const response = await POST(request(validBody))

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    expect(insert).not.toHaveBeenCalled()
    expect(sendSlackWebhook).not.toHaveBeenCalled()
  })

  it("saves valid feedback and returns private quota headers", async () => {
    const { POST } = await import("./route")

    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("ratelimit-remaining")).toBe("29")
    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      "feedback-write",
      { userId: "user-1" }
    )
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      step: "trip_created",
      reaction: "great",
      trip_id: validBody.trip_id,
    })
    expect(sendSlackWebhook).toHaveBeenCalledWith(
      "😊 *Step Feedback* — Created a trip: *great*"
    )
  })

  it("does not expose database errors", async () => {
    insert.mockResolvedValue({ error: { message: "sensitive database detail" } })
    const { POST } = await import("./route")

    const response = await POST(request(validBody))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).not.toContain("sensitive")
    expect(sendSlackWebhook).not.toHaveBeenCalled()
  })
})
