import { useState } from "react"
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Button, Card, Eyebrow, LoadingScreen, Screen } from "@/components/ui"
import { colors, typography } from "@/lib/theme"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/providers/auth-provider"
import { useDashboard } from "@/hooks/use-dashboard"

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? siteUrl

function SettingRow({ icon, label, onPress, destructive = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.setting, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.primary} />
      <Text style={[styles.settingText, destructive && styles.dangerText]}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
    </Pressable>
  )
}

export default function ProfileScreen() {
  const { session } = useAuth()
  const { data, loading } = useDashboard()
  const [deleting, setDeleting] = useState(false)

  if (loading && !data) return <LoadingScreen label="Loading your profile…" />

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function deleteAccount() {
    if (!session) return
    setDeleting(true)
    try {
      const response = await fetch(`${apiUrl}/api/account/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || "Could not delete your account")
      await supabase.auth.signOut()
    } catch (error) {
      Alert.alert("Account not deleted", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your VibeTravel account?",
      "This permanently deletes your profile, family preferences, trips, saved places, readiness details, and private share links. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: deleteAccount },
      ]
    )
  }

  const displayName = data?.profile?.display_name || "Traveler"
  const vibe = data?.familyVibe

  return (
    <Screen contentStyle={styles.page}>
      <Eyebrow>Your account</Eyebrow>
      <Text style={styles.title}>Profile</Text>

      <Card style={styles.identity}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text></View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>
      </Card>

      {vibe ? (
        <Card>
          <View style={styles.vibeHeader}>
            <View>
              <Eyebrow>Family vibe</Eyebrow>
              <Text style={styles.cardTitle}>{vibe.family_name || "Your travel style"}</Text>
            </View>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
          </View>
          <View style={styles.chips}>
            {vibe.travel_style.map((style) => <View key={style} style={styles.chip}><Text style={styles.chipText}>{style}</Text></View>)}
            <View style={styles.chip}><Text style={styles.chipText}>{vibe.pace} pace</Text></View>
          </View>
          <Button variant="secondary" onPress={() => Linking.openURL(`${siteUrl}/profile/vibe`)} style={styles.editButton}>Edit family vibe</Button>
        </Card>
      ) : null}

      <Card style={styles.settingsCard}>
        <SettingRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push("/privacy")} />
        <SettingRow icon="document-text-outline" label="Terms of Use" onPress={() => router.push("/terms")} />
        <SettingRow icon="help-circle-outline" label="Support" onPress={() => router.push("/support")} />
        <SettingRow icon="globe-outline" label="Open VibeTravel on the web" onPress={() => Linking.openURL(siteUrl)} />
      </Card>

      <Button variant="secondary" onPress={signOut}>Sign out</Button>
      <Button variant="ghost" onPress={confirmDelete} loading={deleting} style={styles.deleteButton}>Delete account</Button>
      <Text style={styles.version}>VibeTravel for iOS · Version 1.1</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 10 },
  title: { color: colors.text, fontSize: 35, fontFamily: typography.serif, fontWeight: "700", marginTop: -9 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarText: { color: colors.primary, fontSize: 21, fontWeight: "800" },
  identityText: { flex: 1 },
  name: { color: colors.text, fontSize: 19, fontWeight: "800" },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  vibeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: "800", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15 },
  chip: { backgroundColor: colors.primarySoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { color: colors.primaryDark, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  editButton: { marginTop: 17 },
  settingsCard: { paddingVertical: 4 },
  setting: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  settingText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.6 },
  dangerText: { color: colors.danger },
  deleteButton: { marginTop: -5 },
  version: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 6 },
})
