"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

const STEP_COPY: Record<string, string> = {
  vibe_saved: "How was setting up your family profile?",
  trip_created: "How was creating your trip?",
  itinerary_generated: "How did the itinerary generation feel?",
}

const REACTIONS = [
  { value: "great", emoji: "😊", label: "Great" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "struggling", emoji: "😕", label: "Struggling" },
]

interface MilestonePulseProps {
  step: "vibe_saved" | "trip_created" | "itinerary_generated"
  tripId?: string | null
  onDismiss: () => void
}

export function MilestonePulse({ step, tripId, onDismiss }: MilestonePulseProps) {
  const [visible, setVisible] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Slide in after mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Auto-dismiss after 12s if no interaction
  useEffect(() => {
    const t = setTimeout(() => dismiss(), 12000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDismiss, 400)
  }

  async function handleReaction(reaction: string) {
    setSubmitted(true)
    await fetch("/api/feedback/pulse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, reaction, trip_id: tripId ?? null }),
    }).catch(() => {})
    setTimeout(dismiss, 1200)
  }

  return (
    <div
      className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 transition-all duration-400 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="relative w-80 rounded-2xl border border-white/10 bg-[#0a0a0f] px-6 py-5 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-lg p-1 text-white/30 hover:text-white/60"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {submitted ? (
          <p className="text-center text-sm font-medium text-white/70">
            Thanks for the feedback! 🙏
          </p>
        ) : (
          <>
            <p className="mb-4 text-center text-sm font-medium text-white/80">
              {STEP_COPY[step]}
            </p>
            <div className="flex justify-center gap-6">
              {REACTIONS.map(({ value, emoji, label }) => (
                <button
                  key={value}
                  onClick={() => handleReaction(value)}
                  className="group flex flex-col items-center gap-1.5 transition-transform hover:scale-110 active:scale-95"
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[11px] text-white/40 group-hover:text-white/70">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
