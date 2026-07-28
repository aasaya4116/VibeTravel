"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

// Real steps the itinerary route works through — shown in order so the wait
// feels like progress, not a hung spinner.
const STEPS = [
  "Reviewing your saved spots",
  "Checking the weather forecast",
  "Clustering activities by neighborhood",
  "Pacing each day for your family",
  "Adding meals, breaks, and backup options",
  "Writing your day-by-day plan",
  "Polishing the final details",
]

export function ItineraryGenerating({
  destination,
  regenerate = false,
}: {
  destination: string
  regenerate?: boolean
}) {
  const [step, setStep] = useState(0)
  const [fill, setFill] = useState(false)

  useEffect(() => {
    // Advance the status, holding on the last step until generation finishes.
    const interval = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s))
    }, 5000)
    // Trigger the progress-bar transition on the next tick.
    const timeout = setTimeout(() => setFill(true), 60)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-6 card-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-lg text-foreground">
              {regenerate ? "Rebuilding" : "Building"} your {destination} itinerary
            </p>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {STEPS[step]}…
            </p>
          </div>
        </div>

        {/* Eases toward ~92% while Opus plans; finishes when the plan lands. */}
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-[55000ms] ease-out"
            style={{ width: fill ? "92%" : "6%" }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          This usually takes under a minute — Scout is planning around pace, weather, and your
          kids&apos; ages.
        </p>
      </div>

      {/* Skeleton day cards */}
      {[0, 1, 2].map((d) => (
        <div key={d} className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((r) => (
              <div key={r} className="flex items-center gap-3 rounded-xl bg-background p-3">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
