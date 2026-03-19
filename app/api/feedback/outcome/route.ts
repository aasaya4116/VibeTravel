import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { outcome, comment, trip_id } = await req.json()
  if (!outcome) return NextResponse.json({ error: "Missing outcome" }, { status: 400 })

  const { error } = await supabase.from("feedback_outcomes").insert({
    user_id: user.id,
    outcome,
    comment: comment ?? null,
    trip_id: trip_id ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Slack notification
  const webhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL
  if (webhook) {
    const outcomeEmoji: Record<string, string> = {
      works_great: "✅",
      needs_tweaks: "🔧",
      not_quite: "❌",
    }
    const outcomeLabel: Record<string, string> = {
      works_great: "Works great",
      needs_tweaks: "Needs tweaks",
      not_quite: "Not quite right",
    }
    const lines = [
      `${outcomeEmoji[outcome] ?? "📋"} *Itinerary Outcome* — ${outcomeLabel[outcome] ?? outcome}`,
      comment ? `> "${comment}"` : null,
    ].filter(Boolean).join("\n")

    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
