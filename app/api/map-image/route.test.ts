import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { enforceRateLimit } = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }))

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: { PROVIDER_MEDIA: "provider-media" },
  enforceRateLimit,
  rateLimitResponse: () => Response.json({ error: "Too many requests." }, { status: 429 }),
}))

describe("map image proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("bounds marker inputs and normalizes invalid day colors", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const providerFetch = vi.fn().mockResolvedValue(new Response("png"))
    vi.stubGlobal("fetch", providerFetch)
    enforceRateLimit.mockResolvedValueOnce({ allowed: true })
    const { GET } = await import("./route")
    const params = new URLSearchParams({ dest: `Nairobi\n${"x".repeat(300)}` })
    for (let index = 0; index < 24; index += 1) {
      params.append("place", `Place ${index}`)
      params.append("color", index === 0 ? "-4" : String(index))
    }

    const response = await GET(new NextRequest(`http://localhost/api/map-image?${params}`))
    const providerUrl = String(providerFetch.mock.calls[0]?.[0])

    expect(response.status).toBe(200)
    expect((providerUrl.match(/&markers=/g) ?? [])).toHaveLength(20)
    expect(providerUrl).toContain("markers=color:red%7Clabel:A")
    expect(providerUrl).not.toContain("%0A")
  })

  it("reports an unavailable map service separately from bad parameters", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "")
    const { GET } = await import("./route")

    const response = await GET(new NextRequest("http://localhost/api/map-image?place=Museum"))

    expect(response.status).toBe(503)
  })

  it("does not call Google when the media limit is exhausted", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const providerFetch = vi.fn()
    vi.stubGlobal("fetch", providerFetch)
    enforceRateLimit.mockResolvedValueOnce({ allowed: false })
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      "http://localhost/api/map-image?place=Museum&dest=Nairobi"
    ))

    expect(response.status).toBe(429)
    expect(providerFetch).not.toHaveBeenCalled()
  })
})
