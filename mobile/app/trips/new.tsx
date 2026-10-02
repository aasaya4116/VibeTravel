import { useState } from "react"
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Eyebrow } from "@/components/ui"
import { createTrip } from "@/lib/data"
import { colors, radii } from "@/lib/theme"
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
        <Eyebrow>Start an adventure</Eyebrow>
        <Text style={styles.title}>Where are you headed?</Text>
        <Text style={styles.subtitle}>Create the trip here, then use the web planner for discovery and itinerary generation while the native planning flow is completed.</Text>
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
        <Button onPress={save} loading={loading} disabled={!title.trim() || !destination.trim()}>Create trip</Button>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, padding: 22, justifyContent: "center" },
  title: { color: colors.text, fontSize: 31, fontWeight: "800", marginTop: 7 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 22 },
  form: { gap: 9, marginBottom: 22 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 3 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 15, fontSize: 16, color: colors.text },
})
