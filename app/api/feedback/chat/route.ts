import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { enforceRateLimit, rateLimitResponse, RATE_LIMIT_TIERS } from "@/lib/rate-limit"
import { escapeSlackText, sendSlackWebhook } from "@/lib/slack"
import { captureUnexpectedApiError } from "@/lib/sentry-server"

const MAX_BODY_BYTES = 48_000

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string().max(12_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(40),
    z.record(jsonValueSchema).refine((value) => Object.keys(value).length <= 40, {
      message: "Object has too many fields",
    }),
  ])
)

const feedbackRequestSchema = z
  .object({
    id: z.string().trim().min(1).max(160).optional(),
    messages: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(160).optional(),
            role: z.enum(["user", "assistant"]),
            metadata: jsonValueSchema.optional(),
            parts: z
              .array(
                z
                  .object({ type: z.string().trim().min(1).max(80) })
                  .catchall(jsonValueSchema)
              )
              .min(1)
              .max(20),
          })
          .strict()
      )
      .min(1)
      .max(24),
    familyVibe: jsonValueSchema.nullable().optional(),
    currentTrip: jsonValueSchema.nullable().optional(),
    tripId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const lastMessage = value.messages.at(-1)
    const hasUserText = lastMessage?.parts.some((part) => {
      const text = (part as Record<string, unknown>).text
      return part.type === "text" && typeof text === "string" && text.trim().length > 0
    })
    if (lastMessage?.role !== "user" || !hasUserText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages", value.messages.length - 1],
        message: "The final message must contain user text",
      })
    }
  })

function requestTooLargeResponse() {
  return Response.json(
    { error: "This feedback conversation is too long. Start a new one and try again." },
    { status: 413 }
  )
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { error: "Sign in to share feedback with Scout." },
      { status: 401 }
    )
  }

  const rateLimit = await enforceRateLimit(req, RATE_LIMIT_TIERS.AI_CHAT, {
    userId: user.id,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const contentLength = Number(req.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return requestTooLargeResponse()
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return Response.json({ error: "We could not read this feedback request." }, { status: 400 })
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return requestTooLargeResponse()
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "This feedback request is not valid JSON." }, { status: 400 })
  }

  const parsed = feedbackRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Check your feedback message and try again." }, { status: 400 })
  }
  const messages = parsed.data.messages as UIMessage[]

  // Save the incoming user message
  {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
    const userText = lastUserMsg?.parts
      ?.flatMap((part) => part.type === "text" ? [part.text] : [])
      .join("") ?? ""
    if (userText) {
      const { error } = await supabase.from("feedback_messages").insert({
        user_id: user.id,
        role: "user",
        content: userText,
      })
      if (error) {
        captureUnexpectedApiError(error, {
          route: "/api/feedback/chat",
          operation: "save_user_feedback_message",
        })
      }
    }
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: `You are Scout in feedback mode — your job is to have a warm, conversational chat with this VibeTravel beta tester to understand their experience.

Your goal: find out whether they got what they came for. Did trip planning actually work for their family?

How to run the conversation:
- Start by asking how their trip planning is going overall
- Dig into specific moments: setting up their family vibe, searching for attractions, generating the itinerary, using Scout
- Ask follow-up questions when something sounds off — "what felt confusing?" or "what were you expecting instead?"
- Be genuinely curious, not clinical. This is a conversation, not a survey
- After 3-4 exchanges, ask if there's anything else they want to share, then wrap up warmly

Keep responses short (2-3 sentences). One question at a time. Don't list multiple questions at once.`,
    messages: await convertToModelMessages(messages),
    onError: ({ error }) => {
      captureUnexpectedApiError(error, {
        route: "/api/feedback/chat",
        operation: "stream_feedback_chat",
      })
    },
    onFinish: async ({ text }: { text: string }) => {
      if (user && text) {
        const { error } = await supabase.from("feedback_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: text,
        })
        if (error) {
          captureUnexpectedApiError(error, {
            route: "/api/feedback/chat",
            operation: "save_assistant_feedback_message",
          })
        }

        // Slack notification after assistant responds (includes growing transcript)
        const webhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL
        if (webhook) {
          const allMessages = [...messages]
          const transcript = allMessages
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m) => {
              const text = m.parts
                .flatMap((part) => part.type === "text" ? [part.text] : [])
                .join("")
              return `*${m.role === "user" ? "Tester" : "Scout"}:* ${text}`
            })
            .join("\n")

          await sendSlackWebhook(
            `💬 *Scout Feedback Conversation*\n\n${escapeSlackText(transcript)}\n*Scout:* ${escapeSlackText(text)}`
          )
        }
      }
    },
  })

  return result.toUIMessageStreamResponse({ headers: rateLimit.headers })
}
