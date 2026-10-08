const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const millisecondsPerDay = 24 * 60 * 60 * 1000

export const MAX_TRIP_DAYS = 90

function isoDateValue(value: string) {
  const match = isoDatePattern.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null

  return timestamp
}

export function isValidIsoDate(value: string) {
  return isoDateValue(value) !== null
}

export function localTodayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function addIsoCalendarDays(value: string, amount: number) {
  const timestamp = isoDateValue(value)
  if (timestamp === null) return ""
  return new Date(timestamp + amount * millisecondsPerDay).toISOString().slice(0, 10)
}

export function inclusiveTripDayCount(startDate: string, endDate: string) {
  const start = isoDateValue(startDate)
  const end = isoDateValue(endDate)
  if (start === null || end === null || end < start) return null
  return Math.round((end - start) / millisecondsPerDay) + 1
}

export function tripLengthLabel(startDate: string, endDate: string) {
  const days = inclusiveTripDayCount(startDate, endDate)
  if (days === null) return ""
  return days === 1 ? "1 day" : `${days} days`
}
