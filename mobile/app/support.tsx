import { Alert, Linking, Platform, StyleSheet, View } from "react-native"
import Constants from "expo-constants"
import { Ionicons } from "@expo/vector-icons"
import { Button, Card, Eyebrow, Screen } from "@/components/ui"
import { Text } from "@/components/typography"
import { colors, typography } from "@/lib/theme"

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim()
const supportPageUrl = `${siteUrl}/support`

function supportEmailUrl(email: string) {
  const version = Constants.expoConfig?.version ?? "unknown"
  const platform = `${Platform.OS} ${String(Platform.Version)}`
  const subject = "VibeTravel support request"
  const body = [
    "Hi VibeTravel Support,",
    "",
    "What happened?",
    "",
    "What did you expect to happen?",
    "",
    "Trip name (optional):",
    "",
    "---",
    `App version: ${version}`,
    `Platform: ${platform}`,
    "Please do not include passwords, payment details, or booking confirmation codes.",
  ].join("\n")

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function SupportScreen() {
  async function openSupportPage() {
    await Linking.openURL(supportPageUrl)
  }

  async function emailSupport() {
    if (!supportEmail) {
      await openSupportPage()
      return
    }

    const emailUrl = supportEmailUrl(supportEmail)
    try {
      const available = await Linking.canOpenURL(emailUrl)
      if (!available) throw new Error("No email app is available")
      await Linking.openURL(emailUrl)
    } catch {
      Alert.alert(
        "Email isn’t available",
        "Open the VibeTravel support page instead?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open support page", onPress: () => void openSupportPage() },
        ],
      )
    }
  }

  return (
    <Screen contentStyle={styles.page}>
      <Eyebrow>We’re here to help</Eyebrow>
      <Text style={styles.title}>Support</Text>
      <Text style={styles.intro}>Tell us what happened and what you expected. We’ll start your message with app and device details that help us investigate—never your private trip data.</Text>

      <Card style={styles.supportCard}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-outline" size={22} color={colors.primary} />
        </View>
        <Eyebrow>Fastest response</Eyebrow>
        <Text style={styles.cardTitle}>{supportEmail ? "Email VibeTravel support" : "Contact VibeTravel support"}</Text>
        <Text style={styles.cardBody}>
          {supportEmail
            ? `Your email app will open with helpful, non-sensitive context already included. Send it to ${supportEmail}.`
            : "Open the support page for the current contact method and service information."}
        </Text>
        <Button onPress={() => void emailSupport()} style={styles.button}>
          {supportEmail ? "Start support email" : "Open support page"}
        </Button>
        {supportEmail ? (
          <Button variant="secondary" onPress={() => void openSupportPage()} style={styles.secondaryButton}>Open web support</Button>
        ) : null}
      </Card>

      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
        <Text style={styles.privacyText}>Never send your password, payment details, or private booking confirmation codes.</Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: "100%", minWidth: 0, paddingTop: 12, gap: 18 },
  title: { color: colors.text, fontSize: 36, lineHeight: 42, fontFamily: typography.serif, fontWeight: "700", marginTop: -12 },
  intro: { width: "100%", flexShrink: 1, color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  supportCard: { width: "100%", maxWidth: "100%", minWidth: 0, backgroundColor: "transparent", borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 0, paddingHorizontal: 0, shadowOpacity: 0, elevation: 0 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, marginBottom: 2 },
  cardTitle: { width: "100%", flexShrink: 1, color: colors.text, fontSize: 21, fontWeight: "800", marginTop: 4 },
  cardBody: { width: "100%", flexShrink: 1, color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  button: { marginTop: 18 },
  secondaryButton: { marginTop: 9 },
  privacyNote: { width: "100%", maxWidth: "100%", minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: 10, borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 13, paddingVertical: 3 },
  privacyText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
})
