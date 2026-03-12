"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Map as MapIcon,
  Calendar,
  Search,
  Clock,
  MapPin,
  Wand2,
  Sparkles,
  Loader2,
  ChevronRight,
  Hotel,
  Pencil,
  X,
  ExternalLink,
} from "lucide-react"
import type { Trip, SavedAttraction } from "@/lib/types"
import { getBookingLink } from "@/lib/get-booking-link"
import { getAttractionImage } from "@/lib/attraction-images"
import { TripMap } from "@/components/trip-map"

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
}

export function TripDetail({ trip, savedAttractions, bannerImage, tripSummary }: TripDetailProps) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [deltaGenerating, setDeltaGenerating] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(trip.status)
  const [accommodationArea, setAccommodationArea] = useState(trip.accommodation_area ?? "")
  const [editingAccommodation, setEditingAccommodation] = useState(false)
  const [savingAccommodation, setSavingAccommodation] = useState(false)

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
    } catch {
      toast.error("Could not save accommodation area")
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
      toast.error(err instanceof Error ? err.message : "Could not update status")
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Build a name → imageUrl map from saved attractions for quick lookup
  const savedImageMap = new Map<string, string>()
  for (const sa of savedAttractions) {
    const img = sa.attraction_data?.imageUrl
    if (img && sa.attraction_name) {
      savedImageMap.set(sa.attraction_name.toLowerCase(), img)
    }
  }

  const hasItinerary = trip.itinerary && trip.itinerary.length > 0
  const canGenerate = savedAttractions.length >= 3 && !hasItinerary
  const canRegenerate = savedAttractions.length >= 3 && hasItinerary

  async function handleGenerateItinerary() {
    if ((!canGenerate && !canRegenerate) || generating) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}/itinerary`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate itinerary")
      }
      toast.success("Itinerary generated!")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate itinerary")
    } finally {
      setGenerating(false)
    }
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
      toast.error(err instanceof Error ? err.message : "Could not update itinerary")
    } finally {
      setDeltaGenerating(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      {/* Back link */}
      <Link
        href="/trips"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Trips
      </Link>

      {/* Trip progress flow — hidden once itinerary is generated */}
      {!hasItinerary && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3">
          {[
            { label: "Trip created", done: true },
            { label: `Save places (${savedAttractions.length}/3)`, done: savedAttractions.length >= 3 },
            { label: "Generate itinerary", done: false },
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

      {/* Banner */}
      <div className="mb-8 overflow-hidden rounded-2xl">
        <div className="relative h-52 w-full sm:h-64 lg:h-72">
          {bannerImage ? (
            <img
              src={bannerImage}
              alt={trip.destination}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Content on banner */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[currentStatus]}`}
              >
                {currentStatus}
              </span>
              {nextStep && (
                <button
                  type="button"
                  onClick={handleStatusAdvance}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-50"
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
            <h1 className="font-serif text-3xl text-white lg:text-4xl">
              {trip.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <MapIcon className="h-4 w-4" />
                {trip.destination}
              </span>
              {trip.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                  {trip.end_date &&
                    ` – ${new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                    })}`}
                </span>
              )}
              {trip.accommodation_area && (
                <span className="flex items-center gap-1">
                  <Hotel className="h-4 w-4" />
                  {trip.accommodation_area}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Trip summary */}
        {tripSummary && (
          <div className="border border-t-0 border-border rounded-b-2xl bg-card px-6 py-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">{tripSummary.replace(/^#+\s*/gm, "").trim()}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Itinerary Section */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl text-foreground">Itinerary</h2>
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
                  onClick={handleGenerateItinerary}
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
                      Regenerate itinerary
                    </>
                  )}
                </button>
              </div>
              {/* Delta refinement chips */}
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
            </div>
          )}

          {trip.itinerary && trip.itinerary.length > 0 ? (
            <div className="flex flex-col gap-4">
              {/* Trip Map */}
              <TripMap destination={trip.destination} itinerary={trip.itinerary} />

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary"><Clock className="h-3 w-3" /></span>
                  Your picks
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-accent"><Sparkles className="h-3 w-3" /></span>
                  AI suggestions
                </span>
              </div>
              {trip.itinerary.map((day, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <h3 className="mb-3 font-medium text-foreground">
                    Day {i + 1} -- {day.date}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {day.items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 rounded-xl p-3 ${
                          item.recommended
                            ? "border border-dashed border-accent/30 bg-accent/5"
                            : "bg-background"
                        }`}
                      >
                        {(() => {
                          const name = item.attraction_name ?? ""
                          const img =
                            item.attraction_data?.imageUrl ||
                            (name ? savedImageMap.get(name.toLowerCase()) : undefined) ||
                            (name ? getAttractionImage(item.attraction_data?.category ?? "Cultural", name) : undefined)
                          return (
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                              {img && (
                                <img
                                  src={img}
                                  alt={name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                  }}
                                />
                              )}
                              <div className={`absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full ${
                                item.recommended ? "bg-accent/90" : "bg-primary/90"
                              }`}>
                                {item.recommended
                                  ? <Sparkles className="h-2.5 w-2.5 text-white" />
                                  : <Clock className="h-2.5 w-2.5 text-white" />}
                              </div>
                            </div>
                          )
                        })()}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {item.attraction_name}
                            </p>
                            {item.recommended && (
                              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                                Suggested
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.start_time} - {item.end_time}
                          </p>
                          {item.notes && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {item.notes.replace(/^#+\s*/gm, "").trim()}
                            </p>
                          )}
                          {(() => {
                            const booking = getBookingLink(item, trip.destination)
                            return booking ? (
                              <a
                                href={booking.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {booking.label}
                              </a>
                            ) : null
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
                        desc: "Tap the heart on any attraction to add it to this trip.",
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
                    <Link
                      href={`/search?trip=${trip.id}&dest=${encodeURIComponent(trip.destination)}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Search className="h-4 w-4" />
                      Start searching {trip.destination}
                    </Link>
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
                    Save {3 - savedAttractions.length} more attraction{3 - savedAttractions.length !== 1 ? "s" : ""} to unlock your AI itinerary.
                  </p>
                  <div className="mx-auto mt-5 max-w-xs">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{savedAttractions.length} of 3 saved</span>
                      <span className="font-medium text-primary">{3 - savedAttractions.length} more to go</span>
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
                        onClick={canGenerate ? handleGenerateItinerary : undefined}
                        disabled={generating || !canGenerate}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generating ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                        ) : (
                          <><Wand2 className="h-4 w-4" />Generate itinerary</>
                        )}
                      </button>
                      {!canGenerate && !generating && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
                          Save {3 - savedAttractions.length} more place{3 - savedAttractions.length !== 1 ? "s" : ""} to unlock
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

        {/* Saved Attractions Sidebar */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl text-foreground">Saved Places</h2>
            {!hasItinerary && (
              <span className="text-xs text-muted-foreground">
                {savedAttractions.length >= 3
                  ? "Ready to generate"
                  : `${savedAttractions.length}/3 to generate`}
              </span>
            )}
          </div>
          {!hasItinerary && savedAttractions.length > 0 && savedAttractions.length < 3 && (
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(savedAttractions.length / 3) * 100}%` }}
              />
            </div>
          )}
          {!hasItinerary && savedAttractions.length >= 3 && (
            <p className="mb-3 text-xs text-muted-foreground">
              These places will be woven into your day-by-day itinerary.
            </p>
          )}
          {savedAttractions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {savedAttractions.map((sa) => (
                <div
                  key={sa.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <h4 className="text-sm font-medium text-foreground">
                    {sa.attraction_name}
                  </h4>
                  {sa.attraction_data?.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {sa.attraction_data.location}
                    </p>
                  )}
                  {sa.attraction_data?.vibes && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sa.attraction_data.vibes.slice(0, 3).map((v) => (
                        <span
                          key={v}
                          className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No saved places yet. Explore attractions and save them here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
