import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, Image, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Button, Eyebrow } from "@/components/ui"
import { createTrip } from "@/lib/data"
import { destinationCards } from "@/lib/destinations"
import { searchDestinationOptions, type DestinationOption } from "@/lib/destination-options"
import { remoteImageSource } from "@/lib/media"
import { colors, radii, typography } from "@/lib/theme"
import { useAuth } from "@/providers/auth-provider"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export default function NewTripScreen() {
  const { user, session } = useAuth()
  const [title, setTitle] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [destinationFocused, setDestinationFocused] = useState(false)
  const [destinationConfirmed, setDestinationConfirmed] = useState(false)
  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([])
  const [loadingDestinations, setLoadingDestinations] = useState(false)

  useEffect(() => {
    if (!destinationFocused) return
    let active = true
    const timer = setTimeout(async () => {
      setLoadingDestinations(true)
      const options = await searchDestinationOptions(destination, session?.access_token)
      if (active) {
        setDestinationOptions(options)
        setLoadingDestinations(false)
      }
    }, destination.trim() ? 180 : 0)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [destination, destinationFocused, session?.access_token])

  function chooseDestination(option: DestinationOption) {
    setDestination(option.label)
    setDestinationConfirmed(true)
    setDestinationFocused(false)
    setDestinationOptions([])
    if (!title.trim()) setTitle(`${option.city} family adventure`)
    Keyboard.dismiss()
  }

  async function save() {
    if (!user) return
    if ((startDate && !datePattern.test(startDate)) || (endDate && !datePattern.test(endDate))) {
      Alert.alert("Check the dates", "Use YYYY-MM-DD, for example 2027-03-15.")
      return
    }
    setLoading(true)
    try {
      const trip = await createTrip(user.id, {
        title: title.trim(),
        destination: destination.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
      })
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
            <Text style={styles.subtitle}>Choose a recognized destination so photos, places, and your itinerary stay connected.</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail} keyboardShouldPersistTaps="handled">
            {destinationCards.slice(0, 6).map((card) => {
              const active = destination === card.destination
              return (
                <Pressable key={card.slug} onPress={() => chooseDestination({ label: card.destination, city: card.name, region: card.country, imageUrl: card.imageUrl, recognized: true, recommended: true })} style={[styles.destinationCard, active && styles.destinationCardActive]}>
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
            <View style={[styles.destinationInputWrap, destinationFocused && styles.destinationInputFocused]}>
              <Ionicons name="location-outline" size={19} color={colors.primary} />
              <TextInput
                value={destination}
                onChangeText={(value) => { setDestination(value); setDestinationConfirmed(false); setDestinationFocused(true) }}
                onFocus={() => setDestinationFocused(true)}
                placeholder="Start typing Addis Ababa…"
                placeholderTextColor={colors.textMuted}
                style={styles.destinationInput}
                autoCorrect={false}
                returnKeyType="done"
              />
              {loadingDestinations ? <ActivityIndicator size="small" color={colors.primary} /> : destinationConfirmed ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
            </View>
            {destinationFocused && destinationOptions.length ? (
              <View style={styles.suggestions}>
                <Text style={styles.suggestionsLabel}>SELECT A RECOGNIZED DESTINATION</Text>
                {destinationOptions.map((option) => (
                  <Pressable key={option.label} onPress={() => chooseDestination(option)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                    {option.imageUrl ? <Image source={remoteImageSource(option.imageUrl, session?.access_token)} style={styles.suggestionImage} /> : <View style={styles.suggestionImageFallback}><Ionicons name="location" size={18} color={colors.primary} /></View>}
                    <View style={styles.suggestionCopy}><Text style={styles.suggestionCity}>{option.city}</Text><Text style={styles.suggestionRegion}>{option.region}</Text></View>
                    <Ionicons name="arrow-forward" size={18} color={colors.text} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {destinationConfirmed ? <Text style={styles.confirmed}>Recognized · Explore and trip imagery will use {destination}.</Text> : destination.trim() && !destinationFocused ? <Text style={styles.unconfirmed}>Select a suggestion when available for the most reliable results.</Text> : null}
            <Text style={styles.label}>Trip name</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Spring break in Lisbon" placeholderTextColor={colors.textMuted} style={styles.input} returnKeyType="done" />
            <Text style={styles.label}>Start date</Text>
            <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.textMuted} style={styles.input} returnKeyType="next" />
            <Text style={styles.label}>End date</Text>
            <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.textMuted} style={styles.input} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
          </View>
          <Button onPress={save} loading={loading} disabled={!title.trim() || !destination.trim()} style={styles.submit}>Create trip and find places</Button>
        </ScrollView>
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
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 18 },
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
  submit: { marginHorizontal: 22 },
  destinationInputWrap: { minHeight: 54, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  destinationInputFocused: { borderColor: colors.primary },
  destinationInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  suggestions: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, overflow: "hidden", marginBottom: 4 },
  suggestionsLabel: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.2, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 5 },
  suggestion: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  suggestionImage: { width: 46, height: 46, borderRadius: radii.small, backgroundColor: colors.surfaceMuted },
  suggestionImageFallback: { width: 46, height: 46, borderRadius: radii.small, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  suggestionCopy: { flex: 1 },
  suggestionCity: { color: colors.text, fontSize: 16, fontFamily: typography.serif, fontWeight: "700" },
  suggestionRegion: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  confirmed: { color: colors.success, fontSize: 10, lineHeight: 15 },
  unconfirmed: { color: colors.textMuted, fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.72 },
})
