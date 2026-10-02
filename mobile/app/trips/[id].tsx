import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Stack, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Button, Card, EmptyState, Eyebrow, LoadingScreen, OfflineBanner, Screen } from "@/components/ui"
import { formatDayLabel, formatTripDates } from "@/lib/format"
import { loadTrip, saveItinerary } from "@/lib/data"
import { colors } from "@/lib/theme"
import type { ItineraryItem, Trip } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"
import { useDashboard } from "@/hooks/use-dashboard"

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? siteUrl
const paceLimits = { slow: 3, moderate: 4, fast: 6 } as const

function itemStatus(item: ItineraryItem) {
  if (item.status === "completed") return { label: "Complete", color: colors.success, background: colors.successSoft }
  if (item.status === "skipped") return { label: "Skipped", color: colors.textMuted, background: colors.surfaceMuted }
  if (item.recommended) return { label: "Optional", color: colors.success, background: colors.successSoft }
  return { label: "Your pick", color: colors.primaryDark, background: colors.primarySoft }
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, session } = useAuth()
  const dashboard = useDashboard()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [selectedDay, setSelectedDay] = useState(0)
  const [tripMode, setTripMode] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (!user || !id) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await loadTrip(user.id, id)
      setTrip(result.trip)
      setOffline(result.offline)
      setSelectedDay((current) => Math.min(current, Math.max(0, result.trip.itinerary.length - 1)))
    } catch (error) {
      Alert.alert("Trip unavailable", error instanceof Error ? error.message : "Please reconnect and try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, user])

  useEffect(() => {
    load()
  }, [load])

  const day = trip?.itinerary?.[selectedDay]
  const activeItem = useMemo(() => day?.items.find((item) => !item.status || item.status === "planned"), [day])
  const pace = dashboard.data?.familyVibe?.pace ?? "moderate"
  const abovePace = Boolean(day && day.items.length > paceLimits[pace])

  async function updateStatus(itemId: string, status: "completed" | "skipped") {
    if (!trip || !user || offline) return
    const itinerary = trip.itinerary.map((currentDay, dayIndex) => dayIndex === selectedDay
      ? { ...currentDay, items: currentDay.items.map((item) => item.id === itemId ? { ...item, status } : item) }
      : currentDay)
    setSaving(true)
    try {
      setTrip(await saveItinerary(user.id, trip, itinerary))
    } catch (error) {
      Alert.alert("Change not saved", error instanceof Error ? error.message : "Reconnect and try again.")
    } finally {
      setSaving(false)
    }
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
    <Screen refreshing={refreshing} onRefresh={() => load(true)} contentStyle={styles.page}>
      <Stack.Screen options={{ title: trip.destination }} />
      {offline ? <OfflineBanner /> : null}
      <View style={styles.tripHeader}>
        <View style={styles.headerCopy}>
          <Eyebrow>{trip.status}</Eyebrow>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.destination}>{trip.destination}</Text>
          <Text style={styles.dates}>{formatTripDates(trip.start_date, trip.end_date)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Share trip" onPress={shareTrip} disabled={sharing || offline} style={styles.shareButton}>
          <Ionicons name="share-outline" size={21} color={colors.primary} />
        </Pressable>
      </View>

      <Button onPress={() => setTripMode(true)} disabled={!day?.items.length} style={styles.startMode}>Start Trip Mode</Button>

      {trip.itinerary.length ? (
        <>
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

          <View style={styles.items}>
            {day?.items.map((item, index) => {
              const status = itemStatus(item)
              return (
                <Card key={item.id} style={styles.itemCard}>
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
                    <Pressable onPress={() => openDirections(item)} style={styles.directions}><Ionicons name="navigate-outline" size={16} color={colors.primary} /><Text style={styles.directionsText}>Directions</Text></Pressable>
                  </View>
                </Card>
              )
            })}
          </View>
        </>
      ) : (
        <EmptyState
          title="This trip needs an itinerary"
          body="Open the full planner to discover places and build a personalized schedule. It will appear here automatically."
          action={<Button onPress={() => Linking.openURL(`${siteUrl}/trips/${trip.id}`)}>Open full planner</Button>}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 6 },
  tripHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: "800", marginTop: 4 },
  destination: { color: colors.primary, fontSize: 15, fontWeight: "800", marginTop: 7 },
  dates: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  shareButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  startMode: { marginTop: 2 },
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
  dayHeading: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  stopCount: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  items: { gap: 10 },
  itemCard: { flexDirection: "row", padding: 16 },
  timeline: { width: 22, alignItems: "center", marginRight: 10 },
  timelineDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary, marginTop: 5 },
  timelineLine: { width: 2, flex: 1, minHeight: 80, backgroundColor: colors.border, marginTop: 4, marginBottom: -28 },
  itemContent: { flex: 1 },
  itemTime: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  itemTitle: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: "800", marginTop: 4 },
  itemBadge: { alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
  itemBadgeText: { fontSize: 10, fontWeight: "800" },
  fitSignals: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  fitSignal: { color: colors.textMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9 },
  itemNotes: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  directions: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12, alignSelf: "flex-start" },
  directionsText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
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
})
