import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Button } from "@/components/ui"
import { Text } from "@/components/typography"
import { colors, radii, typography } from "@/lib/theme"

export type ItineraryGenerationMode = "building" | "error" | "draft"

export interface ItineraryGenerationViewProps {
  mode: ItineraryGenerationMode
  destination: string
  savedCount: number
  dayCount: number
  errorMessage?: string
  onRetry: () => void
  onReviewSavedPlaces: () => void
  onBackToTrip?: () => void
  active?: boolean
}

interface ItineraryGenerationModalProps extends Omit<ItineraryGenerationViewProps, "active"> {
  visible: boolean
}

const buildingStatuses = [
  "Anchoring your saved places…",
  "Adding family-fit stops…",
  "Balancing neighborhoods, meals, and downtime…",
  "Checking the day-by-day flow…",
]

function dayLabel(dayCount: number) {
  return `${dayCount} ${dayCount === 1 ? "day" : "days"}`
}

function savedPlaceLabel(savedCount: number) {
  return `${savedCount} saved ${savedCount === 1 ? "place" : "places"}`
}

function DaySkeleton({ index }: { index: number }) {
  return (
    <View style={styles.daySkeleton} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.daySkeletonHeading}>
        <View style={styles.daySkeletonLabel} />
        <Text style={styles.daySkeletonNumber}>DAY {index + 1}</Text>
      </View>
      {[0, 1].map((stop) => (
        <View key={stop} style={styles.stopSkeleton}>
          <View style={styles.stopDot} />
          <View style={styles.stopLines}>
            <View style={[styles.stopLine, stop === 1 && styles.stopLineShort]} />
            <View style={styles.stopSubline} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function ItineraryGenerationView({
  mode,
  destination,
  savedCount,
  dayCount,
  errorMessage,
  onRetry,
  onReviewSavedPlaces,
  onBackToTrip,
  active = true,
}: ItineraryGenerationViewProps) {
  const city = destination.split(",")[0]?.trim() || destination
  const safeDayCount = Math.max(1, dayCount)
  const [statusIndex, setStatusIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    setStatusIndex(0)
    if (!active || mode !== "building" || reduceMotion) return
    const interval = setInterval(() => {
      setStatusIndex((current) => (current + 1) % buildingStatuses.length)
    }, 2400)
    return () => clearInterval(interval)
  }, [active, mode, reduceMotion])

  useEffect(() => {
    progress.stopAnimation()
    progress.setValue(0)
    if (!active || mode !== "building" || reduceMotion) return
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    )
    animation.start()
    return () => animation.stop()
  }, [active, mode, progress, reduceMotion])

  const isBuilding = mode === "building"
  const isDraft = mode === "draft"
  const headline = isBuilding
    ? `Planning your ${city} ${safeDayCount === 1 ? "day" : "days"}`
    : isDraft
      ? "Your saved places are arranged"
      : "We couldn’t finish your itinerary"
  const body = isBuilding
    ? `Organizing ${savedPlaceLabel(savedCount)} across ${dayLabel(safeDayCount)}.`
    : isDraft
      ? "We couldn’t add the full set of recommendations yet. Nothing you saved was lost."
      : errorMessage || `Your trip and all ${savedPlaceLabel(savedCount)} are safe.`

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.page}
          accessibilityViewIsModal
        >
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name={isBuilding ? "sparkles" : isDraft ? "map-outline" : "cloud-offline-outline"} size={20} color={colors.primary} />
            </View>
            <Text style={styles.brandName}>VibeTravel</Text>
          </View>

          <View
            accessibilityRole={mode === "error" ? "alert" : "summary"}
            accessibilityLiveRegion={mode === "error" ? "assertive" : "polite"}
            style={styles.intro}
          >
            <Text style={styles.eyebrow}>
              {isBuilding ? "BUILDING YOUR ITINERARY" : isDraft ? "SAVED-PLACE DRAFT" : "YOUR PLACES ARE SAFE"}
            </Text>
            <Text accessibilityRole="header" style={styles.headline}>{headline}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>

          {isBuilding ? (
            <>
              <View style={styles.progressTrack} accessibilityLabel="Building itinerary">
                <Animated.View
                  style={[
                    styles.progressSegment,
                    reduceMotion
                      ? styles.progressSegmentReduced
                      : {
                          transform: [{
                            translateX: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-160, 360],
                            }),
                          }],
                        },
                  ]}
                />
              </View>
              <View style={styles.statusRow} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.statusText}>{buildingStatuses[statusIndex]}</Text>
              </View>
              <View style={styles.days}>
                {Array.from({ length: Math.min(3, safeDayCount) }, (_, index) => (
                  <DaySkeleton key={index} index={index} />
                ))}
              </View>
              <Text style={styles.footerNote}>This usually takes under a minute. Keep this screen open—your saved places are safe.</Text>
            </>
          ) : (
            <View style={styles.recovery}>
              <View style={styles.safetyRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.safetyText}>All {savedPlaceLabel(savedCount)} are still attached to this trip.</Text>
              </View>
              <Button onPress={onRetry}>{isDraft ? "Finish itinerary" : "Try again"}</Button>
              <Button variant="secondary" onPress={onReviewSavedPlaces}>{isDraft ? "Add more places" : "Review saved places"}</Button>
              {onBackToTrip ? <Button variant="ghost" onPress={onBackToTrip}>Back to trip</Button> : null}
            </View>
          )}
        </ScrollView>
    </SafeAreaView>
  )
}

export default function ItineraryGenerationModal({
  visible,
  ...viewProps
}: ItineraryGenerationModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => { if (viewProps.mode !== "building") viewProps.onReviewSavedPlaces() }}
    >
      <ItineraryGenerationView {...viewProps} active={visible} />
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 24, paddingTop: 18, paddingBottom: 30 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: radii.medium, backgroundColor: colors.dark, alignItems: "center", justifyContent: "center" },
  brandName: { color: colors.text, fontSize: 18, fontFamily: typography.serif },
  intro: { marginTop: 62 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.55 },
  headline: { color: colors.text, fontSize: 38, lineHeight: 44, fontFamily: typography.serif, marginTop: 9 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 470 },
  progressTrack: { height: 3, marginTop: 34, overflow: "hidden", backgroundColor: colors.border },
  progressSegment: { position: "absolute", left: 0, top: 0, bottom: 0, width: "42%", backgroundColor: colors.primary },
  progressSegmentReduced: { left: 0, width: "42%" },
  statusRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  statusText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  days: { marginTop: 20, gap: 12 },
  daySkeleton: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  daySkeletonHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  daySkeletonLabel: { width: "38%", height: 13, borderRadius: 4, backgroundColor: colors.surfaceMuted },
  daySkeletonNumber: { color: colors.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  stopSkeleton: { minHeight: 38, flexDirection: "row", alignItems: "flex-start", gap: 11, marginTop: 8 },
  stopDot: { width: 9, height: 9, borderRadius: 5, marginTop: 2, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  stopLines: { flex: 1, gap: 7 },
  stopLine: { width: "76%", height: 10, borderRadius: 3, backgroundColor: colors.surfaceMuted },
  stopLineShort: { width: "58%" },
  stopSubline: { width: "42%", height: 7, borderRadius: 3, backgroundColor: colors.surfaceMuted },
  footerNote: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 24 },
  recovery: { marginTop: 42, gap: 10 },
  safetyRow: { minHeight: 64, marginBottom: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 },
  safetyText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 18, fontWeight: "700" },
})
