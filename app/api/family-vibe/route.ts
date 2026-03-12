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

  const body = await req.json()

  const { data, error } = await supabase
    .from("family_vibes")
    .upsert(
      {
        user_id: user.id,
        family_name: body.family_name,
        kids: body.kids,
        travel_style: body.travel_style,
        sensory_needs: body.sensory_needs,
        mobility_notes: body.mobility_notes,
        dietary: body.dietary,
        pace: body.pace,
        budget_preference: body.budget_preference ?? "any",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
