import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

describe("destination photo proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.doUnmock("@/lib/supabase/request")
    vi.doUnmock("@/lib/travel-apis/google-places")
  })

  it("forwards clamped dimensions to the resolved place photo", async () => {
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    }))
    vi.doMock("@/lib/travel-apis/google-places", () => ({
      isConfigured: () => true,
      searchPlaces: vi.fn().mockResolvedValue({
        photoUrl: "/api/place-photo?ref=places%2Fabc%2Fphotos%2F123",
      }),
    }))
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      "http://localhost/api/destination-photo?destination=Tokyo&width=99999&height=1"
    ))
    const location = new URL(response.headers.get("location")!)

    expect(response.status).toBe(307)
    expect(location.pathname).toBe("/api/place-photo")
    expect(location.searchParams.get("ref")).toBe("places/abc/photos/123")
    expect(location.searchParams.get("width")).toBe("1600")
    expect(location.searchParams.get("height")).toBe("64")
  })

  it("rejects unauthenticated requests inside the route", async () => {
    const searchPlaces = vi.fn()
    vi.doMock("@/lib/supabase/request", () => ({
      createRequestClient: vi.fn().mockResolvedValue({ user: null }),
    }))
    vi.doMock("@/lib/travel-apis/google-places", () => ({
      isConfigured: () => true,
      searchPlaces,
    }))
    const { GET } = await import("./route")

    const response = await GET(new NextRequest(
      "http://localhost/api/destination-photo?destination=Tokyo"
    ))

    expect(response.status).toBe(401)
    expect(searchPlaces).not.toHaveBeenCalled()
  })
})
