"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarDays, Clock, MapPin, Search } from "lucide-react"
import { toast } from "sonner"
import type { SavedAttraction, TripOption } from "@/lib/types"
import {
  estimateDurationHours,
  getTripDateOptions,
} from "@/lib/trip-planning"

interface TripDayOrganizerProps {
  trip: TripOption
  savedAttractions: SavedAttraction[]
  hasItinerary: boolean
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

export function TripDayOrganizer({
  trip,
  savedAttractions,
  hasItinerary,
}: TripDayOrganizerProps) {
  const [savedPlaces, setSavedPlaces] = useState(savedAttractions)
  const [savingId, setSavingId] = useState<string | null>(null)
  const dateOptions = useMemo(() => getTripDateOptions(trip), [trip])
  const validDates = useMemo(
    () => new Set(dateOptions.map((option) => option.value)),
    [dateOptions]
  )

  useEffect(() => {
    setSavedPlaces(savedAttractions)
  }, [savedAttractions])

  const groups = useMemo(() => {
    const datedGroups = dateOptions.map((option) => ({
      ...option,
      places: savedPlaces.filter(
        (saved) => saved.attraction_data?.plannedDate === option.value
      ),
    }))
    const unscheduled = savedPlaces.filter((saved) => {
      const plannedDate = saved.attraction_data?.plannedDate
      return !plannedDate || !validDates.has(plannedDate)
    })

    return [
      ...datedGroups,
      { value: "", label: "Unscheduled", places: unscheduled },
    ].filter((group) => group.places.length > 0)
  }, [dateOptions, savedPlaces, validDates])

  async function updatePlannedDate(saved: SavedAttraction, plannedDate: string) {
    if (savingId) return
    const previousPlaces = savedPlaces
    const nextPlace = {
      ...saved,
      attraction_data: {
        ...saved.attraction_data,
        plannedDate: plannedDate || null,
      },
    }

    setSavingId(saved.id)
    setSavedPlaces((current) =>
      current.map((place) => (place.id === saved.id ? nextPlace : place))
    )

    try {
      const response = await fetch("/api/attractions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attraction_name: saved.attraction_name,
          attraction_data: nextPlace.attraction_data,
          trip_id: trip.id,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Could not update day")

      setSavedPlaces((current) =>
        current.map((place) => (place.id === saved.id ? payload.data : place))
      )
      toast.success(plannedDate ? "Trip day updated" : "Place moved to unscheduled")
    } catch (error) {
      setSavedPlaces(previousPlaces)
      toast.error(error instanceof Error ? error.message : "Could not update day")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Day planner
          </p>
          <h2 className="font-serif text-xl text-foreground">Saved Places</h2>
        </div>
        {!hasItinerary && (
          <span className="text-right text-xs text-muted-foreground">
            {savedPlaces.length >= 3
              ? "Ready to generate"
              : `${savedPlaces.length}/3 to generate`}
          </span>
        )}
      </div>

      {!hasItinerary && savedPlaces.length > 0 && savedPlaces.length < 3 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(savedPlaces.length / 3) * 100}%` }}
          />
        </div>
      )}

      {savedPlaces.length > 0 ? (
        <>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            {dateOptions.length === 0
              ? "Add trip dates to organize places by day. For now, your itinerary will choose."
              : hasItinerary
                ? "Change a saved preference here, then regenerate your itinerary to apply it."
                : "Choose a preferred day or leave a place flexible for VibeTravel to arrange."}
          </p>

          <div className="flex flex-col gap-4">
            {groups.map((group) => {
              const estimatedHours = group.places.reduce(
                (total, saved) =>
                  total + estimateDurationHours(saved.attraction_data?.estimatedDuration),
                0
              )
              const isBusy =
                group.value !== "" &&
                (estimatedHours > 8 || group.places.length > 4)

              return (
                <section
                  key={group.value || "unscheduled"}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {group.label}
                      </h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {group.places.length} {group.places.length === 1 ? "place" : "places"}
                    </span>
                  </div>

                  {isBusy && (
                    <div className="flex gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-xs leading-relaxed">
                        Busy day — about {formatHours(estimatedHours)} hours before travel and meals.
                      </p>
                    </div>
                  )}

                  {group.places.length > 0 ? (
                    <div className="divide-y divide-border">
                      {group.places.map((saved) => {
                        const selectedDate = validDates.has(
                          saved.attraction_data?.plannedDate ?? ""
                        )
                          ? saved.attraction_data.plannedDate ?? ""
                          : ""
                        const duration = saved.attraction_data?.estimatedDuration

                        return (
                          <div key={saved.id} className="p-4">
                            <h4 className="text-sm font-medium text-foreground">
                              {saved.attraction_name}
                            </h4>
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {saved.attraction_data?.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="line-clamp-1">
                                    {saved.attraction_data.location}
                                  </span>
                                </span>
                              )}
                              {duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {duration}
                                </span>
                              )}
                            </div>
                            {dateOptions.length > 0 && (
                              <select
                                aria-label={`Preferred day for ${saved.attraction_name}`}
                                value={selectedDate}
                                onChange={(event) =>
                                  void updatePlannedDate(saved, event.target.value)
                                }
                                disabled={savingId !== null}
                                className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                              >
                                <option value="">Let the itinerary choose</option>
                                {dateOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="px-4 py-5 text-center text-xs text-muted-foreground">
                      No places planned for this day yet.
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <Search className="mx-auto mb-3 h-6 w-6 text-primary" />
          <p className="text-sm text-muted-foreground">
            No saved places yet. Find a few favorites to start shaping your days.
          </p>
          <Link
            href={`/search?trip=${trip.id}&dest=${encodeURIComponent(trip.destination)}`}
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Find places
          </Link>
        </div>
      )}
    </div>
  )
}
