import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

export async function DELETE(request: Request) {
  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Account deletion is not configured yet. Contact VibeTravel support." },
      { status: 503 }
    )
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: "Your session has expired. Sign in and try again." }, { status: 401 })
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error("Account deletion failed", { userId: user.id, message: error.message })
    return NextResponse.json({ error: "We could not delete the account right now. Please contact support." }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
