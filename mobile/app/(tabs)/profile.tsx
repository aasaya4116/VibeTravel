import { useEffect, useState } from "react"
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Button, Card, Eyebrow, LoadingScreen, Screen } from "@/components/ui"
import { colors, typography } from "@/lib/theme"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/providers/auth-provider"
import { useDashboard } from "@/hooks/use-dashboard"
import { updateProfileDisplayName } from "@/lib/data"

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
  const { data, loading, refresh } = useDashboard()
  const [deleting, setDeleting] = useState(false)
  const [editingOwner, setEditingOwner] = useState(false)
  const [ownerName, setOwnerName] = useState("")
  const [savingOwner, setSavingOwner] = useState(false)

  useEffect(() => {
    if (!editingOwner) setOwnerName(data?.profile?.display_name || "")
  }, [data?.profile?.display_name, editingOwner])

  if (loading && !data) return <LoadingScreen label="Loading your profile…" />

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function saveOwnerProfile() {
    if (!session?.user) return
    const normalizedName = ownerName.trim()
    if (normalizedName.length < 2) {
      Alert.alert("Add your name", "Enter the name you want VibeTravel to use for you.")
      return
    }
    if (normalizedName.length > 80) {
      Alert.alert("Name is too long", "Use 80 characters or fewer.")
      return
    }

    setSavingOwner(true)
    try {
      await updateProfileDisplayName(session.user.id, normalizedName)
      setEditingOwner(false)
      await refresh()
    } catch (error) {
      Alert.alert("Profile not saved", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setSavingOwner(false)
    }
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

      <Card style={styles.ownerCard}>
        <View style={styles.ownerHeader}>
          <View style={styles.ownerIdentity}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text></View>
            <View style={styles.identityText}>
              <Eyebrow>Your profile</Eyebrow>
              <Text style={styles.ownerRole}>Account owner · Lead traveler</Text>
            </View>
          </View>
          {!editingOwner ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Edit your profile" onPress={() => setEditingOwner(true)} style={styles.editOwnerButton}>
              <Ionicons name="pencil" size={15} color={colors.primary} />
              <Text style={styles.editOwnerText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

        {editingOwner ? (
          <View style={styles.ownerForm}>
            <Text style={styles.inputLabel}>Your name</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              maxLength={80}
              onChangeText={setOwnerName}
              placeholder="Adebowale"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={saveOwnerProfile}
              style={styles.nameInput}
              value={ownerName}
            />
            <View style={styles.ownerActions}>
              <Button variant="secondary" disabled={savingOwner} onPress={() => setEditingOwner(false)} style={styles.ownerAction}>Cancel</Button>
              <Button loading={savingOwner} onPress={saveOwnerProfile} style={styles.ownerAction}>Save profile</Button>
            </View>
          </View>
        ) : (
          <View style={styles.ownerDetails}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{session?.user.email}</Text>
          </View>
        )}

        <View style={styles.ownerNote}>
          <Ionicons name="sparkles-outline" size={17} color={colors.primary} />
          <Text style={styles.ownerNoteText}>This is you. Your name helps VibeTravel explain why places and plans fit your travel group.</Text>
        </View>
      </Card>

      {vibe ? (
        <Card style={styles.editorialCard}>
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

      <Card style={[styles.editorialCard, styles.settingsCard]}>
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
  page: { paddingTop: 10, gap: 20 },
  title: { color: colors.text, fontSize: 38, lineHeight: 43, fontFamily: typography.serif, fontWeight: "700", marginTop: -10 },
  editorialCard: { backgroundColor: "transparent", borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 0, paddingHorizontal: 0, shadowOpacity: 0, elevation: 0 },
  ownerCard: { gap: 16, backgroundColor: "transparent", borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 0, paddingHorizontal: 0, shadowOpacity: 0, elevation: 0 },
  ownerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  ownerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 13 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  avatarText: { color: colors.text, fontSize: 17, fontWeight: "800" },
  identityText: { flex: 1 },
  ownerRole: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 5 },
  editOwnerButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: colors.primary },
  editOwnerText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  ownerDetails: { paddingHorizontal: 3 },
  name: { color: colors.text, fontSize: 19, fontWeight: "800" },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  ownerForm: { gap: 9 },
  inputLabel: { color: colors.text, fontSize: 12, fontWeight: "800" },
  nameInput: { minHeight: 52, borderWidth: 0, borderBottomWidth: 1, borderColor: colors.text, backgroundColor: "transparent", borderRadius: 0, paddingHorizontal: 2, color: colors.text, fontSize: 17, fontWeight: "700" },
  ownerActions: { flexDirection: "row", gap: 9, marginTop: 3 },
  ownerAction: { flex: 1 },
  ownerNote: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 12, paddingVertical: 2 },
  ownerNoteText: { flex: 1, color: colors.primaryDark, fontSize: 11, lineHeight: 17, fontWeight: "600" },
  vibeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: "800", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  editButton: { marginTop: 17 },
  settingsCard: { paddingVertical: 4 },
  setting: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  settingText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.6 },
  dangerText: { color: colors.danger },
  deleteButton: { marginTop: -5 },
  version: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 6 },
})
