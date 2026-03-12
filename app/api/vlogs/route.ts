import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const destination = req.nextUrl.searchParams.get("destination")
  if (!destination) {
    return NextResponse.json({ error: "destination required" }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API not configured" }, { status: 500 })
  }

  const q = encodeURIComponent(`family travel ${destination} vlog`)
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=${q}&key=${apiKey}&videoCategoryId=19&relevanceLanguage=en`

  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    return NextResponse.json({ error: "YouTube fetch failed" }, { status: 502 })
  }

  const data = await res.json()

  const videos = (data.items ?? []).map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }))

  return NextResponse.json({ videos })
}
