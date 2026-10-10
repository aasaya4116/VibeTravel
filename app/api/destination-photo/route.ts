import { NextRequest, NextResponse } from "next/server"
import { createRequestClient } from "@/lib/supabase/request"
import { isConfigured, searchVerifiedPlaces } from "@/lib/travel-apis/google-places"

export const maxDuration = 15

function clampedDimension(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 64), maximum)
}

export async function GET(req: NextRequest) {
  const destination = (req.nextUrl.searchParams.get("destination") ?? "")
    .trim()
    .slice(0, 160)

  if (!destination) {
    return new Response("Destination required", { status: 400 })
  }

  const width = clampedDimension(req.nextUrl.searchParams.get("width"), 1200, 1600)
  const height = clampedDimension(req.nextUrl.searchParams.get("height"), 800, 2000)

  const { user } = await createRequestClient(req)

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (!isConfigured()) {
    return new Response("Photo service unavailable", { status: 503 })
  }

  const candidates = await searchVerifiedPlaces(
    "iconic skyline landmark scenic viewpoint",
    destination,
    6
  ).catch(() => [])
  const place = candidates.find((candidate) => Boolean(candidate.photoUrl))
  if (!place?.photoUrl) {
    return new Response("Photo unavailable", { status: 404 })
  }

  const photoUrl = new URL(place.photoUrl, req.nextUrl.origin)
  if (photoUrl.origin === req.nextUrl.origin && photoUrl.pathname === "/api/place-photo") {
    photoUrl.searchParams.set("width", String(width))
    photoUrl.searchParams.set("height", String(height))
  }
  const response = NextResponse.redirect(photoUrl, 307)
  response.headers.set(
    "Cache-Control",
    "private, max-age=86400, stale-while-revalidate=604800"
  )
  return response
}
