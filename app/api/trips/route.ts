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

  const { title, destination, start_date, end_date, accommodation_area } = await req.json()

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      title,
      destination,
      start_date: start_date || null,
      end_date: end_date || null,
      accommodation_area: accommodation_area || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
