"use client"

import { useEffect, useMemo, useState } from "react"
import type { ItineraryDay } from "@/lib/types"
import type { Coordinates } from "@/lib/itinerary-logistics"

export function useItineraryLocations(
  destination: string,
  itinerary: ItineraryDay[]
) {
  const [locations, setLocations] = useState<Record<string, Coordinates | null>>({})
  const [loading, setLoading] = useState(false)
  const [fetchedKey, setFetchedKey] = useState("")

  const places = useMemo(() => {
    const names = new Set<string>()
    itinerary.forEach((day) =>
      day.items.forEach((item) => {
        if (item.attraction_name) names.add(item.attraction_name)
      })
    )
    return Array.from(names).sort((a, b) => a.localeCompare(b)).slice(0, 25)
  }, [itinerary])

  const placesKey = `${destination}|${places.join("|")}`
  const ready = places.length === 0 || fetchedKey === placesKey

  useEffect(() => {
    if (ready || places.length === 0) return
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    params.set("dest", destination)
    places.forEach((place) => params.append("place", place))

    fetch(`/api/geocode?${params.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        setLocations(payload.results ?? {})
        setFetchedKey(placesKey)
      })
      .catch(() => {
        if (!cancelled) setFetchedKey(placesKey)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [destination, places, placesKey, ready])

  return { locations, loading, ready }
}
