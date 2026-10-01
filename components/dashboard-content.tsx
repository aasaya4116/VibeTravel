"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  Map,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react"
import { DashboardLocationSelector } from "@/components/dashboard-location-selector"
import {
  destinationBrowseCards,
  destinationLenses,
  getDefaultDestinationLens,
  type DestinationBrowseCard,
  type DestinationLens,
} from "@/lib/destination-browse"
import {
  findDashboardDestinationCard,
  getRecommendedDashboardDestinations,
} from "@/lib/dashboard-destinations"
import { getCountryCode, getFlagUrl } from "@/lib/destination-flag"
import { getReadinessStats, normalizeTripReadiness } from "@/lib/trip-readiness"
import type { FamilyVibe, Profile, Trip, TripReadinessState } from "@/lib/types"

const DestinationMapLeaflet = dynamic(
  () =>
    import("@/components/destination-map-leaflet").then(
      (module) => module.DestinationMapLeaflet
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[480px] place-items-center bg-[#ddd8cd]">
        <div className="flex items-center gap-2 text-sm text-[#5c584f]">
          <Map className="h-4 w-4 animate-pulse" />
          Loading the map…
        </div>
      </div>
    ),
  }
)

interface DashboardContentProps {
  profile: Profile | null
  trips: Trip[]
  familyVibe: FamilyVibe | null
  readinessByTrip: Record<string, TripReadinessState>
}

function getUpcomingTrip(trips: Trip[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    trips
      .filter((trip) => trip.start_date && trip.status !== "completed")
      .sort(
        (left, right) =>
          new Date(`${left.start_date}T00:00:00`).getTime() -
          new Date(`${right.start_date}T00:00:00`).getTime()
      )
      .find((trip) => {
        const lastDay = new Date(`${trip.end_date ?? trip.start_date}T23:59:59`)
        return lastDay >= today
      }) ?? null
  )
}

function getCountdown(startDate: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${startDate}T00:00:00`)
  const days = Math.ceil((start.getTime() - today.getTime()) / 86_400_000)

  if (days < 0) return "Happening now"
  if (days === 0) return "Starts today"
  if (days === 1) return "Tomorrow"
  return `${days} days away`
}

function formatTripDates(trip: Trip) {
  if (!trip.start_date) return "Dates not set"
  const start = new Date(`${trip.start_date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  if (!trip.end_date) return start
  const end = new Date(`${trip.end_date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${start} – ${end}`
}

function TripFlag({ destination }: { destination: string }) {
  const code = getCountryCode(destination)
  return code ? (
    <img
      src={getFlagUrl(code)}
      alt=""
      width={22}
      height={16}
      className="rounded-sm object-cover"
      style={{ width: 22, height: 16 }}
    />
  ) : (
    <MapPin className="h-4 w-4" />
  )
}

export function DashboardContent({
  profile,
  trips,
  familyVibe,
  readinessByTrip,
}: DashboardContentProps) {
  const router = useRouter()
  const displayName = profile?.display_name?.split(" ")[0] || "Explorer"
  const upcomingTrip = useMemo(() => getUpcomingTrip(trips), [trips])
  const recentDestinations = useMemo(
    () => Array.from(new Set(trips.map((trip) => trip.destination).filter(Boolean))).slice(0, 6),
    [trips]
  )
  const recommendedDestinations = useMemo(
    () => getRecommendedDashboardDestinations(familyVibe?.travel_style ?? []),
    [familyVibe?.travel_style]
  )

  const [lens, setLens] = useState<DestinationLens>(() => getDefaultDestinationLens(familyVibe))
  const [selectedDestination, setSelectedDestination] = useState<DestinationBrowseCard>(
    () =>
      (upcomingTrip && findDashboardDestinationCard(upcomingTrip.destination)) ||
      recommendedDestinations[0] ||
      destinationBrowseCards[0]
  )
  const [locationSelectorOpen, setLocationSelectorOpen] = useState(false)

  const lensDestinations = useMemo(() => {
    const matching = recommendedDestinations.filter((destination) =>
      destination.lenses.includes(lens)
    )
    return matching.length > 0 ? matching : recommendedDestinations
  }, [lens, recommendedDestinations])

  useEffect(() => {
    if (!lensDestinations.some((destination) => destination.name === selectedDestination.name)) {
      setSelectedDestination(lensDestinations[0])
    }
  }, [lensDestinations, selectedDestination.name])

  const readiness = upcomingTrip
    ? normalizeTripReadiness(readinessByTrip[upcomingTrip.id])
    : null
  const readinessStats = upcomingTrip && readiness
    ? getReadinessStats(readiness, upcomingTrip.itinerary ?? [])
    : null
  const remainingTasks = readinessStats
    ? Math.max(readinessStats.totalTasks - readinessStats.completedTasks, 0)
    : 0
  const recentTrips = trips.slice(0, 3)
  const vibeLabels = familyVibe?.travel_style?.slice(0, 3) ?? []

  function exploreDestination(destination: DestinationBrowseCard) {
    router.push(
      `/search?dest=${encodeURIComponent(destination.destination)}&q=${encodeURIComponent(destination.query)}`
    )
  }

  function handleLocationSelection(destination: string) {
    const curated = findDashboardDestinationCard(destination)
    if (curated) {
      setSelectedDestination(curated)
      return
    }
    router.push(`/search?dest=${encodeURIComponent(destination)}`)
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#201d19] dark:bg-background dark:text-foreground">
      <DashboardLocationSelector
        open={locationSelectorOpen}
        onOpenChange={setLocationSelectorOpen}
        recentDestinations={recentDestinations}
        selectedDestination={selectedDestination.destination}
        onExplore={handleLocationSelection}
      />

      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Your travel world
            </p>
            <h1 className="mt-1 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
              Good to see you, {displayName}.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Explore a place that fits your family, or pick up your next trip.
            </p>
          </div>
          <Link
            href="/trips"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-[#201d19] px-5 text-sm font-semibold text-white transition hover:bg-primary dark:bg-foreground dark:text-background"
          >
            <Plus className="h-4 w-4" />
            New trip
          </Link>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.72fr)]">
          <section className="isolate min-w-0 overflow-hidden rounded-[28px] border border-black/[0.08] bg-[#ded9cf] shadow-[0_24px_65px_-42px_rgba(39,31,23,0.55)] dark:border-border dark:bg-card">
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] bg-gradient-to-b from-black/55 via-black/15 to-transparent p-4 pb-20 sm:p-5 sm:pb-24">
                <div className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setLocationSelectorOpen(true)}
                    className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-full border border-white/35 bg-white/[0.92] px-5 text-left text-[#24211d] shadow-lg backdrop-blur transition hover:bg-white"
                  >
                    <Search className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7c746a]">
                        Explore a destination
                      </span>
                      <span className="block truncate text-sm font-semibold">
                        {selectedDestination.destination}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#7c746a]" />
                  </button>
                  <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                    {destinationLenses.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setLens(item)}
                        className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold backdrop-blur transition ${
                          lens === item
                            ? "border-primary bg-primary text-white"
                            : "border-white/30 bg-black/35 text-white hover:bg-black/55"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dashboard-destination-map h-[520px] sm:h-[580px]">
                <DestinationMapLeaflet
                  destinations={destinationBrowseCards}
                  selected={selectedDestination}
                  onSelect={setSelectedDestination}
                  onExplore={exploreDestination}
                />
              </div>

              <div className="absolute inset-x-4 bottom-4 z-[450] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-[360px]">
                <div className="rounded-2xl border border-white/55 bg-white/[0.94] p-4 text-[#24211d] shadow-xl backdrop-blur-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-primary">
                        Why it fits your family
                      </p>
                      <h2 className="mt-1 font-serif text-2xl leading-none">
                        {selectedDestination.name}
                      </h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#e9f0eb] px-2.5 py-1 text-[10px] font-semibold text-[#49715f]">
                      {selectedDestination.energy}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#6e675f]">
                    {selectedDestination.familyFitReason}
                  </p>
                  <button
                    type="button"
                    onClick={() => exploreDestination(selectedDestination)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary"
                  >
                    Explore {selectedDestination.name}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-black/[0.07] bg-[#f7f4ef] p-4 dark:border-border dark:bg-card sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-primary">
                    Chosen for your vibe
                  </p>
                  <h2 className="mt-0.5 font-serif text-xl">Places worth a closer look</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationSelectorOpen(true)}
                  className="hidden text-xs font-semibold text-muted-foreground hover:text-primary sm:block"
                >
                  Browse all
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {lensDestinations.slice(0, 3).map((destination) => (
                  <button
                    key={destination.name}
                    type="button"
                    onClick={() => setSelectedDestination(destination)}
                    className={`group overflow-hidden rounded-2xl border bg-card text-left transition ${
                      destination.name === selectedDestination.name
                        ? "border-primary shadow-md"
                        : "border-border hover:border-primary/35"
                    }`}
                  >
                    <div className="relative h-24 overflow-hidden">
                      <img
                        src={destination.imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                      <p className="absolute bottom-2 left-3 font-serif text-lg text-white">
                        {destination.name}
                      </p>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-[11px] font-semibold text-foreground">
                        {destination.headline}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {destination.idealStay}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6">
            {upcomingTrip ? (
              <section className="overflow-hidden rounded-[28px] border border-black/[0.08] bg-card shadow-[0_24px_65px_-44px_rgba(39,31,23,0.55)]">
                <div className="relative h-44 overflow-hidden bg-[#28241f]">
                  {findDashboardDestinationCard(upcomingTrip.destination) ? (
                    <img
                      src={findDashboardDestinationCard(upcomingTrip.destination)!.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full bg-[radial-gradient(circle_at_20%_20%,rgba(237,91,36,0.35),transparent_38%),linear-gradient(145deg,#39342e,#191715)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
                      <Clock3 className="h-3 w-3 text-[#ff7849]" />
                      {upcomingTrip.start_date
                        ? getCountdown(upcomingTrip.start_date)
                        : "Upcoming trip"}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl leading-tight">
                      {upcomingTrip.title}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                      <TripFlag destination={upcomingTrip.destination} />
                      {upcomingTrip.destination}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Trip readiness
                      </p>
                      <p className="mt-1 font-serif text-3xl">{readinessStats?.progress ?? 0}%</p>
                    </div>
                    <Link
                      href={`/trips/${upcomingTrip.id}#readiness`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Review readiness
                    </Link>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[#54a283] transition-all"
                      style={{ width: `${readinessStats?.progress ?? 0}%` }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-xl font-semibold">{remainingTasks}</p>
                      <p className="text-[10px] text-muted-foreground">tasks remaining</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-xl font-semibold">{readinessStats?.toBook ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">items to book</p>
                    </div>
                  </div>
                  <Link
                    href={`/trips/${upcomingTrip.id}`}
                    className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90"
                  >
                    Continue planning
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] bg-[#25211d] p-6 text-white shadow-[0_24px_65px_-44px_rgba(39,31,23,0.7)]">
                <Compass className="h-7 w-7 text-[#ff7849]" />
                <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Start with a feeling
                </p>
                <h2 className="mt-2 font-serif text-3xl leading-tight">
                  Your next family story starts with a place.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  Browse destinations above, then turn a spark into a trip when you are ready.
                </p>
                <button
                  type="button"
                  onClick={() => setLocationSelectorOpen(true)}
                  className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold"
                >
                  Choose a destination
                  <ArrowRight className="h-4 w-4" />
                </button>
              </section>
            )}

            <section className="rounded-[24px] border border-black/[0.08] bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Your travel DNA
                  </p>
                  <h2 className="mt-1 font-serif text-xl">
                    {familyVibe?.family_name || "Family vibe"}
                  </h2>
                </div>
                <Link href="/profile/vibe" className="text-xs font-semibold text-muted-foreground hover:text-primary">
                  Edit
                </Link>
              </div>
              {familyVibe ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {vibeLabels.map((style) => (
                      <span key={style} className="rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-semibold text-primary">
                        {style}
                      </span>
                    ))}
                    {familyVibe.pace && (
                      <span className="rounded-full bg-[#e8eee9] px-3 py-1.5 text-[10px] font-semibold text-[#4a6c5d] dark:bg-muted dark:text-foreground">
                        {familyVibe.pace} pace
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    {(familyVibe.kids?.length ?? 0) + (familyVibe.travelers?.length ?? 0)} saved travelers
                  </div>
                </>
              ) : (
                <Link href="/profile/vibe" className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  Set your family vibe
                </Link>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Link href="/search" className="group rounded-[20px] border border-black/[0.08] bg-card p-4 transition hover:border-primary/35">
                <Search className="h-5 w-5 text-primary" />
                <p className="mt-5 text-sm font-semibold">Find places</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Search attractions</p>
              </Link>
              <Link href="/trips" className="group rounded-[20px] border border-black/[0.08] bg-card p-4 transition hover:border-primary/35">
                <CalendarDays className="h-5 w-5 text-primary" />
                <p className="mt-5 text-sm font-semibold">All trips</p>
                <p className="mt-1 text-[10px] text-muted-foreground">View your plans</p>
              </Link>
            </section>
          </aside>
        </div>

        <section className="mt-10 pb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-primary">
                Keep the story moving
              </p>
              <h2 className="mt-1 font-serif text-2xl">Your trips</h2>
            </div>
            <Link href="/trips" className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentTrips.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {recentTrips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="group flex min-w-0 items-center gap-4 rounded-[20px] border border-black/[0.08] bg-card p-4 transition hover:border-primary/35 hover:shadow-sm"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    {trip.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <TripFlag destination={trip.destination} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold group-hover:text-primary">
                      {trip.title}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                      {formatTripDates(trip)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLocationSelectorOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-border bg-card p-8 text-sm font-semibold text-primary"
            >
              <Compass className="h-5 w-5" />
              Choose a destination to start your first trip
            </button>
          )}
        </section>
      </div>
    </main>
  )
}
