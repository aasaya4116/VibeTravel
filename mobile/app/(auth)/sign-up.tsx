import { useRef, useState } from "react"
import { Link } from "expo-router"
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button } from "@/components/ui"
import { Text, TextInput } from "@/components/typography"
import { colors, radii, typography } from "@/lib/theme"
import { onboardingPendingMetadata } from "@/lib/onboarding"
import { hasSupabaseConfiguration, supabase } from "@/lib/supabase"

export default function SignUpScreen() {
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const [ownerName, setOwnerName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function signUp() {
    setLoading(true)
    setError(null)
    setMessage(null)
    if (!hasSupabaseConfiguration()) {
      setError("This build is missing its Supabase configuration.")
      setLoading(false)
      return
    }
    try {
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: ownerName.trim(),
            ...onboardingPendingMetadata(),
          },
        },
      })
      if (result.error) setError(result.error.message)
      else if (!result.data.session) setMessage("Check your email to confirm your account, then return here to sign in.")
    } catch {
      setError("We couldn't create your account. Check your connection and try again.")
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
          <Text style={styles.eyebrow}>Create your travel world</Text>
          <Text style={styles.title}>Meet your family’s new trip companion.</Text>
          <View style={styles.form}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              accessibilityLabel="Your name"
              autoCapitalize="words"
              autoComplete="name"
              maxLength={80}
              value={ownerName}
              onChangeText={setOwnerName}
              blurOnSubmit={false}
              onSubmitEditing={() => emailInputRef.current?.focus()}
              placeholder="Adebowale"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              style={styles.input}
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailInputRef}
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              style={styles.input}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordInputRef}
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={styles.input}
            />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
            <Button onPress={signUp} loading={loading} disabled={ownerName.trim().length < 2 || !email.trim() || password.length < 6}>Create account</Button>
          </View>
          <Text style={styles.agreement}>By creating an account, you agree to the <Link href="/terms" style={styles.link}>Terms</Link> and acknowledge the <Link href="/privacy" style={styles.link}>Privacy Policy</Link>.</Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable accessibilityRole="link" style={styles.backLink}><Text style={styles.back}>Already have an account? Sign in</Text></Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontFamily: typography.serif, fontWeight: "700", marginTop: 10, marginBottom: 25 },
  form: { gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 4 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 16, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10, fontSize: 13 },
  success: { color: colors.success, backgroundColor: colors.successSoft, padding: 12, borderRadius: 10, fontSize: 13 },
  agreement: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 18 },
  link: { color: colors.primary, fontWeight: "700" },
  backLink: { minHeight: 44, justifyContent: "center", marginTop: 9 },
  back: { color: colors.primary, fontWeight: "800", textAlign: "center" },
})
