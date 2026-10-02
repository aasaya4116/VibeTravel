export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Dates not set"
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat("en-US", options ?? {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function formatTripDates(start: string | null, end: string | null) {
  if (!start && !end) return "Dates not set"
  if (!end || start === end) return formatDate(start)
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function getDaysUntil(value: string | null) {
  if (!value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(`${value}T00:00:00`)
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000)
}

export function formatDayLabel(value: string) {
  return formatDate(value, { weekday: "short", month: "short", day: "numeric" })
}
