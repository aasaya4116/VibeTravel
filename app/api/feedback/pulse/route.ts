import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { step, reaction, trip_id } = await req.json()
  if (!step || !reaction) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const { error } = await supabase.from("feedback_pulses").insert({
    user_id: user.id,
    step,
    reaction,
    trip_id: trip_id ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Optional Slack notification
  const webhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL
  if (webhook) {
    const emoji = reaction === "great" ? "😊" : reaction === "okay" ? "😐" : "😕"
    const stepLabel: Record<string, string> = {
      vibe_saved: "Set family vibe",
      trip_created: "Created a trip",
      itinerary_generated: "Generated itinerary",
    }
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${emoji} *Step Feedback* — ${stepLabel[step] ?? step}: *${reaction}*`,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
