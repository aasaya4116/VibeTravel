import { NextRequest } from "next/server"

// Named colors for up to 6 days
const DAY_COLORS = ["red", "blue", "green", "orange", "purple", "yellow"]

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const places = searchParams.getAll("place")
  const colors = searchParams.getAll("color") // day index strings
  const dest = searchParams.get("dest") || ""
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey || places.length === 0) {
    return new Response("Missing params", { status: 400 })
  }

  // Cap at 20 markers to stay within URL limits
  const cappedPlaces = places.slice(0, 20)
  const cappedColors = colors.slice(0, 20)

  // Build URL manually — URLSearchParams would encode `:` in "color:red" and `|` separators,
  // breaking the Google Static Maps marker format which requires literal colons.
  let urlStr = `https://maps.googleapis.com/maps/api/staticmap?size=800x420&scale=2&maptype=roadmap&key=${encodeURIComponent(apiKey)}`

  cappedPlaces.forEach((place, i) => {
    const dayIndex = parseInt(cappedColors[i] ?? "0")
    const color = DAY_COLORS[dayIndex % DAY_COLORS.length]
    const label = String.fromCharCode(65 + (i % 26)) // A, B, C...
    const address = encodeURIComponent(`${place}, ${dest}`)
    // Use %7C for pipe separators (matches Google's own documentation examples)
    urlStr += `&markers=color:${color}%7Clabel:${label}%7C${address}`
  })

  // Log sanitized URL for debugging (key redacted)
  console.log("[map-image] fetching:", urlStr.replace(encodeURIComponent(apiKey), "REDACTED"))

  try {
    const res = await fetch(urlStr, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error(`[map-image] Google Static Maps error ${res.status}:`, errText.slice(0, 500))
      return new Response("Map unavailable", { status: 502 })
    }

    const img = await res.arrayBuffer()
    return new Response(img, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch {
    return new Response("Map unavailable", { status: 500 })
  }
}
