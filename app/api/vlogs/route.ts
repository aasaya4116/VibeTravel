import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit, rateLimitResponse, RATE_LIMIT_TIERS } from "@/lib/rate-limit"

function cleanDestination(value: string | null) {
  return (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
}

export async function GET(req: NextRequest) {
  const destination = cleanDestination(req.nextUrl.searchParams.get("destination"))
  if (!destination) {
    return NextResponse.json({ error: "destination required" }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API not configured" }, { status: 503 })
  }

  const rateLimit = await enforceRateLimit(req, RATE_LIMIT_TIERS.PROVIDER_SEARCH)
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "6",
    q: `family travel ${destination} vlog`,
    key: apiKey,
    videoCategoryId: "19",
    relevanceLanguage: "en",
    safeSearch: "strict",
  })
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(5_000)]),
    })
    if (!res.ok) {
      return NextResponse.json({ error: "YouTube fetch failed" }, { status: 502 })
    }

    const data = await res.json()

    const items = Array.isArray(data?.items) ? data.items : []
    const videos = items
      .map((item: unknown) => {
        if (!item || typeof item !== "object") return null
        const entry = item as Record<string, unknown>
        const id = entry.id && typeof entry.id === "object"
          ? String((entry.id as Record<string, unknown>).videoId ?? "")
          : ""
        const snippet = entry.snippet && typeof entry.snippet === "object"
          ? entry.snippet as Record<string, unknown>
          : null
        if (!/^[A-Za-z0-9_-]{6,20}$/.test(id) || !snippet) return null
        const thumbnails = snippet.thumbnails && typeof snippet.thumbnails === "object"
          ? snippet.thumbnails as Record<string, unknown>
          : {}
        const medium = thumbnails.medium && typeof thumbnails.medium === "object"
          ? thumbnails.medium as Record<string, unknown>
          : null
        const fallback = thumbnails.default && typeof thumbnails.default === "object"
          ? thumbnails.default as Record<string, unknown>
          : null
        return {
          id,
          title: String(snippet.title ?? "Travel video").slice(0, 200),
          channel: String(snippet.channelTitle ?? "").slice(0, 120),
          thumbnail: String(medium?.url ?? fallback?.url ?? "").slice(0, 500),
          url: `https://www.youtube.com/watch?v=${id}`,
        }
      })
      .filter(Boolean)
      .slice(0, 6)

    return NextResponse.json({ videos }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    })
  } catch {
    return NextResponse.json({ error: "YouTube fetch failed" }, { status: 502 })
  }
}
