import { useEffect } from "react"
import { Stack, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { useFonts } from "@expo-google-fonts/dm-sans/useFonts"
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular"
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium"
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold"
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold"
import { DMSans_800ExtraBold } from "@expo-google-fonts/dm-sans/800ExtraBold"
import { DMSans_900Black } from "@expo-google-fonts/dm-sans/900Black"
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display/400Regular"
import { AuthProvider, useAuth } from "@/providers/auth-provider"
import { DashboardProvider } from "@/hooks/use-dashboard"
import { LoadingScreen } from "@/components/ui"
import { colors, typography } from "@/lib/theme"

SplashScreen.preventAutoHideAsync().catch(() => undefined)

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
          headerTitleStyle: { fontFamily: typography.sansSemiBold },
          headerBackTitleStyle: { fontFamily: typography.sansMedium },
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
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
    DMSans_900Black,
    DMSerifDisplay_400Regular,
  })

  useEffect(() => {
    if (!fontsLoaded && !fontError) return
    SplashScreen.hideAsync().catch(() => undefined)
  }, [fontError, fontsLoaded])

  if (!fontsLoaded && !fontError) return null

  return (
    <AuthProvider>
      <DashboardProvider>
        <AppNavigator />
      </DashboardProvider>
    </AuthProvider>
  )
}
