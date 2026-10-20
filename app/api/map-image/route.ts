import { NextRequest } from "next/server"
import { enforceRateLimit, rateLimitResponse, RATE_LIMIT_TIERS } from "@/lib/rate-limit"
import {
  captureUnexpectedApiError,
  isExpectedRequestInterruption,
} from "@/lib/sentry-server"

// Named colors for up to 6 days
const DAY_COLORS = ["red", "blue", "green", "orange", "purple", "yellow"]

function cleanText(value: string, maximum: number) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const places = searchParams
    .getAll("place")
    .map((place) => cleanText(place, 140))
    .filter(Boolean)
    .slice(0, 20)
  const colors = searchParams.getAll("color") // day index strings
  const dest = cleanText(searchParams.get("dest") || "", 160)
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    return new Response("Map service is not configured", { status: 503 })
  }
  if (places.length === 0) {
    return new Response("Missing params", { status: 400 })
  }

  const rateLimit = await enforceRateLimit(req, RATE_LIMIT_TIERS.PROVIDER_MEDIA)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  // Cap at 20 markers to stay within URL limits
  const cappedPlaces = places.slice(0, 20)
  const cappedColors = colors.slice(0, 20)

  // Build URL manually — URLSearchParams would encode `:` in "color:red" and `|` separators,
  // breaking the Google Static Maps marker format which requires literal colons.
  let urlStr = `https://maps.googleapis.com/maps/api/staticmap?size=800x420&scale=2&maptype=roadmap&key=${encodeURIComponent(apiKey)}`

  cappedPlaces.forEach((place, i) => {
    const parsedDayIndex = Number.parseInt(cappedColors[i] ?? "0", 10)
    const dayIndex = Number.isFinite(parsedDayIndex) && parsedDayIndex >= 0
      ? parsedDayIndex
      : 0
    const color = DAY_COLORS[dayIndex % DAY_COLORS.length]
    const label = String.fromCharCode(65 + (i % 26)) // A, B, C...
    const address = encodeURIComponent(`${place}, ${dest}`)
    // Use %7C for pipe separators (matches Google's own documentation examples)
    urlStr += `&markers=color:${color}%7Clabel:${label}%7C${address}`
  })

  try {
    const res = await fetch(urlStr, {
      next: { revalidate: 86400 },
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(5_000)]),
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        captureUnexpectedApiError(new Error("Map provider rejected request"), {
          route: "/api/map-image",
          operation: "fetch_static_map",
        })
      }
      return new Response("Map unavailable", { status: 502 })
    }

    const img = await res.arrayBuffer()
    return new Response(img, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch (error) {
    if (!req.signal.aborted && !isExpectedRequestInterruption(error)) {
      captureUnexpectedApiError(error, {
        route: "/api/map-image",
        operation: "fetch_static_map",
      })
    }
    return new Response("Map unavailable", { status: 500 })
  }
}
