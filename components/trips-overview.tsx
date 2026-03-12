"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, Map, Calendar, X, LogIn, Hotel, Trash2 } from "lucide-react"
import { DestinationAutocomplete } from "@/components/destination-autocomplete"
import type { Trip } from "@/lib/types"

interface TripsOverviewProps {
  trips: Trip[]
  isLoggedIn: boolean
}

export function TripsOverview({ trips, isLoggedIn }: TripsOverviewProps) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [title, setTitle] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [accommodationArea, setAccommodationArea] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openWizard() {
    setWizardStep(1)
    setTitle("")
    setDestination("")
    setStartDate("")
    setEndDate("")
    setAccommodationArea("")
    setShowCreate(true)
  }

  function closeWizard() {
    setShowCreate(false)
    setWizardStep(1)
  }

  async function handleDelete(e: React.MouseEvent, tripId: string) {
    e.preventDefault()
    if (!confirm("Delete this trip? This can't be undone.")) return
    setDeletingId(tripId)
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Trip deleted")
      router.refresh()
    } catch {
      toast.error("Could not delete trip")
    } finally {
      setDeletingId(null)
    }
  }

  const dateError =
    startDate && endDate && endDate < startDate
      ? "End date must be after start date"
      : null

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const tripTitle = title.trim() || `${destination} Trip`
    if (!destination.trim()) return
    if (dateError) return

    setCreating(true)
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tripTitle,
          destination,
          start_date: startDate || null,
          end_date: endDate || null,
          accommodation_area: accommodationArea || null,
        }),
      })

      if (!res.ok) throw new Error("Failed to create trip")

      const { data: newTrip } = await res.json()
      toast.success("Trip created! Now let's find some places.")
      router.push(`/search?trip=${newTrip.id}&dest=${encodeURIComponent(destination)}`)
    } catch {
      toast.error("Could not create trip")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Your Trips</h1>
          <p className="mt-1 text-muted-foreground">
            Plan and manage your family adventures.
          </p>
        </div>
        {isLoggedIn ? (
          <button
            onClick={openWizard}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Trip
          </button>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <LogIn className="h-4 w-4" />
            Sign in to plan
          </Link>
        )}
      </div>

      {/* Sign-in prompt for unauthenticated users */}
      {!isLoggedIn && (
        <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <LogIn className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h2 className="font-medium text-foreground">Sign in to start planning</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account to save trips, build itineraries, and get personalized recommendations.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Create account
            </Link>
          </div>
        </div>
      )}

      {/* Create Trip Wizard */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={closeWizard}
          onKeyDown={(e) => { if (e.key === "Escape") closeWizard() }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  {[1, 2].map((s) => (
                    <div
                      key={s}
                      className={`h-1.5 w-8 rounded-full transition-colors ${s <= wizardStep ? "bg-primary" : "bg-muted"}`}
                    />
                  ))}
                </div>
                <h2 className="font-serif text-xl text-foreground">
                  {wizardStep === 1 ? "Where are you going?" : "When & details"}
                </h2>
              </div>
              <button onClick={closeWizard} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: Destination */}
            {wizardStep === 1 && (
              <div className="flex flex-col gap-5">
                <DestinationAutocomplete
                  value={destination}
                  onChange={setDestination}
                  placeholder="e.g., Tokyo, Japan"
                />
                <button
                  type="button"
                  disabled={!destination.trim()}
                  onClick={() => setWizardStep(2)}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  Next →
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  You can add more details in the next step
                </p>
              </div>
            )}

            {/* Step 2: Dates + name */}
            {wizardStep === 2 && (
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground">
                    Trip Name <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`e.g., ${destination} Summer 2026`}
                    className="rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {dateError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{dateError}</p>
                )}

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
                    Where are you staying?
                    <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={accommodationArea}
                    onChange={(e) => setAccommodationArea(e.target.value)}
                    placeholder="e.g., Shinjuku, near Tokyo Station"
                    className="rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !!dateError}
                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : `Create trip → Find places in ${destination}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Trips list */}
      {trips.length === 0 && isLoggedIn ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <Map className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="font-medium text-foreground">No trips planned yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first trip to start building an itinerary.
          </p>
          <button
            onClick={openWizard}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Your First Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <button
                onClick={(e) => handleDelete(e, trip.id)}
                disabled={deletingId === trip.id}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                aria-label="Delete trip"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    trip.status === "active"
                      ? "bg-accent/10 text-accent"
                      : trip.status === "completed"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {trip.status}
                </span>
              </div>
              <h3 className="text-lg font-medium text-foreground group-hover:text-primary">
                {trip.title}
              </h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Map className="h-3.5 w-3.5" />
                {trip.destination}
              </p>
              {trip.start_date && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {trip.end_date &&
                    ` - ${new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}`}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
