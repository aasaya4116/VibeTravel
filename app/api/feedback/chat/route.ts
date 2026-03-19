import { streamText, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const { messages } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Save the incoming user message
  if (user) {
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")
    const userText = lastUserMsg?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("") ?? ""
    if (userText) {
      await supabase.from("feedback_messages").insert({
        user_id: user.id,
        role: "user",
        content: userText,
      })
    }
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
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
    onFinish: async ({ text }: { text: string }) => {
      if (user && text) {
        await supabase.from("feedback_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: text,
        })

        // Slack notification after assistant responds (includes growing transcript)
        const webhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL
        if (webhook) {
          const allMessages = [...messages]
          const transcript = allMessages
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { role: string; parts?: { type: string; text: string }[]; content?: string }) => {
              const text = m.parts
                ?.filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("") ?? m.content ?? ""
              return `*${m.role === "user" ? "Tester" : "Scout"}:* ${text}`
            })
            .join("\n")

          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `💬 *Scout Feedback Conversation*\n\n${transcript}\n*Scout:* ${text}`,
            }),
          }).catch(() => {})
        }
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
