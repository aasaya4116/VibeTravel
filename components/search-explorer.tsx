"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Search, SlidersHorizontal, X, Sparkles, AlertCircle, MapPin, Heart } from "lucide-react"
import { AttractionCard } from "@/components/attraction-card"
import { SearchFilters } from "@/components/search-filters"
import { DestinationAutocomplete } from "@/components/destination-autocomplete"
import type { Attraction, FamilyVibe } from "@/lib/types"
import { VlogStrip } from "@/components/vlog-strip"
import { useOnboardingHints } from "@/hooks/use-onboarding-hints"

interface SearchExplorerProps {
  familyVibe: FamilyVibe | null
  savedAttractionNames: string[]
  tripId?: string | null
  tripTitle?: string | null
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
  savedAttractionNames,
  tripId = null,
  tripTitle = null,
  initialDestination = null,
}: SearchExplorerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isDismissed, dismiss } = useOnboardingHints()

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
  const [savedNames, setSavedNames] = useState<Set<string>>(
    new Set(savedAttractionNames)
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
      if (tripId) params.set("trip", tripId)
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
  }, [tripId, query, destination, filters, router])

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

      if (!searchQuery.trim() && !searchDest.trim()) {
        setSearchError(
          "Enter a search (e.g. kid-friendly museums) or a city/region to explore."
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
            destination: searchDest || "the area",
            filters:
              JSON.stringify(searchFilters) !== JSON.stringify(defaultFilters)
                ? searchFilters
                : null,
            familyVibe,
          }),
        })

        if (!response.ok || !response.body) throw new Error("Search failed")

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

        // Fall back to a derived summary only if the AI one didn't arrive.
        if (!gotSummary) {
          setSummary(
            count > 0
              ? `Found ${count} spot${count !== 1 ? "s" : ""}${searchDest ? ` in ${searchDest}` : ""} matching "${searchQuery || "your family"}".`
              : ""
          )
        }
      } catch (err) {
        console.error("Search error:", err)
        setSearchError("Something went wrong with your search. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [query, destination, filters, familyVibe]
  )

  const autoSearched = useRef(false)
  useEffect(() => {
    if (autoSearched.current) return
    if (initialDestination) {
      autoSearched.current = true
      handleSearch(undefined, "family-friendly attractions")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSave = useCallback(async (attraction: Attraction) => {
    const isSaved = savedNames.has(attraction.name)

    if (isSaved) {
      setSavedNames((prev) => {
        const next = new Set(prev)
        next.delete(attraction.name)
        return next
      })
      try {
        const res = await fetch("/api/attractions/save", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attraction_name: attraction.name,
            ...(tripId && { trip_id: tripId }),
          }),
        })
        if (!res.ok) throw new Error("Failed to unsave")
        toast.success("Removed from saved")
      } catch {
        setSavedNames((prev) => new Set(prev).add(attraction.name))
      }
    } else {
      setSavedNames((prev) => new Set(prev).add(attraction.name))
      try {
        const res = await fetch("/api/attractions/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attraction_name: attraction.name,
            attraction_data: attraction,
            ...(tripId && { trip_id: tripId }),
          }),
        })
        if (res.status === 401) {
          setSavedNames((prev) => {
            const next = new Set(prev)
            next.delete(attraction.name)
            return next
          })
          toast.error("Sign in to save places", {
            action: { label: "Sign in", onClick: () => window.location.assign("/auth/login?next=" + window.location.pathname) },
          })
          return
        }
        if (!res.ok) throw new Error("Failed to save")
        if (tripId) {
          const newCount = savedNames.size + 1
          if (newCount < 3) {
            toast.success(`${newCount} of 3 saved — ${3 - newCount} more to generate your itinerary`)
          } else if (newCount === 3) {
            toast.success(`3 places saved — you're ready to generate your itinerary!`)
          } else {
            toast.success(`Added to "${tripTitle}"`)
          }
        } else {
          toast.success("Saved to wishlist")
        }
      } catch {
        setSavedNames((prev) => {
          const next = new Set(prev)
          next.delete(attraction.name)
          return next
        })
      }
    }
  }, [savedNames, tripId, tripTitle])

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
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
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
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
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
              disabled={loading}
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
              Stroller-friendly
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

      {/* Trip context banner */}
      {tripId && tripTitle ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3">
          <MapPin className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-foreground">
            Saving to: <strong>{tripTitle}</strong>
          </p>
          <a href="/trips" className="ml-auto shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline">
            Change trip
          </a>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-3">
          <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No trip selected — saves go to your wishlist.
          </p>
          <a href="/trips" className="ml-auto shrink-0 text-xs font-medium text-foreground underline-offset-4 hover:underline">
            Select a trip
          </a>
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
            No matches
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
                  handleSearch(undefined, suggestion)
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
              Popular for Families
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Kid-tested, parent-approved destinations to get you started.
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {sampleDestinations.map((attraction, i) => (
                <AttractionCard
                  key={`sample-${attraction.name}-${i}`}
                  attraction={attraction}
                  isSaved={savedNames.has(attraction.name)}
                  onToggleSave={() => toggleSave(attraction)}
                  tripTitle={tripTitle}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Summary */}
      {summary && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground">{summary}</p>
          </div>
        </div>
      )}

      {/* Save hint — shown once when landing on search page with a trip context */}
      {tripId && attractions.length > 0 && !isDismissed("save-hint") && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in duration-500">
          <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="flex-1 text-sm text-foreground">
            Tap the <span className="font-medium">heart</span> on any place to save it to your trip. Save 3 or more to unlock your AI itinerary.
          </p>
          <button
            onClick={() => dismiss("save-hint")}
            aria-label="Dismiss tip"
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Results + Vlog Sidebar */}
      <div className="flex gap-6 items-start">
        {/* Results Grid */}
        <div className="min-w-0 flex-1">
          {(attractions.length > 0 || loading) && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {attractions.map((attraction, i) => (
                <AttractionCard
                  key={`${attraction.name}-${i}`}
                  attraction={attraction}
                  isSaved={savedNames.has(attraction.name)}
                  onToggleSave={() => toggleSave(attraction)}
                  tripTitle={tripTitle}
                />
              ))}
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
    </div>
  )
}
