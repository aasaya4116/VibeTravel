"use client"

import { useState } from "react"
import { CheckCircle2, MessageSquare } from "lucide-react"

const OPTIONS = [
  { value: "works_great", label: "Works great ✓", style: "border-green-500/30 bg-green-500/5 text-green-600 hover:bg-green-500/10" },
  { value: "needs_tweaks", label: "Needs some tweaks", style: "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5" },
  { value: "not_quite", label: "Not quite right", style: "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5" },
]

interface OutcomeCheckProps {
  tripId: string
  onDismiss: () => void
}

export function OutcomeCheck({ tripId, onDismiss }: OutcomeCheckProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!selected || saving) return
    setSaving(true)
    await fetch("/api/feedback/outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: selected, comment: comment.trim() || null, trip_id: tripId }),
    }).catch(() => {})
    setSubmitted(true)
    setSaving(false)
    setTimeout(onDismiss, 2500)
  }

  async function handleSelect(value: string) {
    setSelected(value)
    if (value === "works_great") {
      setSaving(true)
      await fetch("/api/feedback/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: value, comment: null, trip_id: tripId }),
      }).catch(() => {})
      setSubmitted(true)
      setSaving(false)
      setTimeout(onDismiss, 2000)
    }
  }

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {submitted ? (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Thanks for the feedback!</p>
            <p className="text-xs text-muted-foreground">This helps us make VibeTravel better for families.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start gap-3">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Does this itinerary work for your family?
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {OPTIONS.map(({ value, label, style }) => (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${style} ${
                  selected === value ? "ring-2 ring-primary/40" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {selected && selected !== "works_great" && (
            <div className="mt-4 animate-in fade-in duration-300">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What's missing or off? (optional)"
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Sending…" : "Send feedback"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
