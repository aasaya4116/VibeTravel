import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { VibeOnboarding } from "@/components/vibe-onboarding"

export default async function VibeOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login?next=/profile/vibe")

  let existingVibe = null

  if (user) {
    const { data: v } = await supabase
      .from("family_vibes")
      .select("*")
      .eq("user_id", user.id)
      .single()
    existingVibe = v
  }

  const params = await searchParams
  const isOnboarding = params.onboarding === "true"

  return <VibeOnboarding existingVibe={existingVibe} isOnboarding={isOnboarding} />
}
