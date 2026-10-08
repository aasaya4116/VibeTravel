import { describe, expect, it } from "vitest"
import {
  destinationOptionFromCard,
  isVerifiedDestinationOption,
  needsTripDestinationConfirmation,
  normalizeDestinationOption,
} from "./destination-options"
import { findDestinationCard } from "./destinations"

describe("mobile destination resolution", () => {
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
})
