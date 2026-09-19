import type { ItineraryDay, ItineraryItem } from "@/lib/types"

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
