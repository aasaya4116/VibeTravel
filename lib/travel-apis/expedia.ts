const RAPID_API_KEY = process.env.EXPEDIA_RAPID_API_KEY

export function isConfigured() {
  return !!RAPID_API_KEY
}

export interface HotelResult {
  name: string
  starRating: number | null
  guestRating: number | null
  reviewCount: number
  pricePerNight: number | null
  currency: string
  address: string
  url: string
  imageUrl: string | null
  amenities: string[]
  distanceFromCenter: string | null
}

const BUDGET_STAR_MAP: Record<string, number> = {
  "$": 2,
  "$$": 3,
  "$$$": 4,
  "any": 0,
}

export async function searchHotels(
  destination: string,
  checkin: string,   // YYYY-MM-DD
  checkout: string,  // YYYY-MM-DD
  budget?: string,   // "$" | "$$" | "$$$" | "any"
  adults = 2,
  children = 0
): Promise<HotelResult[]> {
  if (!RAPID_API_KEY) return []

  try {
    // Step 1: Get regionId for destination
    const geoRes = await fetch(
      `https://hotels-com-provider.p.rapidapi.com/v2/regions?query=${encodeURIComponent(destination)}&domain=US&locale=en_US`,
      {
        headers: {
          "x-rapidapi-key": RAPID_API_KEY,
          "x-rapidapi-host": "hotels-com-provider.p.rapidapi.com",
        },
      }
    )

    if (!geoRes.ok) return []
    const geoData = await geoRes.json()
    const regionId = geoData.data?.[0]?.gaiaId
    if (!regionId) return []

    // Step 2: Search hotels
    const minStars = budget ? BUDGET_STAR_MAP[budget] ?? 0 : 0
    const params = new URLSearchParams({
      region_id: regionId,
      locale: "en_US",
      checkin_date: checkin,
      checkout_date: checkout,
      adults_number: String(adults),
      children_number: String(children),
      sort_order: "REVIEW",
      domain: "US",
      ...(minStars > 0 ? { star_rating_ids: String(minStars) } : {}),
    })

    const searchRes = await fetch(
      `https://hotels-com-provider.p.rapidapi.com/v2/hotels/search?${params}`,
      {
        headers: {
          "x-rapidapi-key": RAPID_API_KEY,
          "x-rapidapi-host": "hotels-com-provider.p.rapidapi.com",
        },
      }
    )

    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const properties = searchData.properties ?? []

    return properties.slice(0, 6).map((p: {
      name: string
      star?: number
      guestReviews?: { rating?: number; total?: number }
      price?: { lead?: { amount?: number; currencyInfo?: { code?: string } } }
      address?: { addressLine?: string }
      propertyDetailsUrl?: string
      propertyImage?: { image?: { url?: string } }
      amenities?: { text?: string }[]
      destinationInfo?: { distanceFromDestination?: { value?: number; unit?: string } }
    }) => ({
      name: p.name,
      starRating: p.star ?? null,
      guestRating: p.guestReviews?.rating ?? null,
      reviewCount: p.guestReviews?.total ?? 0,
      pricePerNight: p.price?.lead?.amount ?? null,
      currency: p.price?.lead?.currencyInfo?.code ?? "USD",
      address: p.address?.addressLine ?? "",
      url: p.propertyDetailsUrl
        ? `https://hotels.com${p.propertyDetailsUrl}`
        : "https://hotels.com",
      imageUrl: p.propertyImage?.image?.url ?? null,
      amenities: (p.amenities ?? []).slice(0, 5).map((a) => a.text ?? "").filter(Boolean),
      distanceFromCenter: p.destinationInfo?.distanceFromDestination
        ? `${p.destinationInfo.distanceFromDestination.value} ${p.destinationInfo.distanceFromDestination.unit}`
        : null,
    }))
  } catch {
    return []
  }
}
