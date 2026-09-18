"use client"

import Link from "next/link"
import { ArrowRight, Check, ListTodo, LogIn, MapPin, Plus } from "lucide-react"
import type { SavedAttraction, TripOption } from "@/lib/types"

interface TripPlanningTrayProps {
  trips: TripOption[]
  selectedTrip: TripOption | null
  savedAttractions: SavedAttraction[]
  isLoggedIn: boolean
  onTripChange: (tripId: string | null) => void
}

export function TripPlanningTray({
  trips,
  selectedTrip,
  savedAttractions,
  isLoggedIn,
  onTripChange,
}: TripPlanningTrayProps) {
  const selectedSaves = selectedTrip
    ? savedAttractions.filter((saved) => saved.trip_id === selectedTrip.id)
    : []
  const count = selectedSaves.length

  return (
    <aside
      aria-label="Trip planning tray"
      className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-background/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-5 sm:p-4"
    >
      {selectedTrip ? (
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
            <ListTodo className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <select
                value={selectedTrip.id}
                onChange={(event) => onTripChange(event.target.value || null)}
                aria-label="Planning trip"
                className="min-w-0 max-w-full truncate border-0 bg-transparent p-0 text-sm font-semibold text-foreground focus:outline-none focus:ring-0 sm:text-base"
              >
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
              {count >= 3 && (
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 sm:inline-flex">
                  <Check className="h-3 w-3" /> Ready
                </span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {selectedTrip.destination} · {count} place{count === 1 ? "" : "s"} saved
            </p>
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min((count / 3) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 sm:block">
            {count > 0 ? (
              <p className="truncate text-xs text-muted-foreground">
                {selectedSaves.slice(0, 2).map((saved) => saved.attraction_name).join(" · ")}
                {count > 2 ? ` · +${count - 2} more` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add three places to unlock your itinerary.
              </p>
            )}
          </div>

          <Link
            href={`/trips/${selectedTrip.id}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
              count >= 3
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            <span className="hidden sm:inline">{count >= 3 ? "Build itinerary" : "View trip"}</span>
            <span className="sm:hidden">{count}/3</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
            <ListTodo className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Start a trip plan</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choose a trip, then add verified places and an optional day.
            </p>
          </div>
          {!isLoggedIn ? (
            <Link
              href="/auth/login?next=/search"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          ) : trips.length > 0 ? (
            <select
              defaultValue=""
              onChange={(event) => onTripChange(event.target.value || null)}
              aria-label="Choose a trip"
              className="max-w-48 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>Choose trip</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>{trip.title}</option>
              ))}
            </select>
          ) : (
            <Link
              href="/trips"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Create trip
            </Link>
          )}
        </div>
      )}
    </aside>
  )
}
