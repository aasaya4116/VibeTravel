const API_KEY = process.env.YELP_API_KEY

export function isConfigured() {
  return !!API_KEY
}

export interface YelpBusiness {
  name: string
  rating: number
  reviewCount: number
  priceRange: string | null // "$", "$$", "$$$", "$$$$"
  categories: string[]
  address: string
  phone: string | null
  url: string
  imageUrl: string | null
  isClosed: boolean
  distance: number | null // meters
}

export async function searchRestaurants(
  destination: string,
  query = "family restaurant",
  dietary?: string[]
): Promise<YelpBusiness[]> {
  if (!API_KEY) return []

  try {
    const terms = [query, ...(dietary ?? [])].join(" ")
    const params = new URLSearchParams({
      location: destination,
      term: terms,
      categories: "restaurants,food,cafes",
      limit: "8",
      sort_by: "best_match",
    })

    const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    })

    if (!res.ok) return []

    const data = await res.json()
    const businesses = data.businesses ?? []

    return businesses.map((b: {
      name: string
      rating: number
      review_count: number
      price?: string
      categories: { title: string }[]
      location: { display_address: string[] }
      phone?: string
      url: string
      image_url?: string
      is_closed: boolean
      distance?: number
    }) => ({
      name: b.name,
      rating: b.rating,
      reviewCount: b.review_count,
      priceRange: b.price ?? null,
      categories: b.categories?.map((c) => c.title) ?? [],
      address: b.location?.display_address?.join(", ") ?? "",
      phone: b.phone ?? null,
      url: b.url,
      imageUrl: b.image_url ?? null,
      isClosed: b.is_closed,
      distance: b.distance ?? null,
    }))
  } catch {
    return []
  }
}

export async function searchNearby(
  destination: string,
  query: string,
  limit = 5
): Promise<YelpBusiness[]> {
  if (!API_KEY) return []

  try {
    const params = new URLSearchParams({
      location: destination,
      term: query,
      limit: String(limit),
      sort_by: "rating",
    })

    const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })

    if (!res.ok) return []
    const data = await res.json()

    return (data.businesses ?? []).map((b: {
      name: string
      rating: number
      review_count: number
      price?: string
      categories: { title: string }[]
      location: { display_address: string[] }
      phone?: string
      url: string
      image_url?: string
      is_closed: boolean
      distance?: number
    }) => ({
      name: b.name,
      rating: b.rating,
      reviewCount: b.review_count,
      priceRange: b.price ?? null,
      categories: b.categories?.map((c) => c.title) ?? [],
      address: b.location?.display_address?.join(", ") ?? "",
      phone: b.phone ?? null,
      url: b.url,
      imageUrl: b.image_url ?? null,
      isClosed: b.is_closed,
      distance: b.distance ?? null,
    }))
  } catch {
    return []
  }
}
