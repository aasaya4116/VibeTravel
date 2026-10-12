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
vi.mock("@/lib/slack", () => ({
  escapeSlackText: (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  sendSlackWebhook,
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: vi.fn(() => ({ insert })),
  })),
}))

const tripId = "870d225d-d2f1-441d-9288-bf91f9355405"
const validBody = { outcome: "needs_tweaks", comment: "More food stops", trip_id: tripId }

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/feedback/outcome", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

describe("POST /api/feedback/outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    insert.mockResolvedValue({ error: null })
    enforceRateLimit.mockResolvedValue({
      allowed: true,
      headers: { "RateLimit-Remaining": "28" },
    })
  })

  it("authenticates before reading or validating the request body", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import("./route")

    const response = await POST(
      new Request("http://localhost/api/feedback/outcome", {
        method: "POST",
        headers: { "Content-Length": "999999" },
        body: "not-json",
      })
    )

    expect(response.status).toBe(401)
    expect(enforceRateLimit).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("rejects malformed and invalid feedback before limiting", async () => {
    const { POST } = await import("./route")

    const malformed = await POST(
      new Request("http://localhost/api/feedback/outcome", {
        method: "POST",
        body: "{",
      })
    )
    const invalid = await POST(
      request({ outcome: "perfect", comment: "x".repeat(1_501), trip_id: "bad" })
    )

    expect(malformed.status).toBe(400)
    expect(invalid.status).toBe(400)
    expect(enforceRateLimit).not.toHaveBeenCalled()
  })

  it("enforces both declared and actual 8 KB payload limits", async () => {
    const { POST } = await import("./route")

    const declared = await POST(request(validBody, { "Content-Length": "8193" }))
    const actual = await POST(
      new Request("http://localhost/api/feedback/outcome", {
        method: "POST",
        body: JSON.stringify({ ...validBody, padding: "é".repeat(8_000) }),
      })
    )

    expect(declared.status).toBe(413)
    expect(actual.status).toBe(413)
    expect(enforceRateLimit).not.toHaveBeenCalled()
  })

  it("returns quota denial before writing feedback", async () => {
    enforceRateLimit.mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "60" },
    })
    const { POST } = await import("./route")

    const response = await POST(request(validBody))

    expect(response.status).toBe(429)
    expect(insert).not.toHaveBeenCalled()
    expect(sendSlackWebhook).not.toHaveBeenCalled()
  })

  it("trims comments, converts blanks to null, and returns private quota headers", async () => {
    const { POST } = await import("./route")

    const response = await POST(
      request({ outcome: "works_great", comment: "   ", trip_id: null })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("ratelimit-remaining")).toBe("28")
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      outcome: "works_great",
      comment: null,
      trip_id: null,
    })
  })

  it("escapes untrusted Slack comment text", async () => {
    const { POST } = await import("./route")

    const response = await POST(
      request({
        outcome: "not_quite",
        comment: "  Alert <@everyone> & <!channel>  ",
        trip_id: tripId,
      })
    )

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ comment: "Alert <@everyone> & <!channel>" })
    )
    expect(sendSlackWebhook).toHaveBeenCalledWith(
      "❌ *Itinerary Outcome* — Not quite right\n> “Alert &lt;@everyone&gt; &amp; &lt;!channel&gt;”"
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
