import { NextRequest } from "next/server"

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

  const url = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=${height}&maxWidthPx=${width}&key=${apiKey}`

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error(`[place-photo] Google error ${res.status}:`, errText.slice(0, 300))
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
  } catch {
    return new Response("Photo unavailable", { status: 502 })
  }
}
