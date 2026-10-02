import { useMemo } from "react"
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Card, EmptyState, Eyebrow, LoadingScreen, OfflineBanner, Screen } from "@/components/ui"
import { formatTripDates, getDaysUntil } from "@/lib/format"
import { getReadinessPercent } from "@/lib/data"
import { destinationCards, getTripImage } from "@/lib/destinations"
import { colors, radii, shadows, typography } from "@/lib/theme"
import type { Trip } from "@/lib/types"
import { useDashboard } from "@/hooks/use-dashboard"

function chooseNextTrip(trips: Trip[]) {
  const available = trips.filter((trip) => trip.status !== "completed")
  return available.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1
    if (b.status === "active" && a.status !== "active") return 1
    return (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999")
  })[0]
}

export default function TodayScreen() {
  const { data, loading, refreshing, error, refresh } = useDashboard()
  const nextTrip = useMemo(() => chooseNextTrip(data?.trips ?? []), [data?.trips])

  if (loading && !data) return <LoadingScreen label="Loading your next adventure…" />

  const daysUntil = getDaysUntil(nextTrip?.start_date ?? null)
  const readiness = nextTrip ? getReadinessPercent(data?.readinessByTrip[nextTrip.id], nextTrip.itinerary ?? []) : 0
  const firstName = data?.profile?.display_name?.split(" ")[0] ?? "traveler"

  return (
    <Screen refreshing={refreshing} onRefresh={() => refresh(true)} contentStyle={styles.page}>
      <View style={styles.header}>
        <View>
          <Eyebrow>Your travel world</Eyebrow>
          <Text style={styles.title}>Good to see you, {firstName}.</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{firstName[0]?.toUpperCase()}</Text></View>
      </View>

      {data?.offline ? <OfflineBanner /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {nextTrip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${nextTrip.title}`}
          onPress={() => router.push({ pathname: "/trips/[id]", params: { id: nextTrip.id } })}
          style={({ pressed }) => [styles.heroShell, pressed && styles.pressed]}
        >
          <ImageBackground source={{ uri: getTripImage(nextTrip.destination) }} style={styles.hero} imageStyle={styles.heroImage}>
            <View style={styles.heroShade} />
            <View style={styles.heroTop}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{nextTrip.status === "active" ? "In progress" : daysUntil != null && daysUntil >= 0 ? `${daysUntil} days to go` : "Planning"}</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={30} color="#FFFFFF" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroOverline}>YOUR NEXT STORY</Text>
              <Text style={styles.heroTitle}>{nextTrip.title}</Text>
              <Text style={styles.heroDestination}>{nextTrip.destination}</Text>
              <Text style={styles.heroDates}>{formatTripDates(nextTrip.start_date, nextTrip.end_date)}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${readiness}%` }]} />
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.heroMeta}>{readiness}% ready</Text>
                <Text style={styles.heroMeta}>{nextTrip.itinerary?.length ?? 0} planned days</Text>
              </View>
            </View>
          </ImageBackground>
        </Pressable>
      ) : (
        <EmptyState
          title="Your next adventure starts here"
          body="Create a trip, then keep the complete plan with you on the road."
          action={<Pressable onPress={() => router.push("/trips/new")} style={styles.primaryAction}><Text style={styles.primaryActionText}>Plan a trip</Text></Pressable>}
        />
      )}

      <View style={styles.sectionHeading}>
        <View><Eyebrow>Chosen for your vibe</Eyebrow><Text style={styles.sectionTitle}>Where next?</Text></View>
        <Pressable onPress={() => router.push("/explore" as never)}><Text style={styles.browseAll}>Browse all</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail}>
        {destinationCards.slice(0, 5).map((destination) => (
          <Pressable
            key={destination.slug}
            onPress={() => router.push({ pathname: "/explore", params: { destination: destination.destination } } as never)}
            style={({ pressed }) => [styles.destinationCard, pressed && styles.pressed]}
          >
            <Image source={{ uri: destination.imageUrl }} style={styles.destinationImage} />
            <View style={styles.destinationShade} />
            <View style={styles.destinationCopy}>
              <Text style={styles.destinationName}>{destination.name}</Text>
              <Text style={styles.destinationReason} numberOfLines={2}>{destination.headline}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Made for the moment</Text>
      <View style={styles.quickGrid}>
        <Card style={styles.quickCard}>
          <Ionicons name="navigate-circle-outline" size={27} color={colors.primary} />
          <Text style={styles.quickTitle}>Trip Mode</Text>
          <Text style={styles.quickBody}>One stop at a time with directions and check-offs.</Text>
        </Card>
        <Card style={styles.quickCard}>
          <Ionicons name="cloud-offline-outline" size={27} color={colors.success} />
          <Text style={styles.quickTitle}>Offline ready</Text>
          <Text style={styles.quickBody}>Recently opened trips remain available without a signal.</Text>
        </Card>
      </View>

      {data?.familyVibe ? (
        <Card>
          <View style={styles.cardHeading}>
            <View>
              <Eyebrow>Your family vibe</Eyebrow>
              <Text style={styles.cardTitle}>{data.familyVibe.family_name || "Personalized for your crew"}</Text>
            </View>
            <Ionicons name="sparkles-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.chips}>
            {data.familyVibe.travel_style.slice(0, 4).map((style) => (
              <View key={style} style={styles.chip}><Text style={styles.chipText}>{style}</Text></View>
            ))}
            <View style={styles.chip}><Text style={styles.chipText}>{data.familyVibe.pace} pace</Text></View>
          </View>
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { color: colors.text, fontSize: 31, lineHeight: 36, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  avatar: { width: 43, height: 43, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primary, fontSize: 17, fontWeight: "800" },
  heroShell: { borderRadius: 28, overflow: "hidden", ...shadows.floating },
  hero: { minHeight: 390, justifyContent: "space-between" },
  heroImage: { borderRadius: 28 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(13,11,9,0.42)" },
  heroTop: { position: "absolute", left: 22, right: 22, top: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF9B68" },
  statusText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  heroCopy: { padding: 22, backgroundColor: "rgba(0,0,0,0.22)" },
  heroOverline: { color: "#FF9B68", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "#FFFFFF", fontSize: 35, lineHeight: 40, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  heroDestination: { color: "#F2D8C9", fontSize: 15, fontWeight: "700", marginTop: 5 },
  heroDates: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 5 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 22, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#FF8852", borderRadius: 3 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  heroMeta: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 },
  sectionTitle: { color: colors.text, fontSize: 24, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  browseAll: { color: colors.primary, fontSize: 12, fontWeight: "800", paddingBottom: 2 },
  destinationRail: { gap: 12, paddingRight: 18 },
  destinationCard: { width: 205, height: 250, borderRadius: 23, overflow: "hidden", backgroundColor: colors.dark },
  destinationImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  destinationShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.3)" },
  destinationCopy: { position: "absolute", left: 16, right: 16, bottom: 16 },
  destinationName: { color: "#FFFFFF", fontSize: 27, fontFamily: typography.serif, fontWeight: "700" },
  destinationReason: { color: "rgba(255,255,255,0.72)", fontSize: 11, lineHeight: 16, marginTop: 4 },
  quickGrid: { flexDirection: "row", gap: 12 },
  quickCard: { flex: 1, minHeight: 165, padding: 16 },
  quickTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 13 },
  quickBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: "800", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chip: { backgroundColor: colors.primarySoft, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { color: colors.primaryDark, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  primaryAction: { backgroundColor: colors.primary, borderRadius: radii.medium, paddingHorizontal: 20, paddingVertical: 13 },
  primaryActionText: { color: "#FFFFFF", fontWeight: "800" },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
})
