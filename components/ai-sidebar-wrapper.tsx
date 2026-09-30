"use client"

import dynamic from "next/dynamic"
import type { FamilyVibe, Trip } from "@/lib/types"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Sparkles, X } from "lucide-react"
import { useOnboardingHints } from "@/hooks/use-onboarding-hints"

const AISidebar = dynamic(
  () => import("@/components/ai-sidebar").then((module) => module.AISidebar),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-y-0 right-0 z-50 flex w-full items-center justify-center border-l border-border bg-background shadow-xl sm:w-96">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" /> Loading Scout…
        </div>
      </div>
    ),
  }
)

export function AISidebarWrapper() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [feedbackMode, setFeedbackMode] = useState(false)
  const [familyVibe, setFamilyVibe] = useState<FamilyVibe | null>(null)
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null)
  const { isDismissed, dismiss } = useOnboardingHints()
  const showScoutHint = !isDismissed("scout")
  const tripId = pathname.match(/^\/trips\/([^/]+)/)?.[1] ?? null

  useEffect(() => {
    function handleFeedbackOpen() {
      dismiss("scout")
      setFeedbackMode(true)
      setActive(true)
    }
    window.addEventListener("open-scout-feedback", handleFeedbackOpen)
    return () => window.removeEventListener("open-scout-feedback", handleFeedbackOpen)
  }, [dismiss])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const supabase = createClient()
    const vibeRequest = supabase.from("family_vibes").select("*").limit(1).maybeSingle()
    const tripRequest = tripId
      ? supabase.from("trips").select("*").eq("id", tripId).maybeSingle()
      : Promise.resolve({ data: null })

    Promise.all([vibeRequest, tripRequest]).then(([vibeResult, tripResult]) => {
      if (cancelled) return
      setFamilyVibe((vibeResult.data as FamilyVibe | null) ?? null)
      setCurrentTrip((tripResult.data as Trip | null) ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [active, tripId])

  function openScout() {
    dismiss("scout")
    setFeedbackMode(false)
    setActive(true)
  }

  if (active) {
    return (
      <AISidebar
        familyVibe={familyVibe}
        currentTrip={currentTrip}
        tripId={tripId}
        feedbackMode={feedbackMode}
        onClose={() => {
          setActive(false)
          setFeedbackMode(false)
        }}
      />
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openScout}
        title="AI travel assistant — real restaurants, itineraries & more"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
        aria-label="Open Scout AI assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium">Ask Scout</span>
      </button>

      {showScoutHint && (
        <div className="fixed bottom-20 right-6 z-40 w-64 animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-2xl border border-border bg-card p-4 shadow-xl">
          <span
            aria-hidden
            className="absolute -bottom-1.5 right-8 h-2.5 w-2.5 rotate-45 border border-border bg-card"
          />
          <p className="pr-6 text-sm leading-snug text-foreground">
            Try asking Scout to plan your whole trip — <span className="text-primary">&ldquo;Plan a trip to Tokyo for our family&rdquo;</span>
          </p>
          <button
            type="button"
            onClick={() => dismiss("scout")}
            aria-label="Dismiss tip"
            className="absolute right-2.5 top-2.5 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dismiss("scout")}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            Got it
          </button>
        </div>
      )}
    </>
  )
}
