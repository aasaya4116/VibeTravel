import { NextRequest } from "next/server"

async function geocodeOne(place: string, dest: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${place}, ${dest}`)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VibeTravelApp/1.0",
        "Accept-Language": "en",
      },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const places = searchParams.getAll("place").slice(0, 25)
  const dest = searchParams.get("dest") || ""

  if (places.length === 0) {
    return Response.json({ results: {} })
  }

  const results: Record<string, { lat: number; lng: number } | null> = {}

  // Sequential with small delay to respect Nominatim's 1 req/sec policy
  for (const place of places) {
    results[place] = await geocodeOne(place, dest)
    await new Promise((r) => setTimeout(r, 120))
  }

  return Response.json({ results }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  })
}
