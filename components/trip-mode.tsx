"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudRain,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  SkipForward,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { ItineraryDay, ItineraryItem } from "@/lib/types"
import type { TravelMode } from "@/lib/itinerary-logistics"
import { parseTimeToMinutes } from "@/lib/itinerary-logistics"
import { moveItineraryItem } from "@/lib/itinerary-editing"
import {
  getActiveStop,
  getTripModeDayIndex,
  shiftRemainingStops,
} from "@/lib/trip-mode"

interface TripModeProps {
  itinerary: ItineraryDay[]
  destination: string
  travelMode: TravelMode
  busy: boolean
  weatherUpdatingDate: string | null
  onClose: () => void
  onSave: (next: ItineraryDay[], rollback: ItineraryDay[]) => Promise<boolean>
  onStatusChange: (
    dayIndex: number,
    itemId: string,
    status: ItineraryItem["status"]
  ) => Promise<boolean>
  onWeatherBackup: (date: string) => Promise<void>
}

function formatDayDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

function getLocalDate(now: Date) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}

function directionsUrl(name: string, destination: string, mode: TravelMode) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${name}, ${destination}`,
    travelmode: mode,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function TripMode({
  itinerary,
  destination,
  travelMode,
  busy,
  weatherUpdatingDate,
  onClose,
  onSave,
  onStatusChange,
  onWeatherBackup,
}: TripModeProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(() =>
    getTripModeDayIndex(itinerary)
  )
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedDayIndex >= itinerary.length) {
      setSelectedDayIndex(Math.max(0, itinerary.length - 1))
    }
  }, [itinerary.length, selectedDayIndex])

  const day = itinerary[selectedDayIndex]
  const activeStop = useMemo(() => {
    if (!day) return null
    const unfinished = day.items.filter(
      (item) => item.status !== "completed" && item.status !== "skipped"
    )
    if (day.date !== getLocalDate(now)) return unfinished[0] ?? null
    return getActiveStop(day, now)
  }, [day, now])
  const activeIndex = day?.items.findIndex((item) => item.id === activeStop?.id) ?? -1
  const followingStops = day?.items.filter(
    (item, index) =>
      index > activeIndex && item.status !== "completed" && item.status !== "skipped"
  ) ?? []
  const completedCount = day?.items.filter((item) => item.status === "completed").length ?? 0
  const skippedCount = day?.items.filter((item) => item.status === "skipped").length ?? 0
  const doneCount = completedCount + skippedCount
  const totalCount = day?.items.length ?? 0
  const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0
  const isToday = day?.date === getLocalDate(now)
  const activeStart = parseTimeToMinutes(activeStop?.start_time)
  const activeEnd = parseTimeToMinutes(activeStop?.end_time)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const activeLabel =
    isToday && activeStart != null && activeEnd != null && nowMinutes >= activeStart && nowMinutes <= activeEnd
      ? "Happening now"
      : isToday && activeEnd != null && nowMinutes > activeEnd
        ? "Still on your list"
      : "Up next"

  async function changeStatus(item: ItineraryItem, status: "completed" | "skipped") {
    if (busy) return
    const saved = await onStatusChange(selectedDayIndex, item.id, status)
    if (saved) {
      toast.success(status === "completed" ? "Stop complete" : "Stop skipped", {
        action: {
          label: "Undo",
          onClick: () => void onStatusChange(selectedDayIndex, item.id, "planned"),
        },
      })
    }
  }

  async function shiftSchedule(minutes: number) {
    if (!activeStop || busy) return
    const next = shiftRemainingStops(
      itinerary,
      selectedDayIndex,
      activeStop.id,
      minutes
    )
    const saved = await onSave(next, itinerary)
    if (saved) toast.success(`Remaining stops moved ${minutes} minutes later`)
  }

  async function moveStop(item: ItineraryItem, toDayIndex: number) {
    if (busy || toDayIndex === selectedDayIndex) return
    const next = moveItineraryItem(itinerary, selectedDayIndex, item.id, toDayIndex)
    const saved = await onSave(next, itinerary)
    if (saved) toast.success(`Moved to Day ${toDayIndex + 1}`)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="left-0 top-0 h-[100dvh] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden border-0 p-0 sm:rounded-none [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-background/90 [&>button]:p-2 [&>button]:shadow-sm">
        <DialogTitle className="sr-only">Trip Mode</DialogTitle>
        <DialogDescription className="sr-only">
          Follow today&apos;s itinerary, get directions, and update stops as you go.
        </DialogDescription>

        <div className="flex h-full flex-col bg-background">
          <header className="shrink-0 border-b border-border bg-card px-4 pb-3 pt-4 sm:px-6">
            <div className="mx-auto max-w-3xl pr-12">
              <div className="flex items-center gap-2 text-primary">
                <Navigation className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">Trip Mode</p>
              </div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {day ? formatDayDate(day.date) : "Your trip"}
                  </h2>
                  <p className="text-sm text-muted-foreground">{destination}</p>
                </div>
                {totalCount > 0 && (
                  <p className="shrink-0 text-xs font-medium text-muted-foreground">
                    {doneCount} of {totalCount} handled
                  </p>
                )}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </header>

          {itinerary.length > 1 && (
            <div className="shrink-0 overflow-x-auto border-b border-border bg-card px-4 py-2 sm:px-6">
              <div className="mx-auto flex w-max min-w-full max-w-3xl gap-2">
                {itinerary.map((candidate, index) => (
                  <button
                    key={candidate.date}
                    type="button"
                    onClick={() => setSelectedDayIndex(index)}
                    className={`min-h-11 rounded-xl px-4 text-sm font-medium transition-colors ${
                      selectedDayIndex === index
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Day {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 pb-10 sm:px-6">
              {activeStop ? (
                <section className="overflow-hidden rounded-3xl bg-foreground text-background shadow-xl shadow-foreground/10">
                  <div className="p-5 sm:p-7">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1.5 text-xs font-semibold">
                        <Clock3 className="h-3.5 w-3.5" /> {activeLabel}
                      </span>
                      <span className="text-sm font-medium text-background/70">
                        {activeStop.start_time}–{activeStop.end_time}
                      </span>
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold leading-tight sm:text-3xl">
                      {activeStop.attraction_name}
                    </h3>
                    {activeStop.notes && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-background/70">
                        {activeStop.notes.replace(/^#+\s*/gm, "").trim()}
                      </p>
                    )}

                    <a
                      href={directionsUrl(activeStop.attraction_name, destination, travelMode)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Navigation className="h-5 w-5" />
                      Directions
                      <ExternalLink className="h-4 w-4 opacity-70" />
                    </a>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => void changeStatus(activeStop, "completed")}
                        disabled={busy}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => void changeStatus(activeStop, "skipped")}
                        disabled={busy}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-background/10 px-4 text-sm font-semibold transition-colors hover:bg-background/15 disabled:opacity-50"
                      >
                        <SkipForward className="h-5 w-5" /> Skip
                      </button>
                    </div>
                  </div>
                  {itinerary.length > 1 && (
                    <label className="flex min-h-12 items-center gap-2 border-t border-background/10 px-5 text-sm text-background/70 sm:px-7">
                      Move this stop to
                      <select
                        value={selectedDayIndex}
                        onChange={(event) => void moveStop(activeStop, Number(event.target.value))}
                        disabled={busy}
                        className="ml-auto rounded-xl border border-background/15 bg-background/10 px-3 py-2 font-medium text-background outline-none"
                      >
                        {itinerary.map((_, index) => (
                          <option key={index} value={index} className="text-foreground">
                            Day {index + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </section>
              ) : (
                <section className="rounded-3xl border border-accent/20 bg-accent/10 px-6 py-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
                  <h3 className="mt-3 text-xl font-semibold text-foreground">Day complete</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every stop is complete or skipped. Enjoy the rest of the day.
                  </p>
                </section>
              )}

              {activeStop && (
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Running late?</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shift this stop and everything after it.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[15, 30, 60].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => void shiftSchedule(minutes)}
                        disabled={busy}
                        className="min-h-12 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-50"
                      >
                        +{minutes} min
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <button
                type="button"
                onClick={() => day && void onWeatherBackup(day.date)}
                disabled={!day || busy || weatherUpdatingDate === day?.date}
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 text-left text-sky-950 transition-colors hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-100"
              >
                {weatherUpdatingDate === day?.date ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                ) : (
                  <CloudRain className="h-5 w-5 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {weatherUpdatingDate === day?.date ? "Finding indoor backups…" : "Weather changed?"}
                  </span>
                  <span className="block text-xs opacity-70">Find indoor-friendly swaps for this day</span>
                </span>
                <Sparkles className="h-4 w-4 shrink-0" />
              </button>

              {followingStops.length > 0 && (
                <section>
                  <h3 className="px-1 text-sm font-semibold text-foreground">Later today</h3>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
                    {followingStops.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-0"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {day.items.findIndex((candidate) => candidate.id === item.id) + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{item.attraction_name}</p>
                          <p className="text-xs text-muted-foreground">{item.start_time}–{item.end_time}</p>
                        </div>
                        <a
                          href={directionsUrl(item.attraction_name, destination, travelMode)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Directions to ${item.attraction_name}`}
                          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {day && doneCount > 0 && (
                <section className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {completedCount} complete{skippedCount ? ` · ${skippedCount} skipped` : ""}
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
