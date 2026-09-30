"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { ItineraryGenerating } from "@/components/itinerary-generating"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Map as MapIcon,
  Calendar,
  Search,
  Wand2,
  Sparkles,
  Loader2,
  ChevronRight,
  Hotel,
  Pencil,
  X,
  Gauge,
  Users,
} from "lucide-react"
import type {
  Trip,
  SavedAttraction,
  TripReadinessState,
  FamilyVibe,
} from "@/lib/types"
import { getUserFacingError } from "@/lib/client-errors"
import { EditableItinerary } from "@/components/editable-itinerary"
import { TripDayOrganizer } from "@/components/trip-day-organizer"
import { OnboardingHint } from "@/components/onboarding-hint"
import { useOnboardingHints } from "@/hooks/use-onboarding-hints"
import { MilestonePulse } from "@/components/milestone-pulse"
import { OutcomeCheck } from "@/components/outcome-check"
import { TripShareDialog } from "@/components/trip-share-dialog"
import { TripReadiness } from "@/components/trip-readiness"
import { DepartureCenter } from "@/components/departure-center"
import { getTripDateOptions } from "@/lib/trip-planning"
import { MAX_GENERATION_DAYS } from "@/lib/itinerary-batching"

const LongTripPlannerDialog = dynamic(
  () => import("@/components/long-trip-planner-dialog").then((module) => module.LongTripPlannerDialog),
  { ssr: false }
)

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  planning: { next: "active", label: "Mark as Active" },
  active: { next: "completed", label: "Mark as Completed" },
  completed: null,
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-accent/80 text-white",
  completed: "bg-white/20 text-white",
  planning: "bg-primary/80 text-white",
}

interface TripDetailProps {
  trip: Trip
  savedAttractions: SavedAttraction[]
  bannerImage?: string | null
  tripSummary?: string | null
  initialReadiness?: TripReadinessState | null
  familyVibe?: FamilyVibe | null
}

export function TripDetail({
  trip,
  savedAttractions,
  bannerImage,
  tripSummary,
  initialReadiness,
  familyVibe,
}: TripDetailProps) {
  const router = useRouter()
  const { isDismissed, dismiss } = useOnboardingHints()
  const [generating, setGenerating] = useState(false)
  const [showItineraryPulse, setShowItineraryPulse] = useState(false)
  const [showOutcomeCheck, setShowOutcomeCheck] = useState(false)
  const [deltaGenerating, setDeltaGenerating] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(trip.status)
  const [accommodationArea, setAccommodationArea] = useState(trip.accommodation_area ?? "")
  const [editingAccommodation, setEditingAccommodation] = useState(false)
  const [savingAccommodation, setSavingAccommodation] = useState(false)
  const [showLongTripPlanner, setShowLongTripPlanner] = useState(false)

  async function handleSaveAccommodation() {
    if (savingAccommodation) return
    setSavingAccommodation(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accommodation_area: accommodationArea || null }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setEditingAccommodation(false)
      toast.success("Accommodation area saved")
      router.refresh()
    } catch (error) {
      toast.error(getUserFacingError(error, "Could not save accommodation area"))
    } finally {
      setSavingAccommodation(false)
    }
  }

  const nextStep = STATUS_FLOW[currentStatus]

  async function handleStatusAdvance() {
    if (!nextStep || updatingStatus) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStep.next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update status")
      }
      setCurrentStatus(nextStep.next as Trip["status"])
      toast.success(`Trip marked as ${nextStep.next}`)
      router.refresh()
    } catch (err) {
      toast.error(getUserFacingError(err, "Could not update status"))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const hasItinerary = trip.itinerary && trip.itinerary.length > 0
  const canGenerate = savedAttractions.length >= 3 && !hasItinerary
  const canRegenerate = savedAttractions.length >= 3 && hasItinerary
  const placesNeeded = Math.max(0, 3 - savedAttractions.length)
  const tripDateOptions = getTripDateOptions(trip)
  const plannedDates = Array.from(
    new Set((trip.itinerary ?? []).map((day) => day.date))
  )
  const isLongTrip = tripDateOptions.length > MAX_GENERATION_DAYS
  const hasUnplannedDays = plannedDates.length < tripDateOptions.length
  const familyFitLabels = [
    ...(familyVibe?.travel_style ?? []).slice(0, 2),
    familyVibe?.pace ? `${familyVibe.pace} pace` : null,
    familyVibe?.kids?.length
      ? `${familyVibe.kids.length} kid${familyVibe.kids.length === 1 ? "" : "s"}`
      : null,
  ].filter((label): label is string => Boolean(label))

  async function handleGenerateItinerary(dates?: string[]): Promise<boolean> {
    if ((!canGenerate && !canRegenerate) || generating) return false
    const replacingPlannedDays = dates?.some((date) => plannedDates.includes(date))
    if (
      hasItinerary && !dates &&
      !window.confirm(
        "Rebuilding the full itinerary will replace your manual edits. Refresh a single day instead if you want to keep the rest of the plan. Continue?"
      )
    ) {
      return false
    }
    if (
      replacingPlannedDays &&
      !window.confirm(
        "Some selected days already have plans. Their AI suggestions will be refreshed, while your saved, completed, and skipped stops stay in place. Continue?"
      )
    ) {
      return false
    }
    setGenerating(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}/itinerary`, {
        method: "POST",
        headers: dates ? { "Content-Type": "application/json" } : undefined,
        body: dates ? JSON.stringify({ dates }) : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate itinerary")
      }
      toast.success(dates ? `${dates.length} trip days planned!` : "Itinerary generated!")
      setShowItineraryPulse(true)
      setShowOutcomeCheck(true)
      router.refresh()
      return true
    } catch (err) {
      toast.error(getUserFacingError(err, "Could not generate itinerary", "load"))
      return false
    } finally {
      setGenerating(false)
    }
  }

  function handleGenerateClick() {
    if (isLongTrip) {
      setShowLongTripPlanner(true)
      return
    }
    void handleGenerateItinerary()
  }

  async function handleDeltaItinerary(instruction: string) {
    if (deltaGenerating || generating) return
    setDeltaGenerating(instruction)
    try {
      const res = await fetch(`/api/trips/${trip.id}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update itinerary")
      }
      toast.success("Itinerary updated!")
      router.refresh()
    } catch (err) {
      toast.error(getUserFacingError(err, "Could not update itinerary"))
    } finally {
      setDeltaGenerating(null)
    }
  }

  return (
    <>
    {showItineraryPulse && (
      <MilestonePulse
        step="itinerary_generated"
        tripId={trip.id}
        onDismiss={() => setShowItineraryPulse(false)}
      />
    )}
    {showLongTripPlanner && (
      <LongTripPlannerDialog
        open={showLongTripPlanner}
        onOpenChange={setShowLongTripPlanner}
        destination={trip.destination}
        dateOptions={tripDateOptions}
        plannedDates={plannedDates}
        generating={generating}
        onGenerate={handleGenerateItinerary}
      />
    )}
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      {/* Trip navigation and sharing */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Trips
        </Link>
        <TripShareDialog
          tripId={trip.id}
          tripTitle={trip.title}
          destination={trip.destination}
        />
      </div>

      {/* Trip progress flow — hidden once itinerary is generated */}
      {!hasItinerary && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3">
          {[
            { label: "Trip created", done: true },
            { label: `Save places (${savedAttractions.length}/3)`, done: savedAttractions.length >= 3 },
            { label: isLongTrip ? "Choose days to plan" : "Generate itinerary", done: false },
          ].map(({ label, done }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? "bg-primary text-primary-foreground" : "border border-border bg-muted text-muted-foreground"
                }`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={`text-xs font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Planner-led trip hero */}
      <section className="mb-8 grid overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-xl shadow-black/5 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="relative min-h-[280px] overflow-hidden lg:min-h-[410px]">
          {bannerImage ? (
            <img
              src={bannerImage}
              alt={trip.destination}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/35 via-accent/15 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center gap-2 text-xs text-white/85">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 backdrop-blur-md">
              <MapIcon className="h-3.5 w-3.5 text-primary" /> {trip.destination}
            </span>
            {trip.start_date && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 backdrop-blur-md">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                {trip.end_date &&
                  ` – ${new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${STATUS_STYLES[currentStatus]}`}
            >
              {currentStatus}
            </span>
            {nextStep && (
              <button
                type="button"
                onClick={handleStatusAdvance}
                disabled={updatingStatus}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground disabled:opacity-50"
              >
                {updatingStatus ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {nextStep.label}
              </button>
            )}
          </div>
          <p className="overline mt-6">Your family trip</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground lg:text-4xl">
            {trip.title}
          </h1>

          {tripSummary && (
            <div className="mt-5 flex items-start gap-3 border-l-2 border-primary pl-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="line-clamp-5 text-sm leading-relaxed text-muted-foreground">
                {tripSummary.replace(/^#+\s*/gm, "").trim()}
              </p>
            </div>
          )}

          {familyFitLabels.length > 0 && (
            <div className="mt-6">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                <Users className="h-3.5 w-3.5" /> Why this plan fits
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {familyFitLabels.map((label, index) => (
                  <span
                    key={`${label}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[11px] text-foreground"
                  >
                    {label.includes("pace") && <Gauge className="h-3 w-3 text-primary" />}
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {trip.accommodation_area && (
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Hotel className="h-3.5 w-3.5 text-primary" /> Staying near {trip.accommodation_area}
            </p>
          )}
        </div>
      </section>

      <DepartureCenter trip={trip} initialReadiness={initialReadiness} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-7">
        {/* Itinerary Section */}
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="overline">Trip plan</p>
              <h2 className="mt-1 font-serif text-2xl text-foreground">Your itinerary</h2>
            </div>
            {hasItinerary && (
              <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
                {trip.itinerary.length} planned day{trip.itinerary.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {/* Accommodation area — always visible */}
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
            <Hotel className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {editingAccommodation ? (
              <>
                <input
                  type="text"
                  value={accommodationArea}
                  onChange={(e) => setAccommodationArea(e.target.value)}
                  placeholder="e.g., Shinjuku, near Tokyo Station"
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveAccommodation()
                    if (e.key === "Escape") { setEditingAccommodation(false); setAccommodationArea(trip.accommodation_area ?? "") }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveAccommodation}
                  disabled={savingAccommodation}
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingAccommodation ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingAccommodation(false); setAccommodationArea(trip.accommodation_area ?? "") }}
                  className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-xs text-muted-foreground">
                  {accommodationArea || <span className="italic">No accommodation area set</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingAccommodation(true)}
                  className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10"
                >
                  <Pencil className="h-3 w-3" />
                  {accommodationArea ? "Edit" : "Add"}
                </button>
              </>
            )}
          </div>

          {/* Outcome check — shown once after itinerary generates */}
          {hasItinerary && showOutcomeCheck && (
            <OutcomeCheck
              tripId={trip.id}
              onDismiss={() => setShowOutcomeCheck(false)}
            />
          )}

          {/* Action bar — always visible once itinerary exists */}
          {hasItinerary && (
            <div className="mb-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/search?trip=${trip.id}&dest=${encodeURIComponent(trip.destination)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Search className="h-4 w-4" />
                  Find more attractions
                </Link>
                <button
                  type="button"
                  onClick={handleGenerateClick}
                  disabled={generating || !!deltaGenerating}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Regenerating…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      {isLongTrip
                        ? hasUnplannedDays
                          ? "Plan more days"
                          : "Rebuild selected days"
                        : "Rebuild entire itinerary"}
                    </>
                  )}
                </button>
              </div>
              {/* Delta refinement chips */}
              {!isLongTrip ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Refine:</span>
                {[
                  { label: "Fill free time", instruction: "Look for gaps in the schedule (90+ minutes with no activity). Add 1-2 family-friendly activities or meals to fill those gaps. Keep existing items unchanged." },
                  { label: "Add downtime", instruction: "Add rest and downtime slots to days that feel too packed (4+ activities). Include things like 'Rest at hotel', 'Coffee break', 'Free play at a park', or 'Nap time' for young kids. Keep all existing activities." },
                  { label: "More food stops", instruction: "Add breakfast, lunch, or snack stops to days that are missing dedicated meal times. Suggest real local restaurants or cafes in the destination that are family-friendly. Keep all existing activities." },
                ].map(({ label, instruction }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleDeltaItinerary(instruction)}
                    disabled={!!deltaGenerating || generating}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {deltaGenerating === instruction ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-accent" />
                    )}
                    {deltaGenerating === instruction ? "Updating…" : label}
                  </button>
                ))}
              </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Longer trip? Refresh individual days to fine-tune them without changing the rest.
                </p>
              )}
            </div>
          )}

          {generating ? (
            <ItineraryGenerating destination={trip.destination} regenerate={hasItinerary} />
          ) : trip.itinerary && trip.itinerary.length > 0 ? (
            <EditableItinerary
              tripId={trip.id}
              destination={trip.destination}
              initialItinerary={trip.itinerary}
              savedAttractions={savedAttractions}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {savedAttractions.length === 0 ? (
                /* First-run guided state — no attractions saved yet */
                <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 p-8">
                  <h3 className="mb-1 font-serif text-lg text-foreground">
                    Build your {trip.destination} itinerary
                  </h3>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Follow these three steps and AI will handle the rest.
                  </p>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {[
                      {
                        step: "1",
                        title: "Search attractions",
                        desc: `Find things to do in ${trip.destination} using our AI-powered search.`,
                        done: false,
                      },
                      {
                        step: "2",
                        title: "Save 3 or more",
                        desc: "Use Add to trip on any attraction and choose an optional day.",
                        done: false,
                      },
                      {
                        step: "3",
                        title: "Generate itinerary",
                        desc: "AI builds a day-by-day plan around your family's pace and vibe.",
                        done: false,
                      },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="flex flex-1 gap-3 rounded-xl bg-background/70 p-4">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {step}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    {!isDismissed("start-searching") ? (
                      <OnboardingHint
                        message={`Search for things to do in ${trip.destination} and use Add to trip to plan them here.`}
                        side="top"
                        align="start"
                        onDismiss={() => dismiss("start-searching")}
                      >
                        <Link
                          href={`/search?trip=${trip.id}&dest=${encodeURIComponent(trip.destination)}`}
                          onClick={() => dismiss("start-searching")}
                          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <Search className="h-4 w-4" />
                          Start searching {trip.destination}
                        </Link>
                      </OnboardingHint>
                    ) : (
                      <Link
                        href={`/search?trip=${trip.id}&dest=${encodeURIComponent(trip.destination)}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <Search className="h-4 w-4" />
                        Start searching {trip.destination}
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                /* Has some attractions but not enough to generate yet */
                <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Wand2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Almost ready to generate
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Save {placesNeeded} more attraction{placesNeeded !== 1 ? "s" : ""} to unlock your AI itinerary.
                  </p>
                  <div className="mx-auto mt-5 max-w-xs">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{savedAttractions.length} of 3 saved</span>
                      <span className="font-medium text-primary">{placesNeeded} more to go</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min((savedAttractions.length / 3) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <div className="group relative">
                      <button
                        type="button"
                        onClick={canGenerate ? handleGenerateClick : undefined}
                        disabled={generating || !canGenerate}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generating ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                        ) : (
                          <><Wand2 className="h-4 w-4" />{isLongTrip ? "Choose days to plan" : "Generate itinerary"}</>
                        )}
                      </button>
                      {!canGenerate && !generating && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
                          Save {placesNeeded} more place{placesNeeded !== 1 ? "s" : ""} to unlock
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/search?trip=${trip.id}&dest=${encodeURIComponent(trip.destination)}`}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
                        canGenerate
                          ? "border border-border bg-background text-foreground hover:bg-muted"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      <Search className="h-4 w-4" />
                      Find more attractions
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-6 self-start lg:sticky lg:top-24">
          <TripReadiness
            tripId={trip.id}
            destination={trip.destination}
            itinerary={trip.itinerary ?? []}
            initialReadiness={initialReadiness}
          />
          <TripDayOrganizer
            trip={trip}
            savedAttractions={savedAttractions}
            hasItinerary={hasItinerary}
          />
        </aside>
      </div>
    </div>
    </>
  )
}
