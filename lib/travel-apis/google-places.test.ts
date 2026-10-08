import { afterEach, describe, expect, it, vi } from "vitest"

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function destinationPlace(
  id: string,
  city: string,
  region: string,
  country: string,
  latitude: number,
  longitude: number
) {
  return {
    id,
    displayName: { text: city },
    formattedAddress: `${city}, ${country}`,
    addressComponents: [
      { longText: city, types: ["locality"] },
      { longText: region, types: ["administrative_area_level_1"] },
      { longText: country, types: ["country"] },
    ],
    location: { latitude, longitude },
    primaryType: "locality",
    types: ["locality", "political"],
  }
}

describe("Google destination resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it.each([
    ["Nair", "nairobi-id", "Nairobi", "Nairobi County", "Kenya", -1.286389, 36.817223],
    ["Abu", "abuja-id", "Abuja", "Federal Capital Territory", "Nigeria", 9.076479, 7.398574],
  ])(
    "resolves %s to a canonical worldwide destination with coordinates",
    async (query, id, city, region, country, latitude, longitude) => {
      vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
      const fetchMock = vi.fn(async (url: string | URL | Request) => {
        const target = String(url)
        if (target.endsWith("places:autocomplete")) {
          return json({
            suggestions: [
              {
                placePrediction: {
                  placeId: id,
                  text: { text: `${city}, ${country}` },
                  structuredFormat: { mainText: { text: city } },
                  types: ["locality", "political"],
                },
              },
            ],
          })
        }
        return json(destinationPlace(id, city, region, country, latitude, longitude))
      })
      vi.stubGlobal("fetch", fetchMock)

      const { autocompleteDestinations } = await import("./google-places")
      const results = await autocompleteDestinations(query, 6)

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        label: `${city}, ${country}`,
        canonicalLabel: `${city}, ${country}`,
        city,
        region,
        country,
        placeId: id,
        latitude,
        longitude,
        resolved: true,
        recognized: true,
      })
    }
  )

  it("keeps ambiguous cities as distinct verified choices", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const details = new Map([
      [
        "springfield-il",
        destinationPlace(
          "springfield-il",
          "Springfield",
          "Illinois",
          "United States",
          39.7817,
          -89.6501
        ),
      ],
      [
        "springfield-ma",
        destinationPlace(
          "springfield-ma",
          "Springfield",
          "Massachusetts",
          "United States",
          42.1015,
          -72.5898
        ),
      ],
    ])
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url)
        if (target.endsWith("places:autocomplete")) {
          return json({
            suggestions: [
              {
                placePrediction: {
                  placeId: "springfield-il",
                  text: { text: "Springfield, IL, USA" },
                  structuredFormat: { mainText: { text: "Springfield" } },
                  types: ["locality"],
                },
              },
              {
                placePrediction: {
                  placeId: "springfield-ma",
                  text: { text: "Springfield, MA, USA" },
                  structuredFormat: { mainText: { text: "Springfield" } },
                  types: ["locality"],
                },
              },
            ],
          })
        }
        const id = target.split("/").at(-1) ?? ""
        return json(details.get(id))
      })
    )

    const { autocompleteDestinations } = await import("./google-places")
    const results = await autocompleteDestinations("Springfield", 6)

    expect(results.map((result) => result.label)).toEqual([
      "Springfield, IL, USA",
      "Springfield, MA, USA",
    ])
    expect(new Set(results.map((result) => result.placeId)).size).toBe(2)
    expect(results.map((result) => result.region)).toEqual([
      "Illinois",
      "Massachusetts",
    ])
  })

  it("resolves an exact selected place ID without rerunning autocomplete", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const fetchMock = vi.fn().mockResolvedValue(
      json(destinationPlace(
        "abuja-id",
        "Abuja",
        "Federal Capital Territory",
        "Nigeria",
        9.076479,
        7.398574
      ))
    )
    vi.stubGlobal("fetch", fetchMock)

    const { resolveDestinationPlaceId } = await import("./google-places")
    const result = await resolveDestinationPlaceId("abuja-id")

    expect(result).toMatchObject({
      placeId: "abuja-id",
      canonicalLabel: "Abuja, Nigeria",
      latitude: 9.076479,
      longitude: 7.398574,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain("/places/abuja-id")
  })

  it("fails the lookup instead of caching a partial hydrated suggestion list", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url)
        if (target.endsWith("places:autocomplete")) {
          return json({
            suggestions: [
              { placePrediction: { placeId: "abuja-id", text: { text: "Abuja, Nigeria" }, types: ["locality"] } },
              { placePrediction: { placeId: "abu-dhabi-id", text: { text: "Abu Dhabi, UAE" }, types: ["locality"] } },
            ],
          })
        }
        if (target.endsWith("/abuja-id")) return new Response("temporary failure", { status: 503 })
        return json(destinationPlace("abu-dhabi-id", "Abu Dhabi", "Abu Dhabi", "United Arab Emirates", 24.4539, 54.3773))
      })
    )

    const { autocompleteDestinations } = await import("./google-places")
    await expect(autocompleteDestinations("Abu", 6)).rejects.toThrow(/details failed/i)
  })

  it("aborts a destination lookup at its hard deadline", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (!signal) return
          signal.addEventListener(
            "abort",
            () => reject(signal.reason ?? new DOMException("Aborted", "AbortError")),
            { once: true }
          )
        })
      )
    )

    const { autocompleteDestinations } = await import("./google-places")
    await expect(
      autocompleteDestinations("Nairobi", 6, { timeoutMs: 10 })
    ).rejects.toBeDefined()
  })
})

describe("Google Places geographic search", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("uses the destination anchor and rejects results outside its metro radius", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key")
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        places: [
          {
            id: "nairobi-museum",
            displayName: { text: "Nairobi National Museum" },
            formattedAddress: "Museum Hill, Nairobi, Kenya",
            location: { latitude: -1.2733, longitude: 36.8146 },
            businessStatus: "OPERATIONAL",
            types: ["museum"],
          },
          {
            id: "new-jersey-museum",
            displayName: { text: "New Jersey Museum" },
            formattedAddress: "New Jersey, USA",
            location: { latitude: 40.0583, longitude: -74.4057 },
            businessStatus: "OPERATIONAL",
            types: ["museum"],
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { searchVerifiedPlaces } = await import("./google-places")
    const requestController = new AbortController()

    const results = await searchVerifiedPlaces("easy with kids", "Nair", 10, {
      signal: requestController.signal,
      timeoutMs: 5_000,
      destinationAnchor: {
        label: "Nairobi, Kenya",
        canonicalLabel: "Nairobi, Kenya",
        city: "Nairobi",
        region: "Nairobi County",
        country: "Kenya",
        placeId: "nairobi-id",
        latitude: -1.286389,
        longitude: 36.817223,
        resolved: true,
        recognized: true,
        primaryType: "locality",
        types: ["locality"],
        radiusMeters: 75_000,
      },
    })

    expect(results.map((place) => place.id)).toEqual(["nairobi-museum"])
    const providerRequest = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(providerRequest.body))
    expect(body.textQuery).toContain("in Nairobi, Kenya")
    expect(body.locationBias.circle.center).toEqual({
      latitude: -1.286389,
      longitude: 36.817223,
    })
    const providerSignal = providerRequest.signal as AbortSignal
    expect(providerSignal.aborted).toBe(false)
    requestController.abort()
    expect(providerSignal.aborted).toBe(true)
  })
})
