import { useState } from "react"
import { Link } from "expo-router"
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button } from "@/components/ui"
import { Text, TextInput } from "@/components/typography"
import { colors, radii, typography } from "@/lib/theme"
import { hasSupabaseConfiguration, supabase } from "@/lib/supabase"

export default function SignUpScreen() {
  const [name, setName] = useState("")
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
    const result = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    })
    if (result.error) setError(result.error.message)
    else if (!result.data.session) setMessage("Check your email to confirm your account, then return here to sign in.")
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Text style={styles.eyebrow}>Create your travel world</Text>
        <Text style={styles.title}>Meet your family’s new trip companion.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Display name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="The Johnsons" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.label}>Email</Text>
          <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.label}>Password</Text>
          <TextInput autoCapitalize="none" secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={colors.textMuted} style={styles.input} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}
          <Button onPress={signUp} loading={loading} disabled={!name || !email || password.length < 6}>Create account</Button>
        </View>
        <Text style={styles.agreement}>By creating an account, you agree to the <Link href="/terms" style={styles.link}>Terms</Link> and acknowledge the <Link href="/privacy" style={styles.link}>Privacy Policy</Link>.</Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable><Text style={styles.back}>Already have an account? Sign in</Text></Pressable>
        </Link>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, justifyContent: "center", padding: 24 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontFamily: typography.serif, fontWeight: "700", marginTop: 10, marginBottom: 25 },
  form: { gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: 4 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.medium, paddingHorizontal: 16, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10, fontSize: 13 },
  success: { color: colors.success, backgroundColor: colors.successSoft, padding: 12, borderRadius: 10, fontSize: 13 },
  agreement: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 18 },
  link: { color: colors.primary, fontWeight: "700" },
  back: { color: colors.primary, fontWeight: "800", textAlign: "center", marginTop: 20 },
})
