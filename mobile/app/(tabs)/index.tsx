import { useMemo } from "react"
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { EmptyState, Eyebrow, LoadingScreen, OfflineBanner, Screen } from "@/components/ui"
import { formatTripDates, getDaysUntil } from "@/lib/format"
import { getReadinessPercent } from "@/lib/data"
import { destinationCards, getTripImage } from "@/lib/destinations"
import { remoteImageSource } from "@/lib/media"
import { colors, radii, shadows, typography } from "@/lib/theme"
import type { Trip } from "@/lib/types"
import { useDashboard } from "@/hooks/use-dashboard"
import { useAuth } from "@/providers/auth-provider"

function chooseNextTrip(trips: Trip[]) {
  const available = trips.filter((trip) => trip.status !== "completed")
  return available.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1
    if (b.status === "active" && a.status !== "active") return 1
    return (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999")
  })[0]
}

function HowItWorksHero({ accessToken }: { accessToken?: string | null }) {
  const image = destinationCards.find((destination) => destination.slug === "lisbon")?.imageUrl

  return (
    <ImageBackground source={remoteImageSource(image, accessToken)} style={styles.howHero} imageStyle={styles.howHeroImage}>
      <View style={styles.howHeroShade} />
      <View style={styles.howHeroCopy}>
        <Text style={styles.howEyebrow}>HOW VIBETRAVEL WORKS</Text>
        <Text style={styles.howTitle}>Your family’s rhythm, turned into a trip.</Text>
        <Text style={styles.howBody}>Tell us what feels right. Save the places you love. We shape them into days your family can actually enjoy.</Text>
        <View style={styles.howSteps}>
          {[
            ["01", "Set your vibe"],
            ["02", "Choose your places"],
            ["03", "Build a realistic plan"],
          ].map(([number, label]) => (
            <View key={number} style={styles.howStep}>
              <Text style={styles.howStepNumber}>{number}</Text>
              <Text style={styles.howStepLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore destinations matched to your family"
          onPress={() => router.push("/explore" as never)}
          style={({ pressed }) => [styles.howAction, pressed && styles.pressed]}
        >
          <Text style={styles.howActionText}>Explore your matches</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
    </ImageBackground>
  )
}

export default function TodayScreen() {
  const { session } = useAuth()
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
          <Text style={styles.title}>Where to next, {firstName}?</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{firstName[0]?.toUpperCase()}</Text></View>
      </View>

      {data?.offline ? <OfflineBanner /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan a new trip"
        onPress={() => router.push("/trips/new")}
        style={({ pressed }) => [styles.planAction, pressed && styles.pressed]}
      >
        <View style={styles.planActionCopy}>
          <Text style={styles.planActionLabel}>PLAN A NEW JOURNEY</Text>
          <Text style={styles.planActionTitle}>Where will your family go next?</Text>
        </View>
        <Ionicons name="arrow-forward" size={21} color="#FFFFFF" />
      </Pressable>

      {nextTrip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${nextTrip.title}`}
          onPress={() => router.push({ pathname: "/trips/[id]", params: { id: nextTrip.id } })}
          style={({ pressed }) => [styles.heroShell, pressed && styles.pressed]}
        >
          <ImageBackground source={remoteImageSource(getTripImage(nextTrip.destination), session?.access_token)} style={styles.hero} imageStyle={styles.heroImage}>
            <View style={styles.heroShade} />
            <View style={styles.heroTop}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{nextTrip.status === "active" ? "In progress" : daysUntil != null && daysUntil >= 0 ? `${daysUntil} days to go` : "Planning"}</Text>
              </View>
              <Text style={styles.heroCount}>{readiness}% READY</Text>
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
                <Text style={styles.heroMeta}>Open to view your full plan</Text>
              </View>
              <View style={styles.heroButton}>
                <Text style={styles.heroButtonText}>{nextTrip.status === "active" ? "Open trip mode" : "Continue planning"}</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
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
        <View><Eyebrow>Chosen for your vibe</Eyebrow><Text style={styles.sectionTitle}>Chosen for your family</Text></View>
        <Pressable onPress={() => router.push("/explore" as never)}><Text style={styles.browseAll}>View all</Text></Pressable>
      </View>
      <View style={styles.destinationList}>
        {destinationCards.slice(0, 3).map((destination) => (
          <Pressable
            key={destination.slug}
            onPress={() => router.push({ pathname: "/explore", params: { destination: destination.destination } } as never)}
            style={({ pressed }) => [styles.destinationRow, pressed && styles.pressed]}
          >
            <Image source={remoteImageSource(destination.imageUrl, session?.access_token)} style={styles.destinationImage} />
            <View style={styles.destinationCopy}>
              <Text style={styles.destinationName}>{destination.name}</Text>
              <Text style={styles.destinationReason} numberOfLines={1}>{destination.headline}</Text>
            </View>
            <Ionicons name="arrow-forward" size={17} color={colors.primary} />
          </Pressable>
        ))}
      </View>

      <HowItWorksHero accessToken={session?.access_token} />

      <View style={styles.editorialSection}>
        <Text style={styles.sectionTitle}>Travel with less friction</Text>
        <View style={styles.toolRow}>
          <Ionicons name="navigate-outline" size={20} color={colors.primary} />
          <View style={styles.toolCopy}><Text style={styles.toolTitle}>Trip Mode</Text><Text style={styles.toolBody}>Directions and check-offs, one stop at a time.</Text></View>
        </View>
        <View style={styles.toolRow}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.success} />
          <View style={styles.toolCopy}><Text style={styles.toolTitle}>Offline ready</Text><Text style={styles.toolBody}>Recently opened trips stay with you without a signal.</Text></View>
        </View>
      </View>

      {data?.familyVibe ? (
        <View style={styles.vibeSection}>
          <View style={styles.cardHeading}>
            <View>
              <Eyebrow>Your family vibe</Eyebrow>
              <Text style={styles.cardTitle}>{data.familyVibe.family_name || "Personalized for your crew"}</Text>
            </View>
            <Text style={styles.editLink}>Profile →</Text>
          </View>
          <View style={styles.chips}>
            {data.familyVibe.travel_style.slice(0, 4).map((style) => (
              <View key={style} style={styles.chip}><Text style={styles.chipText}>{style}</Text></View>
            ))}
            <View style={styles.chip}><Text style={styles.chipText}>{data.familyVibe.pace} pace</Text></View>
          </View>
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 10, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { color: colors.text, fontSize: 34, lineHeight: 38, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  planAction: { minHeight: 64, borderRadius: radii.medium, backgroundColor: colors.dark, paddingHorizontal: 17, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 13 },
  planActionCopy: { flex: 1 },
  planActionLabel: { color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "900", letterSpacing: 1.45 },
  planActionTitle: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontWeight: "700", marginTop: 3 },
  heroShell: { borderRadius: radii.medium, overflow: "hidden", ...shadows.floating },
  hero: { minHeight: 390, justifyContent: "space-between" },
  heroImage: { borderRadius: radii.medium },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(13,11,9,0.48)" },
  heroTop: { position: "absolute", left: 18, right: 18, top: 17, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#C77A59" },
  statusText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  heroCount: { color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  heroCopy: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 18, backgroundColor: "rgba(0,0,0,0.24)" },
  heroOverline: { color: "#C77A59", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "#FFFFFF", fontSize: 39, lineHeight: 43, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  heroDestination: { color: "#F2D8C9", fontSize: 15, fontWeight: "700", marginTop: 5 },
  heroDates: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 5 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 22, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#C77A59", borderRadius: 3 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  heroMeta: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  heroButton: { minHeight: 45, marginTop: 17, paddingHorizontal: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.5)", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  heroButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 23, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  browseAll: { color: colors.primary, fontSize: 11, fontWeight: "800", paddingBottom: 2 },
  destinationList: { marginTop: -8 },
  destinationRow: { minHeight: 87, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: 12 },
  destinationImage: { width: 76, height: 64, borderRadius: radii.small, backgroundColor: colors.surfaceMuted },
  destinationCopy: { flex: 1 },
  destinationName: { color: colors.text, fontSize: 20, fontFamily: typography.serif, fontWeight: "700" },
  destinationReason: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  howHero: { minHeight: 420, borderRadius: radii.medium, overflow: "hidden", justifyContent: "flex-end", ...shadows.floating },
  howHeroImage: { borderRadius: radii.medium },
  howHeroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(14,12,10,0.62)" },
  howHeroCopy: { padding: 20 },
  howEyebrow: { color: "#D99B7B", fontSize: 9, fontWeight: "900", letterSpacing: 1.65 },
  howTitle: { color: "#FFFFFF", fontSize: 34, lineHeight: 38, fontFamily: typography.serif, fontWeight: "700", marginTop: 7, maxWidth: 320 },
  howBody: { color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 19, marginTop: 10, maxWidth: 340 },
  howSteps: { marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.32)" },
  howStep: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.2)" },
  howStepNumber: { color: "#D99B7B", width: 24, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  howStepLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  howAction: { minHeight: 47, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  howActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  editorialSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 20 },
  toolRow: { flexDirection: "row", alignItems: "flex-start", gap: 13, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  toolCopy: { flex: 1 },
  toolTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  toolBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  vibeSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 20 },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 21, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  editLink: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chip: { backgroundColor: colors.primarySoft, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { color: colors.primaryDark, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  primaryAction: { backgroundColor: colors.dark, borderRadius: radii.medium, paddingHorizontal: 20, paddingVertical: 13 },
  primaryActionText: { color: "#FFFFFF", fontWeight: "800" },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12 },
})
