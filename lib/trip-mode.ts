import type { ItineraryDay, ItineraryItem } from "./types"
import { formatMinutesAsTime, parseTimeToMinutes } from "./itinerary-logistics"

export function getTripModeDayIndex(
  itinerary: ItineraryDay[],
  today = new Date()
): number {
  if (itinerary.length === 0) return -1
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-")
  const exactIndex = itinerary.findIndex((day) => day.date === localDate)
  if (exactIndex >= 0) return exactIndex
  const futureIndex = itinerary.findIndex((day) => day.date > localDate)
  return futureIndex >= 0 ? futureIndex : itinerary.length - 1
}

export function getActiveStop(
  day: ItineraryDay,
  now = new Date()
): ItineraryItem | null {
  const available = day.items.filter(
    (item) => item.status !== "completed" && item.status !== "skipped"
  )
  if (available.length === 0) return null
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return (
    available.find((item) => {
      const end = parseTimeToMinutes(item.end_time)
      return end == null || end >= nowMinutes
    }) ?? available[available.length - 1]
  )
}

export function setItineraryItemStatus(
  itinerary: ItineraryDay[],
  dayIndex: number,
  itemId: string,
  status: ItineraryItem["status"]
): ItineraryDay[] {
  if (!itinerary[dayIndex]) return itinerary
  const itemIndex = itinerary[dayIndex].items.findIndex((item) => item.id === itemId)
  if (itemIndex < 0) return itinerary
  return itinerary.map((day, index) =>
    index === dayIndex
      ? {
          ...day,
          items: day.items.map((item) =>
            item.id === itemId ? { ...item, status } : item
          ),
        }
      : day
  )
}

export function shiftRemainingStops(
  itinerary: ItineraryDay[],
  dayIndex: number,
  fromItemId: string,
  minutes: number
): ItineraryDay[] {
  const day = itinerary[dayIndex]
  const fromIndex = day?.items.findIndex((item) => item.id === fromItemId) ?? -1
  if (!day || fromIndex < 0 || minutes === 0) return itinerary

  return itinerary.map((candidate, index) =>
    index === dayIndex
      ? {
          ...candidate,
          items: candidate.items.map((item, itemIndex) => {
            if (
              itemIndex < fromIndex ||
              item.status === "completed" ||
              item.status === "skipped"
            ) {
              return item
            }
            const start = parseTimeToMinutes(item.start_time)
            const end = parseTimeToMinutes(item.end_time)
            return {
              ...item,
              start_time:
                start == null ? item.start_time : formatMinutesAsTime(start + minutes),
              end_time: end == null ? item.end_time : formatMinutesAsTime(end + minutes),
            }
          }),
        }
      : candidate
  )
}
