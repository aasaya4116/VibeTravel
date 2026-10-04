import type { ItineraryDay, ItineraryItem } from "./types"

function copyItinerary(itinerary: ItineraryDay[]) {
  return itinerary.map((day) => ({ ...day, items: [...day.items] }))
}

export function reorderItineraryItem(
  itinerary: ItineraryDay[],
  dayIndex: number,
  itemId: string,
  offset: -1 | 1
) {
  const currentIndex = itinerary[dayIndex]?.items.findIndex((item) => item.id === itemId) ?? -1
  const targetIndex = currentIndex + offset
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= (itinerary[dayIndex]?.items.length ?? 0)) return itinerary
  const next = copyItinerary(itinerary)
  ;[next[dayIndex].items[currentIndex], next[dayIndex].items[targetIndex]] = [next[dayIndex].items[targetIndex], next[dayIndex].items[currentIndex]]
  return next
}

export function updateItineraryItem(
  itinerary: ItineraryDay[],
  dayIndex: number,
  itemId: string,
  updates: Pick<ItineraryItem, "start_time" | "end_time" | "notes">
) {
  const next = copyItinerary(itinerary)
  const itemIndex = next[dayIndex]?.items.findIndex((item) => item.id === itemId) ?? -1
  if (itemIndex < 0) return itinerary
  next[dayIndex].items[itemIndex] = { ...next[dayIndex].items[itemIndex], ...updates }
  return next
}

export function moveItineraryItem(
  itinerary: ItineraryDay[],
  fromDayIndex: number,
  itemId: string,
  toDayIndex: number
) {
  if (fromDayIndex === toDayIndex || !itinerary[toDayIndex]) return itinerary
  const next = copyItinerary(itinerary)
  const itemIndex = next[fromDayIndex]?.items.findIndex((item) => item.id === itemId) ?? -1
  if (itemIndex < 0) return itinerary
  const [item] = next[fromDayIndex].items.splice(itemIndex, 1)
  next[toDayIndex].items.push(item)
  next[toDayIndex].items.sort((a, b) => a.start_time.localeCompare(b.start_time))
  return next
}

export function removeItineraryItem(itinerary: ItineraryDay[], dayIndex: number, itemId: string) {
  const next = copyItinerary(itinerary)
  const itemIndex = next[dayIndex]?.items.findIndex((item) => item.id === itemId) ?? -1
  if (itemIndex < 0) return itinerary
  next[dayIndex].items.splice(itemIndex, 1)
  return next
}

