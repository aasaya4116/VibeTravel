import type { ItineraryDay } from "./types"

export type TravelPace = "slow" | "moderate" | "fast"

export const PACE_GUIDES: Record<TravelPace, {
  maxStops: number
  maxActivityMinutes: number
  prompt: string
}> = {
  slow: {
    maxStops: 3,
    maxActivityMinutes: 330,
    prompt: "2 primary experiences plus a meal, rest, or flexible neighborhood block; about 5.5 scheduled hours",
  },
  moderate: {
    maxStops: 4,
    maxActivityMinutes: 420,
    prompt: "3 primary experiences plus at most one meal, rest, or flexible neighborhood block; about 7 scheduled hours",
  },
  fast: {
    maxStops: 5,
    maxActivityMinutes: 540,
    prompt: "4 primary experiences plus at most one meal, rest, or flexible neighborhood block; about 9 scheduled hours",
  },
}

function timeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function getScheduledActivityMinutes(day: ItineraryDay) {
  return day.items.reduce((total, item) => total + getItemMinutes(item), 0)
}

function getItemMinutes(item: ItineraryDay["items"][number]) {
  const start = timeToMinutes(item.start_time)
  const end = timeToMinutes(item.end_time)
  return start === null || end === null || end <= start ? 0 : end - start
}

function suggestionPriority(itemType: ItineraryDay["items"][number]["item_type"]) {
  if (itemType === "neighborhood") return 0
  if (itemType === "downtime") return 1
  if (itemType === "meal") return 2
  return 3
}

/**
 * AI suggestions are optional. Keep every traveler pick and completed/skipped
 * item, then admit only enough suggestions to fit the family's saved pace.
 */
export function enforcePaceLimit(day: ItineraryDay, pace: TravelPace): ItineraryDay {
  const guide = PACE_GUIDES[pace]
  const protectedItems = day.items.filter(
    (item) => item.recommended === false || item.status === "completed" || item.status === "skipped"
  )
  const availableSuggestionSlots = Math.max(0, guide.maxStops - protectedItems.length)
  const rankedSuggestions = day.items
    .filter((item) => !protectedItems.includes(item))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const priority = suggestionPriority(a.item.item_type) - suggestionPriority(b.item.item_type)
      return priority || a.index - b.index
    })
    .map(({ item }) => item)
  const suggestions: ItineraryDay["items"] = []
  let scheduledMinutes = protectedItems.reduce(
    (total, item) => total + getItemMinutes(item),
    0
  )
  for (const suggestion of rankedSuggestions) {
    if (suggestions.length >= availableSuggestionSlots) break
    const suggestionMinutes = getItemMinutes(suggestion)
    if (scheduledMinutes + suggestionMinutes > guide.maxActivityMinutes) continue
    suggestions.push(suggestion)
    scheduledMinutes += suggestionMinutes
  }

  const kept = new Set([...protectedItems, ...suggestions].map((item) => item.id))
  return {
    ...day,
    items: day.items.filter((item) => kept.has(item.id)),
  }
}

export function assessDayPace(day: ItineraryDay, pace: TravelPace) {
  const guide = PACE_GUIDES[pace]
  const activityMinutes = getScheduledActivityMinutes(day)
  const stopOverage = Math.max(0, day.items.length - guide.maxStops)
  const minuteOverage = Math.max(0, activityMinutes - guide.maxActivityMinutes)
  return {
    fits: stopOverage === 0 && minuteOverage === 0,
    stopOverage,
    minuteOverage,
    maxStops: guide.maxStops,
    maxActivityMinutes: guide.maxActivityMinutes,
  }
}

export function cleanFitSignals(signals: unknown) {
  if (!Array.isArray(signals)) return []
  return signals
    .filter((signal): signal is string => typeof signal === "string")
    .map((signal) => signal.trim())
    .filter(Boolean)
    .slice(0, 3)
}
