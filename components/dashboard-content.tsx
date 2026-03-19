"use client"

import Link from "next/link"
import { Search, Map, Sparkles, ArrowRight, Plus, Baby, Pencil, Calendar, CheckCircle2, Circle } from "lucide-react"
import type { Profile, Trip, FamilyVibe } from "@/lib/types"
import { getCountryCode, getFlagUrl } from "@/lib/destination-flag"
import { OnboardingHint } from "@/components/onboarding-hint"
import { useOnboardingHints } from "@/hooks/use-onboarding-hints"

const INSPIRATION: {
  destination: string
  country: string
  styles: string[]
  tagline: string
}[] = [
  { destination: "Tokyo", country: "Japan", styles: ["cultural", "foodie", "adventurous"], tagline: "Theme parks, epic food halls, and endless kid-friendly wonder" },
  { destination: "Lisbon", country: "Portugal", styles: ["relaxed", "cultural", "foodie"], tagline: "Easy pace, incredible pastries, and stroller-friendly trams" },
  { destination: "Costa Rica", country: "Costa Rica", styles: ["adventurous", "nature"], tagline: "Wildlife, zip-lines, and beach days — all in one trip" },
  { destination: "Barcelona", country: "Spain", styles: ["beach", "cultural", "foodie"], tagline: "Gaudí, sandy beaches, and the best seafood paella" },
  { destination: "Amsterdam", country: "Netherlands", styles: ["cultural", "relaxed"], tagline: "Canal boat rides, bike paths, and world-class museums" },
  { destination: "Iceland", country: "Iceland", styles: ["nature", "adventurous"], tagline: "Waterfalls, geysers, and Northern Lights the whole family will remember" },
  { destination: "Kyoto", country: "Japan", styles: ["cultural", "relaxed"], tagline: "Bamboo groves, deer parks, and the most serene temples" },
  { destination: "New Zealand", country: "New Zealand", styles: ["nature", "adventurous"], tagline: "Epic landscapes, safe roads, and Lord of the Rings magic" },
  { destination: "Masai Mara", country: "Kenya", styles: ["adventurous", "nature"], tagline: "The Great Migration, big five safaris, and sunsets that stop time" },
  { destination: "Zanzibar", country: "Tanzania", styles: ["beach", "cultural", "relaxed"], tagline: "Turquoise waters, spice markets, and the best fresh seafood" },
  { destination: "Marrakech", country: "Morocco", styles: ["cultural", "foodie", "adventurous"], tagline: "Souks, riads, and tagines — a feast for every sense" },
  { destination: "Cape Town", country: "South Africa", styles: ["nature", "beach", "adventurous"], tagline: "Table Mountain, penguins, and wine country all within an hour" },
  { destination: "Rwanda", country: "Rwanda", styles: ["nature", "adventurous"], tagline: "Gorilla trekking, lush volcanoes, and one of Africa's safest family destinations" },
  { destination: "Serengeti", country: "Tanzania", styles: ["adventurous", "nature"], tagline: "Endless plains, lion prides, and a sky full of stars" },
  { destination: "Cairo", country: "Egypt", styles: ["cultural", "adventurous"], tagline: "Pyramids, the Nile, and 5,000 years of history for curious kids" },
  { destination: "Mauritius", country: "Mauritius", styles: ["beach", "relaxed", "nature"], tagline: "Lagoons, coral reefs, and luxury resorts built for families" },
]

function getCountdown(startDateStr: string): { label: string; urgent: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDateStr + "T00:00:00")
  const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: "In progress", urgent: false }
  if (diff === 0) return { label: "Today!", urgent: true }
  if (diff === 1) return { label: "Tomorrow!", urgent: true }
  if (diff <= 7) return { label: `${diff} days away`, urgent: true }
  return { label: `${diff} days away`, urgent: false }
}

interface DashboardContentProps {
  profile: Profile | null
  trips: Trip[]
  familyVibe: FamilyVibe | null
}

export function DashboardContent({ profile, trips, familyVibe }: DashboardContentProps) {
  const { isDismissed, dismiss } = useOnboardingHints()
  const displayName = profile?.display_name ?? "Explorer"

  // Find the next upcoming or in-progress trip
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcomingTrip =
    trips
      .filter((t) => t.start_date && t.status !== "completed")
      .sort(
        (a, b) =>
          new Date(a.start_date! + "T00:00:00").getTime() -
          new Date(b.start_date! + "T00:00:00").getTime()
      )
      .find((t) => {
        const end = t.end_date
          ? new Date(t.end_date + "T23:59:59")
          : new Date(t.start_date! + "T23:59:59")
        return end >= today
      }) ?? null

  const countdown = upcomingTrip?.start_date ? getCountdown(upcomingTrip.start_date) : null

  // Vibe-matched destination inspiration
  const userStyles = familyVibe?.travel_style ?? []
  const inspirationCards = [...INSPIRATION]
    .map((d) => ({ ...d, score: d.styles.filter((s) => userStyles.includes(s)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-balance font-serif text-3xl text-foreground lg:text-4xl">
          Hey, {displayName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {upcomingTrip
            ? "Your next adventure is coming up."
            : "Where is your family headed next?"}
        </p>
      </div>

      {/* Upcoming trip hero */}
      {upcomingTrip && countdown && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {(() => {
                const code = getCountryCode(upcomingTrip.destination)
                return code ? (
                  <img
                    src={getFlagUrl(code)}
                    alt={code.toUpperCase()}
                    width={52}
                    height={39}
                    className="shrink-0 rounded-lg object-cover shadow-sm"
                    style={{ width: 52, height: 39 }}
                  />
                ) : (
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                    📍
                  </div>
                )
              })()}
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-xl text-foreground">{upcomingTrip.title}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      countdown.urgent
                        ? "bg-accent/15 text-accent"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {countdown.label}
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {new Date(upcomingTrip.start_date! + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {upcomingTrip.end_date &&
                    ` – ${new Date(upcomingTrip.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/search?trip=${upcomingTrip.id}&dest=${encodeURIComponent(upcomingTrip.destination)}`}
                className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                Explore
              </Link>
              <Link
                href={`/trips/${upcomingTrip.id}`}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                View Trip
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions — only shown once the user has completed onboarding */}
      {trips.some(t => t.itinerary?.length > 0) && (
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/search"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Search className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Explore Attractions</p>
            <p className="text-sm text-muted-foreground">
              Find your family{"'"}s next favorite spot
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>

        {trips.length === 0 && familyVibe && !isDismissed("plan-trip") ? (
          <OnboardingHint
            message="Start here — create your first trip. Scout can plan the whole thing from scratch."
            side="bottom"
            align="start"
            onDismiss={() => dismiss("plan-trip")}
          >
            <Link
              href="/trips"
              onClick={() => dismiss("plan-trip")}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Map className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">Plan a Trip</p>
                <p className="text-sm text-muted-foreground">Build your itinerary day by day</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          </OnboardingHint>
        ) : (
          <Link
            href="/trips"
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Map className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Plan a Trip</p>
              <p className="text-sm text-muted-foreground">Build your itinerary day by day</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        )}

        {!familyVibe && (
          <Link
            href="/profile/vibe"
            className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 transition-all hover:border-primary/50 hover:bg-primary/10"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-primary">Set Your Vibe</p>
              <p className="text-sm text-primary/70">
                Tell us about your family for better results
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
      )}

      {/* Family Vibe Card */}
      {familyVibe && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl text-foreground">Your Family Vibe</h2>
            <Link
              href="/profile/vibe"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap gap-6">
              {familyVibe.kids?.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Baby className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Kids</p>
                    <div className="flex flex-wrap gap-1.5">
                      {familyVibe.kids.map((kid, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                        >
                          {kid.name ? `${kid.name}, ${kid.age}y` : `${kid.age}y`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {familyVibe.travel_style?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Travel Style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {familyVibe.travel_style.map((style) => (
                      <span
                        key={style}
                        className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {familyVibe.pace && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Pace</p>
                  <span className="rounded-full border border-accent/20 bg-accent/5 px-2.5 py-0.5 text-xs font-medium text-accent capitalize">
                    {familyVibe.pace}
                  </span>
                </div>
              )}

              {familyVibe.dietary?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Dietary</p>
                  <div className="flex flex-wrap gap-1.5">
                    {familyVibe.dietary.map((d) => (
                      <span
                        key={d}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Getting Started Checklist — shown until first itinerary is generated */}
      {!trips.some(t => t.itinerary?.length > 0) && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-medium text-foreground">Get started</h2>
          </div>
          <div className="flex flex-col gap-3">
            {[
              {
                done: !!familyVibe,
                label: "Set your family vibe",
                description: "Tell us about your kids, travel style, and needs",
                href: "/profile/vibe",
                cta: "Set vibe",
              },
              {
                done: trips.length > 0,
                label: "Create a trip",
                description: "Pick a destination and dates",
                href: "/trips",
                cta: "Create trip",
              },
              {
                done: false,
                label: "Generate your itinerary",
                description: "Save 3+ attractions to a trip, then generate a day-by-day plan",
                href: trips.length > 0 ? `/trips/${trips[0].id}` : "/trips",
                cta: "Go to trip",
              },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
                {!step.done && (
                  <Link
                    href={step.href}
                    className="shrink-0 rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    {step.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Destination Inspiration */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="font-serif text-xl text-foreground">
            Where families like yours love to go
          </h2>
          {userStyles.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Matched to your {userStyles.slice(0, 2).join(" & ")} travel style
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {inspirationCards.map((card) => {
            const code = getCountryCode(card.destination) ?? getCountryCode(card.country)
            return (
              <Link
                key={card.destination}
                href={`/search?dest=${encodeURIComponent(`${card.destination}, ${card.country}`)}`}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  {code ? (
                    <img
                      src={getFlagUrl(code)}
                      alt={code.toUpperCase()}
                      width={32}
                      height={24}
                      className="shrink-0 rounded-sm object-cover"
                      style={{ width: 32, height: 24 }}
                    />
                  ) : (
                    <span className="text-xl">📍</span>
                  )}
                  <div>
                    <p className="font-medium text-foreground group-hover:text-primary">
                      {card.destination}
                    </p>
                    <p className="text-xs text-muted-foreground">{card.country}</p>
                  </div>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                  {card.tagline}
                </p>
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  Explore attractions
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Trips Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-foreground">Your Trips</h2>
          <Link
            href="/trips"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            New Trip
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Map className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No trips yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start by exploring attractions and we{"'"}ll help you build the perfect itinerary.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Search className="h-4 w-4" />
              Start Exploring
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
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
                <h3 className="font-medium text-foreground group-hover:text-primary">
                  {trip.title}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {(() => {
                    const code = getCountryCode(trip.destination)
                    return code ? (
                      <img
                        src={getFlagUrl(code)}
                        alt={code.toUpperCase()}
                        width={20}
                        height={15}
                        className="inline-block rounded-sm object-cover"
                      />
                    ) : (
                      <span>📍</span>
                    )
                  })()}
                  <span>{trip.destination}</span>
                </p>
                {trip.start_date && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {trip.end_date &&
                      ` – ${new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}`}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
