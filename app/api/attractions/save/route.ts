import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attraction_name, attraction_data, trip_id } = await req.json()

  const { data, error } = await supabase
    .from("saved_attractions")
    .upsert(
      {
        user_id: user.id,
        attraction_name,
        attraction_data,
        trip_id: trip_id || null,
      },
      { onConflict: "user_id,attraction_name,trip_id" }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { attraction_name, trip_id } = await req.json()

  let query = supabase
    .from("saved_attractions")
    .delete()
    .eq("user_id", user.id)
    .eq("attraction_name", attraction_name)
  if (trip_id != null) {
    query = query.eq("trip_id", trip_id)
  } else {
    query = query.is("trip_id", null)
  }
  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
