"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import {
  ArrowRight,
  Compass,
  Footprints,
  LayoutGrid,
  Map,
  MapPin,
  Sparkles,
  Utensils,
} from "lucide-react"
import type { FamilyVibe } from "@/lib/types"
import {
  destinationBrowseCards,
  getDefaultDestinationLens,
  getDestinationsForLens,
  type DestinationBrowseCard,
  type DestinationLens,
} from "@/lib/destination-browse"

const DestinationMap = dynamic(
  () =>
    import("@/components/destination-map-leaflet").then(
      (module) => module.DestinationMapLeaflet
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[440px] items-center justify-center bg-muted/20 text-sm text-muted-foreground">
        Loading destination map…
      </div>
    ),
  }
)

const lenses: { label: DestinationLens; icon: typeof Sparkles }[] = [
  { label: "Your vibe", icon: Sparkles },
  { label: "Food + culture", icon: Utensils },
  { label: "Easy with kids", icon: Compass },
  { label: "Nature reset", icon: Footprints },
]

interface DestinationBrowserProps {
  familyVibe: FamilyVibe | null
  onExplore: (destination: DestinationBrowseCard) => void
}

export function DestinationBrowser({
  familyVibe,
  onExplore,
}: DestinationBrowserProps) {
  const [view, setView] = useState<"discover" | "map">("discover")
  const [lens, setLens] = useState<DestinationLens>(() =>
    getDefaultDestinationLens(familyVibe)
  )
  const destinations = useMemo(() => getDestinationsForLens(lens), [lens])
  const [selectedName, setSelectedName] = useState(
    destinations[0]?.name ?? destinationBrowseCards[0].name
  )
  const selected =
    destinations.find((destination) => destination.name === selectedName) ??
    destinations[0] ??
    destinationBrowseCards[0]
  const featured =
    destinations.find((destination) => destination.featured) ?? selected

  function chooseLens(nextLens: DestinationLens) {
    const nextDestinations = getDestinationsForLens(nextLens)
    setLens(nextLens)
    setSelectedName(nextDestinations[0]?.name ?? destinationBrowseCards[0].name)
  }

  return (
    <section className="mt-8" aria-label="Browse destinations">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Explore by feeling
          </p>
          <h2 className="mt-2 font-serif text-2xl text-foreground sm:text-3xl">
            Places that fit your family
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Start with the reason to go—not a wall of generic destinations.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-full border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setView("discover")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors ${
              view === "discover"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Browse
          </button>
          <button
            type="button"
            onClick={() => setView("map")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors ${
              view === "map"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Map className="h-3.5 w-3.5" /> Map
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lenses.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => chooseLens(label)}
            aria-pressed={lens === label}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-medium transition-colors ${
              lens === label
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${lens === label ? "text-primary" : ""}`} />
            {label}
          </button>
        ))}
      </div>

      {view === "discover" ? (
        <div className="space-y-10">
          <article className="grid overflow-hidden rounded-[1.5rem] border border-border bg-[#101012] text-white shadow-2xl shadow-black/10 lg:grid-cols-[1.35fr_1fr]">
            <div className="relative min-h-[330px] overflow-hidden lg:min-h-[430px]">
              <img
                src={featured.imageUrl}
                alt={featured.destination}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/5" />
              <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs text-white/90 backdrop-blur-md">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {featured.destination}
              </div>
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-9 lg:p-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Top match for your family
              </p>
              <h3 className="mt-3 font-serif text-3xl leading-tight text-white lg:text-4xl">
                {featured.name}, in your family&apos;s rhythm
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                {featured.familyFitReason}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {featured.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] text-white/75"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onExplore(featured)}
                className="mt-7 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary/90"
              >
                Explore {featured.name} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>

          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="overline">Picked for {lens.toLowerCase()}</p>
                <h3 className="mt-2 font-serif text-2xl text-foreground">
                  More places worth a closer look
                </h3>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {destinations
                .filter((destination) => destination.name !== featured.name)
                .slice(0, 6)
                .map((destination) => (
                  <article
                    key={destination.name}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/35"
                  >
                    <button
                      type="button"
                      onClick={() => onExplore(destination)}
                      className="relative block h-52 w-full overflow-hidden text-left"
                    >
                      <img
                        src={destination.imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                      <span className="absolute bottom-4 left-4 text-white">
                        <strong className="block font-serif text-2xl font-normal">
                          {destination.name}
                        </strong>
                        <span className="text-xs text-white/70">{destination.country}</span>
                      </span>
                    </button>
                    <div className="p-5">
                      <h4 className="text-sm font-semibold text-foreground">
                        {destination.headline}
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        <strong className="font-medium text-foreground">Why it fits: </strong>
                        {destination.familyFitReason}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
                        <span>{destination.energy}</span>
                        <span>{destination.idealStay}</span>
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/5 lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
            <p className="px-1 text-xs font-medium text-foreground">
              {destinations.length} family-fit destinations
            </p>
            <p className="px-1 pb-3 pt-1 text-[11px] text-muted-foreground">
              Choose a place to see the reason it matches.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {destinations.map((destination) => (
                <button
                  key={destination.name}
                  type="button"
                  onClick={() => setSelectedName(destination.name)}
                  className={`flex min-h-[86px] items-center gap-3 rounded-xl border p-2 text-left transition ${
                    selected.name === destination.name
                      ? "border-primary/35 bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-muted/40"
                  }`}
                >
                  <img
                    src={destination.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0">
                    <strong className="block truncate font-serif text-base font-normal text-foreground">
                      {destination.name}
                    </strong>
                    <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {destination.headline}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-primary">
                      <Sparkles className="h-3 w-3" /> {destination.tags[0]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="relative min-h-[640px] overflow-hidden bg-muted/20 lg:min-h-[720px]">
            <DestinationMap
              destinations={destinations}
              selected={selected}
              onSelect={(destination) => setSelectedName(destination.name)}
              onExplore={onExplore}
            />
            <article className="absolute bottom-4 left-4 right-4 z-[500] rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-md sm:left-auto sm:max-w-md">
              <p className="overline">Why this fits your family</p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl text-foreground">
                    {selected.name}, <span className="font-sans text-sm text-muted-foreground">{selected.country}</span>
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {selected.familyFitReason}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] text-foreground">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onExplore(selected)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Explore {selected.name} <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}

