import { NextRequest, NextResponse } from "next/server"
import { createRequestClient } from "@/lib/supabase/request"
import { isConfigured, searchPlaces } from "@/lib/travel-apis/google-places"

export const maxDuration = 15

export async function GET(req: NextRequest) {
  const destination = (req.nextUrl.searchParams.get("destination") ?? "")
    .trim()
    .slice(0, 160)

  if (!destination) {
    return new Response("Destination required", { status: 400 })
  }

  const { user } = await createRequestClient(req)

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (!isConfigured()) {
    return new Response("Photo service unavailable", { status: 503 })
  }

  const place = await searchPlaces("iconic landmark", destination)
  if (!place?.photoUrl) {
    return new Response("Photo unavailable", { status: 404 })
  }

  const photoUrl = new URL(place.photoUrl, req.nextUrl.origin)
  const response = NextResponse.redirect(photoUrl, 307)
  response.headers.set(
    "Cache-Control",
    "private, max-age=86400, stale-while-revalidate=604800"
  )
  return response
}
