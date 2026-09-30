import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const familyVibeSchema = z.object({
  family_name: z.string().trim().max(120).nullable().optional(),
  kids: z.array(
    z.object({
      name: z.string().trim().min(1).max(80),
      age: z.number().int().min(0).max(18),
      sensoryNeeds: z.array(z.string().trim().max(80)).max(12).optional(),
    })
  ).max(20).default([]),
  travelers: z.array(
    z.object({
      name: z.string().trim().min(1).max(80),
      role: z.enum(["partner", "adult", "grandparent", "extended_family", "friend"]),
      age: z.number().int().min(18).max(120).nullable().optional(),
    })
  ).max(20).default([]),
  travel_style: z.array(z.string().trim().max(80)).max(20).default([]),
  sensory_needs: z.array(z.string().trim().max(80)).max(20).default([]),
  mobility_notes: z.string().trim().max(1000).nullable().optional(),
  dietary: z.array(z.string().trim().max(80)).max(20).default([]),
  pace: z.enum(["slow", "moderate", "fast"]).default("moderate"),
  budget_preference: z.enum(["free", "$", "$$", "$$$", "any"]).default("any"),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = familyVibeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the traveler details and try again." }, { status: 400 })
  }
  const body = parsed.data

  const { data, error } = await supabase
    .from("family_vibes")
    .upsert(
      {
        user_id: user.id,
        family_name: body.family_name,
        kids: body.kids,
        travelers: body.travelers,
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
