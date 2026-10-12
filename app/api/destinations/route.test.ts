import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { enforceRateLimit } = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }))

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_TIERS: { PROVIDER_AUTOCOMPLETE: "provider-autocomplete" },
  enforceRateLimit,
  rateLimitResponse: () => Response.json({ error: "Too many requests." }, { status: 429 }),
}))

describe("destination API fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("returns 429 before worldwide provider lookup when autocomplete is limited", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const providerFetch = vi.fn()
    vi.stubGlobal("fetch", providerFetch)
    enforceRateLimit.mockResolvedValueOnce({ allowed: false })
    const { GET } = await import("./route")

    const response = await GET(new NextRequest("http://localhost/api/destinations?q=Nair"))

    expect(response.status).toBe(429)
    expect(providerFetch).not.toHaveBeenCalled()
  })

  it("fails closed when the worldwide provider is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider down")))
    enforceRateLimit.mockResolvedValueOnce({ allowed: true })
    const { GET } = await import("./route")

    const response = await GET(
      new NextRequest("http://localhost/api/destinations?q=Nair")
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=60")
    expect(payload.error).toMatch(/temporarily unavailable/i)
  })
})
