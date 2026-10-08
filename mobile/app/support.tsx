import { Linking, StyleSheet } from "react-native"
import { Button, Card, Eyebrow, Screen } from "@/components/ui"
import { Text } from "@/components/typography"
import { colors } from "@/lib/theme"

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"

export default function SupportScreen() {
  return (
    <Screen contentStyle={styles.page}>
      <Eyebrow>We’re here to help</Eyebrow>
      <Text style={styles.title}>Support</Text>
      <Text style={styles.intro}>For itinerary problems, account access, privacy requests, or feedback, open the support page below. Include the trip name and what you expected to happen, but never send passwords or confirmation codes.</Text>
      <Card>
        <Text style={styles.cardTitle}>VibeTravel support</Text>
        <Text style={styles.cardBody}>The support page contains the current contact method and service information.</Text>
        <Button onPress={() => Linking.openURL(`${siteUrl}/support`)} style={styles.button}>Open support page</Button>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 12 },
  title: { color: colors.text, fontSize: 31, fontWeight: "800", marginTop: -8 },
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  cardBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  button: { marginTop: 16 },
})
