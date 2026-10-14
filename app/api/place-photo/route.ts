import { NextRequest } from "next/server"
import { enforceRateLimit, rateLimitResponse, RATE_LIMIT_TIERS } from "@/lib/rate-limit"
import {
  captureUnexpectedApiError,
  isExpectedRequestInterruption,
} from "@/lib/sentry-server"

// Proxies Google Places photos so the API key never reaches the browser.
// Photo resource names look like: places/<place_id>/photos/<token>
const REF_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/

function clampedDimension(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 64), maximum)
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const ref = req.nextUrl.searchParams.get("ref") ?? ""
  const width = clampedDimension(req.nextUrl.searchParams.get("width"), 1200, 1600)
  const height = clampedDimension(req.nextUrl.searchParams.get("height"), 800, 2000)

  if (!apiKey) return new Response("Not configured", { status: 503 })
  // Reject anything that isn't a well-formed photo ref — prevents this route
  // from being used as an open proxy for arbitrary Google API calls.
  if (!REF_PATTERN.test(ref)) return new Response("Bad ref", { status: 400 })

  const rateLimit = await enforceRateLimit(req, RATE_LIMIT_TIERS.PROVIDER_MEDIA)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const url = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=${height}&maxWidthPx=${width}&key=${apiKey}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(5_000)]),
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        captureUnexpectedApiError(new Error("Photo provider rejected request"), {
          route: "/api/place-photo",
          operation: "fetch_place_photo",
        })
      }
      return new Response("Photo unavailable", { status: 502 })
    }

    if (!res.body) return new Response("Photo unavailable", { status: 502 })

    const headers = new Headers({
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    })
    const contentLength = res.headers.get("content-length")
    const etag = res.headers.get("etag")
    if (contentLength) headers.set("Content-Length", contentLength)
    if (etag) headers.set("ETag", etag)

    return new Response(res.body, { headers })
  } catch (error) {
    if (!req.signal.aborted && !isExpectedRequestInterruption(error)) {
      captureUnexpectedApiError(error, {
        route: "/api/place-photo",
        operation: "fetch_place_photo",
      })
    }
    return new Response("Photo unavailable", { status: 502 })
  }
}
