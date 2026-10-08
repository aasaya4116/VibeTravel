import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

describe("destination API fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("fails closed when the worldwide provider is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider down")))
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
