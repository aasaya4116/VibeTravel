import { useEffect, useState } from "react"
import { Alert, Keyboard, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Button, Card, Eyebrow, LoadingScreen, Screen } from "@/components/ui"
import { Text, TextInput } from "@/components/typography"
import { colors, typography } from "@/lib/theme"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/providers/auth-provider"
import { useDashboard } from "@/hooks/use-dashboard"
import { updateFamilyVibe, updateProfileDisplayName } from "@/lib/data"
import type { FamilyVibe } from "@/lib/types"

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? "https://vibe-travel-six.vercel.app"
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? siteUrl

type FamilyVibeDraft = Omit<FamilyVibe, "id" | "user_id">

const travelStyleOptions = [
  "Cultural explorer",
  "Nature lover",
  "Foodie family",
  "Urban adventurer",
  "Beach & relaxation",
  "Off the beaten path",
  "History buff",
  "Art & design",
  "Active & outdoorsy",
  "Slow travel",
  "Technology & innovation",
]
const dietaryOptions = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut allergy", "Halal", "Kosher"]
const paceOptions: Array<FamilyVibeDraft["pace"]> = ["slow", "moderate", "fast"]
const budgetOptions: Array<{ value: FamilyVibeDraft["budget_preference"]; label: string }> = [
  { value: "free", label: "Free" },
  { value: "$", label: "$" },
  { value: "$$", label: "$$" },
  { value: "$$$", label: "$$$" },
  { value: "any", label: "Mix" },
]

function toVibeDraft(vibe: FamilyVibe | null | undefined): FamilyVibeDraft {
  return {
    family_name: vibe?.family_name ?? "",
    kids: vibe?.kids ?? [],
    travelers: vibe?.travelers ?? [],
    travel_style: vibe?.travel_style ?? [],
    sensory_needs: vibe?.sensory_needs ?? [],
    mobility_notes: vibe?.mobility_notes ?? null,
    dietary: vibe?.dietary ?? [],
    pace: vibe?.pace ?? "moderate",
    budget_preference: vibe?.budget_preference ?? "any",
  }
}

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
  const [editingVibe, setEditingVibe] = useState(false)
  const [vibeDraft, setVibeDraft] = useState<FamilyVibeDraft>(() => toVibeDraft(null))
  const [savingVibe, setSavingVibe] = useState(false)

  useEffect(() => {
    if (!editingOwner) setOwnerName(data?.profile?.display_name || "")
  }, [data?.profile?.display_name, editingOwner])

  if (loading && !data) return <LoadingScreen label="Loading your profile…" />

  async function signOut() {
    await supabase.auth.signOut()
  }

  function openVibeEditor() {
    setVibeDraft(toVibeDraft(data?.familyVibe))
    setEditingVibe(true)
  }

  function toggleVibeChoice(field: "travel_style" | "dietary", value: string) {
    setVibeDraft((current) => {
      const choices = current[field]
      return {
        ...current,
        [field]: choices.includes(value) ? choices.filter((item) => item !== value) : [...choices, value],
      }
    })
  }

  async function saveFamilyVibe() {
    if (!session?.user) return
    setSavingVibe(true)
    Keyboard.dismiss()
    try {
      await updateFamilyVibe(session.user.id, vibeDraft)
      await refresh()
      setEditingVibe(false)
    } catch (error) {
      Alert.alert("Family Vibe not saved", error instanceof Error ? error.message : "Please try again.")
    } finally {
      setSavingVibe(false)
    }
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
    <>
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
          <Button variant="secondary" onPress={openVibeEditor} style={styles.editButton}>Edit family vibe</Button>
        </Card>
      ) : (
        <Card style={styles.editorialCard}>
          <Eyebrow>Family vibe</Eyebrow>
          <Text style={styles.cardTitle}>Make every recommendation feel like yours.</Text>
          <Text style={styles.emptyVibeText}>Add your travel style, pace, food needs, and budget inside the app.</Text>
          <Button variant="secondary" onPress={openVibeEditor} style={styles.editButton}>Set up family vibe</Button>
        </Card>
      )}

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

    <Modal visible={editingVibe} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditingVibe(false)}>
      <SafeAreaView style={styles.vibeEditorSafe}>
        <View style={styles.vibeEditorHeader}>
          <View style={styles.vibeEditorHeading}>
            <Eyebrow>Personalize VibeTravel</Eyebrow>
            <Text style={styles.vibeEditorTitle}>Your Family Vibe</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Family Vibe editor" onPress={() => { Keyboard.dismiss(); setEditingVibe(false) }} style={styles.vibeEditorClose}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.vibeEditorContent} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
          <View style={styles.vibeSection}>
            <Text style={styles.vibeSectionLabel}>FAMILY NAME</Text>
            <Text style={styles.vibeSectionHint}>What should we call your travel group?</Text>
            <TextInput
              value={vibeDraft.family_name ?? ""}
              onChangeText={(family_name) => setVibeDraft((current) => ({ ...current, family_name }))}
              placeholder="The Asaya family"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={styles.vibeNameInput}
            />
          </View>

          <View style={styles.vibeSection}>
            <Text style={styles.vibeSectionLabel}>TRAVEL STYLE</Text>
            <Text style={styles.vibeSectionTitle}>How does your family like to travel?</Text>
            <Text style={styles.vibeSectionHint}>Choose all that fit. These shape Explore and your itineraries.</Text>
            <View style={styles.vibeChoices}>
              {travelStyleOptions.map((option) => {
                const active = vibeDraft.travel_style.includes(option)
                return (
                  <Pressable key={option} onPress={() => toggleVibeChoice("travel_style", option)} style={[styles.vibeChoice, active && styles.vibeChoiceActive]}>
                    <Text style={[styles.vibeChoiceText, active && styles.vibeChoiceTextActive]}>{option}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.vibeSection}>
            <Text style={styles.vibeSectionLabel}>PACE</Text>
            <Text style={styles.vibeSectionTitle}>How full should a day feel?</Text>
            <View style={styles.vibeChoices}>
              {paceOptions.map((option) => {
                const active = vibeDraft.pace === option
                return (
                  <Pressable key={option} onPress={() => setVibeDraft((current) => ({ ...current, pace: option }))} style={[styles.vibeChoice, active && styles.vibeChoiceActive]}>
                    <Text style={[styles.vibeChoiceText, active && styles.vibeChoiceTextActive]}>{option[0].toUpperCase() + option.slice(1)}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.vibeSection}>
            <Text style={styles.vibeSectionLabel}>TYPICAL TRIP BUDGET</Text>
            <View style={styles.vibeChoices}>
              {budgetOptions.map((option) => {
                const active = vibeDraft.budget_preference === option.value
                return (
                  <Pressable key={option.value} onPress={() => setVibeDraft((current) => ({ ...current, budget_preference: option.value }))} style={[styles.vibeChoice, styles.budgetChoice, active && styles.vibeChoiceActive]}>
                    <Text style={[styles.vibeChoiceText, active && styles.vibeChoiceTextActive]}>{option.label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.vibeSection}>
            <Text style={styles.vibeSectionLabel}>DIETARY NEEDS</Text>
            <Text style={styles.vibeSectionHint}>We’ll use these when suggesting food and daily plans.</Text>
            <View style={styles.vibeChoices}>
              {dietaryOptions.map((option) => {
                const active = vibeDraft.dietary.includes(option)
                return (
                  <Pressable key={option} onPress={() => toggleVibeChoice("dietary", option)} style={[styles.vibeChoice, active && styles.vibeChoiceActive]}>
                    <Text style={[styles.vibeChoiceText, active && styles.vibeChoiceTextActive]}>{option}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.vibeEditorFooter}>
          <Button loading={savingVibe} onPress={saveFamilyVibe}>Save Family Vibe</Button>
        </View>
      </SafeAreaView>
    </Modal>
    </>
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
  emptyVibeText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  settingsCard: { paddingVertical: 4 },
  setting: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  settingText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.6 },
  dangerText: { color: colors.danger },
  deleteButton: { marginTop: -5 },
  version: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 6 },
  vibeEditorSafe: { flex: 1, backgroundColor: colors.background },
  vibeEditorHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vibeEditorHeading: { flex: 1, paddingRight: 18 },
  vibeEditorTitle: { color: colors.text, fontSize: 32, lineHeight: 38, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  vibeEditorClose: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  vibeEditorContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 38 },
  vibeSection: { paddingVertical: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  vibeSectionLabel: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  vibeSectionTitle: { color: colors.text, fontSize: 21, lineHeight: 27, fontFamily: typography.serif, fontWeight: "700", marginTop: 6 },
  vibeSectionHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  vibeNameInput: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.text, color: colors.text, fontSize: 17, fontWeight: "700", paddingHorizontal: 1, marginTop: 8 },
  vibeChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  vibeChoice: { minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  vibeChoiceActive: { borderColor: colors.dark, backgroundColor: colors.dark },
  vibeChoiceText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  vibeChoiceTextActive: { color: "#FFFFFF" },
  budgetChoice: { minWidth: 62 },
  vibeEditorFooter: { padding: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
})
