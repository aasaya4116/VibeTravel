"use client"

import { useState } from "react"
import { MilestonePulse } from "@/components/milestone-pulse"
import { OutcomeCheck } from "@/components/outcome-check"

const PULSE_STEPS = [
  { step: "vibe_saved" as const, label: "After vibe saved" },
  { step: "trip_created" as const, label: "After trip created" },
  { step: "itinerary_generated" as const, label: "After itinerary generated" },
]

export default function FeedbackPreviewPage() {
  const [activePulse, setActivePulse] = useState<string | null>(null)
  const [showOutcome, setShowOutcome] = useState(false)

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="mb-1 text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
        Preview only
      </p>
      <h1 className="mb-2 font-serif text-3xl text-foreground">Feedback Components</h1>
      <p className="mb-10 text-sm text-muted-foreground">
        These appear automatically at key moments. Click below to preview each one.
      </p>

      {/* Layer 1 */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Layer 1 — Milestone pulse</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Slides up from the bottom after vibe setup, trip creation, and itinerary generation. Auto-dismisses in 12s.
        </p>
        <div className="flex flex-wrap gap-3">
          {PULSE_STEPS.map(({ step, label }) => (
            <button
              key={step}
              onClick={() => setActivePulse(step)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Layer 2 */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Layer 2 — Outcome check</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Appears inline on the trip page right after the itinerary generates.
        </p>
        {showOutcome ? (
          <OutcomeCheck tripId="preview" onDismiss={() => setShowOutcome(false)} />
        ) : (
          <button
            onClick={() => setShowOutcome(true)}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            Show outcome check
          </button>
        )}
      </section>

      {/* Layer 3 */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-foreground">Layer 3 — Scout feedback mode</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Triggered by the &ldquo;Give feedback&rdquo; button in the top nav. Opens Scout in interview mode.
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-scout-feedback"))}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          Open Scout feedback mode →
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          (Same as clicking &ldquo;Give feedback&rdquo; in the header)
        </p>
      </section>

      {/* Pulse overlay */}
      {activePulse && (
        <MilestonePulse
          step={activePulse as "vibe_saved" | "trip_created" | "itinerary_generated"}
          onDismiss={() => setActivePulse(null)}
        />
      )}
    </div>
  )
}
