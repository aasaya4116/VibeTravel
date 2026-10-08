import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

describe("place photo proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("clamps requested dimensions and streams the provider response", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const providerFetch = vi.fn().mockResolvedValue(new Response("image-bytes", {
      headers: { "content-type": "image/webp", etag: "photo-tag" },
    }))
    vi.stubGlobal("fetch", providerFetch)
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      "http://localhost/api/place-photo?ref=places%2Fabc%2Fphotos%2F123&width=99999&height=1"
    ))

    expect(providerFetch).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/abc/photos/123/media?maxHeightPx=64&maxWidthPx=1600&key=test-key",
      { next: { revalidate: 86400 } }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/webp")
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate")
    expect(response.headers.get("etag")).toBe("photo-tag")
    expect(await response.text()).toBe("image-bytes")
  })
})
