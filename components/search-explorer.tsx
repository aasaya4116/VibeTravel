"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Search, SlidersHorizontal, X, Sparkles, AlertCircle, ShieldCheck } from "lucide-react"
import { AttractionCard } from "@/components/attraction-card"
import { AddToTripDialog } from "@/components/add-to-trip-dialog"
import { TripPlanningTray } from "@/components/trip-planning-tray"
import { SearchFilters } from "@/components/search-filters"
import { DestinationAutocomplete } from "@/components/destination-autocomplete"
import type { Attraction, FamilyVibe, SavedAttraction, TripOption } from "@/lib/types"
import { VlogStrip } from "@/components/vlog-strip"

interface SearchExplorerProps {
  familyVibe: FamilyVibe | null
  initialSavedAttractions: SavedAttraction[]
  availableTrips: TripOption[]
  isLoggedIn: boolean
  tripId?: string | null
  initialDestination?: string | null
}

interface Filters {
  ageRange: string
  strollerFriendly: boolean
  budget: string
  category: string
}

const defaultFilters: Filters = {
  ageRange: "",
  strollerFriendly: false,
  budget: "",
  category: "",
}

function hasFiltersActive(f: Filters) {
  return !!(f.ageRange || f.strollerFriendly || f.budget || f.category)
}

export function SearchExplorer({
  familyVibe,
  initialSavedAttractions,
  availableTrips,
  isLoggedIn,
  tripId = null,
  initialDestination = null,
}: SearchExplorerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get("q") || "")
  const [destination, setDestination] = useState(initialDestination || searchParams.get("dest") || "")
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [summary, setSummary] = useState("")
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    ageRange: searchParams.get("age") || "",
    strollerFriendly: searchParams.get("stroller") === "true",
    budget: searchParams.get("budget") || "",
    category: searchParams.get("cat") || "",
  })
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(tripId)
  const [savedAttractions, setSavedAttractions] = useState<SavedAttraction[]>(
    initialSavedAttractions
  )
  const [pendingAttraction, setPendingAttraction] = useState<Attraction | null>(null)
  const [savingPlace, setSavingPlace] = useState(false)

  const selectedTrip =
    availableTrips.find((trip) => trip.id === selectedTripId) ?? null
  const selectedTripTitle = selectedTrip?.title ?? null
  const selectedTripSaves = selectedTripId
    ? savedAttractions.filter((saved) => saved.trip_id === selectedTripId)
    : []
  const savedByName = new Map(
    selectedTripSaves.map((saved) => [saved.attraction_name, saved])
  )
  // Tracks what was committed to the last search run
  const [activeSearch, setActiveSearch] = useState<{
    query: string
    destination: string
    filters: Filters
  } | null>(null)

  // Sync filters to URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams()
      if (selectedTripId) params.set("trip", selectedTripId)
      if (query) params.set("q", query)
      if (destination) params.set("dest", destination)
      if (filters.ageRange) params.set("age", filters.ageRange)
      if (filters.strollerFriendly) params.set("stroller", "true")
      if (filters.budget) params.set("budget", filters.budget)
      if (filters.category) params.set("cat", filters.category)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : "/search", { scroll: false })
    }, 500)
    return () => clearTimeout(timeout)
  }, [selectedTripId, query, destination, filters, router])

  // Accepts optional overrides so pill removals can clear a field and immediately re-run
  const handleSearch = useCallback(
    async (
      e?: React.FormEvent,
      overrideQuery?: string,
      overrideDestination?: string,
      overrideFilters?: Filters
    ) => {
      e?.preventDefault()
      const searchQuery = overrideQuery !== undefined ? overrideQuery : query
      const searchDest = overrideDestination !== undefined ? overrideDestination : destination
      const searchFilters = overrideFilters !== undefined ? overrideFilters : filters

      if (!searchDest.trim()) {
        setSearchError(
          "Choose a city or region so every result can be verified in the right place."
        )
        setHasSearched(true)
        return
      }

      setLoading(true)
      setAttractions([])
      setSummary("")
      setSearchError(null)
      setHasSearched(true)

      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery || "family-friendly attractions",
            destination: searchDest,
            filters:
              JSON.stringify(searchFilters) !== JSON.stringify(defaultFilters)
                ? searchFilters
                : null,
            familyVibe,
          }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || "Search failed")
        }
        if (!response.body) throw new Error("Search failed")

        setActiveSearch({ query: searchQuery, destination: searchDest, filters: searchFilters })

        // Results stream as newline-delimited JSON — one enriched attraction per
        // line. Append each as it arrives so cards render incrementally.
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let count = 0
        let gotSummary = false

        const pushLine = (line: string) => {
          const trimmed = line.trim()
          if (!trimmed) return
          try {
            const obj = JSON.parse(trimmed)
            // A summary line has no attraction name; everything else is a result.
            if (obj && typeof obj.summary === "string") {
              setSummary(obj.summary)
              gotSummary = true
              return
            }
            const attraction = obj as Attraction
            if (attraction?.name) {
              count++
              setAttractions((prev) => [...prev, attraction])
            }
          } catch {
            // ignore a malformed or partial line
          }
        }

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) pushLine(line)
        }
        pushLine(buffer)

        // Fall back to a derived summary only if the server one didn't arrive.
        if (!gotSummary) {
          setSummary(
            count > 0
              ? `${count} Google-verified place${count !== 1 ? "s" : ""} in ${searchDest}.`
              : ""
          )
        }
      } catch (err) {
        console.error("Search error:", err)
        setSearchError(
          err instanceof Error
            ? err.message
            : "Something went wrong with your search. Please try again."
        )
      } finally {
        setLoading(false)
      }
    },
    [query, destination, filters, familyVibe]
  )

  const autoSearched = useRef(false)
  useEffect(() => {
    if (autoSearched.current) return
    if (destination) {
      autoSearched.current = true
      handleSearch(undefined, query || "family-friendly attractions", destination)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTripChange(nextTripId: string | null) {
    setSelectedTripId(nextTripId)
    if (!nextTripId) return

    const nextTrip = availableTrips.find((trip) => trip.id === nextTripId)
    if (nextTrip && !destination.trim()) {
      setDestination(nextTrip.destination)
    }
  }

  async function savePlaceToTrip(targetTripId: string, plannedDate: string | null) {
    if (!pendingAttraction || savingPlace) return
    setSavingPlace(true)

    try {
      const existing = savedAttractions.find(
        (saved) =>
          saved.trip_id === targetTripId &&
          saved.attraction_name === pendingAttraction.name
      )
      const res = await fetch("/api/attractions/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attraction_name: pendingAttraction.name,
          attraction_data: { ...pendingAttraction, plannedDate },
          trip_id: targetTripId,
        }),
      })

      if (res.status === 401) {
        toast.error("Sign in to add places to a trip", {
          action: {
            label: "Sign in",
            onClick: () => window.location.assign("/auth/login?next=/search"),
          },
        })
        return
      }

      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.data) {
        throw new Error(payload.error || "Could not add this place")
      }

      setSavedAttractions((previous) => [
        ...previous.filter(
          (saved) =>
            !(
              saved.trip_id === targetTripId &&
              saved.attraction_name === pendingAttraction.name
            )
        ),
        payload.data as SavedAttraction,
      ])
      setSelectedTripId(targetTripId)
      setPendingAttraction(null)

      const previousCount = savedAttractions.filter(
        (saved) => saved.trip_id === targetTripId
      ).length
      const newCount = previousCount + (existing ? 0 : 1)
      const targetTrip = availableTrips.find((trip) => trip.id === targetTripId)

      if (existing) {
        toast.success(plannedDate ? "Trip day updated" : "Place updated in your trip")
      } else if (newCount < 3) {
        toast.success(
          `Added to "${targetTrip?.title || "your trip"}" · ${3 - newCount} more to unlock the itinerary`
        )
      } else if (newCount === 3) {
        toast.success("Three places saved — your itinerary is ready to build!")
      } else {
        toast.success(`Added to "${targetTrip?.title || "your trip"}"`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add this place")
    } finally {
      setSavingPlace(false)
    }
  }

  async function removePlaceFromTrip(targetTripId: string) {
    if (!pendingAttraction || savingPlace) return
    setSavingPlace(true)

    try {
      const res = await fetch("/api/attractions/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attraction_name: pendingAttraction.name,
          trip_id: targetTripId,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Could not remove this place")

      setSavedAttractions((previous) =>
        previous.filter(
          (saved) =>
            !(
              saved.trip_id === targetTripId &&
              saved.attraction_name === pendingAttraction.name
            )
        )
      )
      setPendingAttraction(null)
      toast.success("Removed from trip")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this place")
    } finally {
      setSavingPlace(false)
    }
  }

  const suggestedSearches = destination
    ? [
        `Kid-friendly museums in ${destination}`,
        `Parks and playgrounds in ${destination}`,
        `Rainy day activities in ${destination}`,
        `Best restaurants for families in ${destination}`,
        `Free things to do in ${destination}`,
      ]
    : [
        "Kid-friendly museums",
        "Parks and playgrounds",
        "Rainy day activities",
        "Outdoor nature trails for toddlers",
        "Interactive science museums",
      ]

  const sampleDestinations: Attraction[] = [
    {
      name: "The Exploratorium",
      description:
        "A hands-on science museum where kids can touch, build, and experiment with over 600 interactive exhibits. The outdoor gallery is perfect for toddlers with water play stations and sensory-friendly zones.",
      category: "Museum",
      vibes: ["hands-on", "STEM", "sensory-friendly"],
      ageRange: "2-12",
      strollerFriendly: true,
      sensoryNotes: "Quiet hours on Tuesday mornings; some loud exhibits in the main hall",
      estimatedDuration: "2-3 hours",
      priceRange: "$$",
      location: "San Francisco, CA",
      imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=400&fit=crop",
      rating: 4.8,
      tips: [
        "Visit during weekday mornings for smaller crowds",
        "The Tinkering Studio is best for ages 5+",
        "Free lockers available for strollers near entrance",
      ],
    },
    {
      name: "Jardin d'Acclimatation",
      description:
        "A whimsical amusement park and garden in the Bois de Boulogne with gentle rides, puppet shows, a small zoo, and beautiful walking paths. A Parisian classic that delights toddlers and older children alike.",
      category: "Playground",
      vibes: ["charming", "classic", "outdoor"],
      ageRange: "1-10",
      strollerFriendly: true,
      sensoryNotes: "Mostly outdoors; some rides can be noisy but gardens are very calm",
      estimatedDuration: "3-4 hours",
      priceRange: "$$",
      location: "Paris, France",
      imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop",
      rating: 4.6,
      tips: [
        "Entry fee is separate from ride tickets -- budget accordingly",
        "The puppet theatre (Guignol) is a must-see for ages 3+",
        "Pack a picnic -- the lawns are perfect for it",
      ],
    },
    {
      name: "Hakone Open-Air Museum",
      description:
        "A stunning sculpture park set against mountain views, with a massive crochet play sculpture kids can climb through, a foot bath, and Picasso gallery. Art and nature blend beautifully for all ages.",
      category: "Museum",
      vibes: ["artistic", "nature", "adventurous"],
      ageRange: "2-12",
      strollerFriendly: true,
      sensoryNotes: "Open-air setting with natural sounds; indoor galleries are quiet",
      estimatedDuration: "2-3 hours",
      priceRange: "$$",
      location: "Hakone, Japan",
      imageUrl: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=600&h=400&fit=crop",
      rating: 4.8,
      tips: [
        "The crochet net playground is the highlight for kids under 10",
        "Combine with a nearby onsen for a full family day",
        "Easily accessible by Romancecar train from Shinjuku",
      ],
    },
    {
      name: "Maggie Daley Park Playground",
      description:
        "A sprawling, beautifully designed playground with a climbing wall, enchanted forest, wave lawn, and a separate play area for toddlers. Free and open year-round in the heart of Chicago.",
      category: "Playground",
      vibes: ["adventurous", "free", "outdoor"],
      ageRange: "0-12",
      strollerFriendly: true,
      sensoryNotes: "Open outdoor space with varying noise levels; quieter areas near the garden",
      estimatedDuration: "2-3 hours",
      priceRange: "Free",
      location: "Chicago, IL",
      imageUrl: "https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=600&h=400&fit=crop",
      rating: 4.9,
      tips: [
        "The toddler section is enclosed and separate from big-kid areas",
        "Ice skating ribbon available in winter",
        "Parking at Millennium Garages is closest",
      ],
    },
    {
      name: "Città della Scienza",
      description:
        "Naples' interactive science center with a dedicated 0-6 years play zone, planetarium, and hands-on exhibits about the human body, sea life, and physics. A hidden gem for curious families visiting southern Italy.",
      category: "Museum",
      vibes: ["hands-on", "STEM", "toddler-friendly"],
      ageRange: "0-12",
      strollerFriendly: true,
      sensoryNotes: "The 0-6 area is calm and enclosed; main halls are lively",
      estimatedDuration: "2-3 hours",
      priceRange: "$",
      location: "Naples, Italy",
      imageUrl: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=600&h=400&fit=crop",
      rating: 4.5,
      tips: [
        "The 'Corporea' human body exhibit is a favorite for ages 5+",
        "Planetarium shows are in Italian but visually stunning for all ages",
        "Combine with a waterfront walk along the Bagnoli promenade",
      ],
    },
    {
      name: "Butterfly Conservatory at AMNH",
      description:
        "Walk through a tropical vivarium with 500+ live butterflies from around the world. A calm, awe-inspiring experience that captivates toddlers and older kids alike.",
      category: "Nature",
      vibes: ["calm", "educational", "magical"],
      ageRange: "1-12",
      strollerFriendly: false,
      sensoryNotes: "Warm and humid inside; quiet and peaceful atmosphere",
      estimatedDuration: "45 min - 1 hour",
      priceRange: "$$",
      location: "New York, NY",
      imageUrl: "https://images.unsplash.com/photo-1485738422979-f5c462d49f04?w=600&h=400&fit=crop",
      rating: 4.7,
      tips: [
        "Wear bright colors -- butterflies may land on you",
        "Seasonal exhibit, usually October through May",
        "Combine with the dinosaur halls for a full day trip",
      ],
    },
    {
      name: "KidZania London",
      description:
        "A mini city where children role-play real jobs -- firefighter, doctor, pilot, chef -- earning and spending play currency. Incredibly immersive and educational, with 60+ activities across indoor streets.",
      category: "Creative Play",
      vibes: ["immersive", "educational", "imaginative"],
      ageRange: "4-14",
      strollerFriendly: true,
      sensoryNotes: "Indoor, climate-controlled; can be busy and noisy during peak times",
      estimatedDuration: "4-5 hours",
      priceRange: "$$",
      location: "London, UK",
      imageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&h=400&fit=crop",
      rating: 4.4,
      tips: [
        "Book the first session of the day for shorter queues",
        "Kids under 8 need an accompanying adult for most activities",
        "Located in Westfield Shepherd's Bush -- easy tube access",
      ],
    },
    {
      name: "Sentosa Island Nature Discovery",
      description:
        "A tropical island playground with a butterfly park, nature trails through coastal forest, the S.E.A. Aquarium, and free beach play areas. Perfect for combining nature, adventure, and relaxation.",
      category: "Nature",
      vibes: ["tropical", "adventurous", "family-friendly"],
      ageRange: "0-12",
      strollerFriendly: true,
      sensoryNotes: "Outdoor heat can be intense; aquarium and indoor spaces offer cool respite",
      estimatedDuration: "Full day",
      priceRange: "$-$$$",
      location: "Singapore",
      imageUrl: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&h=400&fit=crop",
      rating: 4.7,
      tips: [
        "Take the free Sentosa Express monorail from VivoCity",
        "Palawan Beach has a rope bridge to the southernmost point of continental Asia",
        "The splash zones at Port of Lost Wonder are free and great for toddlers",
      ],
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-36 lg:px-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-foreground lg:text-4xl">
          Explore Attractions
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search by vibe, style, or what your family loves.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (searchError) setSearchError(null)
              }}
              placeholder="Try: 'kid-friendly modern art' or 'nature + toddler'"
              aria-label="What kind of family activity are you looking for?"
              className="w-full rounded-xl border border-input bg-background py-3 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <DestinationAutocomplete
            value={destination}
            onChange={(val) => {
              setDestination(val)
              if (searchError) setSearchError(null)
            }}
            className="sm:w-56"
            required
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Search filters"
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                showFilters || hasFiltersActive(filters)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {hasFiltersActive(filters) && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {[filters.ageRange, filters.strollerFriendly, filters.budget, filters.category].filter(Boolean).length}
                </span>
              )}
            </button>
            <button
              type="submit"
              disabled={loading || !destination.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Filters Panel */}
      {showFilters && (
        <SearchFilters
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Active search pills */}
      {activeSearch && !loading && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Searching:</span>
          {activeSearch.query && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {activeSearch.query}
              <button
                onClick={() => {
                  setQuery("")
                  handleSearch(undefined, "", activeSearch.destination, activeSearch.filters)
                }}
                aria-label="Remove query filter"
              >
                <X className="h-3 w-3 opacity-70 hover:opacity-100" />
              </button>
            </span>
          )}
          {activeSearch.destination && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              {activeSearch.destination}
              <button
                onClick={() => {
                  setDestination("")
                  handleSearch(undefined, activeSearch.query, "", activeSearch.filters)
                }}
                aria-label="Remove destination filter"
              >
                <X className="h-3 w-3 opacity-70 hover:opacity-100" />
              </button>
            </span>
          )}
          {activeSearch.filters.ageRange && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              Ages {activeSearch.filters.ageRange}
              <button
                onClick={() => {
                  const f = { ...filters, ageRange: "" }
                  setFilters(f)
                  handleSearch(undefined, activeSearch.query, activeSearch.destination, f)
                }}
                aria-label="Remove age filter"
              >
                <X className="h-3 w-3 opacity-70 hover:opacity-100" />
              </button>
            </span>
          )}
          {activeSearch.filters.strollerFriendly && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              Step-free entrance
              <button
                onClick={() => {
                  const f = { ...filters, strollerFriendly: false }
                  setFilters(f)
                  handleSearch(undefined, activeSearch.query, activeSearch.destination, f)
                }}
                aria-label="Remove stroller filter"
              >
                <X className="h-3 w-3 opacity-70 hover:opacity-100" />
              </button>
            </span>
          )}
          {activeSearch.filters.budget && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              Budget: {activeSearch.filters.budget}
              <button
                onClick={() => {
                  const f = { ...filters, budget: "" }
                  setFilters(f)
                  handleSearch(undefined, activeSearch.query, activeSearch.destination, f)
                }}
                aria-label="Remove budget filter"
              >
                <X className="h-3 w-3 opacity-70 hover:opacity-100" />
              </button>
            </span>
          )}
          {activeSearch.filters.category && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              {activeSearch.filters.category}
              <button
                onClick={() => {
                  const f = { ...filters, category: "" }
                  setFilters(f)
                  handleSearch(undefined, activeSearch.query, activeSearch.destination, f)
                }}
                aria-label="Remove category filter"
              >
                <X className="h-3 w-3 opacity-70 hover:opacity-100" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{searchError}</p>
          <button
            onClick={() => handleSearch()}
            className="ml-auto shrink-0 text-sm font-medium text-destructive underline-offset-4 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Result Count */}
      {hasSearched && !loading && !searchError && attractions.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {attractions.length} result{attractions.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* No Results — improved */}
      {hasSearched && !loading && !searchError && attractions.length === 0 && (
        <div className="mb-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="font-medium text-foreground">
            No verified matches
            {activeSearch?.query ? ` for "${activeSearch.query}"` : ""}
            {activeSearch?.destination ? ` in ${activeSearch.destination}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a broader term, a different destination, or relax your filters.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                setQuery("family-friendly activities")
                handleSearch(undefined, "family-friendly activities", activeSearch?.destination ?? destination, defaultFilters)
              }}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              Try "family-friendly activities"
            </button>
            <button
              onClick={() => {
                setQuery("things to do with kids")
                handleSearch(undefined, "things to do with kids", activeSearch?.destination ?? destination, defaultFilters)
              }}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              Try "things to do with kids"
            </button>
            {hasFiltersActive(activeSearch?.filters ?? filters) && (
              <button
                onClick={() => {
                  setFilters(defaultFilters)
                  handleSearch(undefined, activeSearch?.query ?? query, activeSearch?.destination ?? destination, defaultFilters)
                }}
                className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                Clear filters and retry
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Or ask Scout — tap <strong>Ask Scout</strong> in the bottom right for personalised suggestions.
          </p>
        </div>
      )}

      {/* Suggested Searches — always visible, destination-aware */}
      {!loading && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Try:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedSearches.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion)
                  if (destination.trim()) {
                    handleSearch(undefined, suggestion)
                  } else {
                    setSearchError("Great choice — now choose a city or region to search.")
                    setHasSearched(false)
                  }
                }}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sample Destinations */}
      {attractions.length === 0 && !loading && !hasSearched && (
        <>

          <div className="mb-8">
            <h2 className="mb-1 font-serif text-2xl text-foreground">
              Trip Inspiration
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Examples to spark ideas—not live listings. Choose a destination above for current Google-verified details.
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {sampleDestinations.map((attraction, i) => (
                <AttractionCard
                  key={`sample-${attraction.name}-${i}`}
                  attraction={attraction}
                  isSaved={false}
                  onPlan={() => {}}
                  isInspiration
                  showSave={false}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Summary */}
      {summary && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Verified place results</p>
              <p className="mt-0.5 text-sm leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">{summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results + Vlog Sidebar */}
      <div className="flex gap-6 items-start">
        {/* Results Grid */}
        <div className="min-w-0 flex-1">
          {(attractions.length > 0 || loading) && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {attractions.map((attraction, i) => {
                const saved = savedByName.get(attraction.name)
                return (
                  <AttractionCard
                    key={`${attraction.name}-${i}`}
                    attraction={attraction}
                    isSaved={!!saved}
                    onPlan={() => setPendingAttraction(attraction)}
                    tripTitle={selectedTripTitle}
                    plannedDate={saved?.attraction_data?.plannedDate}
                  />
                )
              })}
              {loading && attractions.length === 0 && (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-2xl border border-border bg-card p-6"
                    >
                      <div className="mb-3 h-5 w-3/4 rounded-lg bg-muted" />
                      <div className="mb-2 h-4 w-full rounded-lg bg-muted" />
                      <div className="mb-4 h-4 w-2/3 rounded-lg bg-muted" />
                      <div className="flex gap-2">
                        <div className="h-6 w-16 rounded-full bg-muted" />
                        <div className="h-6 w-20 rounded-full bg-muted" />
                        <div className="h-6 w-14 rounded-full bg-muted" />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Vlog Sidebar — only when destination is set and results exist */}
        {destination && (attractions.length > 0 || loading) && (
          <VlogStrip destination={destination} />
        )}
      </div>

      <TripPlanningTray
        trips={availableTrips}
        selectedTrip={selectedTrip}
        savedAttractions={savedAttractions}
        isLoggedIn={isLoggedIn}
        onTripChange={handleTripChange}
      />

      <AddToTripDialog
        attraction={pendingAttraction}
        trips={availableTrips}
        savedAttractions={savedAttractions}
        defaultTripId={selectedTripId}
        isLoggedIn={isLoggedIn}
        saving={savingPlace}
        onClose={() => setPendingAttraction(null)}
        onSave={savePlaceToTrip}
        onRemove={removePlaceFromTrip}
      />
    </div>
  )
}
