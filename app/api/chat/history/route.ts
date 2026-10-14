import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { captureUnexpectedApiError } from "@/lib/sentry-server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tripId = searchParams.get("trip_id") // null = global thread

  // Supabase query builder is immutable — reassign when adding filters
  let query = supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100)

  if (tripId) {
    query = query.eq("trip_id", tripId)
  } else {
    query = query.is("trip_id", null)
  }

  const { data, error } = await query

  if (error) {
    captureUnexpectedApiError(error, {
      route: "/api/chat/history",
      operation: "load_chat_history",
    })
    return NextResponse.json({ error: "Chat history is temporarily unavailable." }, { status: 500 })
  }

  return NextResponse.json({ messages: data ?? [] })
}
