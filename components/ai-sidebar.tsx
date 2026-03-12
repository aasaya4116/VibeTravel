"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useRef, useEffect } from "react"
import { X, Send, Sparkles, AlertCircle, RotateCcw } from "lucide-react"
import type { FamilyVibe, Trip } from "@/lib/types"

interface AISidebarProps {
  familyVibe: FamilyVibe | null
  currentTrip: Trip | null
}

export function AISidebar({ familyVibe, currentTrip }: AISidebarProps) {
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          messages,
          id,
          familyVibe,
          currentTrip,
        },
      }),
    }),
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    sendMessage({ text: input })
    setInput("")
  }

  const suggestedPrompts = currentTrip
    ? [
        `What are the must-see spots in ${currentTrip.destination} for families?`,
        `Suggest a rainy day backup plan for ${currentTrip.destination}`,
        `Find a great restaurant near ${currentTrip.accommodation_area || currentTrip.destination} with a kids menu`,
        `What's the best order to visit our saved places to avoid too much travel?`,
      ]
    : [
        "Plan a perfect day with a toddler — where should we start?",
        "What are the best quiet spots for sensory breaks?",
        "Suggest a rainy day backup plan",
        "Find restaurants with great food AND a play area",
      ]

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(true)}
        title="AI travel assistant — real restaurants, itineraries & more"
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl ${
          open ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        }`}
        aria-label="Open Scout AI assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium">Ask Scout</span>
      </button>

      {/* Sidebar panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-xl transition-transform duration-300 sm:w-96 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-medium text-foreground">Scout</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Close assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentTrip
              ? `AI travel assistant — knows your ${currentTrip.destination} trip, your family, and can look up real places.`
              : "AI travel assistant — knows your family, your trip, and can look up real places."}
          </p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl bg-primary/5 p-4">
                <p className="mb-1 text-sm font-medium text-foreground">
                  Hi, I{"'"}m Scout — your AI travel assistant.
                </p>
                <p className="text-sm text-muted-foreground">
                  {familyVibe?.kids?.length
                    ? `I see you're planning${currentTrip?.destination ? ` a trip to ${currentTrip.destination}` : ""} with ${familyVibe.kids.map((k: { name?: string; age?: number }) => k.name ? `${k.name}${k.age ? ` (${k.age})` : ""}` : `age ${k.age}`).join(" and ")}. What can I help with?`
                    : currentTrip?.destination
                    ? `I see you're planning a trip to ${currentTrip.destination}. What can I help with?`
                    : "I know your family's vibe and I can look up real restaurants, attractions, and tips."}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      sendMessage({ text: prompt })
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg) => {
                const text =
                  msg.parts
                    ?.filter(
                      (p): p is { type: "text"; text: string } =>
                        p.type === "text"
                    )
                    .map((p) => p.text)
                    .join("") || ""

                if (!text) return null

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{text}</div>
                    </div>
                  </div>
                )
              })}
              {isStreaming &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-muted px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                  <p className="flex-1 text-sm text-destructive">
                    Something went wrong. Please try again.
                  </p>
                  <button
                    onClick={() => {
                      if (messages.length > 0) {
                        const lastUserMsg = [...messages].reverse().find(m => m.role === "user")
                        const text = lastUserMsg?.parts
                          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                          .map(p => p.text)
                          .join("") || ""
                        if (text) sendMessage({ text })
                      }
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="Retry"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your trip..."
              className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="shrink-0 rounded-xl bg-primary p-3 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
