"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Clock3, MapPin, Search, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getDashboardDestinationOptions,
  type DashboardDestinationOption,
} from "@/lib/dashboard-destinations"
import { getCountryCode, getFlagUrl } from "@/lib/destination-flag"

interface DashboardLocationSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recentDestinations: string[]
  selectedDestination?: string
  onExplore: (destination: string) => void
}

function DestinationPreview({ option }: { option: DashboardDestinationOption }) {
  const code = getCountryCode(option.label)

  return (
    <div className="relative hidden h-full min-h-[260px] overflow-hidden bg-[#26231f] lg:block lg:min-h-0">
      {option.imageUrl ? (
        <img
          src={option.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-all duration-700"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(237,91,36,0.34),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(84,119,108,0.38),transparent_40%),linear-gradient(145deg,#292622,#131210)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/20" />

      <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md lg:left-8 lg:top-8">
        <MapPin className="h-3.5 w-3.5 text-[#ff7849]" />
        Destination preview
      </div>

      <div className="absolute inset-x-0 bottom-0 p-6 lg:p-10">
        {code && (
          <img
            src={getFlagUrl(code)}
            alt=""
            width={28}
            height={21}
            className="mb-4 rounded-sm object-cover shadow"
            style={{ width: 28, height: 21 }}
          />
        )}
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff8a61]">
          {option.recommended ? "A VibeTravel favorite" : "Ready to explore"}
        </p>
        <h3 className="mt-2 font-serif text-4xl leading-none text-white lg:text-6xl">
          {option.city}
        </h3>
        {option.region && <p className="mt-2 text-sm text-white/55">{option.region}</p>}
        <p className="mt-5 max-w-md text-sm leading-relaxed text-white/68">
          {option.familyFitReason ??
            `Discover the places, neighborhoods, and experiences that make ${option.city} work for your family.`}
        </p>
        <button
          type="button"
          onClick={() => document.getElementById("dashboard-destination-submit")?.click()}
          className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#ef5a27] px-6 text-sm font-semibold text-white transition hover:bg-[#ff6b38]"
        >
          Explore {option.city}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function DashboardLocationSelector({
  open,
  onOpenChange,
  recentDestinations,
  selectedDestination,
  onExplore,
}: DashboardLocationSelectorProps) {
  const [query, setQuery] = useState("")
  const [selectedLabel, setSelectedLabel] = useState(
    selectedDestination ?? recentDestinations[0] ?? "Tokyo, Japan"
  )

  const options = useMemo(
    () => getDashboardDestinationOptions(recentDestinations, query),
    [query, recentDestinations]
  )
  const selected =
    options.find((option) => option.label === selectedLabel) ??
    getDashboardDestinationOptions(recentDestinations).find(
      (option) => option.label === selectedLabel
    ) ??
    options[0]

  useEffect(() => {
    if (!open) return
    setQuery("")
    setSelectedLabel(selectedDestination ?? recentDestinations[0] ?? "Tokyo, Japan")
  }, [open, recentDestinations, selectedDestination])

  function submitSelection() {
    if (!selected) return
    onExplore(selected.label)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 bg-[#151412] p-0 text-white shadow-none [&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-black/30 [&>button]:p-2 [&>button]:text-white [&>button]:opacity-100 sm:rounded-none">
        <DialogTitle className="sr-only">Choose a destination</DialogTitle>
        <DialogDescription className="sr-only">
          Search or browse destinations, then choose one to explore.
        </DialogDescription>

        <div className="grid h-full overflow-hidden lg:grid-cols-[minmax(440px,0.9fr)_minmax(480px,1.1fr)]">
          <section className="flex min-h-0 flex-col border-white/10 bg-[#151412] lg:border-r">
            <div className="border-b border-white/10 px-5 pb-5 pt-16 sm:px-8 lg:px-12 lg:pb-7 lg:pt-12">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#ff7849]">
                Choose your next view
              </p>
              <h2 className="mt-2 font-serif text-3xl text-white sm:text-4xl">
                Where do you want to go?
              </h2>
              <label className="mt-6 flex min-h-14 items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-5 transition focus-within:border-[#ff7849]/60 focus-within:bg-white/[0.09]">
                <Search className="h-5 w-5 shrink-0 text-white/45" />
                <span className="sr-only">Search destinations</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSelection()
                  }}
                  placeholder="Search city or country"
                  className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/35"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 lg:px-12 lg:py-7">
              {recentDestinations.length > 0 && !query && (
                <div className="mb-6">
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    <Clock3 className="h-3 w-3" />
                    Your recent places
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentDestinations.slice(0, 4).map((destination) => (
                      <button
                        key={destination}
                        type="button"
                        onClick={() => setSelectedLabel(destination)}
                        className={`rounded-full border px-3 py-2 text-xs transition ${
                          selected?.label === destination
                            ? "border-[#ff7849] bg-[#ff7849] text-white"
                            : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        {destination}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {query ? `${options.length} places found` : "Browse destinations"}
              </p>
              <div>
                {options.slice(0, 80).map((option) => {
                  const active = selected?.label === option.label
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setSelectedLabel(option.label)}
                      className="group flex w-full items-center gap-4 border-b border-white/[0.07] py-4 text-left"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
                          active
                            ? "border-[#ff7849] bg-[#ff7849] text-white"
                            : "border-white/15 text-white/30 group-hover:border-white/35 group-hover:text-white"
                        }`}
                      >
                        {active ? <ArrowRight className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-serif text-2xl leading-tight transition sm:text-3xl ${
                            active ? "text-white" : "text-white/62 group-hover:text-white"
                          }`}
                        >
                          {option.city}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-xs text-white/35">
                          {option.region || "City destination"}
                          {option.recommended && (
                            <span className="inline-flex items-center gap-1 text-[#ff8a61]">
                              <Sparkles className="h-3 w-3" /> Vibe match
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {options.length === 0 && (
                  <div className="py-16 text-center">
                    <MapPin className="mx-auto h-7 w-7 text-white/25" />
                    <p className="mt-3 text-sm text-white/55">No destinations match that search.</p>
                    <p className="mt-1 text-xs text-white/30">Try a city, country, or region.</p>
                  </div>
                )}
              </div>
            </div>

            <button
              id="dashboard-destination-submit"
              type="button"
              onClick={submitSelection}
              disabled={!selected}
              className="flex min-h-16 items-center justify-between border-t border-white/10 px-6 text-sm font-semibold text-white disabled:opacity-40 lg:hidden"
            >
              <span>Explore {selected?.city ?? "destination"}</span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ef5a27]">
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </section>

          {selected ? (
            <DestinationPreview option={selected} />
          ) : (
            <div className="hidden bg-[#201e1b] lg:block" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
