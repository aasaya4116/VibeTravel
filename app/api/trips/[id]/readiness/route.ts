import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createDefaultReadiness } from "@/lib/trip-readiness"

type RouteContext = { params: Promise<{ id: string }> }

const optionalUrlSchema = z
  .string()
  .max(2000)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "Use a full http or https URL")

const costSchema = z.number().finite().min(0).max(100_000_000).nullable()

const bookingSchema = z.object({
  status: z.enum(["unreviewed", "to_book", "booked", "not_needed"]),
  cost: costSchema,
  confirmation_code: z.string().max(300),
  booking_url: optionalUrlSchema,
})

const checklistItemSchema = z.object({
  id: z.string().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  category: z.enum(["accommodation", "transport", "tickets", "documents", "packing", "other"]),
  completed: z.boolean(),
  cost: costSchema,
  confirmation_code: z.string().max(300),
  booking_url: optionalUrlSchema,
})

const readinessSchema = z.object({
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]),
  budget_target: costSchema,
  bookings: z.record(z.string().min(1).max(200), bookingSchema).refine(
    (bookings) => Object.keys(bookings).length <= 200,
    "Too many booking records"
  ),
  checklist: z.array(checklistItemSchema).max(50),
})

async function getOwnedTrip(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params
  const owner = await getOwnedTrip(id)

  if (owner.error) {
    return NextResponse.json(
      { error: owner.error },
      { status: owner.error === "Unauthorized" ? 401 : 404 }
    )
  }

  const { data, error } = await owner.supabase
    .from("trip_readiness")
    .select("currency, budget_target, bookings, checklist")
    .eq("trip_id", id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Readiness tracking is temporarily unavailable" }, { status: 503 })
  }

  return NextResponse.json(
    { data: data ?? createDefaultReadiness() },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params
  const owner = await getOwnedTrip(id)

  if (owner.error || !owner.user) {
    return NextResponse.json(
      { error: owner.error },
      { status: owner.error === "Unauthorized" ? 401 : 404 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = readinessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid readiness details" },
      { status: 400 }
    )
  }

  const { data, error } = await owner.supabase
    .from("trip_readiness")
    .upsert(
      {
        trip_id: id,
        user_id: owner.user.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trip_id" }
    )
    .select("currency, budget_target, bookings, checklist")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Could not save trip readiness" }, { status: 400 })
  }

  return NextResponse.json({ data })
}
