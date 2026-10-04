import type { Attraction, ItineraryDay, ItineraryItem } from "@/lib/types"

function copyItinerary(itinerary: ItineraryDay[]): ItineraryDay[] {
  return itinerary.map((day) => ({ ...day, items: [...day.items] }))
}

export function reorderItineraryItem(
  itinerary: ItineraryDay[],
  dayIndex: number,
  itemId: string,
  offset: -1 | 1
): ItineraryDay[] {
  const currentIndex = itinerary[dayIndex]?.items.findIndex(
    (item) => item.id === itemId
  )
  if (currentIndex == null || currentIndex < 0) return itinerary

  const targetIndex = currentIndex + offset
  if (targetIndex < 0 || targetIndex >= itinerary[dayIndex].items.length) {
    return itinerary
  }

  const next = copyItinerary(itinerary)
  const items = next[dayIndex].items
  ;[items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]]
  return next
}

export function moveItineraryItem(
  itinerary: ItineraryDay[],
  fromDayIndex: number,
  itemId: string,
  toDayIndex: number
): ItineraryDay[] {
  if (fromDayIndex === toDayIndex || !itinerary[toDayIndex]) return itinerary

  const currentIndex = itinerary[fromDayIndex]?.items.findIndex(
    (item) => item.id === itemId
  )
  if (currentIndex == null || currentIndex < 0) return itinerary

  const next = copyItinerary(itinerary)
  const [item] = next[fromDayIndex].items.splice(currentIndex, 1)
  next[toDayIndex].items.push(item)
  return next
}

export function updateItineraryItem(
  itinerary: ItineraryDay[],
  dayIndex: number,
  itemId: string,
  updates: Pick<ItineraryItem, "start_time" | "end_time" | "notes">
): ItineraryDay[] {
  if (!itinerary[dayIndex]) return itinerary

  const next = copyItinerary(itinerary)
  const itemIndex = next[dayIndex].items.findIndex((item) => item.id === itemId)
  if (itemIndex < 0) return itinerary
  next[dayIndex].items[itemIndex] = {
    ...next[dayIndex].items[itemIndex],
    ...updates,
  }
  return next
}

export function removeItineraryItem(
  itinerary: ItineraryDay[],
  dayIndex: number,
  itemId: string
): ItineraryDay[] {
  if (!itinerary[dayIndex]) return itinerary
  const next = copyItinerary(itinerary)
  const itemIndex = next[dayIndex].items.findIndex((item) => item.id === itemId)
  if (itemIndex < 0) return itinerary
  next[dayIndex].items.splice(itemIndex, 1)
  return next
}

export function restoreItineraryItem(
  itinerary: ItineraryDay[],
  dayIndex: number,
  item: ItineraryItem,
  itemIndex: number
): ItineraryDay[] {
  if (!itinerary[dayIndex]) return itinerary
  if (itinerary.some((day) => day.items.some((candidate) => candidate.id === item.id))) {
    return itinerary
  }

  const next = copyItinerary(itinerary)
  const safeIndex = Math.min(Math.max(itemIndex, 0), next[dayIndex].items.length)
  next[dayIndex].items.splice(safeIndex, 0, item)
  return next
}

export function mergeRegeneratedDay(
  itinerary: ItineraryDay[],
  targetDate: string,
  rebuiltDay: ItineraryDay
): ItineraryDay[] {
  const targetDay = itinerary.find((day) => day.date === targetDate)
  if (!targetDay) return itinerary

  const originalUserPicks = new Map(
    targetDay.items
      .filter(
        (item) =>
          item.recommended === false ||
          item.status === "completed" ||
          item.status === "skipped"
      )
      .map((item) => [item.attraction_name.toLowerCase(), item])
  )
  const protectedItems = rebuiltDay.items.map(
    (item) => originalUserPicks.get(item.attraction_name.toLowerCase()) ?? item
  )
  const returnedNames = new Set(
    protectedItems.map((item) => item.attraction_name.toLowerCase())
  )
  const missingUserPicks = targetDay.items.filter(
    (item) =>
      (item.recommended === false ||
        item.status === "completed" ||
        item.status === "skipped") &&
      !returnedNames.has(item.attraction_name.toLowerCase())
  )
  const safeRebuiltDay = {
    ...rebuiltDay,
    items: [...protectedItems, ...missingUserPicks].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    ),
  }

  return itinerary.map((day) => (day.date === targetDate ? safeRebuiltDay : day))
}

/**
 * Adds or refreshes one generated section without replacing days that were
 * planned in an earlier request. Existing traveler picks and completed/skipped
 * stops remain protected through mergeRegeneratedDay.
 */
export function mergeItinerarySection(
  itinerary: ItineraryDay[],
  rebuiltDays: ItineraryDay[],
  tripDates: string[]
): ItineraryDay[] {
  const merged = rebuiltDays.reduce(
    (current, rebuiltDay) =>
      current.some((day) => day.date === rebuiltDay.date)
        ? mergeRegeneratedDay(current, rebuiltDay.date, rebuiltDay)
        : [...current, rebuiltDay],
    itinerary
  )
  const dateOrder = new Map(tripDates.map((date, index) => [date, index]))

  return [...merged].sort(
    (a, b) => (dateOrder.get(a.date) ?? 0) - (dateOrder.get(b.date) ?? 0)
  )
}

function timeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function minutesToTime(value: number) {
  const safe = Math.min(Math.max(value, 0), 23 * 60 + 59)
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`
}

function estimatedDurationMinutes(value: string) {
  const match = /(\d+(?:\.\d+)?)/.exec(value)
  if (!match) return 90
  const duration = Number(match[1]) * (value.toLowerCase().includes("min") ? 1 : 60)
  return Math.min(Math.max(Math.round(duration), 45), 180)
}

/**
 * Targeted refreshes must honor places the traveler assigned to that day even
 * when the model accidentally omits one. Missing saved places are appended in
 * the next available time slot and remain marked as traveler picks.
 */
export function ensureSavedAttractionsInDay(
  day: ItineraryDay,
  savedAttractions: Attraction[],
  createId: (attraction: Attraction) => string
): ItineraryDay {
  const existingNames = new Set(
    day.items.map((item) => item.attraction_name.trim().toLowerCase())
  )
  const missing = savedAttractions.filter(
    (attraction) => !existingNames.has(attraction.name.trim().toLowerCase())
  )
  if (missing.length === 0) return day

  let nextStart = day.items.reduce((latest, item) => {
    const end = timeToMinutes(item.end_time)
    return end === null ? latest : Math.max(latest, end)
  }, 8 * 60 + 30)

  const added = missing.map((attraction) => {
    const start = Math.min(nextStart + 30, 22 * 60)
    const end = Math.min(start + estimatedDurationMinutes(attraction.estimatedDuration), 23 * 60 + 59)
    nextStart = end
    return {
      id: createId(attraction),
      attraction_name: attraction.name,
      start_time: minutesToTime(start),
      end_time: minutesToTime(end),
      notes: attraction.familyFitReason || attraction.description || "Saved by you.",
      recommended: false,
      item_type: "place" as const,
      fit_signals: (attraction.familyFitSignals ?? [])
        .map((signal) => signal.label)
        .slice(0, 3),
    } satisfies ItineraryItem
  })

  return {
    ...day,
    items: [...day.items, ...added].sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }
}

/**
 * A traveler-selected date is authoritative. Models may place a supplied
 * attraction on another day even when prompted correctly, so remove any
 * misplaced copy and deterministically restore it to the requested day.
 */
export function pinSavedAttractionsToDates(
  days: ItineraryDay[],
  savedAttractions: Attraction[],
  createId: (attraction: Attraction) => string
): ItineraryDay[] {
  const availableDates = new Set(days.map((day) => day.date))
  const pinnedByName = new Map(
    savedAttractions
      .filter(
        (attraction) =>
          attraction.plannedDate && availableDates.has(attraction.plannedDate)
      )
      .map((attraction) => [attraction.name.trim().toLowerCase(), attraction])
  )

  if (pinnedByName.size === 0) return days

  const correctedDays = days.map((day) => ({
    ...day,
    items: day.items.flatMap((item) => {
      const pinned = pinnedByName.get(item.attraction_name.trim().toLowerCase())
      if (!pinned) return [item]
      if (pinned.plannedDate !== day.date) return []
      return [{ ...item, recommended: false }]
    }),
  }))

  return correctedDays.map((day) =>
    ensureSavedAttractionsInDay(
      day,
      savedAttractions.filter((attraction) => attraction.plannedDate === day.date),
      createId
    )
  )
}

/**
 * Final write-time invariant for a complete itinerary rebuild. Every saved
 * traveler pick must appear exactly once, regardless of what the model
 * returned. Name matching is normalized because legacy rows do not yet carry
 * a stable saved-attraction id inside itinerary JSON.
 */
export function reconcileSavedAttractionsInItinerary(
  days: ItineraryDay[],
  savedAttractions: Attraction[],
  createId: (attraction: Attraction) => string
): ItineraryDay[] {
  if (days.length === 0 || savedAttractions.length === 0) return days

  const normalize = (value: string) => value.trim().toLowerCase()
  const savedByName = new Map(
    savedAttractions.map((attraction) => [normalize(attraction.name), attraction])
  )
  const seen = new Set<string>()
  let reconciled = days.map((day) => ({
    ...day,
    items: day.items.flatMap((item) => {
      const key = normalize(item.attraction_name)
      const saved = savedByName.get(key)
      if (!saved) return [item]
      if (seen.has(key)) return []
      seen.add(key)
      return [{ ...item, recommended: false }]
    }),
  }))

  let flexibleDayIndex = 0
  for (const attraction of savedAttractions) {
    const key = normalize(attraction.name)
    if (seen.has(key)) continue

    const preferredDayIndex = attraction.plannedDate
      ? reconciled.findIndex((day) => day.date === attraction.plannedDate)
      : -1
    const dayIndex = preferredDayIndex >= 0
      ? preferredDayIndex
      : flexibleDayIndex++ % reconciled.length

    reconciled = reconciled.map((day, index) => index === dayIndex
      ? ensureSavedAttractionsInDay(day, [attraction], createId)
      : day)
    seen.add(key)
  }

  return reconciled
}
