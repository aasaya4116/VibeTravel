"use client"

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { MapPin, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import type { ItineraryDay } from "@/lib/types"
import type { Coordinates } from "@/lib/itinerary-logistics"
import type { GeocodedPlace } from "./trip-map-leaflet"

const DAY_COLOR_HEX = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#eab308"]

// Dynamic import — Leaflet uses `window` so SSR must be off
const LeafletMap = dynamic(
  () => import("./trip-map-leaflet").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center bg-muted/10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

interface TripMapProps {
  itinerary: ItineraryDay[]
  locations: Record<string, Coordinates | null>
  locationsLoading: boolean
  locationsReady: boolean
}

export function TripMap({
  itinerary,
  locations,
  locationsLoading,
  locationsReady,
}: TripMapProps) {
  const [selectedDay, setSelectedDay] = useState<"all" | number>("all")
  const [collapsed, setCollapsed] = useState(false)

  // Build the list of places to show on map for the current day selection
  const visiblePlaces = useMemo((): GeocodedPlace[] => {
    const out: GeocodedPlace[] = []
    const days =
      selectedDay === "all"
        ? itinerary.map((d, i) => ({ day: d, dayIndex: i }))
        : [{ day: itinerary[selectedDay as number], dayIndex: selectedDay as number }].filter((x) => x.day)

    for (const { day, dayIndex } of days) {
      for (const item of day.items) {
        if (!item.attraction_name) continue
        const coords = locations[item.attraction_name]
        if (!coords) continue
        out.push({
          name: item.attraction_name,
          lat: coords.lat,
          lng: coords.lng,
          dayIndex,
          time: item.start_time ? `${item.start_time} – ${item.end_time}` : undefined,
        })
      }
    }
    return out
  }, [locations, itinerary, selectedDay])

  if (itinerary.length === 0) return null

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header with day tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 shrink-0">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Trip Map</h3>
          {(locationsLoading || !locationsReady) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {!collapsed && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <button
                onClick={() => setSelectedDay("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedDay === "all"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                All
              </button>
              {itinerary.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedDay === i
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Day {i + 1}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
            aria-label={collapsed ? "Expand map" : "Collapse map"}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {locationsLoading || !locationsReady ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-2 bg-muted/10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Locating attractions…</p>
            </div>
          ) : locationsReady && visiblePlaces.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              Could not locate attractions on map
            </div>
          ) : (
            <LeafletMap places={visiblePlaces} />
          )}

          {/* Day legend — only in all-days view */}
          {selectedDay === "all" && itinerary.length > 1 && !locationsLoading && (
            <div className="flex flex-wrap gap-3 border-t border-border px-5 py-3">
              {itinerary.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: DAY_COLOR_HEX[i % DAY_COLOR_HEX.length] }}
                  />
                  Day {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
