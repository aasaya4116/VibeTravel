import { useState } from "react"
import * as Linking from "expo-linking"
import { Link } from "expo-router"
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { BrandMark } from "@/components/brand-mark"
import { Button, Eyebrow } from "@/components/ui"
import { Text, TextInput } from "@/components/typography"
import { colors, radii, typography } from "@/lib/theme"
import { hasSupabaseConfiguration, supabase } from "@/lib/supabase"

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendResetLink() {
    Keyboard.dismiss()
    setLoading(true)
    setError(null)

    if (!hasSupabaseConfiguration()) {
      setError("This build is missing its Supabase configuration.")
      setLoading(false)
      return
    }

    try {
      const redirectTo = Linking.createURL("reset-password")
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (resetError) throw resetError
      setSent(true)
    } catch {
      setError("We couldn’t send the reset email. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <BrandMark size={38} />
            <Text style={styles.brand}>VibeTravel</Text>
          </View>
          <Eyebrow>Account recovery</Eyebrow>
          <Text style={styles.title}>{sent ? "Check your inbox." : "Find your way back."}</Text>
          <Text style={styles.subtitle}>
            {sent
              ? `If an account exists for ${email.trim()}, a secure reset link is on its way.`
              : "We’ll email you a secure link to choose a new password."}
          </Text>

          {sent ? (
            <View style={styles.actions}>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable accessibilityRole="link" style={styles.primaryLink}>
                  <Text style={styles.primaryLinkText}>Return to sign in</Text>
                </Pressable>
              </Link>
              <Pressable accessibilityRole="button" onPress={() => setSent(false)} style={styles.secondaryLink}>
                <Text style={styles.secondaryLinkText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={sendResetLink}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                returnKeyType="send"
                style={styles.input}
                value={email}
              />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Button onPress={sendResetLink} loading={loading} disabled={!email.trim()}>
                Email me a reset link
              </Button>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable accessibilityRole="link" style={styles.backLink}>
                  <Text style={styles.secondaryLinkText}>Back to sign in</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, width: "100%", maxWidth: "100%", backgroundColor: colors.background },
  page: { flex: 1, width: "100%", maxWidth: "100%" },
  content: { flexGrow: 1, width: "100%", maxWidth: "100%", minWidth: 0, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 },
  brandRow: { width: "100%", minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 42 },
  brand: { color: colors.text, fontFamily: typography.serif, fontSize: 19 },
  title: { width: "100%", flexShrink: 1, color: colors.text, fontFamily: typography.serif, fontSize: 38, lineHeight: 43, marginTop: 9 },
  subtitle: { width: "100%", flexShrink: 1, color: colors.textMuted, fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 30 },
  form: { width: "100%", maxWidth: "100%", minWidth: 0, gap: 12 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.medium,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radii.medium, fontSize: 13 },
  actions: { width: "100%", maxWidth: "100%", minWidth: 0, gap: 10, marginTop: 4 },
  primaryLink: { minHeight: 50, borderRadius: radii.medium, backgroundColor: colors.dark, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryLinkText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.25 },
  secondaryLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  backLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryLinkText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
})
