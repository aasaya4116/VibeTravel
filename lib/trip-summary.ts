interface TripSummaryInput {
  destination: string
  itinerary?: { items: { attraction_name: string }[] }[] | null
}

interface TripSummaryVibe {
  kids?: { name?: string; age: number }[] | null
  travelers?: { name?: string; role?: string; age?: number | null }[] | null
  travel_style?: string[] | null
  pace?: string | null
}

function formatList(items: string[]) {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`
}

export function buildTripSummary(
  trip: TripSummaryInput,
  familyVibe: TripSummaryVibe | null
): string | null {
  const highlights = Array.from(
    new Set(
      (trip.itinerary ?? [])
        .flatMap((day) => day.items)
        .map((item) => item.attraction_name?.trim())
        .filter(Boolean)
    )
  ).slice(0, 4) as string[]

  if (highlights.length === 0) return null

  const styles = (familyVibe?.travel_style ?? [])
    .map((style) => style.trim().toLowerCase())
    .filter(Boolean)
  const pace = familyVibe?.pace?.trim().toLowerCase()
  const children = familyVibe?.kids?.length ?? 0
  const otherTravelers = familyVibe?.travelers?.length ?? 0

  const styleLead = styles.length
    ? `Built around your family's ${formatList(styles.slice(0, 2))} style, `
    : "Built around your family, "
  const paceNote = pace
    ? `The ${pace} pace leaves room to enjoy each area without turning the day into a checklist.`
    : "The plan leaves room to enjoy each area without turning the day into a checklist."
  const familyNote = children + otherTravelers > 0 ? " for the whole travel group" : ""

  return `${styleLead}your ${trip.destination} plan brings together ${formatList(highlights)}${familyNote}. ${paceNote}`
}
