"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
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
import { TripMap } from "@/components/trip-map"

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

  useEffect(() => {
    itineraryRef.current = initialItinerary
    setItinerary(initialItinerary)
  }, [initialItinerary])

  const savedImageMap = new Map<string, string>()
  for (const saved of savedAttractions) {
    const image = saved.attraction_data?.imageUrl
    if (image) savedImageMap.set(saved.attraction_name.toLowerCase(), image)
  }

  const busy = saveStatus === "saving" || regeneratingDate !== null
  const controlsLocked = busy || editDraft !== null

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

  async function handleRegenerateDay(date: string) {
    if (controlsLocked) return
    setRegeneratingDate(date)
    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayDate: date }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not refresh this day")
      applyItinerary(payload.itinerary)
      setSaveStatus("saved")
      setEditDraft(null)
      toast.success("Day refreshed — the rest of your trip stayed unchanged")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh this day")
    } finally {
      setRegeneratingDate(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TripMap destination={destination} itinerary={itinerary} />

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

      {itinerary.map((day, dayIndex) => (
        <section
          key={day.date}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
            <div>
              <p className="text-xs font-medium text-primary">Day {dayIndex + 1}</p>
              <h3 className="font-medium text-foreground">{formatDayDate(day.date)}</h3>
            </div>
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
      ))}
    </div>
  )
}
