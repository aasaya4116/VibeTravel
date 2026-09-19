"use client"

import Link from "next/link"
import {
  CalendarDays,
  Clock,
  ExternalLink,
  Hotel,
  MapPin,
  Printer,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import type { ItineraryDay, SharedTrip } from "@/lib/types"

interface SharedTripViewProps {
  trip: SharedTrip
  bannerImage?: string | null
}

function formatTripDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-US", options ?? { month: "long", day: "numeric", year: "numeric" })
}

function formatDayTitle(day: ItineraryDay, index: number) {
  const parsed = new Date(`${day.date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return day.date || `Day ${index + 1}`
  return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

export function SharedTripView({ trip, bannerImage }: SharedTripViewProps) {
  const itinerary = trip.itinerary ?? []
  const stopCount = itinerary.reduce((total, day) => total + day.items.length, 0)
  const dateRange = trip.start_date
    ? `${formatTripDate(trip.start_date, { month: "short", day: "numeric" })}${
        trip.end_date
          ? ` – ${formatTripDate(trip.end_date, { month: "short", day: "numeric", year: "numeric" })}`
          : ""
      }`
    : null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="VibeTravel home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-serif text-xl text-foreground">VibeTravel</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              Private view-only link
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-foreground">
          <div className="absolute inset-0">
            {bannerImage ? (
              <img src={bannerImage} alt="" className="h-full w-full object-cover opacity-60" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary via-primary/60 to-accent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
          </div>

          <div className="relative mx-auto flex min-h-[340px] max-w-6xl items-end px-4 pb-10 pt-16 sm:min-h-[390px] sm:px-6 sm:pb-12">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                A family trip shared with you
              </div>
              <h1 className="font-serif text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
                {trip.title}
              </h1>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {trip.destination}
                </span>
                {dateRange && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {dateRange}
                  </span>
                )}
                {trip.accommodation_area && (
                  <span className="flex items-center gap-1.5">
                    <Hotel className="h-4 w-4" />
                    Staying near {trip.accommodation_area}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="mb-8 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">The plan</p>
              <h2 className="font-serif text-3xl text-foreground">Day-by-day itinerary</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {itinerary.length
                  ? `${itinerary.length} ${itinerary.length === 1 ? "day" : "days"} · ${stopCount} planned ${stopCount === 1 ? "stop" : "stops"}`
                  : "This trip is still being planned."}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-accent" />
              You’re viewing the latest saved plan
            </span>
          </div>

          {itinerary.length ? (
            <div className="space-y-7">
              {itinerary.map((day, dayIndex) => (
                <article key={`${day.date}-${dayIndex}`} className="overflow-hidden rounded-2xl border border-border bg-card card-soft break-inside-avoid">
                  <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-5 py-4 sm:px-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Day {dayIndex + 1}</p>
                      <h3 className="mt-0.5 font-serif text-xl text-foreground">{formatDayTitle(day, dayIndex)}</h3>
                    </div>
                    <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                      {day.items.length} {day.items.length === 1 ? "stop" : "stops"}
                    </span>
                  </div>

                  {day.items.length ? (
                    <div className="divide-y divide-border">
                      {day.items.map((item, itemIndex) => {
                        const details = item.attraction_data
                        const mapsUrl =
                          details?.googleMapsUri ||
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.attraction_name}, ${trip.destination}`)}`

                        return (
                          <div key={item.id || `${item.attraction_name}-${itemIndex}`} className="grid gap-4 px-5 py-5 sm:grid-cols-[110px_1fr] sm:px-6">
                            <div className="flex items-start gap-2 text-sm font-medium text-foreground sm:block">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-primary" />
                                <span>{item.start_time || "Flexible"}</span>
                              </div>
                              {item.end_time && (
                                <span className="text-xs font-normal text-muted-foreground sm:ml-5 sm:mt-1 sm:block">
                                  to {item.end_time}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-base font-semibold text-foreground">{item.attraction_name}</h4>
                                  {details?.location && (
                                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" />
                                      {details.location}
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground print:hidden"
                                  aria-label={`Open ${item.attraction_name} in maps`}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>

                              {item.notes && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.notes}</p>}

                              {(details?.category || details?.estimatedDuration || details?.priceRange) && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {details.category && (
                                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                                      {details.category}
                                    </span>
                                  )}
                                  {details.estimatedDuration && (
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                                      {details.estimatedDuration}
                                    </span>
                                  )}
                                  {details.priceRange && (
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                                      {details.priceRange}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="px-6 py-8 text-center text-sm text-muted-foreground">No stops planned for this day yet.</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
              <Route className="mx-auto h-8 w-8 text-primary/70" />
              <h3 className="mt-4 font-serif text-xl text-foreground">The itinerary is taking shape</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                The trip owner shared this plan early. Check this same link again after they add the day-by-day details.
              </p>
            </div>
          )}
        </section>

        <section className="border-t border-border bg-secondary/40 px-4 py-12 text-center print:hidden sm:px-6">
          <Sparkles className="mx-auto h-5 w-5 text-primary" />
          <h2 className="mt-3 font-serif text-2xl text-foreground">Planning a family trip?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            VibeTravel turns your family’s ages, pace, interests, and needs into a trip that fits.
          </p>
          <Link
            href="/auth/sign-up"
            className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Plan your own trip
          </Link>
        </section>
      </main>
    </div>
  )
}
