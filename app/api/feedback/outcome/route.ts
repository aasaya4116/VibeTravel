import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  enforceRateLimit,
  rateLimitResponse,
  RATE_LIMIT_TIERS,
} from "@/lib/rate-limit"
import { escapeSlackText, sendSlackWebhook } from "@/lib/slack"

const MAX_BODY_BYTES = 8_192

const outcomeSchema = z
  .object({
    outcome: z.enum(["works_great", "needs_tweaks", "not_quite"]),
    comment: z
      .string()
      .trim()
      .max(1_500)
      .transform((value) => value || null)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    trip_id: z.string().uuid().nullable().optional(),
  })
  .strict()

const outcomeEmoji: Record<z.infer<typeof outcomeSchema>["outcome"], string> = {
  works_great: "✅",
  needs_tweaks: "🔧",
  not_quite: "❌",
}

const outcomeLabels: Record<z.infer<typeof outcomeSchema>["outcome"], string> = {
  works_great: "Works great",
  needs_tweaks: "Needs tweaks",
  not_quite: "Not quite right",
}

function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...Object.fromEntries(new Headers(headers)),
    },
  })
}

function tooLargeResponse() {
  return json({ error: "This feedback is too large." }, 413)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json({ error: "Sign in to share feedback." }, 401)

  const contentLength = Number(req.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return tooLargeResponse()
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return json({ error: "We could not read this feedback." }, 400)
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return tooLargeResponse()
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: "This feedback is not valid JSON." }, 400)
  }

  const parsed = outcomeSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "Check your feedback and try again." }, 400)
  }

  const rateLimit = await enforceRateLimit(req, RATE_LIMIT_TIERS.FEEDBACK_WRITE, {
    userId: user.id,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const { outcome, comment, trip_id } = parsed.data
  try {
    const { error } = await supabase.from("feedback_outcomes").insert({
      user_id: user.id,
      outcome,
      comment,
      trip_id: trip_id ?? null,
    })
    if (error) throw error
  } catch {
    return json({ error: "We could not save your feedback. Please try again." }, 500)
  }

  const lines = [
    `${outcomeEmoji[outcome]} *Itinerary Outcome* — ${outcomeLabels[outcome]}`,
    comment ? `> “${escapeSlackText(comment)}”` : null,
  ]
    .filter(Boolean)
    .join("\n")
  await sendSlackWebhook(lines)

  return json({ ok: true }, 200, rateLimit.headers)
}
