import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Image, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { DateRangePicker } from "@/components/date-range-picker"
import { Button, Eyebrow } from "@/components/ui"
import { Text, TextInput } from "@/components/typography"
import { createTrip } from "@/lib/data"
import { destinationCards } from "@/lib/destinations"
import { searchDestinationOptions, type DestinationOption } from "@/lib/destination-options"
import { remoteImageSource } from "@/lib/media"
import { colors, radii, typography } from "@/lib/theme"
import { inclusiveTripDayCount, isValidIsoDate, localTodayIso, MAX_TRIP_DAYS, tripLengthLabel } from "@/lib/trip-dates"
import { useAuth } from "@/providers/auth-provider"
import { useDashboard } from "@/hooks/use-dashboard"

const tripDateFormatter = new Intl.DateTimeFormat(undefined, { calendar: "gregory", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

function formatTripDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return tripDateFormatter.format(new Date(Date.UTC(year, month - 1, day)))
}

export default function NewTripScreen() {
  const { user, session } = useAuth()
  const { refresh: refreshDashboard } = useDashboard()
  const [title, setTitle] = useState("")
  const [destinationQuery, setDestinationQuery] = useState("")
  const [selectedDestination, setSelectedDestination] = useState<DestinationOption | null>(null)
  const [suggestedTitle, setSuggestedTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [datePickerVisible, setDatePickerVisible] = useState(false)
  const [datePickerSelection, setDatePickerSelection] = useState<"start" | "end">("start")
  const [loading, setLoading] = useState(false)
  const [destinationFocused, setDestinationFocused] = useState(false)
  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([])
  const [destinationSearchState, setDestinationSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [destinationSearchAttempt, setDestinationSearchAttempt] = useState(0)
  const destinationInputRef = useRef<TextInput>(null)

  useEffect(() => {
    const query = destinationQuery.trim()
    if (!destinationFocused || selectedDestination || query.length < 2) {
      setDestinationOptions([])
      setDestinationSearchState("idle")
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setDestinationSearchState("loading")
      try {
        const options = await searchDestinationOptions(query, session?.access_token)
        if (active) {
          setDestinationOptions(options.filter((option) => option.resolved))
          setDestinationSearchState("ready")
        }
      } catch {
        if (active) {
          setDestinationOptions([])
          setDestinationSearchState("error")
        }
      }
    }, 220)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [destinationQuery, destinationFocused, destinationSearchAttempt, selectedDestination, session?.access_token])

  function chooseDestination(option: DestinationOption) {
    if (!option.resolved) return
    const canonicalLabel = option.canonicalLabel || option.label
    setDestinationQuery(canonicalLabel)
    setSelectedDestination(option)
    setDestinationFocused(false)
    setDestinationOptions([])
    setDestinationSearchState("idle")

    const nextSuggestedTitle = `${option.city} family adventure`
    if (!title.trim() || title === suggestedTitle) setTitle(nextSuggestedTitle)
    setSuggestedTitle(nextSuggestedTitle)
    Keyboard.dismiss()
  }

  function exploreInspiredDestination(destination: string) {
    setDestinationQuery(destination)
    setSelectedDestination(null)
    setDestinationOptions([])
    setDestinationSearchState("idle")
    setDestinationFocused(true)
    requestAnimationFrame(() => destinationInputRef.current?.focus())
  }

  function editDestination(value: string) {
    setDestinationQuery(value)
    setSelectedDestination(null)
    setDestinationOptions([])
    setDestinationSearchState("idle")
    setDestinationFocused(true)
  }

  function changeDestination() {
    setSelectedDestination(null)
    setDestinationQuery("")
    setDestinationOptions([])
    setDestinationSearchState("idle")
    setDestinationFocused(true)
    requestAnimationFrame(() => destinationInputRef.current?.focus())
  }

  function retryDestinationSearch() {
    setDestinationSearchAttempt((attempt) => attempt + 1)
    setDestinationFocused(true)
  }

  function openDatePicker(selection: "start" | "end") {
    Keyboard.dismiss()
    setDatePickerSelection(selection === "end" && startDate ? "end" : "start")
    setDatePickerVisible(true)
  }

  async function save() {
    if (!user) return
    if (!selectedDestination?.resolved) {
      Alert.alert("Choose a verified destination", "Select a city from the suggestions before creating your trip.")
      return
    }
    if ((startDate && !isValidIsoDate(startDate)) || (endDate && !isValidIsoDate(endDate))) {
      Alert.alert("Check the dates", "Choose your travel dates again from the calendar.")
      return
    }
    if (Boolean(startDate) !== Boolean(endDate)) {
      Alert.alert("Finish choosing dates", "Choose both a start and end date, or clear the dates to plan them later.")
      return
    }
    if (startDate && startDate < localTodayIso()) {
      Alert.alert("Choose future dates", "Your trip start date can’t be in the past.")
      return
    }
    if (startDate && endDate && endDate < startDate) {
      Alert.alert("Check the date range", "Your end date must be on or after your start date.")
      return
    }
    const tripDays = startDate && endDate ? inclusiveTripDayCount(startDate, endDate) : null
    if (tripDays !== null && tripDays > MAX_TRIP_DAYS) {
      Alert.alert("Choose a shorter trip", `VibeTravel can plan up to ${MAX_TRIP_DAYS} days in one trip.`)
      return
    }
    setLoading(true)
    try {
      const trip = await createTrip(user.id, {
        title: title.trim(),
        destination: selectedDestination.canonicalLabel || selectedDestination.label,
        destinationOption: selectedDestination,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      void refreshDashboard()
      router.replace({ pathname: "/explore", params: { tripId: trip.id, destination: trip.destination } } as never)
    } catch (error) {
      Alert.alert("Trip not created", error instanceof Error ? error.message : "Please reconnect and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
          <View style={styles.intro}>
            <Eyebrow>Start an adventure</Eyebrow>
            <Text style={styles.title}>Where are you headed?</Text>
            <Text style={styles.subtitle}>Choose a verified city so every place, photo, and itinerary day stays anchored to the right destination.</Text>
          </View>
          <View style={styles.inspirationHeader}>
            <Text style={styles.inspirationLabel}>A LITTLE INSPIRATION</Text>
            <Text style={styles.inspirationHint}>Or search anywhere below</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail} keyboardShouldPersistTaps="handled">
            {destinationCards.slice(0, 6).map((card) => {
              const active = selectedDestination?.canonicalLabel === card.destination
              return (
                <Pressable
                  key={card.slug}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${card.destination}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => exploreInspiredDestination(card.destination)}
                  style={({ pressed }) => [styles.destinationCard, active && styles.destinationCardActive, pressed && styles.pressed]}
                >
                  <ImageBackground source={remoteImageSource(card.imageUrl, session?.access_token)} style={styles.destinationImage} imageStyle={styles.destinationImageRadius}>
                    <View style={styles.destinationShade} />
                    <View style={styles.destinationCopy}><Text style={styles.destinationName}>{card.name}</Text><Text style={styles.destinationCountry}>{card.country}</Text></View>
                  </ImageBackground>
                </Pressable>
              )
            })}
          </ScrollView>
          <View style={styles.form}>
            <Text style={styles.label}>Destination</Text>
            <View style={[styles.destinationInputWrap, destinationFocused && !selectedDestination && styles.destinationInputFocused, selectedDestination && styles.destinationInputVerified]}>
              <Ionicons name={selectedDestination ? "location" : "location-outline"} size={19} color={selectedDestination ? colors.success : colors.primary} />
              <TextInput
                ref={destinationInputRef}
                accessibilityLabel="Trip destination"
                accessibilityHint="Type a city, then select a verified destination from the suggestions"
                value={destinationQuery}
                onChangeText={editDestination}
                onFocus={() => setDestinationFocused(true)}
                placeholder="Search any city — try Abuja…"
                placeholderTextColor={colors.textMuted}
                style={styles.destinationInput}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
                clearButtonMode="while-editing"
                onSubmitEditing={Keyboard.dismiss}
              />
              {destinationSearchState === "loading" ? <ActivityIndicator size="small" color={colors.primary} /> : selectedDestination ? <Ionicons name="checkmark-circle" size={21} color={colors.success} /> : null}
            </View>

            {destinationFocused && destinationQuery.trim().length > 0 && destinationQuery.trim().length < 2 ? (
              <Text style={styles.searchHint}>Keep typing to search cities worldwide.</Text>
            ) : null}

            {destinationFocused && destinationSearchState === "loading" ? (
              <View style={styles.lookupState}>
                <ActivityIndicator size="small" color={colors.primary} />
                <View style={styles.lookupStateCopy}>
                  <Text style={styles.lookupStateTitle}>Finding the right place…</Text>
                  <Text style={styles.lookupStateBody}>Checking cities worldwide, not just our featured destinations.</Text>
                </View>
              </View>
            ) : null}

            {destinationFocused && destinationSearchState === "ready" && destinationOptions.length > 0 ? (
              <View style={styles.suggestions}>
                <Text style={styles.suggestionsLabel}>SELECT A VERIFIED DESTINATION</Text>
                {destinationOptions.map((option) => (
                  <Pressable
                    key={option.placeId || option.canonicalLabel || option.label}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${option.canonicalLabel || option.label}`}
                    onPress={() => chooseDestination(option)}
                    style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                  >
                    {option.imageUrl ? <Image source={remoteImageSource(option.imageUrl, session?.access_token)} style={styles.suggestionImage} /> : <View style={styles.suggestionImageFallback}><Ionicons name="location" size={18} color={colors.primary} /></View>}
                    <View style={styles.suggestionCopy}>
                      <Text style={styles.suggestionCity}>{option.city}</Text>
                      <Text style={styles.suggestionRegion}>{option.region}</Text>
                    </View>
                    <View style={styles.suggestionVerified}><Ionicons name="checkmark" size={13} color={colors.success} /></View>
                  </Pressable>
                ))}
                {destinationOptions.some((option) => option.provider === "google") ? (
                  <Text accessibilityLabel="Google Maps" style={styles.googleMapsAttribution}>Google Maps</Text>
                ) : null}
              </View>
            ) : null}

            {destinationFocused && destinationSearchState === "ready" && destinationQuery.trim().length >= 2 && destinationOptions.length === 0 ? (
              <View style={styles.lookupEmpty}>
                <Ionicons name="map-outline" size={22} color={colors.primary} />
                <View style={styles.lookupStateCopy}>
                  <Text style={styles.lookupStateTitle}>We couldn’t verify that city yet</Text>
                  <Text style={styles.lookupStateBody}>Add the country or region — for example, “Abuja, Nigeria” — then try again.</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={retryDestinationSearch} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {destinationFocused && destinationSearchState === "error" ? (
              <View style={styles.lookupEmpty}>
                <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
                <View style={styles.lookupStateCopy}>
                  <Text style={styles.lookupStateTitle}>Destination search is unavailable</Text>
                  <Text style={styles.lookupStateBody}>Check your connection and try again. Your trip hasn’t been created.</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={retryDestinationSearch} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {selectedDestination ? (
              <View style={styles.verifiedCard}>
                <View style={styles.verifiedTopline}>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.verifiedBadgeText}>VERIFIED DESTINATION</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Change destination"
                    onPress={changeDestination}
                    hitSlop={6}
                    style={({ pressed }) => [styles.changeButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.changeText}>Change</Text>
                  </Pressable>
                </View>
                <Text style={styles.verifiedCity}>{selectedDestination.city}</Text>
                <Text style={styles.verifiedRegion}>{selectedDestination.region}</Text>
                <Text style={styles.verifiedBody}>Explore filters and itinerary suggestions will stay anchored here.</Text>
              </View>
            ) : destinationQuery.trim() && !destinationFocused ? (
              <Text style={styles.unconfirmed}>Select a verified suggestion before creating your trip.</Text>
            ) : null}

            <Text style={styles.label}>Trip name</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Spring break in Lisbon" placeholderTextColor={colors.textMuted} style={styles.input} returnKeyType="done" />
            <View style={styles.dateLabelRow}>
              <Text style={styles.label}>Trip dates</Text>
              <Text style={styles.optionalLabel}>OPTIONAL</Text>
            </View>
            <View style={styles.dateRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={startDate ? `Start date ${formatTripDate(startDate)}` : "Choose trip start date"}
                accessibilityHint="Opens the date range calendar"
                onPress={() => openDatePicker("start")}
                style={({ pressed }) => [styles.dateField, startDate && styles.dateFieldSelected, pressed && styles.pressed]}
              >
                <View style={styles.dateFieldTopline}>
                  <Text style={styles.dateFieldLabel}>START</Text>
                  <Ionicons name="calendar-outline" size={17} color={startDate ? colors.primary : colors.textMuted} />
                </View>
                <Text style={[styles.dateFieldValue, !startDate && styles.dateFieldPlaceholder]}>{startDate ? formatTripDate(startDate) : "Select date"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={endDate ? `End date ${formatTripDate(endDate)}` : startDate ? "Choose trip end date" : "Choose trip dates, starting with the start date"}
                accessibilityHint="Opens the date range calendar"
                onPress={() => openDatePicker("end")}
                style={({ pressed }) => [styles.dateField, endDate && styles.dateFieldSelected, pressed && styles.pressed]}
              >
                <View style={styles.dateFieldTopline}>
                  <Text style={styles.dateFieldLabel}>END</Text>
                  <Ionicons name="calendar-outline" size={17} color={endDate ? colors.primary : colors.textMuted} />
                </View>
                <Text style={[styles.dateFieldValue, !endDate && styles.dateFieldPlaceholder]}>{endDate ? formatTripDate(endDate) : "Select date"}</Text>
              </Pressable>
            </View>
            <Text style={styles.dateHint}>{startDate && endDate ? `${formatTripDate(startDate)} – ${formatTripDate(endDate)} · ${tripLengthLabel(startDate, endDate)}` : "Tap either date to choose your range. You can also plan dates later."}</Text>
          </View>
          <Button onPress={save} loading={loading} disabled={!title.trim() || !selectedDestination?.resolved} style={styles.submit}>Create trip and find places</Button>
        </ScrollView>
        <DateRangePicker
          visible={datePickerVisible}
          startDate={startDate}
          endDate={endDate}
          initialSelection={datePickerSelection}
          onChange={(nextStartDate, nextEndDate) => {
            setStartDate(nextStartDate)
            setEndDate(nextEndDate)
          }}
          onClose={() => setDatePickerVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  content: { paddingVertical: 18, paddingBottom: 40 },
  intro: { paddingHorizontal: 22 },
  title: { color: colors.text, fontSize: 34, lineHeight: 39, fontFamily: typography.serif, fontWeight: "700", marginTop: 7 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 20 },
  inspirationHeader: { paddingHorizontal: 22, marginBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  inspirationLabel: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.45 },
  inspirationHint: { color: colors.textMuted, fontSize: 10 },
  destinationRail: { paddingHorizontal: 22, gap: 10, paddingBottom: 18 },
  destinationCard: { width: 138, height: 165, borderRadius: 19, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  destinationCardActive: { borderColor: colors.primary },
  destinationImage: { flex: 1, justifyContent: "flex-end" },
  destinationImageRadius: { borderRadius: 17 },
  destinationShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.32)" },
  destinationCopy: { padding: 12 },
  destinationName: { color: "#FFFFFF", fontSize: 20, fontFamily: typography.serif, fontWeight: "700" },
  destinationCountry: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 2 },
  form: { gap: 9, marginBottom: 22, paddingHorizontal: 22 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 3 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 15, fontSize: 16, color: colors.text },
  dateLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  optionalLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  dateRow: { flexDirection: "row", gap: 9 },
  dateField: { minHeight: 82, flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 13, paddingVertical: 12, justifyContent: "center" },
  dateFieldSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  dateFieldTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dateFieldLabel: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.25 },
  dateFieldValue: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 8 },
  dateFieldPlaceholder: { color: colors.textMuted, fontWeight: "600" },
  dateHint: { color: colors.textMuted, fontSize: 10, lineHeight: 15, paddingHorizontal: 2 },
  submit: { marginHorizontal: 22 },
  destinationInputWrap: { minHeight: 54, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  destinationInputFocused: { borderColor: colors.primary },
  destinationInputVerified: { borderColor: colors.success, backgroundColor: colors.successSoft },
  destinationInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  searchHint: { color: colors.textMuted, fontSize: 11, lineHeight: 17, paddingHorizontal: 2 },
  suggestions: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, overflow: "hidden", marginBottom: 4 },
  suggestionsLabel: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.3, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 7 },
  suggestion: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  suggestionImage: { width: 46, height: 46, borderRadius: radii.small, backgroundColor: colors.surfaceMuted },
  suggestionImageFallback: { width: 46, height: 46, borderRadius: radii.small, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  suggestionCopy: { flex: 1 },
  suggestionCity: { color: colors.text, fontSize: 16, fontFamily: typography.serif, fontWeight: "700" },
  suggestionRegion: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  suggestionVerified: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center", marginRight: 3 },
  googleMapsAttribution: { alignSelf: "flex-end", color: "#5E5E5E", fontSize: 12, fontWeight: "400", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  lookupState: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 14, paddingVertical: 12 },
  lookupEmpty: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingLeft: 14, paddingRight: 9, paddingVertical: 12 },
  lookupStateCopy: { flex: 1 },
  lookupStateTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  lookupStateBody: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  retryButton: { minHeight: 44, minWidth: 68, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  retryText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  verifiedCard: { backgroundColor: colors.dark, borderRadius: radii.large, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.darkSoft, padding: 18, marginTop: 2 },
  verifiedTopline: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -7 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 7 },
  verifiedBadgeText: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: 1.25 },
  changeButton: { minHeight: 44, minWidth: 64, justifyContent: "center", alignItems: "flex-end" },
  changeText: { color: "#D9B98B", fontSize: 12, fontWeight: "800" },
  verifiedCity: { color: "#F7F3EC", fontSize: 25, lineHeight: 30, fontFamily: typography.serif, fontWeight: "700", marginTop: 3 },
  verifiedRegion: { color: colors.whiteMuted, fontSize: 12, marginTop: 3 },
  verifiedBody: { color: colors.whiteMuted, fontSize: 11, lineHeight: 17, marginTop: 14, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.13)" },
  unconfirmed: { color: colors.textMuted, fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.72 },
})
