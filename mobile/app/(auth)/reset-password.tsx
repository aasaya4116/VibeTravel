import { useEffect, useRef, useState } from "react"
import * as Linking from "expo-linking"
import { Link, useRouter, type Href } from "expo-router"
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
import { parseNativeRecoveryUrl, validateRecoveryPassword } from "@/lib/password-recovery"
import { hasSupabaseConfiguration, supabase } from "@/lib/supabase"
import { colors, radii, typography } from "@/lib/theme"

export default function ResetPasswordScreen() {
  const router = useRouter()
  // Unlike the deprecated useURL hook, this returns the cold-start deep link
  // immediately, so we do not briefly misclassify a valid email link as expired.
  const recoveryUrl = Linking.useLinkingURL()
  const processedUrl = useRef<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [opening, setOpening] = useState(true)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function openRecoverySession() {
      if (!hasSupabaseConfiguration()) {
        if (active) {
          setError("This build is missing its Supabase configuration.")
          setOpening(false)
        }
        return
      }

      if (recoveryUrl && processedUrl.current !== recoveryUrl) {
        processedUrl.current = recoveryUrl
        if (active) setError(null)
        const credentials = parseNativeRecoveryUrl(recoveryUrl)

        if (credentials.kind === "error") {
          if (active) {
            setError("This reset link has expired. Request a new one to continue.")
            setOpening(false)
          }
          return
        }

        let sessionError: Error | null = null
        if (credentials.kind === "session") {
          const result = await supabase.auth.setSession({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
          })
          sessionError = result.error
        } else if (credentials.kind === "code") {
          const result = await supabase.auth.exchangeCodeForSession(credentials.code)
          sessionError = result.error
        } else if (credentials.kind === "token-hash") {
          const result = await supabase.auth.verifyOtp({ token_hash: credentials.tokenHash, type: "recovery" })
          sessionError = result.error
        }

        if (sessionError) {
          if (active) {
            setError("This reset link has expired. Request a new one to continue.")
            setOpening(false)
          }
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!active) return
      setReady(Boolean(data.session))
      setError(data.session ? null : "This reset link has expired. Request a new one to continue.")
      setOpening(false)
    }

    openRecoverySession().catch(() => {
      if (!active) return
      setError("We couldn’t open this reset link. Please request a new one.")
      setOpening(false)
    })

    return () => { active = false }
  }, [recoveryUrl])

  async function updatePassword() {
    Keyboard.dismiss()
    const validationError = validateRecoveryPassword(password, confirmation)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setComplete(true)
    } catch {
      setError("We couldn’t update your password. Please request a new reset link and try again.")
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
          <Eyebrow>{complete ? "All set" : "Secure your account"}</Eyebrow>
          <Text style={styles.title}>{complete ? "Your password is updated." : "Choose a new password."}</Text>
          <Text style={styles.subtitle}>
            {complete
              ? "Your travel plans are right where you left them."
              : "Use at least 6 characters, then you’ll be ready to continue planning."}
          </Text>

          {opening ? (
            <Text accessibilityLiveRegion="polite" style={styles.status}>Opening your secure link…</Text>
          ) : complete ? (
            <Button onPress={() => router.replace("/(tabs)")}>Continue to VibeTravel</Button>
          ) : ready ? (
            <View style={styles.form}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                accessibilityLabel="New password"
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.input}
                value={password}
              />
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                accessibilityLabel="Confirm new password"
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setConfirmation}
                onSubmitEditing={updatePassword}
                placeholder="Enter it again"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                secureTextEntry
                style={styles.input}
                value={confirmation}
              />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Button onPress={updatePassword} loading={loading} disabled={!password || !confirmation}>
                Update password
              </Button>
            </View>
          ) : (
            <View style={styles.actions}>
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Link href={"/forgot-password" as Href} asChild>
                <Pressable accessibilityRole="link" style={styles.primaryLink}>
                  <Text style={styles.primaryLinkText}>Request a new link</Text>
                </Pressable>
              </Link>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable accessibilityRole="link" style={styles.secondaryLink}>
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
  status: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: 18 },
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
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radii.medium, fontSize: 13, lineHeight: 19 },
  actions: { width: "100%", maxWidth: "100%", minWidth: 0, gap: 10 },
  primaryLink: { minHeight: 50, borderRadius: radii.medium, backgroundColor: colors.dark, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryLinkText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.25 },
  secondaryLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryLinkText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
})
