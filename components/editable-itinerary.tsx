"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  BusFront,
  Car,
  Check,
  Clock,
  ExternalLink,
  Footprints,
  Loader2,
  Navigation,
  Pencil,
  Route,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import type { ItineraryDay, ItineraryItem, SavedAttraction } from "@/lib/types"
import { getAttractionImage } from "@/lib/attraction-images"
import { getBookingLink } from "@/lib/get-booking-link"
import {
  moveItineraryItem,
  removeItineraryItem,
  reorderItineraryItem,
  restoreItineraryItem,
  updateItineraryItem,
} from "@/lib/itinerary-editing"
import { setItineraryItemStatus } from "@/lib/trip-mode"
import {
  getActivityMinutes,
  getTravelSegments,
  optimizeDayForTravel,
  type TravelMode,
} from "@/lib/itinerary-logistics"
import { useItineraryLocations } from "@/hooks/use-itinerary-locations"
import { TripMap } from "@/components/trip-map"
import { ItineraryTravelSegment } from "@/components/itinerary-travel-segment"
import { TripMode } from "@/components/trip-mode"

interface EditableItineraryProps {
  tripId: string
  destination: string
  initialItinerary: ItineraryDay[]
  savedAttractions: SavedAttraction[]
}

interface EditDraft {
  dayIndex: number
  itemId: string
  startTime: string
  endTime: string
  notes: string
}

function formatDayDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

export function EditableItinerary({
  tripId,
  destination,
  initialItinerary,
  savedAttractions,
}: EditableItineraryProps) {
  const [itinerary, setItinerary] = useState(initialItinerary)
  const itineraryRef = useRef(initialItinerary)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [regeneratingDate, setRegeneratingDate] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [travelMode, setTravelMode] = useState<TravelMode>("transit")
  const [tripModeOpen, setTripModeOpen] = useState(false)
  const { locations, loading: locationsLoading, ready: locationsReady } =
    useItineraryLocations(destination, itinerary)

  useEffect(() => {
    itineraryRef.current = initialItinerary
    setItinerary(initialItinerary)
  }, [initialItinerary])

  useEffect(() => {
    const storedMode = window.localStorage.getItem("vibetravel-travel-mode")
    if (storedMode === "walking" || storedMode === "transit" || storedMode === "driving") {
      setTravelMode(storedMode)
    }
  }, [])

  const savedImageMap = new Map<string, string>()
  for (const saved of savedAttractions) {
    const image = saved.attraction_data?.imageUrl
    if (image) savedImageMap.set(saved.attraction_name.toLowerCase(), image)
  }

  const busy = saveStatus === "saving" || regeneratingDate !== null
  const controlsLocked = busy || editDraft !== null

  function selectTravelMode(mode: TravelMode) {
    setTravelMode(mode)
    window.localStorage.setItem("vibetravel-travel-mode", mode)
  }

  function applyItinerary(next: ItineraryDay[]) {
    itineraryRef.current = next
    setItinerary(next)
  }

  async function persistItinerary(next: ItineraryDay[], rollback: ItineraryDay[]) {
    applyItinerary(next)
    setSaveStatus("saving")
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itinerary: next }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not save itinerary")

      applyItinerary(payload.data?.itinerary ?? next)
      setSaveStatus("saved")
      return true
    } catch (error) {
      applyItinerary(rollback)
      setSaveStatus("idle")
      toast.error(error instanceof Error ? error.message : "Could not save itinerary")
      return false
    }
  }

  async function handleReorder(dayIndex: number, itemId: string, offset: -1 | 1) {
    if (controlsLocked) return
    const current = itineraryRef.current
    const next = reorderItineraryItem(current, dayIndex, itemId, offset)
    if (next !== current) await persistItinerary(next, current)
  }

  async function handleStatusChange(
    dayIndex: number,
    itemId: string,
    status: ItineraryItem["status"]
  ) {
    if (busy) return false
    const current = itineraryRef.current
    const next = setItineraryItemStatus(current, dayIndex, itemId, status)
    return next === current ? false : persistItinerary(next, current)
  }

  async function handleMove(itemId: string, fromDayIndex: number, toDayIndex: number) {
    if (controlsLocked || fromDayIndex === toDayIndex) return
    const current = itineraryRef.current
    const next = moveItineraryItem(current, fromDayIndex, itemId, toDayIndex)
    if (next !== current) {
      const saved = await persistItinerary(next, current)
      if (saved) toast.success(`Moved to Day ${toDayIndex + 1}`)
    }
  }

  async function handleRemove(dayIndex: number, itemIndex: number, item: ItineraryItem) {
    if (controlsLocked) return
    const current = itineraryRef.current
    const next = removeItineraryItem(current, dayIndex, item.id)
    const saved = await persistItinerary(next, current)
    if (!saved) return

    toast.success(`${item.attraction_name} removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          const latest = itineraryRef.current
          const restored = restoreItineraryItem(latest, dayIndex, item, itemIndex)
          if (restored !== latest) void persistItinerary(restored, latest)
        },
      },
    })
  }

  function startEditing(dayIndex: number, item: ItineraryItem) {
    setEditDraft({
      dayIndex,
      itemId: item.id,
      startTime: item.start_time,
      endTime: item.end_time,
      notes: item.notes ?? "",
    })
  }

  async function handleSaveEdit() {
    if (!editDraft || busy) return
    if (!editDraft.startTime.trim() || !editDraft.endTime.trim()) {
      toast.error("Add both a start and end time")
      return
    }

    const current = itineraryRef.current
    const next = updateItineraryItem(
      current,
      editDraft.dayIndex,
      editDraft.itemId,
      {
        start_time: editDraft.startTime.trim(),
        end_time: editDraft.endTime.trim(),
        notes: editDraft.notes.trim() || undefined,
      }
    )
    const saved = await persistItinerary(next, current)
    if (saved) {
      setEditDraft(null)
      toast.success("Stop updated")
    }
  }

  async function handleRegenerateDay(date: string, dayInstruction?: string) {
    if (controlsLocked) return
    setRegeneratingDate(date)
    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayDate: date, dayInstruction }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not refresh this day")
      applyItinerary(payload.itinerary)
      setSaveStatus("saved")
      setEditDraft(null)
      toast.success(
        dayInstruction
          ? "Indoor-friendly backups added — completed stops stayed unchanged"
          : "Day refreshed — the rest of your trip stayed unchanged"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh this day")
    } finally {
      setRegeneratingDate(null)
    }
  }

  async function handleOptimizeDay(dayIndex: number) {
    if (controlsLocked || !locationsReady) return
    const current = itineraryRef.current
    const optimizedDay = optimizeDayForTravel(
      current[dayIndex],
      locations,
      travelMode
    )
    if (optimizedDay === current[dayIndex]) {
      toast.info("VibeTravel needs at least two located stops to optimize this day")
      return
    }

    const next = current.map((day, index) =>
      index === dayIndex ? optimizedDay : day
    )
    const saved = await persistItinerary(next, current)
    if (saved) {
      toast.success("Day optimized with estimated travel time between stops")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {tripModeOpen && (
        <TripMode
          itinerary={itinerary}
          destination={destination}
          travelMode={travelMode}
          busy={busy}
          weatherUpdatingDate={regeneratingDate}
          onClose={() => setTripModeOpen(false)}
          onSave={persistItinerary}
          onStatusChange={handleStatusChange}
          onWeatherBackup={(date) =>
            handleRegenerateDay(
              date,
              "The weather changed. Replace unfinished outdoor AI suggestions with indoor-friendly alternatives, while keeping user-picked, completed, and skipped stops exactly as-is."
            )
          }
        />
      )}

      <section className="relative overflow-hidden rounded-2xl bg-foreground px-5 py-5 text-background shadow-lg shadow-foreground/10 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-background/70">
            <Navigation className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Ready to go?</p>
          </div>
          <h3 className="mt-2 text-lg font-semibold">Your day, one stop at a time</h3>
          <p className="mt-1 max-w-lg text-sm text-background/65">
            Open a simple live view for directions, check-offs, delays, and weather changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTripModeOpen(true)}
          className="relative z-10 mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:mt-0 sm:w-auto sm:shrink-0"
        >
          <Navigation className="h-4 w-4" /> Start Trip Mode
        </button>
        <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
      </section>

      <TripMap
        itinerary={itinerary}
        locations={locations}
        locationsLoading={locationsLoading}
        locationsReady={locationsReady}
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
            <Clock className="h-3 w-3" />
          </span>
          Your picks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-accent">
            <Sparkles className="h-3 w-3" />
          </span>
          AI suggestions
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5" aria-live="polite">
          {saveStatus === "saving" ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Saving changes…</>
          ) : saveStatus === "saved" ? (
            <><Check className="h-3 w-3 text-emerald-600" /> Saved</>
          ) : (
            "Changes save automatically"
          )}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Route className="h-4 w-4 text-primary" />
            Estimated travel
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Includes a family-friendly buffer. Open Directions for live routes.
          </p>
        </div>
        <div
          className="inline-flex w-fit rounded-xl bg-muted p-1"
          role="group"
          aria-label="Travel mode"
        >
          {([
            { value: "walking", label: "Walk", icon: Footprints },
            { value: "transit", label: "Transit", icon: BusFront },
            { value: "driving", label: "Drive", icon: Car },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectTravelMode(value)}
              aria-pressed={travelMode === value}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                travelMode === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {itinerary.map((day, dayIndex) => {
        const travelSegments = getTravelSegments(day, locations, travelMode)
        const travelMinutes = travelSegments.reduce(
          (total, segment) => total + (segment.durationMinutes ?? 0),
          0
        )
        const warningCount = travelSegments.filter((segment) =>
          ["tight", "overlap", "far"].includes(segment.status)
        ).length

        return (
          <section
          key={day.date}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-primary">Day {dayIndex + 1}</p>
              <h3 className="font-medium text-foreground">{formatDayDate(day.date)}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span>{day.items.length} {day.items.length === 1 ? "stop" : "stops"}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDuration(getActivityMinutes(day))} activities</span>
                <span aria-hidden="true">·</span>
                <span>
                  {locationsReady
                    ? `${formatDuration(travelMinutes)} ${travelMode}`
                    : "Estimating travel…"}
                </span>
                {warningCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {warningCount} {warningCount === 1 ? "warning" : "warnings"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleOptimizeDay(dayIndex)}
                disabled={controlsLocked || !locationsReady || day.items.length < 2}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                title="Reorder stops and update times with estimated travel buffers"
              >
                <Route className="h-3.5 w-3.5" />
                Optimize route
              </button>
              <button
                type="button"
                onClick={() => void handleRegenerateDay(day.date)}
                disabled={controlsLocked}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-50"
              >
                {regeneratingDate === day.date ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {regeneratingDate === day.date ? "Refreshing…" : "Refresh day"}
              </button>
            </div>
          </div>

          {day.items.length > 0 ? (
            <div className="divide-y divide-border px-5">
              {day.items.map((item, itemIndex) => {
                const isEditing =
                  editDraft?.dayIndex === dayIndex && editDraft.itemId === item.id
                const name = item.attraction_name ?? ""
                const image =
                  item.attraction_data?.imageUrl ||
                  (name ? savedImageMap.get(name.toLowerCase()) : undefined) ||
                  (name
                    ? getAttractionImage(item.attraction_data?.category ?? "Cultural", name)
                    : undefined)
                const booking = getBookingLink(item, destination)

                return (
                  <div key={item.id} className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {image && (
                          <img
                            src={image}
                            alt={name}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none"
                            }}
                          />
                        )}
                        <div
                          className={`absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full ${
                            item.recommended ? "bg-accent/90" : "bg-primary/90"
                          }`}
                        >
                          {item.recommended ? (
                            <Sparkles className="h-2.5 w-2.5 text-white" />
                          ) : (
                            <Clock className="h-2.5 w-2.5 text-white" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{name}</p>
                          {item.recommended && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                              Suggested
                            </span>
                          )}
                          {item.status === "completed" && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              Complete
                            </span>
                          )}
                          {item.status === "skipped" && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Skipped
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.start_time} – {item.end_time}
                        </p>
                        {item.notes && !isEditing && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {item.notes.replace(/^#+\s*/gm, "").trim()}
                          </p>
                        )}
                        {booking && !isEditing && (
                          <a
                            href={booking.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {booking.label}
                          </a>
                        )}
                      </div>
                    </div>

                    {isEditing && editDraft ? (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-medium text-foreground">
                            Start time
                            <input
                              type="text"
                              value={editDraft.startTime}
                              onChange={(event) =>
                                setEditDraft({ ...editDraft, startTime: event.target.value })
                              }
                              placeholder="09:00"
                              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </label>
                          <label className="text-xs font-medium text-foreground">
                            End time
                            <input
                              type="text"
                              value={editDraft.endTime}
                              onChange={(event) =>
                                setEditDraft({ ...editDraft, endTime: event.target.value })
                              }
                              placeholder="11:00"
                              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </label>
                        </div>
                        <label className="mt-3 block text-xs font-medium text-foreground">
                          Notes
                          <textarea
                            value={editDraft.notes}
                            onChange={(event) =>
                              setEditDraft({ ...editDraft, notes: event.target.value })
                            }
                            rows={3}
                            placeholder="Add a reminder, reservation detail, or family note…"
                            className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </label>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditDraft(null)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit()}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {saveStatus === "saving" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Save changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[60px]">
                        {itinerary.length > 1 && (
                          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            Move to
                            <select
                              value={dayIndex}
                              onChange={(event) =>
                                void handleMove(item.id, dayIndex, Number(event.target.value))
                              }
                              disabled={controlsLocked}
                              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                              aria-label={`Move ${name} to another day`}
                            >
                              {itinerary.map((targetDay, targetIndex) => (
                                <option key={targetDay.date} value={targetIndex}>
                                  Day {targetIndex + 1}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleReorder(dayIndex, item.id, -1)}
                            disabled={controlsLocked || itemIndex === 0}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label={`Move ${name} earlier`}
                            title="Move earlier"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReorder(dayIndex, item.id, 1)}
                            disabled={controlsLocked || itemIndex === day.items.length - 1}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label={`Move ${name} later`}
                            title="Move later"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(dayIndex, item)}
                            disabled={controlsLocked}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label={`Edit ${name}`}
                            title="Edit time and notes"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemove(dayIndex, itemIndex, item)}
                            disabled={controlsLocked}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                            aria-label={`Remove ${name}`}
                            title="Remove stop"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    {travelSegments[itemIndex] && (
                      <ItineraryTravelSegment
                        segment={travelSegments[itemIndex]}
                        mode={travelMode}
                        destination={destination}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              This day is open. Move a stop here from another day or refresh it for new ideas.
            </p>
          )}
          </section>
        )
      })}
    </div>
  )
}
