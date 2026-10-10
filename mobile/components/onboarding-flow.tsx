import { useEffect, useMemo, useState } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/typography"
import { RemoteImageBackground } from "@/components/remote-image"
import { BrandMark } from "@/components/brand-mark"
import {
  budgetOptions,
  dietaryOptions,
  paceDetails,
  travelStyleOptions,
  type FamilyVibeDraft,
} from "@/lib/family-vibe-options"
import { destinationCards } from "@/lib/destinations"
import { colors, radii, shadows, typography } from "@/lib/theme"

type Step = 0 | 1 | 2 | 3 | 4

interface OnboardingFlowProps {
  accessToken?: string | null
  displayName: string
  initialDraft: FamilyVibeDraft
  saving: boolean
  error: string | null
  onComplete: (draft: FamilyVibeDraft) => Promise<boolean>
  onSkip: () => Promise<void>
  onClearError: () => void
  onDraftChange?: (draft: FamilyVibeDraft) => void
  onExplore: () => void
  onPlanTrip: () => void
}

const welcomeImage = destinationCards.find((destination) => destination.slug === "cape-town")?.imageUrl

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "traveler"
}

function StepHeader({ step, onBack }: { step: 1 | 2 | 3; onBack: () => void }) {
  return (
    <View style={styles.stepHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={6}
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={21} color={colors.text} />
      </Pressable>
      <View
        accessible
        accessibilityLabel={`Step ${step} of 3`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: 3, now: step }}
        style={styles.progressWrap}
      >
        <Text style={styles.progressLabel}>{step} OF 3</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
        </View>
      </View>
      <View style={styles.iconButtonPlaceholder} />
    </View>
  )
}

function ChoicePill({
  label,
  selected,
  muted,
  onPress,
}: {
  label: string
  selected: boolean
  muted?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${selected ? ", selected" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choicePill,
        selected && styles.choicePillSelected,
        muted && !selected && styles.choicePillMuted,
        pressed && styles.pressed,
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
      <Text style={[styles.choicePillText, selected && styles.choicePillTextSelected]}>{label}</Text>
    </Pressable>
  )
}

function ActionButton({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
}: {
  label: string
  onPress: () => void
  variant?: "primary" | "secondary" | "light"
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}) {
  const lightText = variant === "primary"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === "primary" && styles.actionPrimary,
        variant === "secondary" && styles.actionSecondary,
        variant === "light" && styles.actionLight,
        (disabled || loading) && styles.actionDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={lightText ? "#FFFFFF" : colors.text} />
      ) : (
        <>
          <Text style={[styles.actionText, lightText && styles.actionTextLight]}>{label}</Text>
          {icon ? <Ionicons name={icon} size={18} color={lightText ? "#FFFFFF" : colors.text} /> : null}
        </>
      )}
    </Pressable>
  )
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  )
}

function StepScaffold({
  step,
  eyebrow,
  title,
  body,
  children,
  footer,
  onBack,
}: {
  step: 1 | 2 | 3
  eyebrow: string
  title: string
  body: string
  children: React.ReactNode
  footer: React.ReactNode
  onBack: () => void
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <StepHeader step={step} onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.stepContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
        <View style={styles.stepChoices}>{children}</View>
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  )
}

export function OnboardingFlow({
  accessToken,
  displayName,
  initialDraft,
  saving,
  error,
  onComplete,
  onSkip,
  onClearError,
  onDraftChange,
  onExplore,
  onPlanTrip,
}: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>(0)
  const [draft, setDraft] = useState(initialDraft)
  const [styleMessage, setStyleMessage] = useState<string | null>(null)
  const [dietaryNone, setDietaryNone] = useState(false)

  useEffect(() => {
    if (step === 0) return
    const label = step === 4 ? "Your Family Vibe is ready" : `Onboarding step ${step} of 3`
    AccessibilityInfo.announceForAccessibility(label)
  }, [step])

  useEffect(() => {
    onDraftChange?.(draft)
  }, [draft, onDraftChange])

  const paceLabel = useMemo(
    () => paceDetails.find((option) => option.value === draft.pace)?.label ?? "Balanced",
    [draft.pace],
  )
  const budgetLabel = useMemo(
    () => budgetOptions.find((option) => option.value === draft.budget_preference)?.description ?? "Flexible",
    [draft.budget_preference],
  )

  function goTo(nextStep: Step) {
    setStyleMessage(null)
    onClearError()
    setStep(nextStep)
  }

  function toggleStyle(option: string) {
    const selected = draft.travel_style.includes(option)
    if (!selected && draft.travel_style.length >= 3) {
      const message = "Choose up to three. Remove one before adding another."
      setStyleMessage(message)
      AccessibilityInfo.announceForAccessibility(message)
      return
    }
    setStyleMessage(null)
    setDraft((current) => ({
      ...current,
      travel_style: selected
        ? current.travel_style.filter((item) => item !== option)
        : [...current.travel_style, option],
    }))
  }

  function toggleDietary(option: string) {
    onClearError()
    setDietaryNone(false)
    setDraft((current) => ({
      ...current,
      dietary: current.dietary.includes(option)
        ? current.dietary.filter((item) => item !== option)
        : [...current.dietary, option],
    }))
  }

  function chooseNoDietaryNeeds() {
    onClearError()
    setDietaryNone((current) => !current)
    setDraft((current) => ({ ...current, dietary: [] }))
  }

  async function finish() {
    const completed = await onComplete(draft)
    if (completed) goTo(4)
  }

  if (step === 0) {
    return (
      <RemoteImageBackground
        uri={welcomeImage}
        accessToken={accessToken}
        preset="backdrop"
        style={styles.welcome}
      >
        <StatusBar style="light" />
        <View style={styles.welcomeShade} />
        <SafeAreaView style={styles.welcomeSafe} edges={["top", "bottom"]}>
          <ScrollView
            contentContainerStyle={styles.welcomeContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brandRow}>
              <BrandMark size={42} />
              <Text style={styles.brandText}>VibeTravel</Text>
            </View>

            <View style={styles.welcomeCopy}>
              <Text style={styles.welcomeEyebrow}>WELCOME, {firstName(displayName).toUpperCase()}</Text>
              <Text accessibilityRole="header" style={styles.welcomeTitle}>Trips that feel like your family—not a checklist.</Text>
              <Text style={styles.welcomeBody}>Tell us what you enjoy and how you like to move. We’ll shape destinations, places, and realistic days around it.</Text>
              <View style={styles.timeNote}>
                <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.76)" />
                <Text style={styles.timeNoteText}>About 60 seconds · Change anything later</Text>
              </View>
              <ErrorMessage message={error} />
              <ActionButton label="Make it mine" variant="light" icon="arrow-forward" disabled={saving} onPress={() => goTo(1)} />
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void onSkip()}
                style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.notNowText}>Skip setup</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </RemoteImageBackground>
    )
  }

  if (step === 1) {
    return (
      <StepScaffold
        step={1}
        eyebrow="YOUR STYLE"
        title="What pulls you into a place?"
        body="Choose up to three. These will change what appears first in Explore."
        onBack={() => goTo(0)}
        footer={
          <>
            {styleMessage ? <Text accessibilityRole="alert" style={styles.inlineMessage}>{styleMessage}</Text> : null}
            <ActionButton label="Continue" icon="arrow-forward" disabled={draft.travel_style.length === 0} onPress={() => goTo(2)} />
            <Pressable accessibilityRole="button" onPress={() => goTo(2)} style={styles.skipStep}>
              <Text style={styles.skipStepText}>Skip this step</Text>
            </Pressable>
          </>
        }
      >
        <View style={styles.selectionMeta}>
          <Text style={styles.selectionMetaText}>{draft.travel_style.length} of 3 selected</Text>
        </View>
        <View style={styles.pillWrap}>
          {travelStyleOptions.map((option) => (
            <ChoicePill
              key={option}
              label={option}
              selected={draft.travel_style.includes(option)}
              muted={draft.travel_style.length >= 3}
              onPress={() => toggleStyle(option)}
            />
          ))}
        </View>
      </StepScaffold>
    )
  }

  if (step === 2) {
    return (
      <StepScaffold
        step={2}
        eyebrow="YOUR RHYTHM"
        title="How should a great day feel?"
        body="This shapes itinerary density—not how ambitious your trip can be."
        onBack={() => goTo(1)}
        footer={<ActionButton label="Continue" icon="arrow-forward" onPress={() => goTo(3)} />}
      >
        <View style={styles.choiceList}>
          {paceDetails.map((option) => {
            const selected = draft.pace === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label}. ${option.description}`}
                onPress={() => setDraft((current) => ({ ...current, pace: option.value }))}
                style={({ pressed }) => [styles.paceChoice, selected && styles.paceChoiceSelected, pressed && styles.pressed]}
              >
                <View style={[styles.paceIcon, selected && styles.paceIconSelected]}>
                  <Ionicons name={option.icon} size={19} color={selected ? "#FFFFFF" : colors.primary} />
                </View>
                <View style={styles.paceCopy}>
                  <Text style={styles.paceTitle}>{option.label}</Text>
                  <Text style={styles.paceDescription}>{option.description}</Text>
                </View>
                <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={23} color={selected ? colors.primary : colors.border} />
              </Pressable>
            )
          })}
        </View>

        <View style={styles.sectionDivider} />
        <Text style={styles.subsectionLabel}>TYPICAL SPEND</Text>
        <Text style={styles.subsectionHint}>Optional. We’ll keep price variety inside your comfort zone.</Text>
        <View style={styles.budgetGrid}>
          {budgetOptions.map((option) => {
            const selected = draft.budget_preference === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label}, ${option.description}`}
                onPress={() => setDraft((current) => ({ ...current, budget_preference: option.value }))}
                style={({ pressed }) => [styles.budgetChoice, selected && styles.budgetChoiceSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.budgetLabel, selected && styles.budgetLabelSelected]}>{option.label}</Text>
                <Text style={[styles.budgetDescription, selected && styles.budgetDescriptionSelected]}>{option.description}</Text>
              </Pressable>
            )
          })}
        </View>
      </StepScaffold>
    )
  }

  if (step === 3) {
    return (
      <StepScaffold
        step={3}
        eyebrow="YOUR NEEDS"
        title="Anything food suggestions should always respect?"
        body="Optional. Choose only what should affect restaurant and daily-plan recommendations."
        onBack={() => goTo(2)}
        footer={
          <>
            <ErrorMessage message={error} />
            <ActionButton label="Build my travel world" icon="sparkles-outline" loading={saving} onPress={() => void finish()} />
          </>
        }
      >
        <View style={styles.pillWrap}>
          <ChoicePill label="No dietary needs" selected={dietaryNone} onPress={chooseNoDietaryNeeds} />
          {dietaryOptions.map((option) => (
            <ChoicePill key={option} label={option} selected={draft.dietary.includes(option)} onPress={() => toggleDietary(option)} />
          ))}
        </View>
        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark-outline" size={19} color={colors.success} />
          <Text style={styles.privacyNoteText}>We only ask for preferences that directly improve your recommendations. You can change these choices later in Profile.</Text>
        </View>
      </StepScaffold>
    )
  }

  return (
    <SafeAreaView style={styles.payoffSafe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.payoffContent} showsVerticalScrollIndicator={false}>
        <View style={styles.successMark}>
          <Ionicons name="sparkles" size={30} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>YOUR VIBE IS READY</Text>
        <Text accessibilityRole="header" style={styles.payoffTitle}>Built around the way you travel.</Text>
        <Text style={styles.payoffBody}>We’ll use these signals across Explore and itinerary generation.</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>DRAWN TO</Text>
            <Text style={styles.summaryValue}>{draft.travel_style.length ? draft.travel_style.join(" · ") : "A little of everything"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>DAY RHYTHM</Text>
            <Text style={styles.summaryValue}>{paceLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TYPICAL SPEND</Text>
            <Text style={styles.summaryValue}>{budgetLabel}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>FOOD NEEDS</Text>
            <Text style={styles.summaryValue}>{draft.dietary.length ? draft.dietary.join(" · ") : "None selected"}</Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.payoffFooter}>
        <ActionButton label="Explore my matches" icon="arrow-forward" onPress={onExplore} />
        <ActionButton label="Plan a trip" variant="secondary" icon="map-outline" onPress={onPlanTrip} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  welcome: { flex: 1, backgroundColor: colors.dark },
  welcomeShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12,10,8,0.58)" },
  welcomeSafe: { flex: 1 },
  welcomeContent: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandText: { color: "#FFFFFF", fontSize: 18, fontFamily: typography.serif, fontWeight: "700" },
  welcomeCopy: { paddingTop: 120, paddingBottom: 8 },
  welcomeEyebrow: { color: "#E5A98D", fontSize: 10, fontWeight: "900", letterSpacing: 1.65 },
  welcomeTitle: { color: "#FFFFFF", fontSize: 40, lineHeight: 44, fontFamily: typography.serif, fontWeight: "700", marginTop: 9, maxWidth: 390 },
  welcomeBody: { color: "rgba(255,255,255,0.78)", fontSize: 14, lineHeight: 22, marginTop: 13, maxWidth: 370 },
  timeNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 17, marginBottom: 22 },
  timeNoteText: { color: "rgba(255,255,255,0.76)", fontSize: 11, fontWeight: "700" },
  notNow: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 4 },
  notNowText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", textDecorationLine: "underline" },
  stepHeader: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  iconButtonPlaceholder: { width: 44, height: 44 },
  progressWrap: { flex: 1, alignItems: "center", gap: 7, paddingHorizontal: 12 },
  progressLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1.25 },
  progressTrack: { width: "100%", maxWidth: 170, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: colors.surfaceMuted },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: colors.primary },
  stepContent: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.55 },
  stepTitle: { color: colors.text, fontSize: 34, lineHeight: 39, fontFamily: typography.serif, fontWeight: "700", marginTop: 7, maxWidth: 390 },
  stepBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 390 },
  stepChoices: { marginTop: 25 },
  selectionMeta: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 11 },
  selectionMetaText: { color: colors.primaryDark, fontSize: 11, fontWeight: "800" },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  choicePill: { minHeight: 46, borderRadius: 99, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surface },
  choicePillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choicePillMuted: { opacity: 0.52 },
  choicePillText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  choicePillTextSelected: { color: "#FFFFFF" },
  choiceList: { gap: 10 },
  paceChoice: { minHeight: 76, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  paceChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  paceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  paceIconSelected: { backgroundColor: colors.primary },
  paceCopy: { flex: 1 },
  paceTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  paceDescription: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 24 },
  subsectionLabel: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  subsectionHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  budgetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  budgetChoice: { minHeight: 62, minWidth: 92, flexGrow: 1, flexBasis: "29%", borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  budgetChoiceSelected: { backgroundColor: colors.dark, borderColor: colors.dark },
  budgetLabel: { color: colors.text, fontSize: 14, fontWeight: "900" },
  budgetLabelSelected: { color: "#FFFFFF" },
  budgetDescription: { color: colors.textMuted, fontSize: 9, marginTop: 3 },
  budgetDescriptionSelected: { color: colors.whiteMuted },
  privacyNote: { marginTop: 25, paddingTop: 19, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  privacyNoteText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 17 },
  footer: { gap: 5, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  actionButton: { minHeight: 52, borderRadius: radii.medium, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  actionPrimary: { backgroundColor: colors.dark },
  actionSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: "transparent" },
  actionLight: { backgroundColor: colors.surface },
  actionDisabled: { opacity: 0.42 },
  actionText: { color: colors.text, fontSize: 13, fontWeight: "900", letterSpacing: 0.15 },
  actionTextLight: { color: "#FFFFFF" },
  skipStep: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  skipStepText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  inlineMessage: { color: colors.warning, fontSize: 11, lineHeight: 16, textAlign: "center", marginBottom: 4 },
  errorBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radii.medium, backgroundColor: colors.dangerSoft, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  payoffSafe: { flex: 1, backgroundColor: colors.background },
  payoffContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 38, paddingBottom: 28 },
  successMark: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 25, ...shadows.card },
  payoffTitle: { color: colors.text, fontSize: 38, lineHeight: 43, fontFamily: typography.serif, fontWeight: "700", marginTop: 8, maxWidth: 390 },
  payoffBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 370 },
  summaryCard: { marginTop: 30, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  summaryRow: { paddingVertical: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.35 },
  summaryValue: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 5 },
  payoffFooter: { gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
})
