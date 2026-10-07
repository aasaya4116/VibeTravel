import { useCallback, useMemo, useState } from "react"
import {
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Button, Card, EmptyState, Eyebrow, LoadingScreen, OfflineBanner, Screen } from "@/components/ui"
import { formatDayLabel, formatTripDates } from "@/lib/format"
import { generateTripItinerary, loadTrip, readTripCache, saveItinerary } from "@/lib/data"
import { getTripImage } from "@/lib/destinations"
import { absoluteMediaUrl, remoteImageSource } from "@/lib/media"
import { moveItineraryItem, removeItineraryItem, reorderItineraryItem, updateItineraryItem } from "@/lib/itinerary-editing"
import { colors, shadows, typography } from "@/lib/theme"
import type { ItineraryItem, SavedAttraction, Trip } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"
import { useFamilyPace } from "@/hooks/use-family-pace"

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? siteUrl
const paceLimits = { slow: 3, moderate: 4, fast: 6 } as const

function normalizePlaceName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ")
}

function itemStatus(item: ItineraryItem) {
  if (item.status === "completed") return { label: "Complete", color: colors.success, background: colors.successSoft }
  if (item.status === "skipped") return { label: "Skipped", color: colors.textMuted, background: colors.surfaceMuted }
  if (item.recommended) return { label: "Optional", color: colors.success, background: colors.successSoft }
  return { label: "Your pick", color: colors.primaryDark, background: colors.primarySoft }
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, session } = useAuth()
  const pace = useFamilyPace()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [savedAttractions, setSavedAttractions] = useState<SavedAttraction[]>([])
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedDay, setSelectedDay] = useState(0)
  const [tripMode, setTripMode] = useState(false)
  const [generationError, setGenerationError] = useState("")
  const [generationNote, setGenerationNote] = useState("")
  const [editingStop, setEditingStop] = useState<{ item: ItineraryItem; dayIndex: number } | null>(null)
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editTargetDay, setEditTargetDay] = useState(0)

  const load = useCallback(async (isRefresh = false) => {
    if (!user || !id) return
    if (isRefresh) setRefreshing(true)
    else {
      const cached = readTripCache(user.id, id)
      if (cached) {
        setTrip(cached.trip)
        setSavedAttractions(cached.savedAttractions)
        setOffline(false)
        setSelectedDay((current) => Math.min(current, Math.max(0, cached.trip.itinerary.length - 1)))
        setLoading(false)
      } else {
        setLoading(true)
      }
    }
    try {
      const result = await loadTrip(user.id, id)
      setTrip(result.trip)
      setSavedAttractions(result.savedAttractions)
      setOffline(result.offline)
      setSelectedDay((current) => Math.min(current, Math.max(0, result.trip.itinerary.length - 1)))
    } catch (error) {
      Alert.alert("Trip unavailable", error instanceof Error ? error.message : "Please reconnect and try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, user])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const day = trip?.itinerary?.[selectedDay]
  const activeItem = useMemo(() => day?.items.find((item) => !item.status || item.status === "planned"), [day])
  const itineraryPlaceNames = useMemo(() => new Set(
    (trip?.itinerary ?? []).flatMap((itineraryDay) => itineraryDay.items.map((item) => normalizePlaceName(item.attraction_name)))
  ), [trip?.itinerary])
  const pendingSavedAttractions = useMemo(() => savedAttractions.filter(
    (saved) => !itineraryPlaceNames.has(normalizePlaceName(saved.attraction_name))
  ), [itineraryPlaceNames, savedAttractions])
  const abovePace = Boolean(day && day.items.length > paceLimits[pace])

  async function persistItinerary(itinerary: Trip["itinerary"]) {
    if (!trip || !user || offline) return false
    const previous = trip
    setTrip({ ...trip, itinerary })
    setSaving(true)
    try {
      setTrip(await saveItinerary(user.id, trip, itinerary))
      return true
    } catch (error) {
      setTrip(previous)
      Alert.alert("Change not saved", error instanceof Error ? error.message : "Reconnect and try again.")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(itemId: string, status: "completed" | "skipped") {
    if (!trip || !user || offline) return
    const itinerary = trip.itinerary.map((currentDay, dayIndex) => dayIndex === selectedDay
      ? { ...currentDay, items: currentDay.items.map((item) => item.id === itemId ? { ...item, status } : item) }
      : currentDay)
    await persistItinerary(itinerary)
  }

  function openDirections(item: ItineraryItem) {
    const supplied = item.attraction_data?.googleMapsUri
    const destination = `${item.attraction_name}, ${trip?.destination ?? ""}`
    Linking.openURL(supplied || `https://maps.apple.com/?q=${encodeURIComponent(destination)}`)
  }

  async function shareTrip() {
    if (!trip || !session) return
    setSharing(true)
    try {
      const response = await fetch(`${apiUrl}/api/trips/${trip.id}/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.token) throw new Error(payload.error || "Could not create the private link")
      const url = `${siteUrl}/share/${payload.token}`
      await Share.share({ title: trip.title, message: `Take a look at our ${trip.destination} trip plan on VibeTravel.\n${url}`, url })
    } catch (error) {
      Alert.alert("Sharing unavailable", error instanceof Error ? error.message : "Please reconnect and try again.")
    } finally {
      setSharing(false)
    }
  }

  async function generateItinerary(options: { instruction?: string; dayDate?: string; dayInstruction?: string } = {}) {
    if (!trip || !session || offline) return
    setGenerating(true)
    setGenerationError("")
    setGenerationNote("")
    try {
      const result = await generateTripItinerary(session.access_token, trip.id, options)
      if (result.inclusion && result.inclusion.includedCount < result.inclusion.savedCount) {
        throw new Error(`Only ${result.inclusion.includedCount} of ${result.inclusion.savedCount} saved places were included. Nothing was replaced—please retry.`)
      }
      setTrip({ ...trip, itinerary: result.itinerary })
      if (options.dayDate) {
        setSelectedDay(Math.max(0, result.itinerary.findIndex((candidate) => candidate.date === options.dayDate)))
        setGenerationNote("This day was refreshed. Your other days and traveler picks stayed intact.")
      } else if (options.instruction) {
        const firstAddedName = pendingSavedAttractions[0]?.attraction_name
        const addedDayIndex = firstAddedName
          ? result.itinerary.findIndex((candidate) => candidate.items.some((item) => normalizePlaceName(item.attraction_name) === normalizePlaceName(firstAddedName)))
          : -1
        if (addedDayIndex >= 0) setSelectedDay(addedDayIndex)
        setGenerationNote(`${pendingSavedAttractions.length} newly saved place${pendingSavedAttractions.length === 1 ? "" : "s"} added to your itinerary. Existing traveler picks and edits stayed intact.`)
      } else {
        setSelectedDay(0)
        setGenerationNote(result.inclusion?.generationMode === "saved-picks-only"
          ? `We built a reliable base plan with all ${result.inclusion.includedCount} saved places. Refresh individual days when you want VibeTravel to add more suggestions.`
          : result.inclusion
          ? `All ${result.inclusion.includedCount} saved place${result.inclusion.includedCount === 1 ? "" : "s"} are included in your itinerary.`
          : "Your itinerary is ready. Traveler picks are marked on each day.")
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Your saved places are safe. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  function openStopEditor(item: ItineraryItem) {
    setEditingStop({ item, dayIndex: selectedDay })
    setEditStartTime(item.start_time)
    setEditEndTime(item.end_time)
    setEditNotes(item.notes ?? "")
    setEditTargetDay(selectedDay)
  }

  async function saveStopEdits() {
    if (!trip || !editingStop) return
    let itinerary = updateItineraryItem(trip.itinerary, editingStop.dayIndex, editingStop.item.id, {
      start_time: editStartTime.trim(),
      end_time: editEndTime.trim(),
      notes: editNotes.trim(),
    })
    itinerary = moveItineraryItem(itinerary, editingStop.dayIndex, editingStop.item.id, editTargetDay)
    if (await persistItinerary(itinerary)) {
      setSelectedDay(editTargetDay)
      setEditingStop(null)
    }
  }

  function confirmRemoveStop() {
    if (!trip || !editingStop) return
    Alert.alert("Remove this stop?", `${editingStop.item.attraction_name} will be removed from the itinerary.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const itinerary = removeItineraryItem(trip.itinerary, editingStop.dayIndex, editingStop.item.id)
          if (await persistItinerary(itinerary)) setEditingStop(null)
        },
      },
    ])
  }

  function findPlaces() {
    if (!trip) return
    router.push({ pathname: "/explore", params: { tripId: trip.id, destination: trip.destination } } as never)
  }

  function getItemImage(item: ItineraryItem) {
    return absoluteMediaUrl(item.attraction_data?.imageUrl ?? savedAttractions.find(
      (saved) => saved.attraction_name.toLowerCase() === item.attraction_name.toLowerCase()
    )?.attraction_data.imageUrl)
  }

  if (loading && !trip) return <LoadingScreen label="Packing your itinerary…" />
  if (!trip) return <EmptyState title="Trip unavailable" body="This trip may have been removed or belongs to another account." />

  if (tripMode && day) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => load(true)} contentStyle={styles.modePage}>
        <Stack.Screen options={{ title: "Trip Mode" }} />
        {offline ? <OfflineBanner /> : null}
        <View style={styles.modeHeader}>
          <View>
            <Eyebrow>{formatDayLabel(day.date)}</Eyebrow>
            <Text style={styles.modeTitle}>{activeItem ? "Up next" : "Day complete"}</Text>
          </View>
          <Pressable onPress={() => setTripMode(false)} style={styles.closeMode}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
        </View>
        {activeItem ? (
          <Card style={styles.activeCard}>
            <Text style={styles.activeTime}>{activeItem.start_time} – {activeItem.end_time}</Text>
            <Text style={styles.activeTitle}>{activeItem.attraction_name}</Text>
            {activeItem.notes ? <Text style={styles.activeNotes}>{activeItem.notes}</Text> : null}
            <Button onPress={() => openDirections(activeItem)} style={styles.modeButton}>Open directions</Button>
            <View style={styles.modeActions}>
              <View style={styles.modeAction}><Button variant="secondary" onPress={() => updateStatus(activeItem.id, "skipped")} disabled={saving || offline}>Skip</Button></View>
              <View style={styles.modeAction}><Button onPress={() => updateStatus(activeItem.id, "completed")} loading={saving} disabled={offline}>Complete</Button></View>
            </View>
          </Card>
        ) : (
          <EmptyState title="You’re done for today" body="Every stop is complete or skipped. Enjoy the rest of your day." />
        )}
        <Text style={styles.progressText}>{day.items.filter((item) => item.status === "completed").length} of {day.items.length} stops complete</Text>
      </Screen>
    )
  }

  return (
    <>
    <Screen refreshing={refreshing} onRefresh={() => load(true)} contentStyle={styles.page}>
      <Stack.Screen options={{ title: trip.destination }} />
      {offline ? <OfflineBanner /> : null}
      <ImageBackground source={remoteImageSource(getTripImage(trip.destination), session?.access_token)} style={styles.tripHero} imageStyle={styles.tripHeroImage}>
        <View style={styles.tripHeroShade} />
        <View style={styles.heroTopRow}>
          <View style={styles.statusPill}><Text style={styles.statusPillText}>{trip.status}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Share trip" onPress={shareTrip} disabled={sharing || offline} style={styles.shareButton}>
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroOverline}>YOUR FAMILY ADVENTURE</Text>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.destination}>{trip.destination}</Text>
          <Text style={styles.dates}>{formatTripDates(trip.start_date, trip.end_date)}</Text>
        </View>
      </ImageBackground>

      <Button onPress={() => setTripMode(true)} disabled={!day?.items.length} style={styles.startMode}>Start Trip Mode</Button>

      {generationNote ? (
        <View style={styles.generationSuccess}><Ionicons name="checkmark-circle" size={19} color={colors.success} /><Text style={styles.generationSuccessText}>{generationNote}</Text></View>
      ) : null}
      {generationError ? (
        <View style={styles.generationError}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <View style={styles.generationErrorCopy}><Text style={styles.generationErrorTitle}>We couldn’t finish the itinerary</Text><Text style={styles.generationErrorBody}>{generationError} Your saved places have not been removed.</Text></View>
          <Pressable onPress={() => generateItinerary()} disabled={generating} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></Pressable>
        </View>
      ) : null}

      {trip.itinerary.length ? (
        <>
          {pendingSavedAttractions.length ? (
            <View style={styles.pendingPicks}>
              <View style={styles.pendingPicksHeading}>
                <View style={styles.pendingPicksIcon}><Ionicons name="bookmark" size={17} color={colors.primaryDark} /></View>
                <View style={styles.pendingPicksCopy}>
                  <Text style={styles.pendingPicksTitle}>{pendingSavedAttractions.length} saved place{pendingSavedAttractions.length === 1 ? " is" : "s are"} ready</Text>
                  <Text style={styles.pendingPicksBody} numberOfLines={2}>{pendingSavedAttractions.slice(0, 3).map((saved) => saved.attraction_name).join(" · ")}{pendingSavedAttractions.length > 3 ? ` · +${pendingSavedAttractions.length - 3} more` : ""}</Text>
                </View>
              </View>
              <Button
                onPress={() => generateItinerary({ instruction: "Add every newly saved place to the itinerary. Preserve all existing traveler picks, completed or skipped stops, and manual edits; adjust only AI suggestions as needed." })}
                loading={generating}
                disabled={offline}
              >
                Add {pendingSavedAttractions.length === 1 ? "place" : `all ${pendingSavedAttractions.length}`} to itinerary
              </Button>
            </View>
          ) : null}
          <View style={styles.planActions}>
            <View style={styles.planAction}><Button variant={pendingSavedAttractions.length ? "secondary" : "primary"} onPress={findPlaces}>Find more places</Button></View>
            <View style={styles.planAction}><Button variant="secondary" onPress={() => generateItinerary()} loading={generating} disabled={offline}>Rebuild plan</Button></View>
          </View>
          <View style={styles.dayTabs}>
            {trip.itinerary.map((itineraryDay, index) => (
              <Pressable key={`${itineraryDay.date}-${index}`} onPress={() => setSelectedDay(index)} style={[styles.dayTab, selectedDay === index && styles.dayTabActive]}>
                <Text style={[styles.dayNumber, selectedDay === index && styles.dayNumberActive]}>Day {index + 1}</Text>
                <Text style={[styles.dayDate, selectedDay === index && styles.dayDateActive]}>{formatDayLabel(itineraryDay.date).split(",")[0]}</Text>
              </Pressable>
            ))}
          </View>

          {abovePace ? (
            <View style={styles.paceWarning}>
              <Ionicons name="speedometer-outline" size={22} color={colors.warning} />
              <View style={styles.warningCopy}>
                <Text style={styles.warningTitle}>This day is above your {pace} pace</Text>
                <Text style={styles.warningBody}>We kept all {day?.items.length} stops. Consider moving one to another day if your family needs more breathing room.</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.itineraryHeading}>
            <View>
              <Eyebrow>Day {selectedDay + 1}</Eyebrow>
              <Text style={styles.dayHeading}>{day ? formatDayLabel(day.date) : ""}</Text>
            </View>
            <Text style={styles.stopCount}>{day?.items.length ?? 0} stops</Text>
          </View>
          {day ? (
            <View style={styles.dayActions}>
              <Pressable onPress={() => generateItinerary({ dayDate: day.date, dayInstruction: "Refresh this day with a realistic mix while preserving every traveler pick and manual edit that must remain." })} disabled={generating || offline} style={styles.dayAction}>
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} /><Text style={styles.dayActionText}>Refresh day</Text>
              </Pressable>
              <Pressable onPress={() => generateItinerary({ dayDate: day.date, dayInstruction: "Optimize this day's geographic order and travel flow while preserving every traveler pick." })} disabled={generating || offline} style={styles.dayAction}>
                <Ionicons name="git-branch-outline" size={16} color={colors.primary} /><Text style={styles.dayActionText}>Optimize route</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.items}>
            {day?.items.map((item, index) => {
              const status = itemStatus(item)
              const itemImage = getItemImage(item)
              return (
                <Card key={item.id} style={styles.itemCard}>
                  {itemImage ? <Image source={remoteImageSource(itemImage, session?.access_token)} style={styles.itemImage} /> : null}
                  <View style={styles.itemBody}>
                    <View style={styles.timeline}>
                      <View style={styles.timelineDot} />
                      {index < day.items.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={styles.itemContent}>
                    <Text style={styles.itemTime}>{item.start_time} – {item.end_time}</Text>
                    <Text style={styles.itemTitle}>{item.attraction_name}</Text>
                    <View style={[styles.itemBadge, { backgroundColor: status.background }]}><Text style={[styles.itemBadgeText, { color: status.color }]}>{status.label}</Text></View>
                    {item.fit_signals?.length ? (
                      <View style={styles.fitSignals}>{item.fit_signals.slice(0, 3).map((signal) => <Text key={signal} style={styles.fitSignal}>{signal}</Text>)}</View>
                    ) : null}
                    {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
                    <View style={styles.itemFooter}>
                      <Pressable onPress={() => openDirections(item)} style={styles.directions}><Ionicons name="navigate-outline" size={16} color={colors.primary} /><Text style={styles.directionsText}>Directions</Text></Pressable>
                      <View style={styles.itemControls}>
                        <Pressable accessibilityLabel="Move stop earlier" disabled={index === 0 || saving} onPress={() => persistItinerary(reorderItineraryItem(trip.itinerary, selectedDay, item.id, -1))} style={[styles.itemControl, index === 0 && styles.itemControlDisabled]}><Ionicons name="arrow-up" size={17} color={colors.textMuted} /></Pressable>
                        <Pressable accessibilityLabel="Move stop later" disabled={index === day.items.length - 1 || saving} onPress={() => persistItinerary(reorderItineraryItem(trip.itinerary, selectedDay, item.id, 1))} style={[styles.itemControl, index === day.items.length - 1 && styles.itemControlDisabled]}><Ionicons name="arrow-down" size={17} color={colors.textMuted} /></Pressable>
                        <Pressable accessibilityLabel="Edit stop" disabled={saving} onPress={() => openStopEditor(item)} style={styles.itemControl}><Ionicons name="create-outline" size={18} color={colors.primary} /></Pressable>
                      </View>
                    </View>
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        </>
      ) : (
        <View style={styles.planningCard}>
          <Eyebrow>Build your itinerary</Eyebrow>
          <Text style={styles.planningTitle}>Turn saved places into a day-by-day story.</Text>
          <Text style={styles.planningBody}>Choose at least three places. VibeTravel will organize them around your family’s pace, interests, and practical needs.</Text>
          <View style={styles.savedProgressRow}>
            <Text style={styles.savedProgress}>{savedAttractions.length} saved</Text>
            <Text style={styles.savedNeeded}>{Math.max(3 - savedAttractions.length, 0)} more to unlock</Text>
          </View>
          <View style={styles.savedTrack}><View style={[styles.savedFill, { width: `${Math.min((savedAttractions.length / 3) * 100, 100)}%` }]} /></View>
          {savedAttractions.length ? (
            <View style={styles.savedList}>
              {savedAttractions.map((saved) => (
                <View key={saved.id} style={styles.savedPlace}>
                  {saved.attraction_data.imageUrl ? <Image source={remoteImageSource(saved.attraction_data.imageUrl, session?.access_token)} style={styles.savedImage} /> : <View style={styles.savedImageFallback}><Ionicons name="location" size={16} color={colors.primary} /></View>}
                  <Text style={styles.savedName} numberOfLines={1}>{saved.attraction_name}</Text>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                </View>
              ))}
            </View>
          ) : null}
          <Button onPress={findPlaces} variant={savedAttractions.length >= 3 ? "secondary" : "primary"} style={styles.planningButton}>Find places in {trip.destination.split(",")[0]}</Button>
          {savedAttractions.length >= 3 ? <Button onPress={() => generateItinerary()} loading={generating} disabled={offline}>Generate my itinerary with all {savedAttractions.length} picks</Button> : null}
        </View>
      )}
    </Screen>
    <Modal visible={Boolean(editingStop)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingStop(null)}>
      <SafeAreaView style={styles.editorSafe}>
        <View style={styles.editorHeader}>
          <View style={styles.editorHeaderCopy}><Eyebrow>Edit itinerary stop</Eyebrow><Text style={styles.editorTitle}>{editingStop?.item.attraction_name}</Text></View>
          <Pressable accessibilityLabel="Close editor" onPress={() => setEditingStop(null)} style={styles.editorClose}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
        </View>
        <KeyboardAvoidingView style={styles.editorKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.editorBody} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
          <Text style={styles.editorLabel}>Time</Text>
          <View style={styles.timeInputs}>
            <TextInput value={editStartTime} onChangeText={setEditStartTime} placeholder="09:00" style={styles.timeInput} keyboardType="numbers-and-punctuation" />
            <Text style={styles.timeSeparator}>to</Text>
            <TextInput value={editEndTime} onChangeText={setEditEndTime} placeholder="10:30" style={styles.timeInput} keyboardType="numbers-and-punctuation" />
          </View>
          <Text style={styles.editorLabel}>Move to day</Text>
          <View style={styles.editorDays}>
            {trip.itinerary.map((candidate, index) => (
              <Pressable key={candidate.date} onPress={() => setEditTargetDay(index)} style={[styles.editorDay, editTargetDay === index && styles.editorDayActive]}><Text style={[styles.editorDayText, editTargetDay === index && styles.editorDayTextActive]}>Day {index + 1}</Text></Pressable>
            ))}
          </View>
          <Text style={styles.editorLabel}>Notes</Text>
          <TextInput value={editNotes} onChangeText={setEditNotes} placeholder="Add practical notes for your family" multiline style={styles.notesInput} />
          <Button onPress={saveStopEdits} loading={saving} disabled={!editStartTime.trim() || !editEndTime.trim()}>Save changes</Button>
          <Button variant="danger" onPress={confirmRemoveStop} disabled={saving}>Remove stop</Button>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 6 },
  tripHero: { minHeight: 390, borderRadius: 28, overflow: "hidden", justifyContent: "space-between", padding: 18, ...shadows.floating },
  tripHeroImage: { borderRadius: 28 },
  tripHeroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.42)" },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  statusPillText: { color: colors.primaryDark, fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  heroCopy: { paddingTop: 80 },
  heroOverline: { color: "#FF9B68", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#FFFFFF", fontSize: 38, lineHeight: 43, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  destination: { color: "rgba(255,255,255,0.86)", fontSize: 15, fontWeight: "800", marginTop: 7 },
  dates: { color: "rgba(255,255,255,0.66)", fontSize: 13, marginTop: 4 },
  shareButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  startMode: { marginTop: 2 },
  generationSuccess: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 13, backgroundColor: colors.successSoft, borderRadius: 12 },
  generationSuccessText: { flex: 1, color: colors.success, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  generationError: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, backgroundColor: colors.dangerSoft, borderRadius: 12 },
  generationErrorCopy: { flex: 1 },
  generationErrorTitle: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  generationErrorBody: { color: colors.danger, fontSize: 11, lineHeight: 17, marginTop: 3 },
  retryButton: { minHeight: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  retryButtonText: { color: colors.danger, fontSize: 11, fontWeight: "800" },
  pendingPicks: { gap: 13, borderRadius: 18, borderWidth: 1, borderColor: "#D8C3B6", backgroundColor: "#F7F0EA", padding: 16 },
  pendingPicksHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  pendingPicksIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EAD8CC", alignItems: "center", justifyContent: "center" },
  pendingPicksCopy: { flex: 1 },
  pendingPicksTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  pendingPicksBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  planActions: { flexDirection: "row", gap: 10 },
  planAction: { flex: 1 },
  dayTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayTab: { minWidth: 65, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.surface },
  dayTabActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  dayNumber: { color: colors.text, fontSize: 12, fontWeight: "800" },
  dayNumberActive: { color: "#FFFFFF" },
  dayDate: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  dayDateActive: { color: "rgba(255,255,255,0.65)" },
  paceWarning: { flexDirection: "row", gap: 12, borderRadius: 16, padding: 15, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: "#F2D28B" },
  warningCopy: { flex: 1 },
  warningTitle: { color: colors.warning, fontSize: 14, fontWeight: "800", textTransform: "capitalize" },
  warningBody: { color: colors.warning, fontSize: 12, lineHeight: 18, marginTop: 3 },
  itineraryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayActions: { flexDirection: "row", gap: 9 },
  dayAction: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dayActionText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  dayHeading: { color: colors.text, fontSize: 23, fontFamily: typography.serif, fontWeight: "700", marginTop: 2 },
  stopCount: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  items: { gap: 10 },
  itemCard: { padding: 0, overflow: "hidden" },
  itemImage: { width: "100%", height: 170, backgroundColor: colors.surfaceMuted },
  itemBody: { flexDirection: "row", padding: 16 },
  timeline: { width: 22, alignItems: "center", marginRight: 10 },
  timelineDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary, marginTop: 5 },
  timelineLine: { width: 2, flex: 1, minHeight: 80, backgroundColor: colors.border, marginTop: 4, marginBottom: -28 },
  itemContent: { flex: 1 },
  itemTime: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  itemTitle: { color: colors.text, fontSize: 20, lineHeight: 25, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  itemBadge: { alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
  itemBadgeText: { fontSize: 10, fontWeight: "800" },
  fitSignals: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  fitSignal: { color: colors.textMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9 },
  itemNotes: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  itemFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 },
  directions: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  directionsText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  itemControls: { flexDirection: "row", gap: 5 },
  itemControl: { width: 38, height: 38, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  itemControlDisabled: { opacity: 0.35 },
  modePage: { paddingTop: 12 },
  modeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modeTitle: { color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 3 },
  closeMode: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  activeCard: { padding: 22 },
  activeTime: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  activeTitle: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: "800", marginTop: 8 },
  activeNotes: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: 12 },
  modeButton: { marginTop: 22 },
  modeActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  modeAction: { flex: 1 },
  progressText: { color: colors.textMuted, textAlign: "center", fontSize: 12, fontWeight: "700" },
  planningCard: { borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20, ...shadows.card },
  planningTitle: { color: colors.text, fontSize: 27, lineHeight: 33, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  planningBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  savedProgressRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  savedProgress: { color: colors.text, fontSize: 12, fontWeight: "800" },
  savedNeeded: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  savedTrack: { height: 7, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: "hidden", marginTop: 8 },
  savedFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  savedList: { gap: 8, marginTop: 17 },
  savedPlace: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 15, backgroundColor: colors.background, padding: 8 },
  savedImage: { width: 38, height: 38, borderRadius: 11 },
  savedImageFallback: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  savedName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  planningButton: { marginTop: 18, marginBottom: 10 },
  editorSafe: { flex: 1, backgroundColor: colors.background },
  editorKeyboard: { flex: 1 },
  editorHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  editorHeaderCopy: { flex: 1, paddingRight: 16 },
  editorTitle: { color: colors.text, fontSize: 27, lineHeight: 32, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  editorClose: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  editorBody: { padding: 20, gap: 14 },
  editorLabel: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: 3 },
  timeInputs: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeInput: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 13, fontSize: 15 },
  timeSeparator: { color: colors.textMuted, fontSize: 12 },
  editorDays: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  editorDay: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  editorDayActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  editorDayText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  editorDayTextActive: { color: "#FFFFFF" },
  notesInput: { minHeight: 110, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, color: colors.text, padding: 13, fontSize: 14, textAlignVertical: "top" },
})
