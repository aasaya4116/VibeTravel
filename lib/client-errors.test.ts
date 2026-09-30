import { describe, expect, it } from "vitest"
import { getUserFacingError, isConnectionError } from "./client-errors"

describe("client errors", () => {
  it("recognizes browser fetch failures", () => {
    expect(isConnectionError(new TypeError("Failed to fetch"), true)).toBe(true)
  })

  it("uses save-specific offline language", () => {
    expect(getUserFacingError(new Error("anything"), "Fallback", "save", false)).toBe(
      "You appear to be offline. Your change wasn’t saved—reconnect and try again."
    )
  })

  it("uses search-specific offline language", () => {
    expect(getUserFacingError(new Error("NetworkError"), "Fallback", "search", true)).toBe(
      "You appear to be offline. Reconnect, then try your search again."
    )
  })

  it("preserves useful non-network errors", () => {
    expect(getUserFacingError(new Error("Trip not found"), "Fallback", "load", true)).toBe(
      "Trip not found"
    )
  })
})
