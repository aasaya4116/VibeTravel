"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ItineraryDay } from "@/lib/types"
import type { Coordinates } from "@/lib/itinerary-logistics"

const GEOCODE_BATCH_SIZE = 6
const GEOCODE_RETRY_FLOOR_MS = 1_250

export function partitionItineraryLocations(itinerary: ItineraryDay[]) {
  const names = new Set<string>()
  const knownLocations: Record<string, Coordinates> = {}
  itinerary.forEach((day) =>
    day.items.forEach((item) => {
      const name = item.attraction_name?.trim()
      if (!name) return
      const latitude = item.attraction_data?.latitude
      const longitude = item.attraction_data?.longitude
      if (
        typeof latitude === "number" &&
        Number.isFinite(latitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        typeof longitude === "number" &&
        Number.isFinite(longitude) &&
        longitude >= -180 &&
        longitude <= 180
      ) {
        knownLocations[name] = { lat: latitude, lng: longitude }
      } else {
        names.add(name)
      }
    })
  )

  return {
    knownLocations,
    // Most verified places already have Google coordinates. Keep the fallback
    // set bounded, then the hook sends it in conservatively paced batches.
    places: Array.from(names)
      .filter((name) => !knownLocations[name])
      .sort((a, b) => a.localeCompare(b)),
  }
}

function waitForRetry(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, milliseconds)
    function abort() {
      clearTimeout(timeoutId)
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal.addEventListener("abort", abort, { once: true })
  })
}

async function fetchGeocodeBatch(
  destination: string,
  places: string[],
  signal: AbortSignal
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const params = new URLSearchParams()
    params.set("dest", destination)
    places.forEach((place) => params.append("place", place))
    const response = await fetch(`/api/geocode?${params.toString()}`, { signal })
    if (response.ok) {
      const payload = await response.json()
      return (payload.results ?? {}) as Record<string, Coordinates | null>
    }

    if (response.status === 429 && attempt < 2) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"))
      const providerCooldown = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1_000 + 250
        : 0
      await waitForRetry(
        Math.max(GEOCODE_RETRY_FLOOR_MS, providerCooldown),
        signal
      )
      continue
    }
    throw new Error(`Geocoding failed with status ${response.status}`)
  }
  return {}
}

export async function fetchItineraryLocations(
  destination: string,
  places: string[],
  signal: AbortSignal,
  onBatch?: (locations: Record<string, Coordinates | null>) => void
) {
  const locations: Record<string, Coordinates | null> = {}
  for (let index = 0; index < places.length; index += GEOCODE_BATCH_SIZE) {
    const batch = places.slice(index, index + GEOCODE_BATCH_SIZE)
    const batchLocations = await fetchGeocodeBatch(destination, batch, signal)
    Object.assign(locations, batchLocations)
    onBatch?.(batchLocations)
  }
  return locations
}

export function useItineraryLocations(
  destination: string,
  itinerary: ItineraryDay[]
) {
  const [fetchedLocations, setFetchedLocations] = useState<Record<string, Coordinates | null>>({})
  const [locationsKey, setLocationsKey] = useState("")
  const [loadingKey, setLoadingKey] = useState("")
  const [fetchedKey, setFetchedKey] = useState("")
  const [failedKey, setFailedKey] = useState("")
  const [retryVersion, setRetryVersion] = useState(0)

  const { knownLocations, places } = useMemo(
    () => partitionItineraryLocations(itinerary),
    [itinerary]
  )
  const placesKey = `${destination}|${places.join("|")}`

  const locations = useMemo(
    () => ({
      ...(locationsKey === placesKey ? fetchedLocations : {}),
      ...knownLocations,
    }),
    [fetchedLocations, knownLocations, locationsKey, placesKey]
  )

  const loading = loadingKey === placesKey
  const error = failedKey === placesKey
  const ready = places.length === 0 || fetchedKey === placesKey || error

  const retry = useCallback(() => {
    setFailedKey("")
    setFetchedKey("")
    setRetryVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    if (places.length === 0 || fetchedKey === placesKey || failedKey === placesKey) return
    let cancelled = false
    const controller = new AbortController()
    setLoadingKey(placesKey)
    setFailedKey("")
    setLocationsKey(placesKey)
    setFetchedLocations({})

    async function geocodeAllPlaces() {
      try {
        const results = await fetchItineraryLocations(
          destination,
          places,
          controller.signal,
          (batchLocations) => {
            if (!cancelled) {
              setFetchedLocations((current) => ({
                ...current,
                ...batchLocations,
              }))
            }
          }
        )
        if (cancelled) return
        setFetchedLocations(results)
        setFetchedKey(placesKey)
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DOMException && error.name === "AbortError")
        ) return
        setFailedKey(placesKey)
      } finally {
        if (!cancelled) {
          setLoadingKey((current) => current === placesKey ? "" : current)
        }
      }
    }

    void geocodeAllPlaces()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [destination, failedKey, fetchedKey, places, placesKey, retryVersion])

  return { locations, loading, ready, error, retry }
}
