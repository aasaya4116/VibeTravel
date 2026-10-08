import type { FamilyVibeDraft } from "./family-vibe-options"

export const CURRENT_ONBOARDING_VERSION = 1

export const MOBILE_ONBOARDING_METADATA_KEYS = {
  pending: "vibetravel_mobile_onboarding_pending",
  version: "vibetravel_mobile_onboarding_version",
  outcome: "vibetravel_mobile_onboarding_outcome",
} as const

export type MobileOnboardingOutcome = "completed" | "skipped"

type UserMetadata = Record<string, unknown> | null | undefined

export interface MobileRootNavigationInput {
  loading: boolean
  hasSession: boolean
  rootSegment?: string
  userMetadata?: UserMetadata
}

export type MobileRootNavigationTarget = "/(auth)/sign-in" | "/onboarding" | "/(tabs)" | null

const PUBLIC_ROOT_SEGMENTS = new Set(["privacy", "terms", "support"])
const ONBOARDING_DRAFT_PREFIX = "vibetravel:mobile:onboarding-draft:v1"

export type OnboardingDraftSnapshot = Pick<
  FamilyVibeDraft,
  "travel_style" | "dietary" | "pace" | "budget_preference"
>

function onboardingDraftKey(userId: string) {
  return `${ONBOARDING_DRAFT_PREFIX}:${userId}`
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

export function readOnboardingDraft(userId: string): OnboardingDraftSnapshot | null {
  try {
    const raw = globalThis.localStorage?.getItem(onboardingDraftKey(userId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<OnboardingDraftSnapshot>
    if (
      !isStringArray(value.travel_style)
      || !isStringArray(value.dietary)
      || !["slow", "moderate", "fast"].includes(value.pace ?? "")
      || !["free", "$", "$$", "$$$", "any"].includes(value.budget_preference ?? "")
    ) return null
    return {
      travel_style: value.travel_style.slice(0, 3),
      dietary: value.dietary,
      pace: value.pace as OnboardingDraftSnapshot["pace"],
      budget_preference: value.budget_preference as OnboardingDraftSnapshot["budget_preference"],
    }
  } catch {
    return null
  }
}

export function writeOnboardingDraft(userId: string, draft: FamilyVibeDraft) {
  try {
    const snapshot: OnboardingDraftSnapshot = {
      travel_style: draft.travel_style.slice(0, 3),
      dietary: [...draft.dietary],
      pace: draft.pace,
      budget_preference: draft.budget_preference,
    }
    globalThis.localStorage?.setItem(onboardingDraftKey(userId), JSON.stringify(snapshot))
  } catch {
    // Draft persistence is best-effort and must never block onboarding.
  }
}

export function clearOnboardingDraft(userId: string) {
  try {
    globalThis.localStorage?.removeItem(onboardingDraftKey(userId))
  } catch {
    // A stale local draft is harmless because completed users are not gated.
  }
}

/**
 * Only users explicitly marked by the mobile sign-up flow enter onboarding.
 * Legacy accounts and malformed metadata always fall through to the app.
 */
export function isOnboardingPending(metadata: UserMetadata) {
  if (!metadata || metadata[MOBILE_ONBOARDING_METADATA_KEYS.pending] !== true) return false

  const version = metadata[MOBILE_ONBOARDING_METADATA_KEYS.version]
  return (
    typeof version === "number"
    && Number.isInteger(version)
    && version >= 1
    && version <= CURRENT_ONBOARDING_VERSION
  )
}

/** Metadata marker written when a new account is created from the mobile app. */
export function onboardingPendingMetadata() {
  return {
    [MOBILE_ONBOARDING_METADATA_KEYS.pending]: true,
    [MOBILE_ONBOARDING_METADATA_KEYS.version]: CURRENT_ONBOARDING_VERSION,
  }
}

/**
 * Metadata patch for the onboarding UI to pass to supabase.auth.updateUser.
 * Completion and skip are both durable decisions; neither account is forced
 * back through onboarding on a later device or app launch.
 */
export function onboardingCompletionMetadata(outcome: MobileOnboardingOutcome = "completed") {
  return {
    [MOBILE_ONBOARDING_METADATA_KEYS.pending]: false,
    [MOBILE_ONBOARDING_METADATA_KEYS.version]: CURRENT_ONBOARDING_VERSION,
    [MOBILE_ONBOARDING_METADATA_KEYS.outcome]: outcome,
  }
}

/** Pure routing decision used by the root navigator and unit tests. */
export function getMobileRootNavigationTarget({
  loading,
  hasSession,
  rootSegment,
  userMetadata,
}: MobileRootNavigationInput): MobileRootNavigationTarget {
  if (loading) return null

  const inAuth = rootSegment === "(auth)"
  const inOnboarding = rootSegment === "onboarding"
  const isPublic = Boolean(rootSegment && PUBLIC_ROOT_SEGMENTS.has(rootSegment))

  if (!hasSession) {
    return inAuth || isPublic ? null : "/(auth)/sign-in"
  }

  if (isPublic) return null

  if (isOnboardingPending(userMetadata)) {
    return inOnboarding ? null : "/onboarding"
  }

  // The onboarding screen owns its completion/skip payoff and final replace.
  // Once its metadata changes, leave it mounted until that UI is ready to exit.
  return inAuth || !rootSegment ? "/(tabs)" : null
}
