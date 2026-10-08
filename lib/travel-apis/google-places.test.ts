import { afterEach, describe, expect, it, vi } from "vitest"

describe("Google Places deadlines", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("combines caller cancellation with the provider request deadline", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "place-1",
              displayName: { text: "Test Museum" },
              formattedAddress: "1 Test Street",
              businessStatus: "OPERATIONAL",
              types: ["museum"],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    const { searchVerifiedPlaces } = await import("./google-places")
    const requestController = new AbortController()

    const results = await searchVerifiedPlaces(
      "museum",
      "Test City",
      10,
      { signal: requestController.signal, timeoutMs: 5_000 }
    )

    expect(results.map((place) => place.id)).toEqual(["place-1"])
    const providerSignal = fetchMock.mock.calls[0][1]?.signal as AbortSignal
    expect(providerSignal.aborted).toBe(false)
    requestController.abort()
    expect(providerSignal.aborted).toBe(true)
  })
})
