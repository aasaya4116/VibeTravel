import { describe, expect, it } from "vitest"
import {
  MOBILE_ONBOARDING_METADATA_KEYS,
  CURRENT_ONBOARDING_VERSION,
  clearOnboardingDraft,
  getMobileRootNavigationTarget,
  isOnboardingPending,
  onboardingCompletionMetadata,
  onboardingPendingMetadata,
  readOnboardingDraft,
  writeOnboardingDraft,
} from "./onboarding"
import { toVibeDraft } from "./family-vibe-options"

const pendingMetadata = {
  display_name: "Adebowale Asaya",
  ...onboardingPendingMetadata(),
}

describe("mobile onboarding metadata", () => {
  it("marks only a newly created mobile account as pending", () => {
    expect(pendingMetadata).toEqual({
      display_name: "Adebowale Asaya",
      [MOBILE_ONBOARDING_METADATA_KEYS.pending]: true,
      [MOBILE_ONBOARDING_METADATA_KEYS.version]: CURRENT_ONBOARDING_VERSION,
    })
    expect(isOnboardingPending(pendingMetadata)).toBe(true)
  })

  it("never forces legacy accounts without the explicit pending marker", () => {
    expect(isOnboardingPending(undefined)).toBe(false)
    expect(isOnboardingPending({})).toBe(false)
    expect(isOnboardingPending({ display_name: "Existing traveler" })).toBe(false)
    expect(isOnboardingPending({
      [MOBILE_ONBOARDING_METADATA_KEYS.version]: CURRENT_ONBOARDING_VERSION,
    })).toBe(false)
  })

  it("rejects malformed and unsupported pending versions", () => {
    expect(isOnboardingPending({
      [MOBILE_ONBOARDING_METADATA_KEYS.pending]: "true",
      [MOBILE_ONBOARDING_METADATA_KEYS.version]: CURRENT_ONBOARDING_VERSION,
    })).toBe(false)
    expect(isOnboardingPending({
      [MOBILE_ONBOARDING_METADATA_KEYS.pending]: true,
      [MOBILE_ONBOARDING_METADATA_KEYS.version]: "1",
    })).toBe(false)
    expect(isOnboardingPending({
      [MOBILE_ONBOARDING_METADATA_KEYS.pending]: true,
      [MOBILE_ONBOARDING_METADATA_KEYS.version]: CURRENT_ONBOARDING_VERSION + 1,
    })).toBe(false)
  })

  it.each(["completed", "skipped"] as const)("resolves onboarding durably as %s", (outcome) => {
    const patch = onboardingCompletionMetadata(outcome)

    expect(patch).toEqual({
      [MOBILE_ONBOARDING_METADATA_KEYS.pending]: false,
      [MOBILE_ONBOARDING_METADATA_KEYS.version]: CURRENT_ONBOARDING_VERSION,
      [MOBILE_ONBOARDING_METADATA_KEYS.outcome]: outcome,
    })
    expect(isOnboardingPending({ ...pendingMetadata, ...patch })).toBe(false)
  })

  it("uses completed as the default resolution for the primary finish action", () => {
    expect(onboardingCompletionMetadata()[MOBILE_ONBOARDING_METADATA_KEYS.outcome]).toBe("completed")
  })
})

describe("mobile root navigation", () => {
  it("waits for authentication state before navigating", () => {
    expect(getMobileRootNavigationTarget({ loading: true, hasSession: false })).toBeNull()
  })

  it("sends signed-out users to sign in while leaving auth and legal screens alone", () => {
    expect(getMobileRootNavigationTarget({ loading: false, hasSession: false })).toBe("/(auth)/sign-in")
    expect(getMobileRootNavigationTarget({ loading: false, hasSession: false, rootSegment: "(tabs)" })).toBe("/(auth)/sign-in")
    expect(getMobileRootNavigationTarget({ loading: false, hasSession: false, rootSegment: "(auth)" })).toBeNull()
    expect(getMobileRootNavigationTarget({ loading: false, hasSession: false, rootSegment: "privacy" })).toBeNull()
    expect(getMobileRootNavigationTarget({ loading: false, hasSession: false, rootSegment: "terms" })).toBeNull()
    expect(getMobileRootNavigationTarget({ loading: false, hasSession: false, rootSegment: "support" })).toBeNull()
  })

  it("sends an explicitly pending new user to onboarding", () => {
    expect(getMobileRootNavigationTarget({
      loading: false,
      hasSession: true,
      rootSegment: "(auth)",
      userMetadata: pendingMetadata,
    })).toBe("/onboarding")
    expect(getMobileRootNavigationTarget({
      loading: false,
      hasSession: true,
      rootSegment: "(tabs)",
      userMetadata: pendingMetadata,
    })).toBe("/onboarding")
    expect(getMobileRootNavigationTarget({
      loading: false,
      hasSession: true,
      rootSegment: "onboarding",
      userMetadata: pendingMetadata,
    })).toBeNull()
  })

  it("allows a pending user to open public legal and support screens", () => {
    for (const rootSegment of ["privacy", "terms", "support"]) {
      expect(getMobileRootNavigationTarget({
        loading: false,
        hasSession: true,
        rootSegment,
        userMetadata: pendingMetadata,
      })).toBeNull()
    }
  })

  it("never forces an existing user without the marker into onboarding", () => {
    expect(getMobileRootNavigationTarget({
      loading: false,
      hasSession: true,
      userMetadata: { display_name: "Existing traveler" },
    })).toBe("/(tabs)")
    expect(getMobileRootNavigationTarget({
      loading: false,
      hasSession: true,
      rootSegment: "(tabs)",
      userMetadata: { display_name: "Existing traveler" },
    })).toBeNull()
    expect(getMobileRootNavigationTarget({
      loading: false,
      hasSession: true,
      rootSegment: "(auth)",
      userMetadata: { display_name: "Existing traveler" },
    })).toBe("/(tabs)")
  })

  it("lets the onboarding UI own its post-completion and post-skip exit", () => {
    for (const outcome of ["completed", "skipped"] as const) {
      expect(getMobileRootNavigationTarget({
        loading: false,
        hasSession: true,
        rootSegment: "onboarding",
        userMetadata: { ...pendingMetadata, ...onboardingCompletionMetadata(outcome) },
      })).toBeNull()
    }
  })
})

describe("mobile onboarding draft", () => {
  it("restores only the short flow's editable choices and clears them", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const previousStorage = globalThis.localStorage
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage })

    try {
      writeOnboardingDraft("user-1", {
        ...toVibeDraft(null),
        family_name: "Must not be stored",
        travel_style: ["Foodie family", "Art & design"],
        dietary: ["Nut allergy"],
        pace: "slow",
        budget_preference: "$$",
      })

      expect(readOnboardingDraft("user-1")).toEqual({
        travel_style: ["Foodie family", "Art & design"],
        dietary: ["Nut allergy"],
        pace: "slow",
        budget_preference: "$$",
      })
      clearOnboardingDraft("user-1")
      expect(readOnboardingDraft("user-1")).toBeNull()
    } finally {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage })
    }
  })
})
