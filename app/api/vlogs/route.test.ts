import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { enforceRateLimit } = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }))

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: { PROVIDER_SEARCH: "provider-search" },
  enforceRateLimit,
  rateLimitResponse: () => Response.json({ error: "Too many requests." }, { status: 429 }),
}))

describe("travel video API", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("bounds the destination, requests strict safe search, and drops malformed videos", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key")
    const providerFetch = vi.fn().mockResolvedValue(Response.json({
      items: [
        {
          id: { videoId: "abc_123-XYZ" },
          snippet: {
            title: "Family guide",
            channelTitle: "Travel channel",
            thumbnails: { medium: { url: "https://example.com/image.jpg" } },
          },
        },
        { id: {}, snippet: {} },
      ],
    }))
    vi.stubGlobal("fetch", providerFetch)
    enforceRateLimit.mockResolvedValueOnce({ allowed: true })
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      `http://localhost/api/vlogs?destination=${encodeURIComponent(`Nairobi\n${"x".repeat(300)}`)}`
    ))
    const providerUrl = new URL(String(providerFetch.mock.calls[0]?.[0]))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(providerUrl.searchParams.get("safeSearch")).toBe("strict")
    expect(providerUrl.searchParams.get("q")).not.toContain("\n")
    expect(providerUrl.searchParams.get("q")!.length).toBeLessThanOrEqual(179)
    expect(payload.videos).toEqual([expect.objectContaining({ id: "abc_123-XYZ" })])
  })

  it("returns a stable gateway error when YouTube times out", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")))
    enforceRateLimit.mockResolvedValueOnce({ allowed: true })
    const { GET } = await import("./route")

    const response = await GET(new NextRequest("http://localhost/api/vlogs?destination=Nairobi"))

    expect(response.status).toBe(502)
  })

  it("does not call YouTube when the provider-search limit is exhausted", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key")
    const providerFetch = vi.fn()
    vi.stubGlobal("fetch", providerFetch)
    enforceRateLimit.mockResolvedValueOnce({ allowed: false })
    const { GET } = await import("./route")

    const response = await GET(new NextRequest("http://localhost/api/vlogs?destination=Nairobi"))

    expect(response.status).toBe(429)
    expect(providerFetch).not.toHaveBeenCalled()
  })
})
