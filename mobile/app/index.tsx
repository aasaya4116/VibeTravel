import { Redirect } from "expo-router"
import { LoadingScreen } from "@/components/ui"
import { useAuth } from "@/providers/auth-provider"

export default function Index() {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return <Redirect href={session ? "/(tabs)" : "/(auth)/sign-in"} />
}
