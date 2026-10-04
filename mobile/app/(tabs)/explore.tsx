import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Button, Eyebrow, LoadingScreen, Screen } from "@/components/ui"
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
import { loadTrip, saveAttractionToTrip } from "@/lib/data"
import { absoluteMediaUrl, apiUrl, remoteImageSource } from "@/lib/media"
import { colors, radii, typography } from "@/lib/theme"
import type { Attraction, Trip } from "@/lib/types"
import { useDashboard } from "@/hooks/use-dashboard"
import { useAuth } from "@/providers/auth-provider"

const fallbackPlaceImage = "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&h=800&fit=crop"

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
      <Image source={remoteImageSource(imageUrl)} onError={() => setImageUrl(fallbackPlaceImage)} style={styles.resultImage} />
      <View style={styles.resultContent}>
        <View style={styles.resultTopline}>
          <Text style={styles.resultCategory}>{attraction.category || "PLACE"}</Text>
          {attraction.rating ? <Text style={styles.rating}>★ {attraction.rating.toFixed(1)}</Text> : null}
        </View>
        <Text style={styles.resultTitle}>{attraction.name}</Text>
        <Text style={styles.resultLocation} numberOfLines={1}>{attraction.location}</Text>
        {attraction.familyFitReason ? (
          <View style={styles.whyBox}>
            <Text style={styles.whyLabel}>WHY IT FITS YOUR FAMILY</Text>
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
  const [summary, setSummary] = useState("")
  const [searchError, setSearchError] = useState("")
  const [searching, setSearching] = useState(false)
  const [pendingAttraction, setPendingAttraction] = useState<Attraction | null>(null)
  const [saving, setSaving] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [browseQuery, setBrowseQuery] = useState("")
  const [lensTouched, setLensTouched] = useState(false)
  const [scopedTrip, setScopedTrip] = useState<Trip | null>(null)
  const [savedAttractionNames, setSavedAttractionNames] = useState<Set<string>>(new Set())
  const [recentlySavedNames, setRecentlySavedNames] = useState<Set<string>>(new Set())
  const [savingName, setSavingName] = useState("")
  const [lastSavedName, setLastSavedName] = useState("")
  const [lastSavedTripTitle, setLastSavedTripTitle] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const [revealResults, setRevealResults] = useState(false)
  const screenRef = useRef<ScrollView>(null)
  const autoSearchKey = useRef("")

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

  const customDestination = useMemo(() => {
    const value = browseQuery.trim()
    if (!value || findDestinationCard(value)) return null
    return createDestinationCard(value)
  }, [browseQuery])

  const searchSuggestions = useMemo(() => {
    if (lens === "Food + culture") return ["Local food", "Markets", "Art + culture"]
    if (lens === "Easy with kids") return ["Hands-on", "Parks", "Easy meals"]
    if (lens === "Nature reset") return ["Nature", "Beaches", "Gardens"]
    return selected.tags.slice(0, 3)
  }, [lens, selected.tags])

  const vibeDescription = describeVibeMatch(data?.familyVibe ?? null)

  useEffect(() => {
    if (!user || !params.tripId) {
      setScopedTrip(null)
      setSavedAttractionNames(new Set())
      return
    }
    let active = true
    loadTrip(user.id, params.tripId)
      .then((result) => {
        if (!active) return
        setScopedTrip(result.trip)
        setSavedAttractionNames(new Set(result.savedAttractions.map((saved) => saved.attraction_name.trim().toLowerCase())))
      })
      .catch(() => {
        if (!active) return
        setScopedTrip(data?.trips.find((trip) => trip.id === params.tripId) ?? null)
      })
    return () => { active = false }
  }, [data?.trips, params.tripId, user])

  useEffect(() => {
    const destination = resolveDestinationCard(params.destination)
    if (!destination) return
    setSelected(destination)
    setQuery("")
    setAttractions([])
    setSummary("")
    setSearchError("")
    setHasSearched(false)
  }, [params.destination])

  useEffect(() => {
    if (!data?.familyVibe || lensTouched || params.destination) return
    const defaultLens = getDefaultDestinationLens(data.familyVibe)
    const ranked = rankDestinationsForVibe(data.familyVibe, defaultLens)
    setLens(defaultLens)
    if (ranked[0]) {
      setSelected(ranked[0])
      setQuery("")
    }
  }, [data?.familyVibe, lensTouched, params.destination])

  function chooseDestination(destination: DestinationCard) {
    Keyboard.dismiss()
    setSelected(destination)
    setQuery("")
    setAttractions([])
    setSummary("")
    setSearchError("")
    setHasSearched(false)
    setBrowseOpen(false)
    setBrowseQuery("")
  }

  function chooseLens(nextLens: DestinationLens) {
    setLens(nextLens)
    setLensTouched(true)
    setAttractions([])
    setSummary("")
    setSearchError("")
    setHasSearched(false)
    setQuery("")
    if (params.destination) return
    const ranked = rankDestinationsForVibe(data?.familyVibe ?? null, nextLens)
    if (ranked[0]) chooseDestination(ranked[0])
  }

  async function searchPlaces() {
    Keyboard.dismiss()
    setSearching(true)
    setHasSearched(true)
    setAttractions([])
    setSummary("")
    setSearchError("")
    try {
      const response = await fetch(`${apiUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: selected.destination,
          query: query.trim() || getDestinationQueryForLens(selected, lens),
          ownerName: data?.profile?.display_name,
          familyVibe: data?.familyVibe,
          filters: {},
        }),
      })
      const text = await response.text()
      if (!response.ok) {
        const parsed = (() => {
          try { return JSON.parse(text || "{}") } catch { return {} }
        })()
        throw new Error(parsed.error || "We couldn't find verified places right now.")
      }
      const found: Attraction[] = []
      let resultSummary = ""
      text.split(/\r?\n/).forEach((line) => {
        const normalizedLine = line.trim().replace(/^data:\s*/, "")
        if (!normalizedLine || normalizedLine === "[DONE]") return
        try {
          const item = JSON.parse(normalizedLine)
          if (item.name) found.push({
            ...(item as Attraction),
            imageUrl: absoluteMediaUrl(item.imageUrl),
          })
          if (item.summary) resultSummary = item.summary
        } catch {
          // Ignore malformed stream fragments and keep any valid verified results.
        }
      })
      setAttractions(found)
      setRevealResults(true)
      setSummary(resultSummary || (found.length ? `${found.length} verified place${found.length === 1 ? "" : "s"} in ${selected.name}.` : ""))
      if (!found.length) setSearchError(`No verified matches appeared for ${selected.name}. Try “food”, “museums”, or another broader idea.`)
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search is temporarily unavailable. Please try again shortly.")
    } finally {
      setSearching(false)
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
    setSavingName(normalizedName)
    try {
      await saveAttractionToTrip(user.id, trip.id, {
        ...attraction,
        imageUrl: absoluteMediaUrl(attraction.imageUrl),
      })
      setSavedAttractionNames((current) => new Set([...current, normalizedName]))
      setLastSavedName(attraction.name)
      setLastSavedTripTitle(trip.title)
      setPendingAttraction(null)
    } catch (error) {
      Alert.alert("Place not saved", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setSavingName("")
    }
  }

  useEffect(() => {
    if (!params.tripId || !params.destination || loading || !scopedTrip) return
    const key = `${params.tripId}:${selected.destination}`
    if (autoSearchKey.current === key) return
    autoSearchKey.current = key
    void searchPlaces()
    // This runs once for each trip-scoped destination. Search inputs remain user-controlled afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, params.destination, params.tripId, scopedTrip?.id, selected.destination])

  function revealSearchResults(event: LayoutChangeEvent) {
    if (!revealResults) return
    setRevealResults(false)
    requestAnimationFrame(() => {
      screenRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 18), animated: true })
    })
  }

  if (loading && !data) return <LoadingScreen label="Finding places that fit…" />

  return (
    <>
      <Screen scrollRef={screenRef} contentStyle={styles.page}>
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
              <Text style={styles.tripContextMeta}>{savedAttractionNames.size} saved · Results are scoped to {scopedTrip.destination}</Text>
            </View>
            <View style={styles.tripContextAction}><Text style={styles.tripContextActionText}>VIEW TRIP</Text><Ionicons name="arrow-forward" size={17} color={colors.primary} /></View>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scopedTrip ? `Trip destination ${selected.name}` : "Browse destinations"}
          onPress={() => { if (!scopedTrip) setBrowseOpen(true) }}
          style={({ pressed }) => [styles.destinationPicker, pressed && styles.pressed]}
        >
          <View style={styles.destinationPickerIcon}><Ionicons name="location-outline" size={18} color={colors.primary} /></View>
          <View style={styles.destinationPickerCopy}>
            <Text style={styles.destinationPickerLabel}>{scopedTrip ? "TRIP DESTINATION" : "BROWSE DESTINATIONS"}</Text>
            <Text style={styles.destinationPickerValue}>{selected.name}, {selected.country}</Text>
          </View>
          <Ionicons name={scopedTrip ? "lock-closed-outline" : "chevron-down"} size={20} color={scopedTrip ? colors.textMuted : colors.text} />
        </Pressable>

        <View style={styles.lensHeading}>
          <Eyebrow>Explore by feeling</Eyebrow>
          <Text style={styles.lensHint}>The featured city and recommendations change with each choice.</Text>
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

        <DiscoveryCanvas destination={selected} lens={lens} searching={searching} onExplore={searchPlaces} accessToken={session?.access_token} />

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
              onSubmitEditing={searchPlaces}
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
          <Button variant="secondary" onPress={searchPlaces} loading={searching} style={styles.searchButton}>Find matching places</Button>
          {searchError ? (
            <View style={styles.searchError}>
              <Ionicons name="information-circle-outline" size={18} color="#F1C6B5" />
              <Text style={styles.searchErrorText}>{searchError}</Text>
            </View>
          ) : null}
        </View>

        {searching ? (
          <View style={styles.loadingResults}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingResultsText}>Finding verified places in {selected.name} for your family…</Text></View>
        ) : null}

        {attractions.length ? (
          <View style={styles.results} onLayout={revealSearchResults}>
            <View style={styles.sectionHeading}>
              <View><Eyebrow>Matched to your vibe</Eyebrow><Text style={styles.sectionTitle}>Places in {selected.name}</Text></View>
              <Text style={styles.sectionCount}>{attractions.length}</Text>
            </View>
            {lastSavedName && (scopedTrip || lastSavedTripTitle) ? (
              <View style={styles.savedConfirmation}>
                <Ionicons name="checkmark-circle" size={19} color={colors.success} />
                <Text style={styles.savedConfirmationText}>{lastSavedName} is in {scopedTrip?.title ?? lastSavedTripTitle}. Added places stay marked below.</Text>
              </View>
            ) : null}
            {summary ? <Text style={styles.summary}>{summary}</Text> : null}
            {attractions.map((attraction) => {
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
          </View>
        ) : null}

        {hasSearched && !searching && !attractions.length && !searchError ? (
          <View style={styles.noResults}><Text style={styles.noResultsTitle}>No places appeared yet</Text><Text style={styles.noResultsBody}>Try a broader idea such as food, museums, parks, or family activities.</Text></View>
        ) : null}

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
                  <Image source={remoteImageSource(destination.imageUrl, session?.access_token)} style={styles.destinationImage} />
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
            {customDestination ? (
              <Pressable onPress={() => chooseDestination(customDestination)} style={({ pressed }) => [styles.customDestinationRow, pressed && styles.browserRowPressed]}>
                <View style={styles.customDestinationIcon}><Ionicons name="search" size={18} color="#FFFFFF" /></View>
                <View style={styles.browserRowCopy}>
                  <Text style={styles.customDestinationLabel}>SEARCH ANY DESTINATION</Text>
                  <Text style={styles.customDestinationTitle}>Explore {customDestination.destination}</Text>
                  <Text style={styles.browserReason}>Find verified places using your Family Vibe</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}
            {browsableDestinations.map((destination) => (
              <Pressable key={destination.slug} onPress={() => chooseDestination(destination)} style={({ pressed }) => [styles.browserRow, pressed && styles.browserRowPressed]}>
                <View style={styles.browserRowCopy}>
                  <Text style={styles.browserCity}>{destination.name}</Text>
                  <Text style={styles.browserCountry}>{destination.country} · {destination.region}</Text>
                  <Text style={styles.browserReason} numberOfLines={1}>{destination.headline}</Text>
                </View>
                <Image source={remoteImageSource(destination.imageUrl, session?.access_token)} style={styles.browserImage} />
                <View style={styles.browserArrow}><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></View>
              </Pressable>
            ))}
            {!browsableDestinations.length && !customDestination ? <Text style={styles.browserEmpty}>Type any city or region to explore it.</Text> : null}
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
    </>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 8, paddingHorizontal: 0, gap: 20 },
  header: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 34, lineHeight: 39, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  sparkle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  tripContext: { marginHorizontal: 18, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
  tripContextIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  tripContextCopy: { flex: 1 },
  tripContextLabel: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  tripContextTitle: { color: colors.text, fontSize: 18, fontFamily: typography.serif, fontWeight: "700", marginTop: 2 },
  tripContextMeta: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  tripContextAction: { alignItems: "flex-end", gap: 3 },
  tripContextActionText: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  destinationPicker: { marginHorizontal: 18, minHeight: 68, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
  destinationPickerIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  destinationPickerCopy: { flex: 1 },
  destinationPickerLabel: { color: colors.primary, fontSize: 8, fontWeight: "800", letterSpacing: 1.35 },
  destinationPickerValue: { color: colors.text, fontSize: 17, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  lensHeading: { paddingHorizontal: 18, gap: 4 },
  lensHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  lenses: { paddingHorizontal: 18, gap: 8 },
  lens: { minHeight: 38, paddingHorizontal: 15, borderRadius: 99, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  lensActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  lensText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  lensTextActive: { color: "#FFFFFF" },
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
  searchErrorText: { flex: 1, color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 17 },
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
  results: { gap: 14, paddingBottom: 10 },
  savedConfirmation: { marginHorizontal: 18, flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: colors.successSoft, borderRadius: radii.small, padding: 13 },
  savedConfirmationText: { flex: 1, color: colors.success, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  summary: { marginHorizontal: 18, color: colors.success, borderLeftWidth: 2, borderLeftColor: colors.success, paddingLeft: 13, fontSize: 12, lineHeight: 18 },
  resultCard: { marginHorizontal: 18, paddingBottom: 17, overflow: "hidden", backgroundColor: "transparent", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultImage: { width: "100%", height: 205, backgroundColor: colors.surfaceMuted },
  resultContent: { paddingTop: 15 },
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
  browserRow: { minHeight: 112, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.17)", flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  browserRowPressed: { opacity: 0.68 },
  browserRowCopy: { flex: 1 },
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
})
