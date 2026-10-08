import { Redirect } from "expo-router"
import { LoadingScreen } from "@/components/ui"
import { isOnboardingPending } from "@/lib/onboarding"
import { useAuth } from "@/providers/auth-provider"

export default function Index() {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  const href = !session
    ? "/(auth)/sign-in"
    : isOnboardingPending(session.user.user_metadata)
      ? "/onboarding"
      : "/(tabs)"
  return <Redirect href={href} />
}
