import { useState } from "react"
import { Alert, Pressable, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { EmptyState, Eyebrow, LoadingScreen, OfflineBanner, Screen } from "@/components/ui"
import { Text } from "@/components/typography"
import { RemoteImageBackground } from "@/components/remote-image"
import { formatTripDates } from "@/lib/format"
import { getTripImage } from "@/lib/destinations"
import { colors, shadows, typography } from "@/lib/theme"
import { useDashboard } from "@/hooks/use-dashboard"
import { useAuth } from "@/providers/auth-provider"
import { deleteTrip } from "@/lib/data"
import type { Trip } from "@/lib/types"

export default function TripsScreen() {
  const { session } = useAuth()
  const { data, loading, refreshing, error, refresh } = useDashboard()
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
  if (loading && !data) return <LoadingScreen label="Opening your trips…" />

  async function removeTrip(trip: Trip) {
    if (!session?.user) return
    setDeletingTripId(trip.id)
    try {
      await deleteTrip(session.user.id, trip.id)
      await refresh(true)
    } catch (caught) {
      Alert.alert("Trip not deleted", caught instanceof Error ? caught.message : "Check your connection and try again.")
    } finally {
      setDeletingTripId(null)
    }
  }

  function confirmDeleteTrip(trip: Trip) {
    if (data?.offline) {
      Alert.alert("Reconnect to delete", "Deleting a trip requires an internet connection. Your trip is still available offline.")
      return
    }
    Alert.alert(
      `Delete ${trip.title}?`,
      "This permanently removes the itinerary, readiness details, and private share link. Your saved places are not deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete trip", style: "destructive", onPress: () => void removeTrip(trip) },
      ]
    )
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => refresh(true)} contentStyle={styles.page}>
      <View style={styles.header}>
        <View>
          <Eyebrow>Your adventures</Eyebrow>
          <Text style={styles.title}>Trips</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Create a trip" onPress={() => router.push("/trips/new")} style={styles.addButton}>
          <Text style={styles.addButtonText}>New trip</Text>
          <Ionicons name="add" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
      {data?.offline ? <OfflineBanner /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {(data?.trips.length ?? 0) === 0 ? (
        <EmptyState title="No trips yet" body="Create your first family adventure and it will stay available here on the road." />
      ) : (
        <View style={styles.list}>
          {data?.trips.map((trip) => (
            <Pressable
              key={trip.id}
              onPress={() => router.push({ pathname: "/trips/[id]", params: { id: trip.id } })}
              style={({ pressed }) => [styles.trip, pressed && styles.pressed]}
            >
              <RemoteImageBackground uri={getTripImage(trip.destination)} accessToken={session?.access_token} preset="hero" style={styles.tripImage} imageStyle={styles.tripImageRadius}>
                <View style={styles.tripShade} />
                <View style={styles.tripTop}>
                  <View style={[styles.badge, trip.status === "active" && styles.badgeActive]}>
                    <Text style={[styles.badgeText, trip.status === "active" && styles.badgeTextActive]}>{trip.status}</Text>
                  </View>
                  <View style={styles.tripActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${trip.title}`}
                      accessibilityHint="Opens a confirmation before permanently deleting this trip"
                      accessibilityState={{ busy: deletingTripId === trip.id, disabled: deletingTripId !== null }}
                      disabled={deletingTripId !== null}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation()
                        confirmDeleteTrip(trip)
                      }}
                      style={({ pressed }) => [styles.deleteCircle, pressed && styles.actionPressed, deletingTripId === trip.id && styles.actionDisabled]}
                    >
                      <Ionicons name={deletingTripId === trip.id ? "hourglass-outline" : "trash-outline"} size={16} color="#FFFFFF" />
                    </Pressable>
                    <View style={styles.openCircle}><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></View>
                  </View>
                </View>
                <View style={styles.tripCopy}>
                  <Text style={styles.tripTitle}>{trip.title}</Text>
                  <Text style={styles.destination}>{trip.destination}</Text>
                  <Text style={styles.dates}>{formatTripDates(trip.start_date, trip.end_date)}</Text>
                </View>
              </RemoteImageBackground>
              <View style={styles.tripFooter}>
                <View><Text style={styles.footerLabel}>TRIP PLAN</Text><Text style={styles.days}>Open to view itinerary</Text></View>
                <Text style={styles.open}>Open trip  →</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 10, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { color: colors.text, fontSize: 35, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  addButton: { minHeight: 42, borderRadius: 7, paddingHorizontal: 14, backgroundColor: colors.dark, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  list: { gap: 24 },
  trip: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 6 },
  pressed: { opacity: 0.75 },
  tripImage: { height: 300, justifyContent: "space-between", padding: 17, borderRadius: 8, overflow: "hidden", ...shadows.card },
  tripImageRadius: { borderRadius: 8 },
  tripShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  tripTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tripActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { alignSelf: "flex-start", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.7)" },
  badgeActive: { borderBottomColor: "#A9C6B8" },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 },
  badgeTextActive: { color: "#D9E9E0" },
  openCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  deleteCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "rgba(103,20,20,0.44)", alignItems: "center", justifyContent: "center" },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  actionDisabled: { opacity: 0.55 },
  tripCopy: { paddingTop: 50 },
  tripTitle: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontFamily: typography.serif, fontWeight: "700" },
  destination: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "700", marginTop: 5 },
  dates: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 4 },
  tripFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13 },
  footerLabel: { color: colors.textMuted, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  days: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  open: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
})
