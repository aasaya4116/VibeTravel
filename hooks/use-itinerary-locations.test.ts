import { afterEach, describe, expect, it, vi } from "vitest"
import type { ItineraryDay } from "@/lib/types"
import {
  fetchItineraryLocations,
  partitionItineraryLocations,
} from "./use-itinerary-locations"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("partitionItineraryLocations", () => {
  it("uses verified place coordinates and sends only unresolved names to fallback geocoding", () => {
    const itinerary = [{
      date: "2026-10-12",
      items: [
        {
          id: "known",
          attraction_name: "National Museum",
          start_time: "09:00",
          end_time: "10:00",
          attraction_data: { latitude: -1.2733, longitude: 36.8146 },
        },
        {
          id: "unknown",
          attraction_name: "City Market",
          start_time: "10:30",
          end_time: "11:30",
        },
      ],
    }] as ItineraryDay[]

    expect(partitionItineraryLocations(itinerary)).toEqual({
      knownLocations: {
        "National Museum": { lat: -1.2733, lng: 36.8146 },
      },
      places: ["City Market"],
    })
  })

  it("rejects invalid coordinates and de-duplicates fallback names", () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      id: String(index),
      attraction_name: `Place ${index}`,
      start_time: "09:00",
      end_time: "10:00",
      ...(index === 0
        ? { attraction_data: { latitude: 999, longitude: 36 } }
        : {}),
    }))
    items.push({
      id: "duplicate",
      attraction_name: "Place 1",
      start_time: "11:00",
      end_time: "12:00",
    })

    const result = partitionItineraryLocations([{ date: "2026-10-12", items }] as ItineraryDay[])

    expect(result.places).toHaveLength(9)
    expect(new Set(result.places).size).toBe(9)
    expect(result.knownLocations).toEqual({})
  })

  it("does not geocode a duplicate stop when another copy already has coordinates", () => {
    const itinerary = [{
      date: "2026-10-12",
      items: [
        {
          id: "unresolved-copy",
          attraction_name: "City Market",
          start_time: "09:00",
          end_time: "10:00",
        },
        {
          id: "verified-copy",
          attraction_name: "City Market",
          start_time: "11:00",
          end_time: "12:00",
          attraction_data: { latitude: -1.2833, longitude: 36.8167 },
        },
      ],
    }] as ItineraryDay[]

    expect(partitionItineraryLocations(itinerary)).toEqual({
      knownLocations: {
        "City Market": { lat: -1.2833, lng: 36.8167 },
      },
      places: [],
    })
  })
})

describe("fetchItineraryLocations", () => {
  it("paces and fetches every unresolved stop in six-place batches", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ results: { "Place 0": { lat: 1, lng: 2 } } })
      )
      .mockResolvedValueOnce(
        Response.json({ results: { "Place 8": { lat: 3, lng: 4 } } })
      )
    vi.stubGlobal("fetch", fetchMock)
    const places = Array.from({ length: 9 }, (_, index) => `Place ${index}`)
    const onBatch = vi.fn()

    const locationsPromise = fetchItineraryLocations(
      "Nairobi, Kenya",
      places,
      new AbortController().signal,
      onBatch
    )
    await vi.runAllTimersAsync()

    await expect(locationsPromise).resolves.toEqual({
      "Place 0": { lat: 1, lng: 2 },
      "Place 8": { lat: 3, lng: 4 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onBatch).toHaveBeenCalledTimes(2)
    const firstUrl = new URL(fetchMock.mock.calls[0][0], "http://localhost")
    const secondUrl = new URL(fetchMock.mock.calls[1][0], "http://localhost")
    expect(firstUrl.searchParams.getAll("place")).toHaveLength(6)
    expect(secondUrl.searchParams.getAll("place")).toHaveLength(3)
  })

  it("retries a rate-limited batch instead of caching an empty result", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "1" },
        })
      )
      .mockResolvedValueOnce(
        Response.json({ results: { Museum: { lat: 5, lng: 6 } } })
      )
    vi.stubGlobal("fetch", fetchMock)

    const locationsPromise = fetchItineraryLocations(
      "Lagos, Nigeria",
      ["Museum"],
      new AbortController().signal
    )
    await vi.runAllTimersAsync()

    await expect(locationsPromise).resolves.toEqual({
      Museum: { lat: 5, lng: 6 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("surfaces limiter unavailability immediately so the UI can offer a retry", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)

    const locationsPromise = fetchItineraryLocations(
      "Addis Ababa, Ethiopia",
      ["Museum"],
      new AbortController().signal
    )
    const rejection = expect(locationsPromise).rejects.toThrow(
      "Geocoding failed with status 503"
    )
    await vi.runAllTimersAsync()

    await rejection
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
