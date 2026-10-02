import { useState } from "react"
import { Link } from "expo-router"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button } from "@/components/ui"
import { colors, radii } from "@/lib/theme"
import { hasSupabaseConfiguration, supabase } from "@/lib/supabase"

export default function SignInScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setLoading(true)
    setError(null)
    if (!hasSupabaseConfiguration()) {
      setError("This build is missing its Supabase configuration.")
      setLoading(false)
      return
    }
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (result.error) setError(result.error.message === "Invalid login credentials" ? "Incorrect email or password." : result.error.message)
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.brandMark}><Text style={styles.plane}>✈</Text></View>
        <Text style={styles.brand}>VibeTravel</Text>
        <Text style={styles.title}>Your family trip, in your pocket.</Text>
        <Text style={styles.subtitle}>Open your itinerary, get directions, and keep the day moving—even when your connection does not.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button onPress={signIn} loading={loading} disabled={!email || !password}>Sign in</Button>
        </View>

        <Text style={styles.switchText}>
          New to VibeTravel?{" "}
          <Link href="/(auth)/sign-up" asChild>
            <Pressable><Text style={styles.link}>Create an account</Text></Pressable>
          </Link>
        </Text>
        <View style={styles.legalRow}>
          <Link href="/privacy" style={styles.legalLink}>Privacy</Link>
          <Text style={styles.dot}>•</Text>
          <Link href="/terms" style={styles.legalLink}>Terms</Link>
          <Text style={styles.dot}>•</Text>
          <Link href="/support" style={styles.legalLink}>Support</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, justifyContent: "center", padding: 24 },
  brandMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  plane: { color: "#FFFFFF", fontSize: 23 },
  brand: { color: colors.primary, fontSize: 16, fontWeight: "800", marginBottom: 24 },
  title: { color: colors.text, fontSize: 32, lineHeight: 37, fontWeight: "800", maxWidth: 330 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 28 },
  form: { gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 4 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 16, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10, fontSize: 13 },
  switchText: { color: colors.textMuted, textAlign: "center", marginTop: 24, fontSize: 14 },
  link: { color: colors.primary, fontWeight: "800" },
  legalRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 22 },
  legalLink: { color: colors.textMuted, fontSize: 12 },
  dot: { color: colors.border },
})
