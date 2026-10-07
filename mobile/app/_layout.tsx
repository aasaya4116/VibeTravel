import { useEffect } from "react"
import { Stack, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { AuthProvider, useAuth } from "@/providers/auth-provider"
import { DashboardProvider } from "@/hooks/use-dashboard"
import { LoadingScreen } from "@/components/ui"
import { colors } from "@/lib/theme"

function AppNavigator() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const root = segments[0]
    const inAuth = root === "(auth)"
    const publicRoute = root === "privacy" || root === "terms" || root === "support"

    if (!session && !inAuth && !publicRoute) router.replace("/(auth)/sign-in")
    if (session && (inAuth || !root)) router.replace("/(tabs)")
  }, [loading, router, segments, session])

  if (loading) return <LoadingScreen />

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trips/[id]" options={{ title: "Trip", headerBackTitle: "Trips" }} />
        <Stack.Screen name="trips/new" options={{ title: "New trip", presentation: "modal" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy Policy" }} />
        <Stack.Screen name="terms" options={{ title: "Terms of Use" }} />
        <Stack.Screen name="support" options={{ title: "Support" }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DashboardProvider>
        <AppNavigator />
      </DashboardProvider>
    </AuthProvider>
  )
}
