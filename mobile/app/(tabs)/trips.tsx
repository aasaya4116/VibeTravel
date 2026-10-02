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
          <Ionicons name="add" size={24} color="#FFFFFF" />
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
                <Text style={styles.open}>Open trip →</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { color: colors.text, fontSize: 35, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  list: { gap: 12 },
  trip: { backgroundColor: colors.surface, borderRadius: 26, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadows.card },
  pressed: { opacity: 0.75 },
  tripImage: { height: 285, justifyContent: "space-between", padding: 17 },
  tripImageRadius: { borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  tripShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.38)" },
  tripTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeText: { color: colors.primaryDark, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  badgeTextActive: { color: colors.success },
  openCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.32)", alignItems: "center", justifyContent: "center" },
  tripCopy: { paddingTop: 50 },
  tripTitle: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontFamily: typography.serif, fontWeight: "700" },
  destination: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "700", marginTop: 5 },
  dates: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 4 },
  tripFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  footerLabel: { color: colors.textMuted, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  days: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  open: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
})
