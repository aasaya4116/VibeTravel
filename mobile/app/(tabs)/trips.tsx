import { Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { EmptyState, Eyebrow, LoadingScreen, OfflineBanner, Screen } from "@/components/ui"
import { formatTripDates } from "@/lib/format"
import { colors } from "@/lib/theme"
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
              <View style={styles.tripTop}>
                <View style={[styles.badge, trip.status === "active" && styles.badgeActive]}>
                  <Text style={[styles.badgeText, trip.status === "active" && styles.badgeTextActive]}>{trip.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <Text style={styles.tripTitle}>{trip.title}</Text>
              <Text style={styles.destination}>{trip.destination}</Text>
              <Text style={styles.dates}>{formatTripDates(trip.start_date, trip.end_date)}</Text>
              <View style={styles.tripFooter}>
                <Text style={styles.days}>{trip.itinerary?.length ?? 0} planned days</Text>
                <Text style={styles.open}>Open trip</Text>
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
  title: { color: colors.text, fontSize: 32, fontWeight: "800", marginTop: 3 },
  addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  list: { gap: 12 },
  trip: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 18 },
  pressed: { opacity: 0.75 },
  tripTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { alignSelf: "flex-start", backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeText: { color: colors.primaryDark, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  badgeTextActive: { color: colors.success },
  tripTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 15 },
  destination: { color: colors.textMuted, fontSize: 14, fontWeight: "700", marginTop: 4 },
  dates: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  tripFooter: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, marginTop: 17, paddingTop: 13 },
  days: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  open: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
})
