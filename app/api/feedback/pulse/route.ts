import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  enforceRateLimit,
  rateLimitResponse,
  RATE_LIMIT_TIERS,
} from "@/lib/rate-limit"
import { sendSlackWebhook } from "@/lib/slack"

const MAX_BODY_BYTES = 4_096

const pulseSchema = z
  .object({
    step: z.enum(["vibe_saved", "trip_created", "itinerary_generated"]),
    reaction: z.enum(["great", "okay", "struggling"]),
    trip_id: z.string().uuid().nullable().optional(),
  })
  .strict()

const stepLabels: Record<z.infer<typeof pulseSchema>["step"], string> = {
  vibe_saved: "Set family vibe",
  trip_created: "Created a trip",
  itinerary_generated: "Generated itinerary",
}

const reactionEmoji: Record<z.infer<typeof pulseSchema>["reaction"], string> = {
  great: "😊",
  okay: "😐",
  struggling: "😕",
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

  const parsed = pulseSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "Check your feedback and try again." }, 400)
  }

  const rateLimit = await enforceRateLimit(req, RATE_LIMIT_TIERS.FEEDBACK_WRITE, {
    userId: user.id,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const { step, reaction, trip_id } = parsed.data
  try {
    const { error } = await supabase.from("feedback_pulses").insert({
      user_id: user.id,
      step,
      reaction,
      trip_id: trip_id ?? null,
    })
    if (error) throw error
  } catch {
    return json({ error: "We could not save your feedback. Please try again." }, 500)
  }

  await sendSlackWebhook(
    `${reactionEmoji[reaction]} *Step Feedback* — ${stepLabels[step]}: *${reaction}*`
  )

  return json({ ok: true }, 200, rateLimit.headers)
}
