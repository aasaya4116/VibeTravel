import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const itineraryItemSchema = z.object({
  id: z.string().min(1).max(200),
  attraction_name: z.string().min(1).max(300),
  start_time: z.string().max(40),
  end_time: z.string().max(40),
  notes: z.string().max(2000).optional(),
  recommended: z.boolean().optional(),
  attraction_data: z.record(z.string(), z.unknown()).optional(),
})

const itinerarySchema = z.array(
  z.object({
    date: z.string().min(1).max(40),
    items: z.array(itineraryItemSchema).max(30),
  })
).max(31)

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const allowed = ["status", "title", "destination", "start_date", "end_date", "accommodation_area"]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if ("itinerary" in body) {
    const parsed = itinerarySchema.safeParse(body.itinerary)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid itinerary" }, { status: 400 })
    }
    updates.itinerary = parsed.data
    updates.updated_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("trips")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ deleted: true })
}
