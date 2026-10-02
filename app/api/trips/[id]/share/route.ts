import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createShareToken } from "@/lib/trip-sharing-server"

type RouteContext = { params: Promise<{ id: string }> }

async function getOwner(request: Request, id: string) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const supabase = token
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      )
    : await createClient()
  const {
    data: { user },
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser()

  if (!user) return { error: "Unauthorized" as const, supabase, user: null }

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!trip) return { error: "Trip not found" as const, supabase, user }

  return { error: null, supabase, user }
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params
  const owner = await getOwner(request, id)

  if (owner.error) {
    return NextResponse.json(
      { error: owner.error },
      { status: owner.error === "Unauthorized" ? 401 : 404 }
    )
  }

  const { data, error } = await owner.supabase
    .from("trip_shares")
    .select("token, created_at")
    .eq("trip_id", id)
    .is("revoked_at", null)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Sharing is temporarily unavailable" }, { status: 503 })
  }

  return NextResponse.json(
    data
      ? { active: true, token: data.token, createdAt: data.created_at }
      : { active: false },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params
  const owner = await getOwner(request, id)

  if (owner.error || !owner.user) {
    return NextResponse.json(
      { error: owner.error },
      { status: owner.error === "Unauthorized" ? 401 : 404 }
    )
  }

  const { data: existing, error: existingError } = await owner.supabase
    .from("trip_shares")
    .select("token, created_at")
    .eq("trip_id", id)
    .is("revoked_at", null)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: "Sharing is temporarily unavailable" }, { status: 503 })
  }

  if (existing) {
    return NextResponse.json({
      active: true,
      token: existing.token,
      createdAt: existing.created_at,
    })
  }

  const token = createShareToken()
  const { data, error } = await owner.supabase
    .from("trip_shares")
    .insert({ trip_id: id, created_by: owner.user.id, token })
    .select("token, created_at")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Could not create the share link" }, { status: 400 })
  }

  return NextResponse.json(
    { active: true, token: data.token, createdAt: data.created_at },
    { status: 201 }
  )
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params
  const owner = await getOwner(request, id)

  if (owner.error || !owner.user) {
    return NextResponse.json(
      { error: owner.error },
      { status: owner.error === "Unauthorized" ? 401 : 404 }
    )
  }

  const { error } = await owner.supabase
    .from("trip_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("trip_id", id)
    .eq("created_by", owner.user.id)
    .is("revoked_at", null)

  if (error) {
    return NextResponse.json({ error: "Could not stop sharing" }, { status: 400 })
  }

  return NextResponse.json({ revoked: true })
}
