"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BedDouble,
  BusFront,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  Luggage,
  Loader2,
  LockKeyhole,
  Plus,
  Sparkles,
  Ticket,
  Trash2,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { getBookingLink } from "@/lib/get-booking-link"
import {
  formatReadinessCurrency,
  getBooking,
  getReadinessStats,
  normalizeTripReadiness,
  reconcileBookings,
  SUPPORTED_CURRENCIES,
} from "@/lib/trip-readiness"
import type {
  BookingStatus,
  ItineraryDay,
  ReadinessCategory,
  ReadinessChecklistItem,
  TripBooking,
  TripReadinessState,
} from "@/lib/types"

interface TripReadinessProps {
  tripId: string
  destination: string
  itinerary: ItineraryDay[]
  initialReadiness?: TripReadinessState | null
}

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: "unreviewed", label: "Review booking need" },
  { value: "to_book", label: "Needs booking" },
  { value: "booked", label: "Booked" },
  { value: "not_needed", label: "No booking needed" },
]

const CATEGORY_OPTIONS: { value: ReadinessCategory; label: string }[] = [
  { value: "accommodation", label: "Accommodation" },
  { value: "transport", label: "Transportation" },
  { value: "tickets", label: "Tickets" },
  { value: "documents", label: "Documents" },
  { value: "packing", label: "Packing" },
  { value: "other", label: "Other" },
]

const CATEGORY_ICON = {
  accommodation: BedDouble,
  transport: BusFront,
  tickets: Ticket,
  documents: FileCheck2,
  packing: Luggage,
  other: ClipboardCheck,
} satisfies Record<ReadinessCategory, typeof ClipboardCheck>

const inputClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"

function parseCost(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function newChecklistId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `custom-${crypto.randomUUID()}`
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TripReadiness({
  tripId,
  destination,
  itinerary,
  initialReadiness,
}: TripReadinessProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"bookings" | "checklist">("bookings")
  const [readiness, setReadiness] = useState(() => normalizeTripReadiness(initialReadiness))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTask, setNewTask] = useState("")
  const [newCategory, setNewCategory] = useState<ReadinessCategory>("other")

  useEffect(() => {
    setReadiness(normalizeTripReadiness(initialReadiness))
    setDirty(false)
  }, [initialReadiness, tripId])

  const stats = useMemo(() => getReadinessStats(readiness, itinerary), [itinerary, readiness])

  function updateReadiness(update: (current: TripReadinessState) => TripReadinessState) {
    setReadiness(update)
    setDirty(true)
  }

  function updateBooking(itemId: string, patch: Partial<TripBooking>) {
    updateReadiness((current) => ({
      ...current,
      bookings: {
        ...current.bookings,
        [itemId]: { ...getBooking(current.bookings, itemId), ...patch },
      },
    }))
  }

  function updateChecklistItem(itemId: string, patch: Partial<ReadinessChecklistItem>) {
    updateReadiness((current) => ({
      ...current,
      checklist: current.checklist.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      ),
    }))
  }

  function removeChecklistItem(itemId: string) {
    updateReadiness((current) => ({
      ...current,
      checklist: current.checklist.filter((item) => item.id !== itemId),
    }))
  }

  function addChecklistItem(event: React.FormEvent) {
    event.preventDefault()
    const label = newTask.trim()
    if (!label) return

    updateReadiness((current) => ({
      ...current,
      checklist: [
        ...current.checklist,
        {
          id: newChecklistId(),
          label,
          category: newCategory,
          completed: false,
          cost: null,
          confirmation_code: "",
          booking_url: "",
        },
      ],
    }))
    setNewTask("")
  }

  async function saveReadiness() {
    if (saving) return
    const payload = {
      ...readiness,
      bookings: reconcileBookings(itinerary, readiness.bookings),
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/trips/${tripId}/readiness`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Could not save trip readiness")

      setReadiness(normalizeTripReadiness(result.data))
      setDirty(false)
      toast.success("Trip readiness saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save trip readiness")
    } finally {
      setSaving(false)
    }
  }

  const hasBudgetTarget = readiness.budget_target !== null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="group mb-6 w-full overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 text-left card-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <ClipboardCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    Trip readiness
                  </p>
                  <h2 className="mt-0.5 font-serif text-xl text-foreground">
                    {stats.progress === 100 ? "Ready to go" : `${stats.progress}% ready`}
                  </h2>
                </div>
              </div>
              <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${stats.progress}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-background/65 px-2 py-2">
                <p className="text-sm font-semibold text-foreground">{stats.booked}</p>
                <p className="text-[10px] text-muted-foreground">booked</p>
              </div>
              <div className="rounded-xl bg-background/65 px-2 py-2">
                <p className="text-sm font-semibold text-foreground">
                  {stats.completedTasks}/{stats.totalTasks}
                </p>
                <p className="text-[10px] text-muted-foreground">tasks</p>
              </div>
              <div className="rounded-xl bg-background/65 px-2 py-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {formatReadinessCurrency(stats.trackedSpend, readiness.currency)}
                </p>
                <p className="text-[10px] text-muted-foreground">tracked</p>
              </div>
            </div>
          </div>
        </button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 px-6 py-6 pr-12">
          <SheetHeader>
            <div className="mb-1 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">Ready for the real trip</span>
            </div>
            <SheetTitle className="font-serif text-2xl font-normal">Trip readiness</SheetTitle>
            <SheetDescription>
              Keep bookings, budget, and everything your family needs before departure in one private place.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-5 py-5 sm:px-6">
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-3.5">
              <div className="flex gap-2.5">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Private to your account. Shared trip links never include costs, booking links, or confirmation details.
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Trip budget
                  <div className="mt-1.5 flex rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                    <span className="flex items-center border-r border-input px-3 text-sm text-muted-foreground">
                      <CircleDollarSign className="h-4 w-4" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={readiness.budget_target ?? ""}
                      onChange={(event) =>
                        updateReadiness((current) => ({
                          ...current,
                          budget_target: parseCost(event.target.value),
                        }))
                      }
                      placeholder="Set target"
                      className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none"
                    />
                  </div>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Currency
                  <select
                    value={readiness.currency}
                    onChange={(event) =>
                      updateReadiness((current) => ({ ...current, currency: event.target.value }))
                    }
                    className={`${inputClass} mt-1.5`}
                  >
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tracked trip total</p>
                  <p className="mt-0.5 text-lg font-semibold text-foreground">
                    {formatReadinessCurrency(stats.trackedSpend, readiness.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {stats.overBudget > 0 ? "Over target" : hasBudgetTarget ? "Remaining" : "Budget target"}
                  </p>
                  <p className={`mt-0.5 text-lg font-semibold ${stats.overBudget > 0 ? "text-destructive" : "text-foreground"}`}>
                    {stats.overBudget > 0
                      ? formatReadinessCurrency(stats.overBudget, readiness.currency)
                      : stats.remainingBudget !== null
                        ? formatReadinessCurrency(stats.remainingBudget, readiness.currency)
                        : "Not set"}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setActiveTab("bookings")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === "bookings" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Bookings · {stats.reviewedBookings}/{stats.itineraryItems}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("checklist")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === "checklist" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Before you go · {stats.completedTasks}/{stats.totalTasks}
              </button>
            </div>

            {activeTab === "bookings" ? (
              <div className="space-y-5">
                <div>
                  <h3 className="font-serif text-xl text-foreground">Reservation check</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Review each itinerary stop so tickets and timed entries don’t become day-of surprises.
                  </p>
                </div>

                {itinerary.length ? (
                  itinerary.map((day, dayIndex) => (
                    <section key={`${day.date}-${dayIndex}`} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {dayIndex + 1}
                        </span>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Day {dayIndex + 1} · {day.date}
                        </p>
                      </div>

                      {day.items.map((item) => {
                        const booking = getBooking(readiness.bookings, item.id)
                        const bookingSuggestion = getBookingLink(item, destination)
                        const showDetails = booking.status === "to_book" || booking.status === "booked"

                        return (
                          <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-semibold text-foreground">{item.attraction_name}</h4>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {item.start_time || "Flexible time"}
                                </p>
                              </div>
                              {booking.status === "booked" && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">
                                  <Check className="h-3 w-3" /> Booked
                                </span>
                              )}
                              {booking.status === "to_book" && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                  <AlertTriangle className="h-3 w-3" /> To book
                                </span>
                              )}
                            </div>

                            <select
                              aria-label={`Booking status for ${item.attraction_name}`}
                              value={booking.status}
                              onChange={(event) =>
                                updateBooking(item.id, { status: event.target.value as BookingStatus })
                              }
                              className={`${inputClass} mt-3`}
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            {showDetails && (
                              <div className="mt-4 space-y-3 border-t border-border pt-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    {booking.status === "booked" ? "Paid / estimated cost" : "Expected cost"}
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={booking.cost ?? ""}
                                      onChange={(event) => updateBooking(item.id, { cost: parseCost(event.target.value) })}
                                      placeholder="0.00"
                                      className={`${inputClass} mt-1.5`}
                                    />
                                  </label>
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Confirmation number
                                    <input
                                      value={booking.confirmation_code}
                                      onChange={(event) => updateBooking(item.id, { confirmation_code: event.target.value })}
                                      placeholder="Private confirmation"
                                      className={`${inputClass} mt-1.5`}
                                    />
                                  </label>
                                </div>
                                <label className="block text-xs font-medium text-muted-foreground">
                                  Reservation link
                                  <input
                                    type="url"
                                    value={booking.booking_url}
                                    onChange={(event) => updateBooking(item.id, { booking_url: event.target.value })}
                                    placeholder="https://…"
                                    className={`${inputClass} mt-1.5`}
                                  />
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {booking.booking_url && /^https?:\/\//i.test(booking.booking_url) && (
                                    <a
                                      href={booking.booking_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                                    >
                                      <ExternalLink className="h-3 w-3" /> Open reservation
                                    </a>
                                  )}
                                  {!booking.booking_url && bookingSuggestion && (
                                    <a
                                      href={bookingSuggestion.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
                                    >
                                      <ExternalLink className="h-3 w-3" /> {bookingSuggestion.label}
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </section>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                    <Ticket className="mx-auto h-7 w-7 text-primary/70" />
                    <p className="mt-3 text-sm font-medium text-foreground">No itinerary stops yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Generate an itinerary and its reservation check will appear here.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif text-xl text-foreground">Before you go</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Track the practical details that make departure day feel calm.
                  </p>
                </div>

                <div className="space-y-3">
                  {readiness.checklist.map((item) => {
                    const CategoryIcon = CATEGORY_ICON[item.category]
                    const hasDetails = Boolean(
                      item.cost !== null || item.confirmation_code || item.booking_url
                    )

                    return (
                      <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => updateChecklistItem(item.id, { completed: !item.completed })}
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                              item.completed
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-input bg-background text-transparent hover:border-primary"
                            }`}
                            aria-label={`${item.completed ? "Mark incomplete" : "Mark complete"}: ${item.label}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className={`text-sm font-medium ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                  {item.label}
                                </p>
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                  <CategoryIcon className="h-3 w-3" />
                                  {CATEGORY_OPTIONS.find((category) => category.value === item.category)?.label}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeChecklistItem(item.id)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Remove ${item.label}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <details className="mt-3" open={hasDetails || undefined}>
                              <summary className="cursor-pointer text-xs font-medium text-primary">Cost & private details</summary>
                              <div className="mt-3 space-y-3 border-t border-border pt-3">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Cost
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={item.cost ?? ""}
                                      onChange={(event) => updateChecklistItem(item.id, { cost: parseCost(event.target.value) })}
                                      placeholder="0.00"
                                      className={`${inputClass} mt-1.5`}
                                    />
                                  </label>
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Confirmation number
                                    <input
                                      value={item.confirmation_code}
                                      onChange={(event) => updateChecklistItem(item.id, { confirmation_code: event.target.value })}
                                      placeholder="Private confirmation"
                                      className={`${inputClass} mt-1.5`}
                                    />
                                  </label>
                                </div>
                                <label className="block text-xs font-medium text-muted-foreground">
                                  Booking link
                                  <input
                                    type="url"
                                    value={item.booking_url}
                                    onChange={(event) => updateChecklistItem(item.id, { booking_url: event.target.value })}
                                    placeholder="https://…"
                                    className={`${inputClass} mt-1.5`}
                                  />
                                </label>
                              </div>
                            </details>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <form onSubmit={addChecklistItem} className="rounded-2xl border border-dashed border-border p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add your own task</p>
                  <input
                    value={newTask}
                    onChange={(event) => setNewTask(event.target.value)}
                    placeholder="e.g., Reserve airport parking"
                    maxLength={200}
                    className={inputClass}
                  />
                  <div className="mt-2 flex gap-2">
                    <select
                      value={newCategory}
                      onChange={(event) => setNewCategory(event.target.value as ReadinessCategory)}
                      className={`${inputClass} flex-1`}
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!newTask.trim()}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-background px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={saveReadiness}
            disabled={saving || !dirty}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
            {saving ? "Saving readiness…" : dirty ? "Save readiness" : "Everything saved"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
