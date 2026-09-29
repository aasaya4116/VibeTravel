"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Download,
  Luggage,
  Sparkles,
  TicketCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
  buildOfflineTripHtml,
  getDepartureStatus,
  offlineTripFilename,
} from "@/lib/departure-center"
import { normalizeTripReadiness } from "@/lib/trip-readiness"
import type { Trip, TripReadinessState } from "@/lib/types"
import {
  ITINERARY_SAVED_EVENT,
  type ItinerarySavedDetail,
} from "@/lib/trip-events"

interface DepartureCenterProps {
  trip: Trip
  initialReadiness?: TripReadinessState | null
}

const PHASE_LABELS = {
  no_dates: "Departure center",
  planning: "Planning ahead",
  booking: "Booking window",
  final_checks: "Final checks",
  departure_day: "Departure day",
  traveling: "Trip in progress",
  past: "Trip archive",
}

export function DepartureCenter({ trip, initialReadiness }: DepartureCenterProps) {
  const [readiness, setReadiness] = useState(() => normalizeTripReadiness(initialReadiness))
  const [currentItinerary, setCurrentItinerary] = useState(trip.itinerary)

  useEffect(() => {
    setReadiness(normalizeTripReadiness(initialReadiness))
    setCurrentItinerary(trip.itinerary)
  }, [initialReadiness, trip.id, trip.itinerary])

  useEffect(() => {
    function handleReadinessSaved(event: Event) {
      const saved = (event as CustomEvent<TripReadinessState>).detail
      if (saved) setReadiness(normalizeTripReadiness(saved))
    }

    window.addEventListener("vibetravel:readiness-saved", handleReadinessSaved)
    return () => window.removeEventListener("vibetravel:readiness-saved", handleReadinessSaved)
  }, [])

  useEffect(() => {
    function handleItinerarySaved(event: Event) {
      const detail = (event as CustomEvent<ItinerarySavedDetail>).detail
      if (detail?.tripId === trip.id) setCurrentItinerary(detail.itinerary)
    }

    window.addEventListener(ITINERARY_SAVED_EVENT, handleItinerarySaved)
    return () => window.removeEventListener(ITINERARY_SAVED_EVENT, handleItinerarySaved)
  }, [trip.id])

  const currentTrip = useMemo(
    () => ({ ...trip, itinerary: currentItinerary }),
    [currentItinerary, trip]
  )

  const status = useMemo(
    () => getDepartureStatus(currentTrip, readiness),
    [currentTrip, readiness]
  )
  const attentionCount = status.unresolvedBookings + status.incompleteTasks
  const isUrgent = status.phase === "final_checks" || status.phase === "departure_day"
  const hasItinerary = (currentTrip.itinerary?.length ?? 0) > 0

  function openReadiness() {
    window.dispatchEvent(new Event("vibetravel:open-readiness"))
  }

  function downloadOfflinePack() {
    if (!hasItinerary) {
      toast.error("Add an itinerary before downloading an offline pack")
      return
    }

    const html = buildOfflineTripHtml(currentTrip, readiness)
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = offlineTripFilename(currentTrip.title)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success("Offline trip pack downloaded")
  }

  return (
    <section
      className={`mb-8 overflow-hidden rounded-2xl border card-soft ${
        status.ready
          ? "border-accent/25 bg-gradient-to-br from-accent/10 via-card to-background"
          : isUrgent
            ? "border-amber-300/70 bg-gradient-to-br from-amber-50 via-card to-primary/5 dark:border-amber-900/50 dark:from-amber-950/20"
            : "border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/5"
      }`}
    >
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                status.ready
                  ? "bg-accent text-accent-foreground"
                  : isUrgent
                    ? "bg-amber-500 text-white"
                    : "bg-primary text-primary-foreground"
              }`}
            >
              {status.ready ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : status.phase === "traveling" ? (
                <Luggage className="h-5 w-5" />
              ) : (
                <CalendarClock className="h-5 w-5" />
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  {PHASE_LABELS[status.phase]}
                </p>
                {status.ready && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    <Check className="h-3 w-3" /> Ready
                  </span>
                )}
              </div>
              <h2 className="mt-1 font-serif text-2xl text-foreground">{status.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {status.description}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-background/80">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  status.ready ? "bg-accent" : "bg-gradient-to-r from-primary to-accent"
                }`}
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold text-foreground">{status.progress}% ready</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {status.unresolvedBookings > 0 && (
              <button
                type="button"
                onClick={openReadiness}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <TicketCheck className="h-3.5 w-3.5" />
                {status.unresolvedBookings} booking{status.unresolvedBookings === 1 ? "" : "s"} to review
              </button>
            )}
            {status.incompleteTasks > 0 && (
              <button
                type="button"
                onClick={openReadiness}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                {status.incompleteTasks} task{status.incompleteTasks === 1 ? "" : "s"} remaining
              </button>
            )}
            {attentionCount === 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Everything checked
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:w-52 lg:flex-col">
          <button
            type="button"
            onClick={openReadiness}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <TicketCheck className="h-4 w-4" />
            {attentionCount > 0 ? "Review readiness" : "View readiness"}
          </button>
          <button
            type="button"
            onClick={downloadOfflinePack}
            disabled={!hasItinerary}
            title={hasItinerary ? "Download a private-safe offline copy" : "Add an itinerary first"}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Offline trip pack
          </button>
        </div>
      </div>

      <div className="border-t border-border/70 bg-background/45 px-5 py-2.5 text-center text-[11px] text-muted-foreground sm:px-6">
        Offline packs include only your schedule and locations—never confirmations, costs, private links, or notes.
      </div>
    </section>
  )
}
