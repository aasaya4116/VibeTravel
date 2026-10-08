import { useCallback, useMemo, useState } from "react"
import { router } from "expo-router"
import { OnboardingFlow } from "@/components/onboarding-flow"
import { Button, EmptyState, LoadingScreen, Screen } from "@/components/ui"
import { useDashboard } from "@/hooks/use-dashboard"
import { updateFamilyVibe } from "@/lib/data"
import {
  mergeOnboardingChoices,
  toVibeDraft,
  type FamilyVibeDraft,
} from "@/lib/family-vibe-options"
import {
  clearOnboardingDraft,
  onboardingCompletionMetadata,
  readOnboardingDraft,
  writeOnboardingDraft,
} from "@/lib/onboarding"
import { supabase } from "@/lib/supabase"
import type { FamilyVibe } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

const saveFailureMessage = "We couldn’t save your choices. They’re still here—check your connection and try again."
const skipFailureMessage = "We couldn’t finish setup right now. Check your connection and try again."

export default function OnboardingScreen() {
  const { session, user } = useAuth()
  const { data, loading, error: dashboardError, refresh } = useDashboard()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const userId = user?.id ?? ""
  const initialDraft = useMemo(() => {
    const base = toVibeDraft(data?.familyVibe)
    const stored = userId ? readOnboardingDraft(userId) : null
    return stored ? { ...base, ...stored } : base
  }, [data?.familyVibe, userId])
  const persistDraft = useCallback((draft: FamilyVibeDraft) => {
    if (!userId) return
    writeOnboardingDraft(userId, draft)
  }, [userId])

  if (loading && !data) return <LoadingScreen label="Preparing your travel world…" />
  if (!session || !user) return <LoadingScreen />
  if (dashboardError && !data) {
    return (
      <Screen>
        <EmptyState
          title="We couldn’t prepare your travel world."
          body="Your account is safe. Check your connection, then try loading setup again."
          action={<Button onPress={() => void refresh(true)}>Try again</Button>}
        />
      </Screen>
    )
  }

  const displayName = data?.profile?.display_name
    || (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "")
    || "Traveler"

  async function completeOnboarding(draft: FamilyVibeDraft) {
    setSaving(true)
    setError(null)
    try {
      const { data: latestVibe, error: latestVibeError } = await supabase
        .from("family_vibes")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
      if (latestVibeError) throw latestVibeError
      await updateFamilyVibe(
        userId,
        mergeOnboardingChoices(latestVibe as FamilyVibe | null, draft),
      )
      const { error: authError } = await supabase.auth.updateUser({
        data: onboardingCompletionMetadata("completed"),
      })
      if (authError) throw authError
      clearOnboardingDraft(userId)
      await refresh()
      return true
    } catch {
      setError(saveFailureMessage)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function skipOnboarding() {
    setSaving(true)
    setError(null)
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: onboardingCompletionMetadata("skipped"),
      })
      if (authError) throw authError
      clearOnboardingDraft(userId)
      router.replace("/(tabs)" as never)
    } catch {
      setError(skipFailureMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingFlow
      accessToken={session.access_token}
      displayName={displayName}
      initialDraft={initialDraft}
      saving={saving}
      error={error}
      onComplete={completeOnboarding}
      onSkip={skipOnboarding}
      onClearError={() => setError(null)}
      onDraftChange={persistDraft}
      onExplore={() => router.replace("/explore" as never)}
      onPlanTrip={() => router.replace("/trips/new")}
    />
  )
}
