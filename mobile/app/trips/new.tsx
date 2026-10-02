import { useState } from "react"
import { Alert, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Eyebrow } from "@/components/ui"
import { createTrip } from "@/lib/data"
import { destinationCards } from "@/lib/destinations"
import { colors, radii, typography } from "@/lib/theme"
import { useAuth } from "@/providers/auth-provider"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export default function NewTripScreen() {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)

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
      router.replace({ pathname: "/trips/[id]", params: { id: trip.id } })
    } catch (error) {
      Alert.alert("Trip not created", error instanceof Error ? error.message : "Please reconnect and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.intro}>
          <Eyebrow>Start an adventure</Eyebrow>
          <Text style={styles.title}>Where are you headed?</Text>
          <Text style={styles.subtitle}>Start with a place. We’ll shape the trip around your family’s vibe.</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRail}>
          {destinationCards.slice(0, 6).map((card) => {
            const active = destination === card.destination
            return (
              <Pressable key={card.slug} onPress={() => { setDestination(card.destination); if (!title) setTitle(`${card.name} family adventure`) }} style={[styles.destinationCard, active && styles.destinationCardActive]}>
                <ImageBackground source={{ uri: card.imageUrl }} style={styles.destinationImage} imageStyle={styles.destinationImageRadius}>
                  <View style={styles.destinationShade} />
                  <View style={styles.destinationCopy}><Text style={styles.destinationName}>{card.name}</Text><Text style={styles.destinationCountry}>{card.country}</Text></View>
                </ImageBackground>
              </Pressable>
            )
          })}
        </ScrollView>
        <View style={styles.form}>
          <Text style={styles.label}>Trip name</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Spring break in Lisbon" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.label}>Destination</Text>
          <TextInput value={destination} onChangeText={setDestination} placeholder="Lisbon, Portugal" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.label}>Start date</Text>
          <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.label}>End date</Text>
          <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.textMuted} style={styles.input} />
        </View>
        <Button onPress={save} loading={loading} disabled={!title.trim() || !destination.trim()} style={styles.submit}>Create trip</Button>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, paddingVertical: 18, justifyContent: "center" },
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
})
