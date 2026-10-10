import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { fetch } from "expo/fetch"
import { Button, Eyebrow, LoadingScreen, Screen } from "@/components/ui"
import { Text, TextInput } from "@/components/typography"
import { RemoteImage } from "@/components/remote-image"
import DiscoveryCanvas from "@/components/discovery-canvas"
import {
  destinationCards,
  destinationLenses,
  createDestinationCard,
  describeVibeMatch,
  findDestinationCard,
  getDefaultDestinationLens,
  getDestinationQueryForLens,
  rankDestinationsForVibe,
  resolveDestinationCard,
  type DestinationCard,
  type DestinationLens,
} from "@/lib/destinations"
import {
  generateTripItinerary,
  loadTrip,
  readTripDestinationOption,
  saveAttractionToTrip,
  updateTripDestination,
} from "@/lib/data"
import {
  isVerifiedDestinationOption,
  needsTripDestinationConfirmation,
  searchDestinationOptions,
  type DestinationOption,
} from "@/lib/destination-options"
import { absoluteMediaUrl, apiUrl } from "@/lib/media"
import { consumeNdjson } from "@/lib/ndjson-stream"
import { startOperationTiming } from "@/lib/observability"
import { colors, radii, typography } from "@/lib/theme"
import type { Attraction, Trip } from "@/lib/types"
import { useDashboard } from "@/hooks/use-dashboard"
import { useAuth } from "@/providers/auth-provider"

const fallbackPlaceImage = "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&h=800&fit=crop"
const resultBatchSize = 4
const itineraryUnlockCount = 3
const buildPromptStorageKey = (tripId: string) => `vibetravel:explore-build-prompt:${tripId}`

function wasBuildPromptShown(tripId: string) {
  try {
    return globalThis.localStorage?.getItem(buildPromptStorageKey(tripId)) === "1"
  } catch {
    return false
  }
}

function rememberBuildPrompt(tripId: string) {
  try {
    globalThis.localStorage?.setItem(buildPromptStorageKey(tripId), "1")
  } catch {
    // The in-memory guard still prevents repeat prompts during this session.
  }
}

interface SearchPlacesOptions {
  destination?: DestinationCard
  destinationOption?: DestinationOption | null
  lens?: DestinationLens
  query?: string
  reveal?: boolean
}

function destinationCardFromOption(option: DestinationOption): DestinationCard {
  const destination = resolveDestinationCard(option.canonicalLabel || option.label)
    ?? createDestinationCard(option.canonicalLabel || option.label)
  return {
    ...destination,
    name: option.city || destination.name,
    country: option.country || option.region || destination.country,
    destination: option.canonicalLabel || option.label,
    imageUrl: option.imageUrl || destination.imageUrl,
    latitude: option.latitude ?? destination.latitude,
    longitude: option.longitude ?? destination.longitude,
  }
}

function normalizedPlaceText(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") ?? ""
}

function appendUniqueAttraction(
  attraction: Attraction,
  found: Attraction[],
  googlePlaceIds: Set<string>,
  nameLocations: Set<string>
) {
  const googlePlaceId = normalizedPlaceText(attraction.googlePlaceId)
  const nameLocation = `${normalizedPlaceText(attraction.name)}|${normalizedPlaceText(attraction.location)}`
  if ((googlePlaceId && googlePlaceIds.has(googlePlaceId)) || nameLocations.has(nameLocation)) return false
  if (googlePlaceId) googlePlaceIds.add(googlePlaceId)
  nameLocations.add(nameLocation)
  found.push(attraction)
  return true
}

function ResultCard({
  attraction,
  onSave,
  saved,
  saving,
}: {
  attraction: Attraction
  onSave: () => void
  saved: boolean
  saving: boolean
}) {
  const signals = attraction.familyFitSignals?.map((signal) => signal.label) ?? attraction.vibes ?? []
  const [imageUrl, setImageUrl] = useState(attraction.imageUrl || fallbackPlaceImage)
  return (
    <View style={styles.resultCard}>
      <RemoteImage uri={imageUrl} preset="landscape" onError={() => setImageUrl(fallbackPlaceImage)} style={styles.resultImage} />
      <View style={styles.resultContent}>
        <View style={styles.resultTopline}>
          <Text style={styles.resultCategory}>{attraction.category || "PLACE"}</Text>
          {attraction.rating ? <Text style={styles.rating}>★ {attraction.rating.toFixed(1)}</Text> : null}
        </View>
        <Text style={styles.resultTitle}>{attraction.name}</Text>
        <Text style={styles.resultLocation} numberOfLines={1}>{attraction.location}</Text>
        {attraction.familyFitReason ? (
          <View style={styles.whyBox}>
            <Text style={styles.whyLabel}>WHY THIS MATCHED</Text>
            <Text style={styles.whyText}>{attraction.familyFitReason}</Text>
          </View>
        ) : null}
        <View style={styles.signalRow}>
          {signals.slice(0, 3).map((signal) => <Text key={signal} style={styles.signal}>{signal}</Text>)}
        </View>
        <Button onPress={onSave} loading={saving} disabled={saved} variant={saved ? "secondary" : "primary"} style={[styles.saveButton, saved && styles.savedButton]}>
          {saved ? "Added to trip ✓" : "Add to trip"}
        </Button>
      </View>
    </View>
  )
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ tripId?: string; destination?: string }>()
  const { user, session } = useAuth()
  const { data, loading } = useDashboard()
  const initialDestination = resolveDestinationCard(params.destination) ?? destinationCards[0]
  const [selected, setSelected] = useState<DestinationCard>(initialDestination)
  const [lens, setLens] = useState<DestinationLens>(() => getDefaultDestinationLens(data?.familyVibe ?? null))
  const [query, setQuery] = useState("")
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [resultsLens, setResultsLens] = useState<DestinationLens | null>(null)
  const [resultsDestinationName, setResultsDestinationName] = useState("")
  const [summary, setSummary] = useState("")
  const [searchError, setSearchError] = useState("")
  const [searching, setSearching] = useState(false)
  const [pendingAttraction, setPendingAttraction] = useState<Attraction | null>(null)
  const [saving, setSaving] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [browseQuery, setBrowseQuery] = useState("")
  const [browseDestinationOptions, setBrowseDestinationOptions] = useState<DestinationOption[]>([])
  const [browseDestinationSearching, setBrowseDestinationSearching] = useState(false)
  const [browseDestinationError, setBrowseDestinationError] = useState("")
  const [lensTouched, setLensTouched] = useState(false)
  const [scopedTrip, setScopedTrip] = useState<Trip | null>(null)
  const [selectedDestinationOption, setSelectedDestinationOption] = useState<DestinationOption | null>(null)
  const [destinationNeedsConfirmation, setDestinationNeedsConfirmation] = useState(() => (
    Boolean(params.tripId) && needsTripDestinationConfirmation(params.destination)
  ))
  const [destinationRepairOpen, setDestinationRepairOpen] = useState(false)
  const [destinationRepairQuery, setDestinationRepairQuery] = useState(params.destination ?? "")
  const [destinationRepairOptions, setDestinationRepairOptions] = useState<DestinationOption[]>([])
  const [destinationRepairSearching, setDestinationRepairSearching] = useState(false)
  const [destinationRepairSaving, setDestinationRepairSaving] = useState(false)
  const [destinationRepairError, setDestinationRepairError] = useState("")
  const [savedAttractionNames, setSavedAttractionNames] = useState<Set<string>>(new Set())
  const [recentlySavedNames, setRecentlySavedNames] = useState<Set<string>>(new Set())
  const [savingName, setSavingName] = useState("")
  const [lastSavedName, setLastSavedName] = useState("")
  const [lastSavedTripTitle, setLastSavedTripTitle] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const [incomingResultCount, setIncomingResultCount] = useState(0)
  const [revealResults, setRevealResults] = useState(false)
  const [visibleResultCount, setVisibleResultCount] = useState(resultBatchSize)
  const [buildPromptOpen, setBuildPromptOpen] = useState(false)
  const [buildingItinerary, setBuildingItinerary] = useState(false)
  const [buildError, setBuildError] = useState("")
  const screenRef = useRef<ScrollView>(null)
  const autoSearchKey = useRef("")
  const searchRequestId = useRef(0)
  const searchAbortController = useRef<AbortController | null>(null)
  const tripSearchScopeKey = useRef("")
  const destinationRepairAbortController = useRef<AbortController | null>(null)
  const browseDestinationAbortController = useRef<AbortController | null>(null)
  const savedAttractionNamesRef = useRef<Set<string>>(new Set())
  const promptedTripId = useRef("")
  const buildInFlight = useRef(false)
  const resultsLayoutY = useRef<number | null>(null)
  const revealUsingExistingLayout = useRef(false)

  function invalidateSearchRequest() {
    searchRequestId.current += 1
    const activeController = searchAbortController.current
    searchAbortController.current = null
    activeController?.abort()
  }

  const visibleDestinations = useMemo(() => {
    return rankDestinationsForVibe(data?.familyVibe ?? null, lens)
  }, [data?.familyVibe, lens])

  const browsableDestinations = useMemo(() => {
    const normalized = browseQuery.trim().toLowerCase()
    if (!normalized) return destinationCards
    return destinationCards.filter((destination) => (
      `${destination.name} ${destination.country} ${destination.region}`.toLowerCase().includes(normalized)
    ))
  }, [browseQuery])

  const browsableDestinationFallbacks = useMemo(() => {
    const resolvedCities = new Set(
      browseDestinationOptions.map((option) => option.city.trim().toLowerCase())
    )
    return browsableDestinations.filter((destination) => (
      !resolvedCities.has(destination.name.trim().toLowerCase())
    ))
  }, [browsableDestinations, browseDestinationOptions])

  const customDestination = useMemo(() => {
    const value = browseQuery.trim()
    if (
      value.length < 2 ||
      findDestinationCard(value) ||
      browseDestinationSearching ||
      browseDestinationOptions.length > 0
    ) return null
    return createDestinationCard(value)
  }, [browseDestinationOptions.length, browseDestinationSearching, browseQuery])

  const searchSuggestions = useMemo(() => {
    if (lens === "Food + culture") return ["Local food", "Markets", "Art + culture"]
    if (lens === "Easy with kids") return ["Hands-on", "Parks", "Easy meals"]
    if (lens === "Nature reset") return ["Nature", "Beaches", "Gardens"]
    return selected.tags.slice(0, 3)
  }, [lens, selected.tags])

  const vibeDescription = describeVibeMatch(data?.familyVibe ?? null)
  const savedCount = savedAttractionNames.size
  const hasItinerary = Boolean(scopedTrip?.itinerary?.some((day) => day.items.length))
  const itineraryAttractionNames = useMemo(() => new Set(
    (scopedTrip?.itinerary ?? []).flatMap((day) => (
      day.items.map((item) => item.attraction_name.trim().toLowerCase())
    )),
  ), [scopedTrip?.itinerary])
  const pendingSavedCount = useMemo(() => (
    [...savedAttractionNames].filter((name) => !itineraryAttractionNames.has(name)).length
  ), [itineraryAttractionNames, savedAttractionNames])
  const canBuildItinerary = Boolean(scopedTrip && (
    hasItinerary ? pendingSavedCount > 0 : savedCount >= itineraryUnlockCount
  ))
  const buildCtaLabel = hasItinerary
    ? `Update itinerary · ${pendingSavedCount} new place${pendingSavedCount === 1 ? "" : "s"}`
    : `Build itinerary · ${savedCount} place${savedCount === 1 ? "" : "s"}`

  useEffect(() => {
    savedAttractionNamesRef.current = savedAttractionNames
  }, [savedAttractionNames])

  useEffect(() => () => {
    invalidateSearchRequest()
    destinationRepairAbortController.current?.abort()
    browseDestinationAbortController.current?.abort()
    // Refs are intentionally invalidated without setting state during unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const nextScopeKey = `${user?.id ?? "guest"}:${params.tripId ?? "browse"}`
    if (tripSearchScopeKey.current !== nextScopeKey) {
      tripSearchScopeKey.current = nextScopeKey
      invalidateSearchRequest()
      autoSearchKey.current = ""
      setSearching(false)
      setIncomingResultCount(0)
      setAttractions([])
      setResultsLens(null)
      setResultsDestinationName("")
      setSummary("")
      setSearchError("")
      setHasSearched(false)
      setVisibleResultCount(resultBatchSize)
      setRevealResults(false)
    }
    if (!user || !params.tripId) {
      setScopedTrip(null)
      setSelectedDestinationOption(null)
      setDestinationNeedsConfirmation(false)
      setSavedAttractionNames(new Set())
      savedAttractionNamesRef.current = new Set()
      return
    }
    const emptyNames = new Set<string>()
    setScopedTrip(null)
    setSelectedDestinationOption(null)
    setDestinationNeedsConfirmation(true)
    autoSearchKey.current = ""
    savedAttractionNamesRef.current = emptyNames
    setSavedAttractionNames(emptyNames)
    setBuildPromptOpen(false)
    setBuildError("")
    let active = true
    loadTrip(user.id, params.tripId)
      .then((result) => {
        if (!active) return
        const cachedDestination = readTripDestinationOption(user.id, result.trip.id)
        const cachedDestinationMatches = Boolean(
          cachedDestination
          && cachedDestination.label.toLocaleLowerCase() === result.trip.destination.trim().toLocaleLowerCase()
        )
        const activeDestinationOption = cachedDestinationMatches && isVerifiedDestinationOption(cachedDestination)
          ? cachedDestination
          : null
        const names = new Set(result.savedAttractions.map((saved) => saved.attraction_name.trim().toLowerCase()))
        setScopedTrip(result.trip)
        setSelectedDestinationOption(activeDestinationOption)
        setDestinationNeedsConfirmation(needsTripDestinationConfirmation(result.trip.destination, activeDestinationOption))
        setDestinationRepairQuery(result.trip.destination)
        if (activeDestinationOption && isVerifiedDestinationOption(activeDestinationOption)) {
          setSelected(destinationCardFromOption(activeDestinationOption))
        } else {
          setSelected(resolveDestinationCard(result.trip.destination) ?? createDestinationCard(result.trip.destination))
        }
        savedAttractionNamesRef.current = names
        setSavedAttractionNames(names)
        promptedTripId.current = wasBuildPromptShown(result.trip.id)
          ? result.trip.id
          : ""
      })
      .catch(() => {
        if (!active) return
        const fallbackTrip = data?.trips.find((trip) => trip.id === params.tripId) ?? null
        setSelectedDestinationOption(null)
        setScopedTrip(fallbackTrip)
        setDestinationNeedsConfirmation(needsTripDestinationConfirmation(fallbackTrip?.destination))
        if (fallbackTrip) {
          setDestinationRepairQuery(fallbackTrip.destination)
          setSelected(resolveDestinationCard(fallbackTrip.destination) ?? createDestinationCard(fallbackTrip.destination))
        }
      })
    return () => { active = false }
  }, [data?.trips, params.tripId, user])

  useEffect(() => {
    const destination = resolveDestinationCard(params.destination)
    if (!destination) return
    invalidateSearchRequest()
    setSearching(false)
    setIncomingResultCount(0)
    setSelected(destination)
    setQuery("")
    setAttractions([])
    setResultsLens(null)
    setResultsDestinationName("")
    setSummary("")
    setSearchError("")
    setHasSearched(false)
    setVisibleResultCount(resultBatchSize)
    setRevealResults(false)
  }, [params.destination])

  useEffect(() => {
    if (!data?.familyVibe || lensTouched || params.destination) return
    const defaultLens = getDefaultDestinationLens(data.familyVibe)
    const ranked = rankDestinationsForVibe(data.familyVibe, defaultLens)
    setLens(defaultLens)
    if (ranked[0]) {
      invalidateSearchRequest()
      setSearching(false)
      setIncomingResultCount(0)
      setSelected(ranked[0])
      setQuery("")
      setAttractions([])
      setResultsLens(null)
      setResultsDestinationName("")
      setSummary("")
      setSearchError("")
      setHasSearched(false)
      setVisibleResultCount(resultBatchSize)
      setRevealResults(false)
    }
  }, [data?.familyVibe, lensTouched, params.destination])

  useEffect(() => {
    if (!destinationRepairOpen) return
    const normalized = destinationRepairQuery.trim()
    destinationRepairAbortController.current?.abort()
    if (normalized.length < 2) {
      setDestinationRepairOptions([])
      setDestinationRepairSearching(false)
      return
    }

    const controller = new AbortController()
    destinationRepairAbortController.current = controller
    const timer = setTimeout(async () => {
      setDestinationRepairSearching(true)
      setDestinationRepairError("")
      try {
        const options = await searchDestinationOptions(normalized, session?.access_token, controller.signal)
        if (controller.signal.aborted) return
        setDestinationRepairOptions(options.filter(isVerifiedDestinationOption))
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return
        setDestinationRepairOptions([])
        setDestinationRepairError("Destination lookup is temporarily unavailable. Please try again.")
      } finally {
        if (!controller.signal.aborted) setDestinationRepairSearching(false)
      }
    }, 180)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [destinationRepairOpen, destinationRepairQuery, session?.access_token])

  useEffect(() => {
    if (!browseOpen) return
    const normalized = browseQuery.trim()
    browseDestinationAbortController.current?.abort()

    if (normalized.length < 2) {
      setBrowseDestinationOptions([])
      setBrowseDestinationSearching(false)
      setBrowseDestinationError("")
      return
    }

    const controller = new AbortController()
    browseDestinationAbortController.current = controller
    setBrowseDestinationOptions([])
    setBrowseDestinationSearching(true)
    setBrowseDestinationError("")
    const timer = setTimeout(async () => {
      try {
        const options = await searchDestinationOptions(normalized, session?.access_token, controller.signal)
        if (controller.signal.aborted) return
        setBrowseDestinationOptions(options)
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return
        setBrowseDestinationOptions([])
        setBrowseDestinationError("We couldn’t verify that destination right now. You can still search the exact name below.")
      } finally {
        if (!controller.signal.aborted) setBrowseDestinationSearching(false)
      }
    }, 180)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [browseOpen, browseQuery, session?.access_token])

  function openDestinationRepair() {
    Keyboard.dismiss()
    setDestinationRepairQuery(scopedTrip?.destination ?? selected.destination)
    setDestinationRepairOptions([])
    setDestinationRepairError("")
    setDestinationRepairOpen(true)
  }

  async function confirmTripDestination(option: DestinationOption) {
    if (!user || !scopedTrip || !isVerifiedDestinationOption(option)) return
    setDestinationRepairSaving(true)
    setDestinationRepairError("")
    try {
      const updatedTrip = await updateTripDestination(user.id, scopedTrip.id, option)
      const destination = destinationCardFromOption(option)
      invalidateSearchRequest()
      autoSearchKey.current = ""
      setSearching(false)
      setIncomingResultCount(0)
      setScopedTrip(updatedTrip)
      setSelectedDestinationOption(option)
      setSelected(destination)
      setDestinationNeedsConfirmation(false)
      setDestinationRepairOpen(false)
      setQuery("")
      setAttractions([])
      setResultsLens(null)
      setResultsDestinationName("")
      setSummary("")
      setSearchError("")
      setHasSearched(false)
      setVisibleResultCount(resultBatchSize)
      setRevealResults(false)
      autoSearchKey.current = `${updatedTrip.id}:${destination.destination}`
      void searchPlaces({
        destination,
        destinationOption: option,
        query: "",
        reveal: true,
      })
    } catch (error) {
      setDestinationRepairError(error instanceof Error ? error.message : "We couldn’t update this destination. Please try again.")
    } finally {
      setDestinationRepairSaving(false)
    }
  }

  function resetDestinationSearch(destination: DestinationCard) {
    Keyboard.dismiss()
    invalidateSearchRequest()
    setSearching(false)
    setIncomingResultCount(0)
    setSelected(destination)
    setSelectedDestinationOption(null)
    setQuery("")
    setAttractions([])
    setResultsLens(null)
    setResultsDestinationName("")
    setSummary("")
    setSearchError("")
    setHasSearched(false)
    setVisibleResultCount(resultBatchSize)
    setRevealResults(false)
    setBrowseOpen(false)
    setBrowseQuery("")
    setBrowseDestinationOptions([])
    setBrowseDestinationError("")
  }

  function chooseDestination(destination: DestinationCard, searchImmediately = false) {
    resetDestinationSearch(destination)
    setSelectedDestinationOption(null)
    if (searchImmediately) {
      void searchPlaces({ destination, destinationOption: null, query: "", reveal: true })
    }
  }

  function chooseDestinationOption(option: DestinationOption) {
    const destination = destinationCardFromOption(option)
    const verifiedOption = isVerifiedDestinationOption(option) ? option : null
    resetDestinationSearch(destination)
    setSelectedDestinationOption(verifiedOption)
    void searchPlaces({
      destination,
      destinationOption: verifiedOption,
      query: "",
      reveal: true,
    })
  }

  function chooseLens(nextLens: DestinationLens) {
    if (nextLens === lens) return
    Keyboard.dismiss()
    const nextDestination = params.tripId
      ? selected
      : rankDestinationsForVibe(data?.familyVibe ?? null, nextLens)[0] ?? selected
    setLens(nextLens)
    setLensTouched(true)
    setSelected(nextDestination)
    setQuery("")
    void searchPlaces({ destination: nextDestination, lens: nextLens, query: "", reveal: false })
  }

  async function searchPlaces(options: SearchPlacesOptions = {}) {
    if (
      params.tripId &&
      destinationNeedsConfirmation &&
      !isVerifiedDestinationOption(options.destinationOption)
    ) {
      openDestinationRepair()
      return
    }
    const destination = options.destination ?? selected
    const destinationOption = options.destinationOption !== undefined
      ? options.destinationOption
      : selectedDestinationOption
    const searchLens = options.lens ?? lens
    const searchQuery = options.query !== undefined ? options.query.trim() : query.trim()
    const requestId = searchRequestId.current + 1
    searchRequestId.current = requestId
    searchAbortController.current?.abort()
    const controller = new AbortController()
    searchAbortController.current = controller
    const isCurrentSearch = () => (
      requestId === searchRequestId.current
      && searchAbortController.current === controller
      && !controller.signal.aborted
    )
    Keyboard.dismiss()
    if (!isCurrentSearch()) return
    setSearching(true)
    setHasSearched(true)
    setSearchError("")
    setIncomingResultCount(0)
    const previousResults = attractions
    revealUsingExistingLayout.current = previousResults.length > 0
    const baseTimingAttributes = { had_results: previousResults.length > 0 }
    const timing = startOperationTiming("search.places", baseTimingAttributes)
    let httpStatus = 0
    const found: Attraction[] = []
    const googlePlaceIds = new Set<string>()
    const nameLocations = new Set<string>()
    let resultSummary = ""
    try {
      const response = await fetch(`${apiUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          destination: destination.destination,
          destinationPlaceId: destinationOption?.placeId || undefined,
          destinationLatitude: destinationOption?.latitude ?? destination.latitude,
          destinationLongitude: destinationOption?.longitude ?? destination.longitude,
          query: searchQuery || getDestinationQueryForLens(destination, searchLens),
          ownerName: data?.profile?.display_name,
          familyVibe: data?.familyVibe,
          filters: {},
        }),
      })
      httpStatus = response.status
      if (!isCurrentSearch()) {
        timing.finish({ ...baseTimingAttributes, aborted: true, http_status: httpStatus })
        return
      }
      if (!response.ok) {
        const text = await response.text()
        if (!isCurrentSearch()) {
          timing.finish({ ...baseTimingAttributes, aborted: true, http_status: httpStatus })
          return
        }
        const parsed = (() => {
          try { return JSON.parse(text || "{}") } catch { return {} }
        })()
        throw new Error(parsed.error || "We couldn't find verified places right now.")
      }

      await consumeNdjson<Record<string, unknown>>(response, {
        signal: controller.signal,
        onValue: (item) => {
          if (!isCurrentSearch()) return

          if (typeof item.summary === "string" && item.summary.trim()) {
            resultSummary = item.summary.trim()
            if (found.length && isCurrentSearch()) setSummary(resultSummary)
          }

          if (typeof item.name !== "string" || !item.name.trim()) return
          const attraction = {
            ...(item as unknown as Attraction),
            imageUrl: absoluteMediaUrl(typeof item.imageUrl === "string" ? item.imageUrl : undefined),
          }
          if (!appendUniqueAttraction(attraction, found, googlePlaceIds, nameLocations)) return
          if (!isCurrentSearch()) return

          const isFirstFreshResult = found.length === 1
          setAttractions([...found])
          setIncomingResultCount(found.length)
          setSummary(resultSummary || `${found.length} verified place${found.length === 1 ? "" : "s"} found so far in ${destination.name}.`)
          if (isFirstFreshResult) {
            setResultsLens(searchLens)
            setResultsDestinationName(destination.name)
            setVisibleResultCount(resultBatchSize)
            setRevealResults(options.reveal !== false)
          }
        },
      })

      if (!isCurrentSearch()) {
        timing.finish({ ...baseTimingAttributes, aborted: true, http_status: httpStatus })
        return
      }
      if (found.length) {
        setSummary(resultSummary || `${found.length} verified place${found.length === 1 ? "" : "s"} in ${destination.name}.`)
      } else {
        setSearchError(previousResults.length
          ? `No new ${searchLens.toLowerCase()} matches appeared. Your current places are still here—try a broader search.`
          : `No verified matches appeared for ${destination.name}. Try “food”, “museums”, or another broader idea.`)
      }
      timing.finish({
        had_results: found.length > 0,
        http_status: httpStatus,
        result_count: found.length,
      })
    } catch (error) {
      if (!isCurrentSearch() || (error instanceof Error && error.name === "AbortError")) {
        timing.finish({ ...baseTimingAttributes, aborted: true, http_status: httpStatus })
        return
      }
      timing.fail(error, { ...baseTimingAttributes, http_status: httpStatus, result_count: found.length })
      const message = found.length
        ? `We found ${found.length} place${found.length === 1 ? "" : "s"} before the connection paused. Those results are still here—try again for more.`
        : previousResults.length
          ? "We couldn’t refresh these matches. Your current places are still here—try again."
          : "Search is temporarily unavailable. Try again in a moment."
      if (isCurrentSearch()) setSearchError(message)
    } finally {
      if (isCurrentSearch()) {
        searchAbortController.current = null
        setSearching(false)
      }
    }
  }

  async function saveToTrip(trip: Trip) {
    if (!pendingAttraction || !user) return
    const attractionName = pendingAttraction.name
    const normalizedName = attractionName.trim().toLowerCase()
    setSaving(true)
    try {
      await saveAttractionToTrip(user.id, trip.id, {
        ...pendingAttraction,
        imageUrl: absoluteMediaUrl(pendingAttraction.imageUrl),
      })
      setRecentlySavedNames((current) => new Set([...current, normalizedName]))
      setLastSavedName(attractionName)
      setLastSavedTripTitle(trip.title)
      setPendingAttraction(null)
    } catch (error) {
      Alert.alert("Place not saved", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setSaving(false)
    }
  }

  function beginSave(attraction: Attraction) {
    if (params.tripId) {
      const trip = scopedTrip ?? data?.trips.find((item) => item.id === params.tripId)
      if (trip) void saveToTripWithAttraction(trip, attraction)
      return
    }
    setPendingAttraction(attraction)
  }

  async function saveToTripWithAttraction(trip: Trip, attraction: Attraction) {
    if (!user) return
    const normalizedName = attraction.name.trim().toLowerCase()
    if (savedAttractionNamesRef.current.has(normalizedName)) return
    setSavingName(normalizedName)
    try {
      await saveAttractionToTrip(user.id, trip.id, {
        ...attraction,
        imageUrl: absoluteMediaUrl(attraction.imageUrl),
      })
      const previousCount = savedAttractionNamesRef.current.size
      const nextNames = new Set([...savedAttractionNamesRef.current, normalizedName])
      savedAttractionNamesRef.current = nextNames
      setSavedAttractionNames(nextNames)
      setLastSavedName(attraction.name)
      setLastSavedTripTitle(trip.title)
      setPendingAttraction(null)
      if (
        previousCount < itineraryUnlockCount
        && nextNames.size >= itineraryUnlockCount
        && promptedTripId.current !== trip.id
      ) {
        promptedTripId.current = trip.id
        rememberBuildPrompt(trip.id)
        setBuildError("")
        setBuildPromptOpen(true)
      }
    } catch (error) {
      Alert.alert("Place not saved", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setSavingName("")
    }
  }

  async function buildItinerary() {
    if (buildInFlight.current || !scopedTrip) return
    if (!session?.access_token) {
      setBuildError("Your session needs a quick refresh. Sign in again, and your saved places will still be here.")
      setBuildPromptOpen(true)
      return
    }

    buildInFlight.current = true
    setBuildingItinerary(true)
    setBuildError("")
    try {
      // fastDraft gives the traveler a complete, deterministic first pass immediately.
      // The trip screen can then enrich or rebuild individual days without losing picks.
      const options = hasItinerary
        ? {
            fastDraft: true,
            instruction: "Add every saved place to the itinerary. Preserve all existing traveler picks and manual edits; adjust only suggestions as needed.",
          }
        : { fastDraft: true }
      const result = await generateTripItinerary(session.access_token, scopedTrip.id, options)
      if (result.inclusion && result.inclusion.includedCount < result.inclusion.savedCount) {
        throw new Error(`Only ${result.inclusion.includedCount} of ${result.inclusion.savedCount} saved places were included. Please try again.`)
      }
      setScopedTrip((current) => current ? { ...current, itinerary: result.itinerary } : current)
      setBuildPromptOpen(false)
      router.push({ pathname: "/trips/[id]", params: { id: scopedTrip.id } })
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Please try again."
      setBuildError(`We couldn’t finish the itinerary. Your ${savedCount} saved place${savedCount === 1 ? " is" : "s are"} safe. ${detail}`)
      setBuildPromptOpen(true)
    } finally {
      buildInFlight.current = false
      setBuildingItinerary(false)
    }
  }

  useEffect(() => {
    if (!params.tripId || !params.destination || loading || !scopedTrip || destinationNeedsConfirmation) return
    const key = `${params.tripId}:${selected.destination}`
    if (autoSearchKey.current === key) return
    autoSearchKey.current = key
    void searchPlaces()
    // This runs once for each trip-scoped destination. Search inputs remain user-controlled afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationNeedsConfirmation, loading, params.destination, params.tripId, scopedTrip?.id, selected.destination])

  useEffect(() => {
    if (!revealResults || incomingResultCount === 0 || !revealUsingExistingLayout.current) return
    const resultsY = resultsLayoutY.current
    if (resultsY === null) return
    revealUsingExistingLayout.current = false
    setRevealResults(false)
    const frame = requestAnimationFrame(() => {
      screenRef.current?.scrollTo({ y: Math.max(0, resultsY - 18), animated: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [incomingResultCount, revealResults])

  function revealSearchResults(event: LayoutChangeEvent) {
    const resultsY = event.nativeEvent.layout.y
    resultsLayoutY.current = resultsY
    if (!revealResults) return
    revealUsingExistingLayout.current = false
    setRevealResults(false)
    requestAnimationFrame(() => {
      screenRef.current?.scrollTo({ y: Math.max(0, resultsY - 18), animated: true })
    })
  }

  if (loading && !data) return <LoadingScreen label="Finding places that fit…" />

  return (
    <View style={styles.root}>
      <Screen scrollRef={screenRef} contentStyle={[styles.page, canBuildItinerary && styles.pageWithSticky]}>
        <View style={styles.header}>
          <View>
            <Eyebrow>Explore by feeling</Eyebrow>
            <Text style={styles.title}>Find your next place.</Text>
          </View>
          <View style={styles.sparkle}><Ionicons name="sparkles" size={19} color={colors.primary} /></View>
        </View>

        {scopedTrip ? (
          <Pressable onPress={() => router.push({ pathname: "/trips/[id]", params: { id: scopedTrip.id } })} style={({ pressed }) => [styles.tripContext, pressed && styles.pressed]}>
            <View style={styles.tripContextIcon}><Ionicons name="briefcase-outline" size={18} color={colors.primary} /></View>
            <View style={styles.tripContextCopy}>
              <Text style={styles.tripContextLabel}>ADDING PLACES TO</Text>
              <Text style={styles.tripContextTitle}>{scopedTrip.title}</Text>
              <Text style={styles.tripContextMeta} accessibilityLiveRegion="polite">
                {savedCount >= itineraryUnlockCount
                  ? `${savedCount} saved · Ready to build`
                  : `${savedCount} of ${itineraryUnlockCount} saved · ${itineraryUnlockCount - savedCount} more to build`}
              </Text>
              <View style={styles.tripProgressTrack}>
                <View style={[styles.tripProgressFill, { width: `${Math.min((savedCount / itineraryUnlockCount) * 100, 100)}%` }]} />
              </View>
            </View>
            <View style={styles.tripContextAction}><Text style={styles.tripContextActionText}>VIEW TRIP</Text><Ionicons name="arrow-forward" size={17} color={colors.primary} /></View>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scopedTrip
            ? destinationNeedsConfirmation ? `Confirm trip destination ${selected.name}` : `Trip destination ${selected.name}`
            : "Browse destinations"}
          disabled={Boolean(scopedTrip) && !destinationNeedsConfirmation}
          onPress={() => { if (scopedTrip && destinationNeedsConfirmation) openDestinationRepair(); else if (!scopedTrip) setBrowseOpen(true) }}
          style={({ pressed }) => [
            styles.destinationPicker,
            destinationNeedsConfirmation && styles.destinationPickerWarning,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.destinationPickerIcon}>
            <Ionicons name={destinationNeedsConfirmation ? "alert-circle-outline" : "location-outline"} size={18} color={colors.primary} />
          </View>
          <View style={styles.destinationPickerCopy}>
            <Text style={styles.destinationPickerLabel}>{scopedTrip
              ? destinationNeedsConfirmation ? "DESTINATION NEEDS CONFIRMATION" : "TRIP DESTINATION"
              : "BROWSE DESTINATIONS"}</Text>
            <Text style={styles.destinationPickerValue}>{destinationNeedsConfirmation
              ? scopedTrip?.destination
              : `${selected.name}, ${selected.country}`}</Text>
          </View>
          {scopedTrip ? (
            destinationNeedsConfirmation ? (
              <View style={styles.destinationPickerAction}>
                <Text style={styles.destinationPickerActionText}>FIX</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </View>
            ) : <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          ) : <Ionicons name="chevron-down" size={20} color={colors.text} />}
        </Pressable>

        {destinationNeedsConfirmation ? (
          <View style={styles.destinationRepairGate} accessibilityLiveRegion="polite">
            <View style={styles.destinationRepairGateIcon}><Ionicons name="map-outline" size={21} color={colors.primary} /></View>
            <View style={styles.destinationRepairGateCopy}>
              <Text style={styles.destinationRepairGateEyebrow}>ONE QUICK CHECK</Text>
              <Text style={styles.destinationRepairGateTitle}>Confirm where this trip is going.</Text>
              <Text style={styles.destinationRepairGateBody}>“{scopedTrip?.destination}” may be incomplete. We’ll pause place searches until you select the exact city, so another state or country never slips into your results.</Text>
              <Button onPress={openDestinationRepair} style={styles.destinationRepairGateButton}>Confirm or change destination</Button>
            </View>
          </View>
        ) : null}

        {!destinationNeedsConfirmation ? <>
        <View style={styles.lensHeading}>
          <Eyebrow>Explore by feeling</Eyebrow>
          <Text style={styles.lensHint}>{scopedTrip
            ? `Recommendations refresh within ${selected.name}; your saved places stay put.`
            : "The featured city and recommendations change with each choice."}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lenses}>
          {destinationLenses.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`Show ${item} destinations`}
              accessibilityState={{ selected: lens === item }}
              onPress={() => chooseLens(item)}
              style={[styles.lens, lens === item && styles.lensActive]}
            >
              <Text style={[styles.lensText, lens === item && styles.lensTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <DiscoveryCanvas destination={selected} lens={lens} searching={searching} onExplore={() => void searchPlaces()} accessToken={session?.access_token} />

        <View style={styles.fitCard}>
          <Text style={styles.fitLabel}>WHY IT FITS YOUR FAMILY</Text>
          <Text style={styles.fitReason}>{selected.familyFitReason}</Text>
          <View style={styles.tags}>{selected.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.searchEyebrow}>REFINE YOUR SEARCH</Text>
          <View style={styles.searchInputRow}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Food, art, tech, nature…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
              blurOnSubmit
              onSubmitEditing={() => void searchPlaces()}
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} style={styles.clearSearch}>
                <Ionicons name="close-circle" size={21} color="rgba(255,255,255,0.58)" />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.searchContext}>Using your Family Vibe · {getDestinationQueryForLens(selected, lens)}</Text>
          <View style={styles.searchSuggestions}>
            {searchSuggestions.map((suggestion) => (
              <Pressable key={suggestion} onPress={() => setQuery(suggestion)} style={styles.searchSuggestion}>
                <Text style={styles.searchSuggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
          <Button variant="secondary" onPress={() => void searchPlaces()} loading={searching} style={styles.searchButton}>Find matching places</Button>
          {searchError ? (
            <View style={styles.searchError}>
              <Ionicons name="information-circle-outline" size={18} color="#F1C6B5" />
              <View style={styles.searchErrorCopy}>
                <Text style={styles.searchErrorText}>{searchError}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try this place search again"
                  disabled={searching}
                  onPress={() => void searchPlaces({ reveal: false })}
                  style={styles.retrySearch}
                >
                  <Text style={styles.retrySearchText}>TRY AGAIN</Text>
                  <Ionicons name="arrow-forward" size={14} color="#F0F0F2" />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {searching && !attractions.length ? (
          <View style={styles.loadingResults}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingResultsText}>Finding verified places in {selected.name} for your family…</Text></View>
        ) : null}

        {searching && attractions.length ? (
          <View style={styles.refreshingResults} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.refreshingResultsText}>{incomingResultCount > 0
              ? `${incomingResultCount} new match${incomingResultCount === 1 ? "" : "es"} found so far. More may still appear.`
              : `Updating for ${lens}. Your current places will stay visible until the new matches arrive.`}</Text>
          </View>
        ) : null}

        {attractions.length ? (
          <View style={styles.results} onLayout={revealSearchResults}>
            <View style={styles.sectionHeading}>
              <View><Eyebrow>{resultsLens ? `${resultsLens} matches` : "Matched to your vibe"}</Eyebrow><Text style={styles.sectionTitle}>Places in {resultsDestinationName || selected.name}</Text></View>
              <Text style={styles.sectionCount}>{searching && incomingResultCount > 0 ? `${attractions.length} so far` : attractions.length}</Text>
            </View>
            {lastSavedName && (scopedTrip || lastSavedTripTitle) ? (
              <View style={styles.savedConfirmation}>
                <Ionicons name="checkmark-circle" size={19} color={colors.success} />
                <Text style={styles.savedConfirmationText}>{lastSavedName} is in {scopedTrip?.title ?? lastSavedTripTitle}. Added places stay marked below.</Text>
              </View>
            ) : null}
            {summary ? <Text style={styles.summary}>{summary}</Text> : null}
            {attractions.slice(0, visibleResultCount).map((attraction) => {
              const normalizedName = attraction.name.trim().toLowerCase()
              return (
                <ResultCard
                  key={attraction.googlePlaceId ?? attraction.name}
                  attraction={attraction}
                  onSave={() => beginSave(attraction)}
                  saved={params.tripId ? savedAttractionNames.has(normalizedName) : recentlySavedNames.has(normalizedName)}
                  saving={savingName === normalizedName}
                />
              )
            })}
            {visibleResultCount < attractions.length ? (
              <View style={styles.moreResults}>
                <Text style={styles.moreResultsStatus} accessibilityLiveRegion="polite">
                  Showing {Math.min(visibleResultCount, attractions.length)} of {attractions.length} places
                </Text>
                <Button
                  variant="secondary"
                  onPress={() => setVisibleResultCount((current) => Math.min(current + resultBatchSize, attractions.length))}
                  accessibilityLabel={`Show ${Math.min(resultBatchSize, attractions.length - visibleResultCount)} more places`}
                  accessibilityHint="Loads the next group of matching places"
                  style={styles.moreResultsButton}
                >
                  Show {Math.min(resultBatchSize, attractions.length - visibleResultCount)} more
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {hasSearched && !searching && !attractions.length && !searchError ? (
          <View style={styles.noResults}><Text style={styles.noResultsTitle}>No places appeared yet</Text><Text style={styles.noResultsBody}>Try a broader idea such as food, museums, parks, or family activities.</Text></View>
        ) : null}
        </> : null}

        {!scopedTrip ? (
          <>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}>
                <Eyebrow>Matched to your family</Eyebrow>
                <Text style={styles.sectionTitle}>Worth a closer look</Text>
                <Text style={styles.personalizedBy}>{lens} · {vibeDescription}</Text>
              </View>
              <Text style={styles.sectionCount}>{visibleDestinations.length} places</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail}>
              {visibleDestinations.map((destination) => (
                <Pressable key={destination.slug} onPress={() => chooseDestination(destination)} style={[styles.destinationCard, selected.slug === destination.slug && styles.destinationCardActive]}>
                  <RemoteImage uri={destination.imageUrl} accessToken={session?.access_token} preset="portraitCard" style={styles.destinationImage} />
                  <View style={styles.destinationShade} />
                  <View style={styles.destinationCopy}>
                    <Text style={styles.destinationName}>{destination.name}</Text>
                    <Text style={styles.destinationSub}>{destination.country}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </Screen>

      {canBuildItinerary ? (
        <SafeAreaView pointerEvents="box-none" edges={["bottom"]} style={styles.stickyBuildSafe}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={buildCtaLabel}
            accessibilityHint={hasItinerary
              ? "Adds your new saved places without removing the itinerary you already planned"
              : "Builds a first itinerary with every saved place and opens your trip"}
            disabled={buildingItinerary}
            onPress={() => void buildItinerary()}
            style={({ pressed }) => [styles.stickyBuild, pressed && styles.stickyBuildPressed, buildingItinerary && styles.stickyBuildDisabled]}
          >
            <View style={styles.stickyBuildCopy}>
              <Text style={styles.stickyBuildEyebrow}>{hasItinerary ? "NEW PICKS READY" : "ENOUGH TO START"}</Text>
              <Text style={styles.stickyBuildLabel}>{buildCtaLabel}</Text>
            </View>
            {buildingItinerary
              ? <ActivityIndicator color="#F0F0F2" />
              : <Ionicons name="arrow-forward" size={20} color="#F0F0F2" />}
          </Pressable>
        </SafeAreaView>
      ) : null}

      <Modal
        visible={destinationRepairOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => { if (!destinationRepairSaving) setDestinationRepairOpen(false) }}
      >
        <SafeAreaView style={styles.destinationRepairSafe}>
          <View style={styles.destinationRepairHeader}>
            <View style={styles.destinationRepairHeaderCopy}>
              <Text style={styles.destinationRepairEyebrow}>{destinationNeedsConfirmation ? "CONFIRM DESTINATION" : "CHANGE DESTINATION"}</Text>
              <Text style={styles.destinationRepairTitle}>Choose the exact city.</Text>
              <Text style={styles.destinationRepairSubtitle}>This keeps every Explore lens geographically anchored to one place.</Text>
            </View>
            <Pressable
              accessibilityLabel="Close destination confirmation"
              disabled={destinationRepairSaving}
              onPress={() => setDestinationRepairOpen(false)}
              style={styles.destinationRepairClose}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.destinationRepairSearch}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              autoFocus
              value={destinationRepairQuery}
              onChangeText={setDestinationRepairQuery}
              placeholder="City and country"
              placeholderTextColor={colors.textMuted}
              style={styles.destinationRepairInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            {destinationRepairSearching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          <ScrollView
            contentContainerStyle={styles.destinationRepairList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={styles.destinationRepairListLabel}>VERIFIED DESTINATIONS</Text>
            {destinationRepairOptions.map((option) => (
              <Pressable
                key={option.placeId}
                accessibilityRole="button"
                accessibilityLabel={`Use ${option.label}`}
                disabled={destinationRepairSaving}
                onPress={() => void confirmTripDestination(option)}
                style={({ pressed }) => [styles.destinationRepairOption, pressed && styles.pressed]}
              >
                {option.imageUrl ? (
                  <RemoteImage uri={option.imageUrl} accessToken={session?.access_token} preset="thumbnail" style={styles.destinationRepairImage} />
                ) : (
                  <View style={styles.destinationRepairImageFallback}><Ionicons name="location" size={20} color={colors.primary} /></View>
                )}
                <View style={styles.destinationRepairOptionCopy}>
                  <Text style={styles.destinationRepairCity}>{option.city}</Text>
                  <Text style={styles.destinationRepairRegion}>{option.country || option.region}</Text>
                  <View style={styles.destinationVerifiedRow}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <Text style={styles.destinationVerifiedText}>Verified destination</Text>
                  </View>
                </View>
                {destinationRepairSaving
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Ionicons name="arrow-forward" size={19} color={colors.text} />}
              </Pressable>
            ))}
            {destinationRepairOptions.some((option) => option.provider === "google") ? (
              <Text accessibilityLabel="Google Maps" style={styles.googleMapsAttribution}>Google Maps</Text>
            ) : null}
            {!destinationRepairSearching && destinationRepairQuery.trim().length >= 2 && !destinationRepairOptions.length ? (
              <View style={styles.destinationRepairEmpty}>
                <Ionicons name="globe-outline" size={23} color={colors.primary} />
                <Text style={styles.destinationRepairEmptyTitle}>No verified city yet</Text>
                <Text style={styles.destinationRepairEmptyBody}>Add the country—for example, “Abuja, Nigeria”—or try the full city name.</Text>
              </View>
            ) : null}
            {destinationRepairError ? <Text style={styles.destinationRepairError}>{destinationRepairError}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={browseOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setBrowseOpen(false)}>
        <SafeAreaView style={styles.browserSafe}>
          <View style={styles.browserHeader}>
            <View>
              <Text style={styles.browserEyebrow}>CHOOSE YOUR NEXT VIEW</Text>
              <Text style={styles.browserTitle}>Where do you want to go?</Text>
            </View>
            <Pressable accessibilityLabel="Close destination browser" onPress={() => setBrowseOpen(false)} style={styles.browserClose}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.browserSearch}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.55)" />
            <TextInput
              autoFocus
              value={browseQuery}
              onChangeText={setBrowseQuery}
              placeholder="Search city, country, or region"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.browserSearchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <ScrollView contentContainerStyle={styles.browserList} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <Text style={styles.browserListLabel}>{browseQuery ? "SEARCH RESULTS" : "CURATED DESTINATIONS"}</Text>
            {browseDestinationSearching ? (
              <View style={styles.browserLookupStatus} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.browserLookupText}>Finding verified destinations…</Text>
              </View>
            ) : null}
            {browseDestinationOptions.map((option) => {
              const verified = isVerifiedDestinationOption(option)
              return (
                <Pressable key={`${option.provider}:${option.placeId}:${option.canonicalLabel}`} onPress={() => chooseDestinationOption(option)} style={({ pressed }) => [styles.browserRow, pressed && styles.browserRowPressed]}>
                  <View style={styles.browserRowCopy}>
                    <Text style={styles.browserVerifiedLabel}>{verified ? "VERIFIED DESTINATION" : "CURATED DESTINATION"}</Text>
                    <Text style={styles.browserCity}>{option.city}</Text>
                    <Text style={styles.browserCountry}>{[option.region, option.country].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ")}</Text>
                  </View>
                  {option.imageUrl ? <RemoteImage uri={option.imageUrl} accessToken={session?.access_token} preset="thumbnail" style={styles.browserImage} /> : null}
                  <View style={styles.browserArrow}><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></View>
                </Pressable>
              )
            })}
            {customDestination ? (
              <Pressable onPress={() => chooseDestination(customDestination, true)} style={({ pressed }) => [styles.customDestinationRow, pressed && styles.browserRowPressed]}>
                <View style={styles.customDestinationIcon}><Ionicons name="search" size={18} color="#FFFFFF" /></View>
                <View style={styles.browserRowCopy}>
                  <Text style={styles.customDestinationLabel}>SEARCH EXACT DESTINATION</Text>
                  <Text style={styles.customDestinationTitle}>Find places in {customDestination.destination}</Text>
                  <Text style={styles.browserReason}>We’ll verify the location before showing matches</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}
            {browsableDestinationFallbacks.map((destination) => (
              <Pressable key={destination.slug} onPress={() => chooseDestination(destination, true)} style={({ pressed }) => [styles.browserRow, pressed && styles.browserRowPressed]}>
                <View style={styles.browserRowCopy}>
                  <Text style={styles.browserCity}>{destination.name}</Text>
                  <Text style={styles.browserCountry}>{destination.country} · {destination.region}</Text>
                  <Text style={styles.browserReason} numberOfLines={1}>{destination.headline}</Text>
                </View>
                <RemoteImage uri={destination.imageUrl} accessToken={session?.access_token} preset="thumbnail" style={styles.browserImage} />
                <View style={styles.browserArrow}><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></View>
              </Pressable>
            ))}
            {browseDestinationError ? <Text style={styles.browserLookupError}>{browseDestinationError}</Text> : null}
            {!browseDestinationSearching && !browseDestinationOptions.length && !browsableDestinationFallbacks.length && !customDestination ? <Text style={styles.browserEmpty}>Type any city or region to explore it.</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(pendingAttraction && !params.tripId)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPendingAttraction(null)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeadingCopy}><Eyebrow>Add to a trip</Eyebrow><Text style={styles.modalTitle}>{pendingAttraction?.name}</Text></View>
            <Pressable onPress={() => setPendingAttraction(null)} style={styles.closeButton}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.tripChoices}>
            {data?.trips.map((trip) => (
              <Pressable key={trip.id} disabled={saving} onPress={() => saveToTrip(trip)} style={({ pressed }) => [styles.tripChoice, pressed && styles.pressed]}>
                <View><Text style={styles.tripChoiceTitle}>{trip.title}</Text><Text style={styles.tripChoiceDestination}>{trip.destination}</Text></View>
                {saving ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />}
              </Pressable>
            ))}
            {!data?.trips.length ? <Text style={styles.noTrips}>Create a trip first, then return here to save places.</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={buildPromptOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!buildingItinerary) setBuildPromptOpen(false) }}
      >
        <View style={styles.buildPromptOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep exploring"
            disabled={buildingItinerary}
            onPress={() => setBuildPromptOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={["bottom"]} style={styles.buildPromptSafe}>
            <View style={styles.buildPromptSheet}>
              <View style={styles.buildPromptHandle} />
              <View style={styles.buildPromptIcon}><Ionicons name="sparkles" size={20} color={colors.primary} /></View>
              <Text style={styles.buildPromptEyebrow}>YOUR TRIP HAS A POINT OF VIEW</Text>
              <Text style={styles.buildPromptTitle}>You have enough to build.</Text>
              <Text style={styles.buildPromptBody}>We’ll organize all {savedCount} saved places into a practical first itinerary. You can keep exploring or refine every day afterward.</Text>
              {buildError ? (
                <View style={styles.buildPromptError}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Text style={styles.buildPromptErrorText}>{buildError}</Text>
                </View>
              ) : null}
              <Button onPress={() => void buildItinerary()} loading={buildingItinerary} style={styles.buildPromptPrimary}>
                {hasItinerary ? "Update my itinerary" : "Build my itinerary"}
              </Button>
              <Button variant="ghost" disabled={buildingItinerary} onPress={() => setBuildPromptOpen(false)} style={styles.buildPromptSecondary}>Keep exploring</Button>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  page: { paddingTop: 8, paddingHorizontal: 0, gap: 20 },
  pageWithSticky: { paddingBottom: 132 },
  header: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 34, lineHeight: 39, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  sparkle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  tripContext: { marginHorizontal: 18, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
  tripContextIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  tripContextCopy: { flex: 1 },
  tripContextLabel: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  tripContextTitle: { color: colors.text, fontSize: 18, fontFamily: typography.serif, fontWeight: "700", marginTop: 2 },
  tripContextMeta: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  tripProgressTrack: { height: 3, marginTop: 9, borderRadius: 99, overflow: "hidden", backgroundColor: colors.surfaceMuted },
  tripProgressFill: { height: "100%", borderRadius: 99, backgroundColor: colors.primary },
  tripContextAction: { alignItems: "flex-end", gap: 3 },
  tripContextActionText: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  destinationPicker: { marginHorizontal: 18, minHeight: 68, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
  destinationPickerWarning: { minHeight: 78, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  destinationPickerIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  destinationPickerCopy: { flex: 1 },
  destinationPickerLabel: { color: colors.primary, fontSize: 8, fontWeight: "800", letterSpacing: 1.35 },
  destinationPickerValue: { color: colors.text, fontSize: 17, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  destinationPickerAction: { flexDirection: "row", alignItems: "center", gap: 1 },
  destinationPickerActionText: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  destinationRepairGate: { marginHorizontal: 18, padding: 18, borderRadius: radii.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, flexDirection: "row", alignItems: "flex-start", gap: 13 },
  destinationRepairGateIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  destinationRepairGateCopy: { flex: 1 },
  destinationRepairGateEyebrow: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  destinationRepairGateTitle: { color: colors.text, fontSize: 21, lineHeight: 26, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  destinationRepairGateBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  destinationRepairGateButton: { marginTop: 14, minHeight: 46 },
  lensHeading: { paddingHorizontal: 18, gap: 4 },
  lensHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  lenses: { paddingHorizontal: 18, gap: 8 },
  lens: { minHeight: 44, paddingHorizontal: 16, borderRadius: 99, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  lensActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  lensText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  lensTextActive: { color: colors.primaryDark },
  fitCard: { marginHorizontal: 18, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  fitLabel: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  fitReason: { color: colors.text, fontSize: 17, lineHeight: 24, fontFamily: typography.serif, marginTop: 7 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  tag: { color: colors.success, backgroundColor: "transparent", borderRadius: 99, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: "700" },
  searchCard: { marginHorizontal: 18, backgroundColor: colors.dark, borderRadius: radii.medium, padding: 18, gap: 13 },
  searchEyebrow: { color: "rgba(255,255,255,0.44)", fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  searchInputRow: { minHeight: 52, borderRadius: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.42)", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  clearSearch: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  searchContext: { color: "rgba(255,255,255,0.58)", fontSize: 10, lineHeight: 15 },
  searchSuggestions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  searchSuggestion: { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.28)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  searchSuggestionText: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "700" },
  searchButton: { backgroundColor: colors.surface, borderColor: colors.surface },
  searchError: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.2)", paddingTop: 12 },
  searchErrorCopy: { flex: 1, gap: 9 },
  searchErrorText: { flex: 1, color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 17 },
  retrySearch: { minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 8 },
  retrySearchText: { color: "#F0F0F2", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  sectionHeading: { paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionHeadingCopy: { flex: 1, paddingRight: 12 },
  sectionTitle: { color: colors.text, fontSize: 25, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  sectionCount: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  personalizedBy: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 5, textTransform: "capitalize" },
  destinationRail: { paddingHorizontal: 18, gap: 12 },
  destinationCard: { width: 176, height: 228, borderRadius: radii.medium, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  destinationCardActive: { borderColor: colors.primary },
  destinationImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  destinationShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.28)" },
  destinationCopy: { position: "absolute", left: 15, right: 15, bottom: 15 },
  destinationName: { color: "#FFFFFF", fontSize: 25, fontFamily: typography.serif, fontWeight: "700" },
  destinationSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  loadingResults: { marginHorizontal: 18, paddingVertical: 28, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", gap: 12 },
  loadingResultsText: { color: colors.textMuted, fontSize: 13 },
  refreshingResults: { marginHorizontal: 18, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radii.medium, backgroundColor: colors.primarySoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary },
  refreshingResultsText: { flex: 1, color: colors.primaryDark, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  results: { gap: 14, paddingBottom: 10 },
  savedConfirmation: { marginHorizontal: 18, flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: colors.successSoft, borderRadius: radii.small, padding: 13 },
  savedConfirmationText: { flex: 1, color: colors.success, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  summary: { marginHorizontal: 18, color: colors.success, borderLeftWidth: 2, borderLeftColor: colors.success, paddingLeft: 13, fontSize: 12, lineHeight: 18 },
  resultCard: { marginHorizontal: 18, paddingBottom: 17, overflow: "hidden", backgroundColor: "transparent", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultImage: { width: "100%", height: 205, backgroundColor: colors.surfaceMuted },
  resultContent: { paddingTop: 15 },
  moreResults: { marginHorizontal: 18, alignItems: "center", gap: 9, paddingTop: 2, paddingBottom: 8 },
  moreResultsStatus: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  moreResultsButton: { alignSelf: "stretch" },
  resultTopline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultCategory: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  rating: { color: colors.text, fontSize: 11, fontWeight: "800" },
  resultTitle: { color: colors.text, fontSize: 24, lineHeight: 29, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  resultLocation: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  whyBox: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 11, marginTop: 15 },
  whyLabel: { color: colors.primary, fontSize: 8, fontWeight: "800", letterSpacing: 1.1 },
  whyText: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  signalRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 13 },
  signal: { color: colors.textMuted, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 2, paddingVertical: 5, fontSize: 9, fontWeight: "700" },
  saveButton: { marginTop: 16 },
  savedButton: { borderColor: colors.success, backgroundColor: colors.successSoft },
  noResults: { marginHorizontal: 18, paddingVertical: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  noResultsTitle: { color: colors.text, fontSize: 18, fontFamily: typography.serif, fontWeight: "700" },
  noResultsBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  destinationRepairSafe: { flex: 1, backgroundColor: colors.background },
  destinationRepairHeader: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  destinationRepairHeaderCopy: { flex: 1, paddingRight: 18 },
  destinationRepairEyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.45 },
  destinationRepairTitle: { color: colors.text, fontSize: 32, lineHeight: 38, fontFamily: typography.serif, fontWeight: "700", marginTop: 7 },
  destinationRepairSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  destinationRepairClose: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  destinationRepairSearch: { marginHorizontal: 22, minHeight: 56, paddingHorizontal: 15, borderRadius: radii.medium, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10 },
  destinationRepairInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  destinationRepairList: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 48 },
  destinationRepairListLabel: { color: colors.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 1.35, marginBottom: 7 },
  destinationRepairOption: { minHeight: 88, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 13 },
  destinationRepairImage: { width: 62, height: 62, borderRadius: radii.small, backgroundColor: colors.surfaceMuted },
  destinationRepairImageFallback: { width: 62, height: 62, borderRadius: radii.small, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  destinationRepairOptionCopy: { flex: 1 },
  destinationRepairCity: { color: colors.text, fontSize: 20, fontFamily: typography.serif, fontWeight: "700" },
  destinationRepairRegion: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  destinationVerifiedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7 },
  destinationVerifiedText: { color: colors.success, fontSize: 9, fontWeight: "800" },
  googleMapsAttribution: { alignSelf: "flex-end", color: "#5E5E5E", fontSize: 12, fontWeight: "400", paddingHorizontal: 10, paddingTop: 10, paddingBottom: 5 },
  destinationRepairEmpty: { paddingVertical: 46, alignItems: "center" },
  destinationRepairEmptyTitle: { color: colors.text, fontSize: 19, fontFamily: typography.serif, fontWeight: "700", marginTop: 12 },
  destinationRepairEmptyBody: { maxWidth: 290, color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 },
  destinationRepairError: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radii.small, padding: 12, fontSize: 11, lineHeight: 17, fontWeight: "700", marginTop: 14 },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { padding: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  modalHeadingCopy: { flex: 1, paddingRight: 20 },
  modalTitle: { color: colors.text, fontSize: 27, lineHeight: 32, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  tripChoices: { padding: 18, gap: 10 },
  tripChoice: { minHeight: 78, borderRadius: 19, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tripChoiceTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  tripChoiceDestination: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  noTrips: { color: colors.textMuted, textAlign: "center", padding: 30 },
  pressed: { opacity: 0.72 },
  browserSafe: { flex: 1, backgroundColor: colors.dark },
  browserHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  browserEyebrow: { color: "#D48A67", fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  browserTitle: { color: "#FFFFFF", fontSize: 34, lineHeight: 40, fontFamily: typography.serif, fontWeight: "700", marginTop: 7 },
  browserClose: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  browserSearch: { marginHorizontal: 20, minHeight: 54, paddingHorizontal: 15, borderRadius: radii.medium, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center", gap: 10 },
  browserSearchInput: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  browserList: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  browserListLabel: { color: "rgba(255,255,255,0.42)", fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 },
  browserLookupStatus: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.17)" },
  browserLookupText: { color: "rgba(255,255,255,0.68)", fontSize: 12 },
  browserLookupError: { color: "#F1C6B5", fontSize: 11, lineHeight: 17, paddingVertical: 14 },
  browserRow: { minHeight: 112, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.17)", flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  browserRowPressed: { opacity: 0.68 },
  browserRowCopy: { flex: 1 },
  browserVerifiedLabel: { color: "#D48A67", fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginBottom: 4 },
  browserCity: { color: "#FFFFFF", fontSize: 29, lineHeight: 34, fontFamily: typography.serif, fontWeight: "700" },
  browserCountry: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 3 },
  browserReason: { color: "#D48A67", fontSize: 10, fontWeight: "700", marginTop: 7 },
  browserImage: { width: 76, height: 84, borderRadius: radii.small, backgroundColor: "rgba(255,255,255,0.08)" },
  browserArrow: { position: "absolute", right: 8, bottom: 16, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  browserEmpty: { color: "rgba(255,255,255,0.62)", fontSize: 14, textAlign: "center", paddingVertical: 48 },
  customDestinationRow: { minHeight: 94, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.2)", flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14 },
  customDestinationIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  customDestinationLabel: { color: "rgba(255,255,255,0.46)", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  customDestinationTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  stickyBuildSafe: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 8, backgroundColor: "rgba(243,239,231,0.96)" },
  stickyBuild: { minHeight: 68, paddingHorizontal: 18, borderRadius: radii.large, backgroundColor: colors.dark, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8 },
  stickyBuildPressed: { opacity: 0.9, transform: [{ translateY: 1 }] },
  stickyBuildDisabled: { opacity: 0.68 },
  stickyBuildCopy: { flex: 1, paddingRight: 12 },
  stickyBuildEyebrow: { color: "#C8A96E", fontSize: 8, fontWeight: "900", letterSpacing: 1.35 },
  stickyBuildLabel: { color: "#F0F0F2", fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 3 },
  buildPromptOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  buildPromptSafe: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  buildPromptSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  buildPromptHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 },
  buildPromptIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, marginBottom: 14 },
  buildPromptEyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.45 },
  buildPromptTitle: { color: colors.text, fontSize: 29, lineHeight: 34, fontFamily: typography.serif, fontWeight: "700", marginTop: 7 },
  buildPromptBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 10, marginBottom: 18 },
  buildPromptError: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: radii.medium, backgroundColor: colors.dangerSoft, marginBottom: 14 },
  buildPromptErrorText: { flex: 1, color: colors.danger, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  buildPromptPrimary: { backgroundColor: colors.dark },
  buildPromptSecondary: { marginTop: 2, minHeight: 44 },
})
