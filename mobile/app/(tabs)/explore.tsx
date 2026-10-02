import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Button, Eyebrow, LoadingScreen, Screen } from "@/components/ui"
import {
  destinationCards,
  destinationLenses,
  findDestinationCard,
  getDefaultDestinationLens,
  type DestinationCard,
  type DestinationLens,
} from "@/lib/destinations"
import { saveAttractionToTrip } from "@/lib/data"
import { colors, radii, shadows, typography } from "@/lib/theme"
import type { Attraction, Trip } from "@/lib/types"
import { useDashboard } from "@/hooks/use-dashboard"
import { useAuth } from "@/providers/auth-provider"

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"

function ResultCard({ attraction, onSave }: { attraction: Attraction; onSave: () => void }) {
  const signals = attraction.familyFitSignals?.map((signal) => signal.label) ?? attraction.vibes ?? []
  return (
    <View style={styles.resultCard}>
      {attraction.imageUrl ? <Image source={{ uri: attraction.imageUrl }} style={styles.resultImage} /> : null}
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
        <Button onPress={onSave} style={styles.saveButton}>Add to a trip</Button>
      </View>
    </View>
  )
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ tripId?: string; destination?: string }>()
  const { user } = useAuth()
  const { data, loading } = useDashboard()
  const initialDestination = findDestinationCard(params.destination) ?? destinationCards[0]
  const [selected, setSelected] = useState<DestinationCard>(initialDestination)
  const [lens, setLens] = useState<DestinationLens>(() => getDefaultDestinationLens(data?.familyVibe ?? null))
  const [query, setQuery] = useState(initialDestination.query)
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [summary, setSummary] = useState("")
  const [searching, setSearching] = useState(false)
  const [pendingAttraction, setPendingAttraction] = useState<Attraction | null>(null)
  const [saving, setSaving] = useState(false)

  const visibleDestinations = useMemo(() => {
    const matches = destinationCards.filter((destination) => destination.lenses.includes(lens))
    return matches.length ? matches : destinationCards
  }, [lens])

  useEffect(() => {
    const destination = findDestinationCard(params.destination)
    if (!destination) return
    setSelected(destination)
    setQuery(destination.query)
  }, [params.destination])

  function chooseDestination(destination: DestinationCard) {
    setSelected(destination)
    setQuery(destination.query)
    setAttractions([])
    setSummary("")
  }

  async function searchPlaces() {
    setSearching(true)
    setAttractions([])
    setSummary("")
    try {
      const response = await fetch(`${apiUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: selected.destination,
          query: query.trim() || selected.query,
          familyVibe: data?.familyVibe,
          filters: {},
        }),
      })
      const text = await response.text()
      if (!response.ok) {
        const parsed = JSON.parse(text || "{}")
        throw new Error(parsed.error || "We couldn't find verified places right now.")
      }
      const found: Attraction[] = []
      let resultSummary = ""
      text.split("\n").filter(Boolean).forEach((line) => {
        const item = JSON.parse(line)
        if (item.name) found.push(item as Attraction)
        if (item.summary) resultSummary = item.summary
      })
      setAttractions(found)
      setSummary(resultSummary)
      if (!found.length) Alert.alert("No verified matches", "Try a broader idea or another destination.")
    } catch (error) {
      Alert.alert("Search unavailable", error instanceof Error ? error.message : "Please try again shortly.")
    } finally {
      setSearching(false)
    }
  }

  async function saveToTrip(trip: Trip) {
    if (!pendingAttraction || !user) return
    setSaving(true)
    try {
      await saveAttractionToTrip(user.id, trip.id, pendingAttraction)
      Alert.alert("Added to your trip", `${pendingAttraction.name} is saved to ${trip.title}.`)
      setPendingAttraction(null)
    } catch (error) {
      Alert.alert("Place not saved", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setSaving(false)
    }
  }

  function beginSave(attraction: Attraction) {
    setPendingAttraction(attraction)
    if (params.tripId) {
      const trip = data?.trips.find((item) => item.id === params.tripId)
      if (trip) void saveToTripWithAttraction(trip, attraction)
    }
  }

  async function saveToTripWithAttraction(trip: Trip, attraction: Attraction) {
    if (!user) return
    setSaving(true)
    try {
      await saveAttractionToTrip(user.id, trip.id, attraction)
      Alert.alert("Added to your trip", `${attraction.name} is saved to ${trip.title}.`)
      setPendingAttraction(null)
    } catch (error) {
      Alert.alert("Place not saved", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) return <LoadingScreen label="Finding places that fit…" />

  return (
    <>
      <Screen contentStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Eyebrow>Explore by feeling</Eyebrow>
            <Text style={styles.title}>Find your next place.</Text>
          </View>
          <View style={styles.sparkle}><Ionicons name="sparkles" size={19} color={colors.primary} /></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lenses}>
          {destinationLenses.map((item) => (
            <Pressable key={item} onPress={() => setLens(item)} style={[styles.lens, lens === item && styles.lensActive]}>
              <Text style={[styles.lensText, lens === item && styles.lensTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ImageBackground source={{ uri: selected.imageUrl }} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.previewPill}><Ionicons name="location" size={13} color="#FFFFFF" /><Text style={styles.previewText}>DESTINATION PREVIEW</Text></View>
          <View style={styles.heroCopy}>
            <Text style={styles.country}>{selected.country.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{selected.name}</Text>
            <Text style={styles.headline}>{selected.headline}</Text>
            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMeta}>{selected.energy}</Text>
              <Text style={styles.heroMeta}>Ideal: {selected.idealStay}</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.fitCard}>
          <Text style={styles.fitLabel}>WHY IT FITS YOUR FAMILY</Text>
          <Text style={styles.fitReason}>{selected.familyFitReason}</Text>
          <View style={styles.tags}>{selected.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.searchEyebrow}>WHAT SOUNDS GOOD?</Text>
          <View style={styles.searchInputRow}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Food, art, tech, nature…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={searchPlaces}
            />
          </View>
          <Button onPress={searchPlaces} loading={searching}>Explore {selected.name}</Button>
        </View>

        <View style={styles.sectionHeading}>
          <View><Eyebrow>Chosen for your vibe</Eyebrow><Text style={styles.sectionTitle}>Worth a closer look</Text></View>
          <Text style={styles.sectionCount}>{visibleDestinations.length} places</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail}>
          {visibleDestinations.map((destination) => (
            <Pressable key={destination.slug} onPress={() => chooseDestination(destination)} style={[styles.destinationCard, selected.slug === destination.slug && styles.destinationCardActive]}>
              <Image source={{ uri: destination.imageUrl }} style={styles.destinationImage} />
              <View style={styles.destinationShade} />
              <View style={styles.destinationCopy}>
                <Text style={styles.destinationName}>{destination.name}</Text>
                <Text style={styles.destinationSub}>{destination.country}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {searching ? (
          <View style={styles.loadingResults}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingResultsText}>Finding verified places for your family…</Text></View>
        ) : null}

        {attractions.length ? (
          <View style={styles.results}>
            <View style={styles.sectionHeading}>
              <View><Eyebrow>Matched to your vibe</Eyebrow><Text style={styles.sectionTitle}>Places in {selected.name}</Text></View>
              <Text style={styles.sectionCount}>{attractions.length}</Text>
            </View>
            {summary ? <Text style={styles.summary}>{summary}</Text> : null}
            {attractions.map((attraction) => <ResultCard key={attraction.googlePlaceId ?? attraction.name} attraction={attraction} onSave={() => beginSave(attraction)} />)}
          </View>
        ) : null}
      </Screen>

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
  page: { paddingTop: 8, paddingHorizontal: 0, gap: 18 },
  header: { paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 34, lineHeight: 39, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  sparkle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  lenses: { paddingHorizontal: 18, gap: 8 },
  lens: { minHeight: 40, paddingHorizontal: 16, borderRadius: 99, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  lensActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  lensText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  lensTextActive: { color: "#FFFFFF" },
  hero: { height: 470, marginHorizontal: 18, justifyContent: "space-between", overflow: "hidden", borderRadius: 30, ...shadows.floating },
  heroImage: { borderRadius: 30 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12,10,8,0.36)" },
  previewPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, margin: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  previewText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  heroCopy: { padding: 22, backgroundColor: "rgba(0,0,0,0.26)" },
  country: { color: "#FF9A73", fontSize: 10, fontWeight: "800", letterSpacing: 1.7 },
  heroTitle: { color: "#FFFFFF", fontSize: 52, lineHeight: 58, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  headline: { color: "rgba(255,255,255,0.82)", fontSize: 16, fontWeight: "600", marginTop: 4 },
  heroMetaRow: { flexDirection: "row", gap: 8, marginTop: 17 },
  heroMeta: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  fitCard: { marginHorizontal: 18, marginTop: -6, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 19, ...shadows.card },
  fitLabel: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  fitReason: { color: colors.text, fontSize: 17, lineHeight: 24, fontFamily: typography.serif, marginTop: 7 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  tag: { color: colors.success, backgroundColor: colors.successSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: "700" },
  searchCard: { marginHorizontal: 18, backgroundColor: colors.dark, borderRadius: 24, padding: 18, gap: 13 },
  searchEyebrow: { color: "rgba(255,255,255,0.44)", fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  searchInputRow: { minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  sectionHeading: { paddingHorizontal: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontSize: 25, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  sectionCount: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  destinationRail: { paddingHorizontal: 18, gap: 12 },
  destinationCard: { width: 176, height: 228, borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  destinationCardActive: { borderColor: colors.primary },
  destinationImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  destinationShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.28)" },
  destinationCopy: { position: "absolute", left: 15, right: 15, bottom: 15 },
  destinationName: { color: "#FFFFFF", fontSize: 25, fontFamily: typography.serif, fontWeight: "700" },
  destinationSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  loadingResults: { marginHorizontal: 18, padding: 28, borderRadius: 22, alignItems: "center", gap: 12, backgroundColor: colors.surface },
  loadingResultsText: { color: colors.textMuted, fontSize: 13 },
  results: { gap: 14, paddingBottom: 10 },
  summary: { marginHorizontal: 18, color: colors.success, backgroundColor: colors.successSoft, borderRadius: 14, padding: 13, fontSize: 12, lineHeight: 18 },
  resultCard: { marginHorizontal: 18, borderRadius: 24, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  resultImage: { width: "100%", height: 205, backgroundColor: colors.surfaceMuted },
  resultContent: { padding: 17 },
  resultTopline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultCategory: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  rating: { color: colors.text, fontSize: 11, fontWeight: "800" },
  resultTitle: { color: colors.text, fontSize: 24, lineHeight: 29, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  resultLocation: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  whyBox: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 11, marginTop: 15 },
  whyLabel: { color: colors.primary, fontSize: 8, fontWeight: "800", letterSpacing: 1.1 },
  whyText: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  signalRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 13 },
  signal: { color: colors.textMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: "700" },
  saveButton: { marginTop: 16 },
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
})
