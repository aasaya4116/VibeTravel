import { afterEach, describe, expect, it, vi } from "vitest"
import {
  destinationOptionFromCard,
  isVerifiedDestinationOption,
  needsTripDestinationConfirmation,
  normalizeDestinationOption,
  searchDestinationOptions,
} from "./destination-options"
import { findDestinationCard } from "./destinations"

describe("mobile destination resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("normalizes the worldwide resolver contract", () => {
    const option = normalizeDestinationOption({
      label: "Nairobi, Kenya",
      city: "Nairobi",
      region: "Kenya",
      country: "Kenya",
      placeId: "google:nairobi",
      latitude: -1.286389,
      longitude: 36.817223,
      resolved: true,
      recognized: true,
      provider: "google",
    })

    expect(option).toMatchObject({
      canonicalLabel: "Nairobi, Kenya",
      city: "Nairobi",
      country: "Kenya",
      provider: "google",
      resolved: true,
    })
    expect(isVerifiedDestinationOption(option)).toBe(true)
  })

  it("does not treat recognized curated fallback text as geographically resolved", () => {
    const option = normalizeDestinationOption({
      label: "Abuja, Nigeria",
      city: "Abuja",
      region: "Nigeria",
      placeId: "curated:abuja",
      recognized: true,
      resolved: false,
    })

    expect(option?.recognized).toBe(true)
    expect(option?.resolved).toBe(false)
    expect(isVerifiedDestinationOption(option)).toBe(false)
  })

  it("rejects stale pre-fix curated metadata even when it claimed to be resolved", () => {
    const option = normalizeDestinationOption({
      label: "Tokyo, Japan",
      city: "Tokyo",
      region: "Japan",
      country: "Japan",
      placeId: "curated:tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      provider: "curated",
      resolved: true,
    })

    expect(isVerifiedDestinationOption(option)).toBe(false)
  })

  it("requires legacy fragments such as Nair to be confirmed", () => {
    expect(needsTripDestinationConfirmation("Nair")).toBe(true)
    expect(needsTripDestinationConfirmation("Nairobi, Kenya")).toBe(false)
  })

  it("trusts a cached verified selection with the same canonical label", () => {
    const option = normalizeDestinationOption({
      label: "Abuja, Nigeria",
      city: "Abuja",
      region: "Nigeria",
      placeId: "google:abuja",
      latitude: 9.0765,
      longitude: 7.3986,
      resolved: true,
    })

    expect(needsTripDestinationConfirmation("Abuja, Nigeria", option)).toBe(false)
  })

  it("keeps curated cards as inspiration rather than verified options", () => {
    const lagos = findDestinationCard("Lagos, Nigeria")
    expect(lagos).not.toBeNull()

    const option = destinationOptionFromCard(lagos!)
    expect(option.placeId).toBe("curated:lagos")
    expect(option.resolved).toBe(false)
    expect(isVerifiedDestinationOption(option)).toBe(false)
  })

  it("returns a verified worldwide destination that is not in the curated list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      options: [{
        label: "Annapolis, MD, USA",
        canonicalLabel: "Annapolis, MD, USA",
        city: "Annapolis",
        region: "Maryland",
        country: "United States",
        placeId: "google:annapolis",
        latitude: 38.9784,
        longitude: -76.4922,
        provider: "google",
        resolved: true,
        recognized: true,
        recommended: false,
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })))

    const options = await searchDestinationOptions("Annapolis")

    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({
      canonicalLabel: "Annapolis, MD, USA",
      provider: "google",
      resolved: true,
    })
    expect(isVerifiedDestinationOption(options[0])).toBe(true)
  })
})
