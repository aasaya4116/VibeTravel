import { NextRequest } from "next/server"

// Proxies Google Places photos so the API key never reaches the browser.
// Photo resource names look like: places/<place_id>/photos/<token>
const REF_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const ref = req.nextUrl.searchParams.get("ref") ?? ""

  if (!apiKey) return new Response("Not configured", { status: 503 })
  // Reject anything that isn't a well-formed photo ref — prevents this route
  // from being used as an open proxy for arbitrary Google API calls.
  if (!REF_PATTERN.test(ref)) return new Response("Bad ref", { status: 400 })

  const url = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=800&maxWidthPx=1200&key=${apiKey}`

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error(`[place-photo] Google error ${res.status}:`, errText.slice(0, 300))
      return new Response("Photo unavailable", { status: 502 })
    }

    const img = await res.arrayBuffer()
    return new Response(img, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch {
    return new Response("Photo unavailable", { status: 502 })
  }
}
