import type { ItineraryDay, ItineraryItem } from "@/lib/types"

export type TravelMode = "walking" | "transit" | "driving"

export interface Coordinates {
  lat: number
  lng: number
}

export interface TravelSegment {
  from: ItineraryItem
  to: ItineraryItem
  distanceKm: number | null
  durationMinutes: number | null
  gapMinutes: number | null
  status: "ok" | "tight" | "overlap" | "far" | "unknown"
}

const MODE_SPEED_KMH: Record<TravelMode, number> = {
  walking: 4.5,
  transit: 20,
  driving: 28,
}

const MODE_OVERHEAD_MINUTES: Record<TravelMode, number> = {
  walking: 3,
  transit: 12,
  driving: 8,
}

const LONG_TRANSFER_KM: Record<TravelMode, number> = {
  walking: 3,
  transit: 12,
  driving: 20,
}

export function parseTimeToMinutes(value?: string | null): number | null {
  const text = value?.trim().toLowerCase()
  if (!text) return null

  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  const period = match[3]
  if (minutes > 59 || hours > (period ? 12 : 23) || hours < 0) return null

  if (period === "am") hours = hours === 12 ? 0 : hours
  if (period === "pm") hours = hours === 12 ? 12 : hours + 12
  return hours * 60 + minutes
}

export function formatMinutesAsTime(value: number): string {
  const safeValue = Math.min(Math.max(Math.round(value), 0), 23 * 60 + 59)
  const hours = Math.floor(safeValue / 60)
  const minutes = safeValue % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function distanceBetweenKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(to.lat - from.lat)
  const longitudeDelta = toRadians(to.lng - from.lng)
  const fromLatitude = toRadians(from.lat)
  const toLatitude = toRadians(to.lat)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function estimateTravelMinutes(distanceKm: number, mode: TravelMode): number {
  const rawMinutes =
    (distanceKm / MODE_SPEED_KMH[mode]) * 60 + MODE_OVERHEAD_MINUTES[mode]
  return Math.max(5, Math.ceil(rawMinutes / 5) * 5)
}

export function getTravelSegments(
  day: ItineraryDay,
  locations: Record<string, Coordinates | null>,
  mode: TravelMode
): TravelSegment[] {
  return day.items.slice(0, -1).map((from, index) => {
    const to = day.items[index + 1]
    const fromLocation = locations[from.attraction_name]
    const toLocation = locations[to.attraction_name]
    const fromEnd = parseTimeToMinutes(from.end_time)
    const toStart = parseTimeToMinutes(to.start_time)
    const gapMinutes =
      fromEnd == null || toStart == null ? null : toStart - fromEnd

    if (!fromLocation || !toLocation) {
      return {
        from,
        to,
        distanceKm: null,
        durationMinutes: null,
        gapMinutes,
        status: gapMinutes != null && gapMinutes < 0 ? "overlap" : "unknown",
      }
    }

    const distanceKm = distanceBetweenKm(fromLocation, toLocation)
    const durationMinutes = estimateTravelMinutes(distanceKm, mode)
    const status =
      gapMinutes != null && gapMinutes < 0
        ? "overlap"
        : gapMinutes != null && gapMinutes < durationMinutes
          ? "tight"
          : distanceKm > LONG_TRANSFER_KM[mode]
            ? "far"
            : "ok"

    return { from, to, distanceKm, durationMinutes, gapMinutes, status }
  })
}

export function getActivityMinutes(day: ItineraryDay): number {
  return day.items.reduce((total, item) => {
    const start = parseTimeToMinutes(item.start_time)
    const end = parseTimeToMinutes(item.end_time)
    return start == null || end == null || end <= start ? total : total + end - start
  }, 0)
}

export function optimizeDayForTravel(
  day: ItineraryDay,
  locations: Record<string, Coordinates | null>,
  mode: TravelMode
): ItineraryDay {
  if (day.items.length < 2) return day

  const located = day.items.filter((item) => locations[item.attraction_name])
  if (located.length < 2) return day

  const ordered: ItineraryItem[] = [located[0]]
  const remaining = located.slice(1)
  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1]
    const currentLocation = locations[current.attraction_name]!
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((candidate, index) => {
      const candidateLocation = locations[candidate.attraction_name]!
      const distance = distanceBetweenKm(currentLocation, candidateLocation)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })
    ordered.push(remaining.splice(nearestIndex, 1)[0])
  }

  const locatedIds = new Set(ordered.map((item) => item.id))
  ordered.push(...day.items.filter((item) => !locatedIds.has(item.id)))

  let cursor = parseTimeToMinutes(day.items[0].start_time) ?? 9 * 60
  const scheduled = ordered.map((item, index) => {
    if (index > 0) {
      const previous = ordered[index - 1]
      const previousLocation = locations[previous.attraction_name]
      const currentLocation = locations[item.attraction_name]
      cursor +=
        previousLocation && currentLocation
          ? estimateTravelMinutes(
              distanceBetweenKm(previousLocation, currentLocation),
              mode
            )
          : 15
    }

    const originalStart = parseTimeToMinutes(item.start_time)
    const originalEnd = parseTimeToMinutes(item.end_time)
    const duration =
      originalStart != null && originalEnd != null && originalEnd > originalStart
        ? originalEnd - originalStart
        : 60
    const start = cursor
    const end = start + duration
    cursor = end
    return {
      ...item,
      start_time: formatMinutesAsTime(start),
      end_time: formatMinutesAsTime(end),
    }
  })

  return { ...day, items: scheduled }
}
