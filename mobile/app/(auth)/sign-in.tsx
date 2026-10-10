import { useState } from "react"
import { Link } from "expo-router"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { Button } from "@/components/ui"
import { Text, TextInput } from "@/components/typography"
import { RemoteImageBackground } from "@/components/remote-image"
import { BrandMark } from "@/components/brand-mark"
import { colors, radii, shadows, typography } from "@/lib/theme"
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
    <RemoteImageBackground uri="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf" preset="backdrop" style={styles.backdrop}>
      <StatusBar style="light" />
      <View style={styles.backdropShade} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.heroCopy}>
            <View style={styles.brandRow}><BrandMark size={42} /><Text style={styles.brand}>VibeTravel</Text></View>
            <Text style={styles.eyebrow}>TRAVEL THAT FEELS LIKE YOU</Text>
            <Text style={styles.title}>Your family’s world, beautifully planned.</Text>
            <Text style={styles.subtitle}>Discover places that fit your people, then carry every detail with you.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.welcome}>Welcome back</Text>
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
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </RemoteImageBackground>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.dark },
  backdropShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(14,11,9,0.46)" },
  safe: { flex: 1 },
  page: { flex: 1, justifyContent: "flex-end", paddingTop: 20 },
  heroCopy: { paddingHorizontal: 24, paddingBottom: 26 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 34 },
  brand: { color: "#FFFFFF", fontSize: 18, fontFamily: typography.serif, fontWeight: "700" },
  eyebrow: { color: "#FF9B73", fontSize: 9, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: "#FFFFFF", fontSize: 38, lineHeight: 43, fontFamily: typography.serif, fontWeight: "700", maxWidth: 350, marginTop: 6 },
  subtitle: { color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 340 },
  formCard: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18, ...shadows.floating },
  welcome: { color: colors.text, fontSize: 24, fontFamily: typography.serif, fontWeight: "700", marginBottom: 12 },
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
