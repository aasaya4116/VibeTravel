const API_KEY = process.env.VIATOR_API_KEY

export function isConfigured() {
  return !!API_KEY
}

export interface ViatorTour {
  name: string
  description: string
  duration: string
  price: number | null
  currency: string
  rating: number | null
  reviewCount: number
  url: string
  imageUrl: string | null
  highlights: string[]
  ageRange: string | null
  cancellationPolicy: string | null
}

export async function searchTours(
  destination: string,
  query = "family activities",
  options?: { minAge?: number; maxAge?: number }
): Promise<ViatorTour[]> {
  if (!API_KEY) return []

  try {
    const baseUrl = process.env.VIATOR_SANDBOX === "true"
      ? "https://api.sandbox.viator.com"
      : "https://api.viator.com"
    const res = await fetch(`${baseUrl}/partner/products/search`, {
      method: "POST",
      headers: {
        "exp-api-key": API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json;version=2.0",
        "Accept-Language": "en-US",
      },
      body: JSON.stringify({
        filtering: {
          destination,
          tags: query ? [query] : undefined,
          ageRange: options?.minAge
            ? { minimum: options.minAge, maximum: options.maxAge ?? 99 }
            : undefined,
        },
        sorting: {
          sort: "REVIEW_AVG_RATING_A",
          order: "DESCENDING",
        },
        pagination: {
          start: 1,
          count: 8,
        },
        currency: "USD",
      }),
    })

    if (!res.ok) return []

    const data = await res.json()
    const products = data.products ?? []

    return products.map((p: {
      title: string
      description: string
      duration?: { fixedDurationInMinutes?: number }
      pricing?: { summary?: { fromPrice?: number }; currency?: string }
      reviews?: { combinedAverageRating?: number; totalReviews?: number }
      productUrl: string
      images?: { variants?: { url?: string }[] }[]
      highlights?: string[]
      itinerary?: { ageRange?: { minimum?: number; maximum?: number } }
      cancellationPolicy?: { type?: string }
    }) => {
      const minutes = p.duration?.fixedDurationInMinutes
      const duration = minutes
        ? minutes >= 60
          ? `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) !== 1 ? "s" : ""}`
          : `${minutes} min`
        : "Varies"

      const ageMin = p.itinerary?.ageRange?.minimum
      const ageMax = p.itinerary?.ageRange?.maximum
      const ageRange = ageMin != null ? `Ages ${ageMin}${ageMax ? `–${ageMax}` : "+"}` : null

      return {
        name: p.title,
        description: p.description?.slice(0, 200) ?? "",
        duration,
        price: p.pricing?.summary?.fromPrice ?? null,
        currency: p.pricing?.currency ?? "USD",
        rating: p.reviews?.combinedAverageRating ?? null,
        reviewCount: p.reviews?.totalReviews ?? 0,
        url: p.productUrl,
        imageUrl: p.images?.[0]?.variants?.[0]?.url ?? null,
        highlights: p.highlights?.slice(0, 3) ?? [],
        ageRange,
        cancellationPolicy: p.cancellationPolicy?.type ?? null,
      }
    })
  } catch {
    return []
  }
}
