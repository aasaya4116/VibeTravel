"use client"

import { AlertTriangle, BusFront, Car, ExternalLink, Footprints } from "lucide-react"
import type { TravelMode, TravelSegment } from "@/lib/itinerary-logistics"

interface ItineraryTravelSegmentProps {
  segment: TravelSegment
  mode: TravelMode
  destination: string
}

const MODE_LABELS: Record<TravelMode, string> = {
  walking: "walk",
  transit: "transit",
  driving: "drive",
}

function TravelIcon({ mode }: { mode: TravelMode }) {
  if (mode === "walking") return <Footprints className="h-3.5 w-3.5" />
  if (mode === "driving") return <Car className="h-3.5 w-3.5" />
  return <BusFront className="h-3.5 w-3.5" />
}

function getDirectionsUrl(segment: TravelSegment, mode: TravelMode, destination: string) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${segment.from.attraction_name}, ${destination}`,
    destination: `${segment.to.attraction_name}, ${destination}`,
    travelmode: mode,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function ItineraryTravelSegment({
  segment,
  mode,
  destination,
}: ItineraryTravelSegmentProps) {
  const miles = segment.distanceKm == null ? null : segment.distanceKm * 0.621371
  const warning =
    segment.status === "overlap"
      ? `Times overlap by ${Math.abs(segment.gapMinutes ?? 0)} min`
      : segment.status === "tight"
        ? `Only ${Math.max(segment.gapMinutes ?? 0, 0)} min available`
        : segment.status === "far"
          ? "Long transfer — consider another day"
          : null
  const warningStyle =
    segment.status === "overlap"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"

  return (
    <div
      className={`my-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-[11px] ${
        warning
          ? warningStyle
          : "border-border/70 bg-muted/30 text-muted-foreground"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <TravelIcon mode={mode} />
        {segment.durationMinutes != null ? (
          <>
            ~{segment.durationMinutes} min {MODE_LABELS[mode]}
            {miles != null && ` · ${miles < 0.1 ? "<0.1" : miles.toFixed(1)} mi`}
          </>
        ) : (
          "Travel estimate unavailable"
        )}
      </span>
      {warning ? (
        <span className="inline-flex items-center gap-1 font-medium">
          <AlertTriangle className="h-3 w-3" />
          {warning}
        </span>
      ) : segment.gapMinutes != null ? (
        <span>{Math.max(segment.gapMinutes, 0)} min between stops</span>
      ) : null}
      <a
        href={getDirectionsUrl(segment, mode, destination)}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
      >
        Directions <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
