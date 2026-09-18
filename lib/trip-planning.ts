import type { TripOption } from "@/lib/types"

export interface TripDateOption {
  value: string
  label: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function getTripDateOptions(trip: TripOption | null): TripDateOption[] {
  if (!trip?.start_date || !trip.end_date) return []

  const start = new Date(`${trip.start_date}T00:00:00Z`)
  const end = new Date(`${trip.end_date}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return []
  }

  const dayCount = Math.min(
    31,
    Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1
  )

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS)
    const value = date.toISOString().slice(0, 10)
    const friendlyDate = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    return { value, label: `Day ${index + 1} · ${friendlyDate}` }
  })
}

export function formatPlannedDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function estimateDurationHours(value?: string | null): number {
  const duration = value?.trim().toLowerCase()
  if (!duration) return 2
  if (duration.includes("full day")) return 8

  const hourRange = duration.match(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*hours?/
  )
  if (hourRange) return Number(hourRange[2])

  const hours = Array.from(duration.matchAll(/(\d+(?:\.\d+)?)\s*hours?/g)).map(
    (match) => Number(match[1])
  )
  if (hours.length > 0) return Math.max(...hours)

  const minuteRange = duration.match(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/
  )
  if (minuteRange) return Number(minuteRange[2]) / 60

  const minutes = Array.from(
    duration.matchAll(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/g)
  ).map((match) => Number(match[1]))
  if (minutes.length > 0) return Math.max(...minutes) / 60

  return 2
}
