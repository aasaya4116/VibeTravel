const NON_BOOKABLE = /restaurant|cafe|café|bar|food|lunch|dinner|breakfast|brunch|snack|rest|break|hotel|nap|downtime|free time/i

export function getBookingLink(
  item: { attraction_name: string; attraction_data?: { category?: string; yelpUrl?: string } },
  destination: string
): { label: string; url: string } | null {
  const category = item.attraction_data?.category ?? ""
  const name = item.attraction_name

  if (NON_BOOKABLE.test(name) || NON_BOOKABLE.test(category)) {
    if (item.attraction_data?.yelpUrl) {
      return { label: "Find on Yelp", url: item.attraction_data.yelpUrl }
    }
    return null
  }

  const viatorUrl = `https://www.viator.com/search/${encodeURIComponent(destination)}?text=${encodeURIComponent(name)}`
  return { label: "Book on Viator", url: viatorUrl }
}
