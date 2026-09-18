"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarDays,
  Check,
  LogIn,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import type { Attraction, SavedAttraction, TripOption } from "@/lib/types"
import { getTripDateOptions } from "@/lib/trip-planning"

interface AddToTripDialogProps {
  attraction: Attraction | null
  trips: TripOption[]
  savedAttractions: SavedAttraction[]
  defaultTripId: string | null
  isLoggedIn: boolean
  saving: boolean
  onClose: () => void
  onSave: (tripId: string, plannedDate: string | null) => Promise<void>
  onRemove: (tripId: string) => Promise<void>
}

export function AddToTripDialog({
  attraction,
  trips,
  savedAttractions,
  defaultTripId,
  isLoggedIn,
  saving,
  onClose,
  onSave,
  onRemove,
}: AddToTripDialogProps) {
  const [selectedTripId, setSelectedTripId] = useState("")
  const [plannedDate, setPlannedDate] = useState("")

  useEffect(() => {
    if (!attraction) return
    setSelectedTripId(defaultTripId || trips[0]?.id || "")
  }, [attraction, defaultTripId, trips])

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips]
  )
  const existingSave = useMemo(
    () =>
      attraction
        ? savedAttractions.find(
            (saved) =>
              saved.trip_id === selectedTripId &&
              saved.attraction_name === attraction.name
          ) ?? null
        : null,
    [attraction, savedAttractions, selectedTripId]
  )
  const dateOptions = useMemo(
    () => getTripDateOptions(selectedTrip),
    [selectedTrip]
  )

  useEffect(() => {
    setPlannedDate(existingSave?.attraction_data?.plannedDate ?? "")
  }, [existingSave, selectedTripId])

  if (!attraction) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 px-3 py-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-trip-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-border bg-background p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Trip planner
            </p>
            <h2 id="add-to-trip-title" className="font-serif text-2xl text-foreground">
              Add to your trip
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {attraction.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close trip planner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isLoggedIn ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
            <LogIn className="mx-auto mb-3 h-7 w-7 text-primary" />
            <p className="font-medium text-foreground">Sign in to build a trip</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your saved places and chosen days will stay with your account.
            </p>
            <Link
              href="/auth/login?next=/search"
              className="mt-4 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Sign in
            </Link>
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <Plus className="mx-auto mb-3 h-7 w-7 text-primary" />
            <p className="font-medium text-foreground">Create a trip first</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a destination and optional dates, then come back to plan this place.
            </p>
            <Link
              href="/trips"
              className="mt-4 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Create a trip
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (selectedTripId) {
                void onSave(selectedTripId, plannedDate || null)
              }
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="planner-trip" className="text-sm font-medium text-foreground">
                Trip
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="planner-trip"
                  value={selectedTripId}
                  onChange={(event) => setSelectedTripId(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-input bg-background py-3 pl-10 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title} · {trip.destination}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="planner-day" className="text-sm font-medium text-foreground">
                Day <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="planner-day"
                  value={plannedDate}
                  onChange={(event) => setPlannedDate(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-input bg-background py-3 pl-10 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Let the itinerary choose</option>
                  {dateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {dateOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  This trip has no date range yet, so VibeTravel will choose the best day.
                </p>
              )}
            </div>

            {existingSave && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0" />
                Already in this trip. Update its day or remove it below.
              </div>
            )}

            <div className="mt-1 flex items-center gap-2">
              {existingSave && (
                <button
                  type="button"
                  onClick={() => void onRemove(selectedTripId)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ml-auto rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !selectedTripId}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : existingSave ? "Update day" : "Add to trip"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
