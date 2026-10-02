import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { EmptyState, Eyebrow, LoadingScreen, OfflineBanner, Screen } from "@/components/ui"
import { formatTripDates } from "@/lib/format"
import { getTripImage } from "@/lib/destinations"
import { colors, shadows, typography } from "@/lib/theme"
import { useDashboard } from "@/hooks/use-dashboard"

export default function TripsScreen() {
  const { data, loading, refreshing, error, refresh } = useDashboard()
  if (loading && !data) return <LoadingScreen label="Opening your trips…" />

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
              <ImageBackground source={{ uri: getTripImage(trip.destination) }} style={styles.tripImage} imageStyle={styles.tripImageRadius}>
                <View style={styles.tripShade} />
                <View style={styles.tripTop}>
                  <View style={[styles.badge, trip.status === "active" && styles.badgeActive]}>
                    <Text style={[styles.badgeText, trip.status === "active" && styles.badgeTextActive]}>{trip.status}</Text>
                  </View>
                  <View style={styles.openCircle}><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></View>
                </View>
                <View style={styles.tripCopy}>
                  <Text style={styles.tripTitle}>{trip.title}</Text>
                  <Text style={styles.destination}>{trip.destination}</Text>
                  <Text style={styles.dates}>{formatTripDates(trip.start_date, trip.end_date)}</Text>
                </View>
              </ImageBackground>
              <View style={styles.tripFooter}>
                <View><Text style={styles.footerLabel}>ITINERARY</Text><Text style={styles.days}>{trip.itinerary?.length ?? 0} planned days</Text></View>
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
  badge: { alignSelf: "flex-start", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.7)" },
  badgeActive: { borderBottomColor: "#A9C6B8" },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 },
  badgeTextActive: { color: "#D9E9E0" },
  openCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
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
