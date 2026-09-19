import { describe, expect, it } from "vitest"
import { buildShareUrl, isValidShareToken } from "./trip-sharing"
import { createShareToken } from "./trip-sharing-server"

describe("trip sharing", () => {
  it("creates a high-entropy URL-safe token", () => {
    const token = createShareToken()

    expect(token).toHaveLength(43)
    expect(isValidShareToken(token)).toBe(true)
  })

  it("creates a different token for each link", () => {
    expect(createShareToken()).not.toBe(createShareToken())
  })

  it("rejects malformed share tokens", () => {
    expect(isValidShareToken("too-short")).toBe(false)
    expect(isValidShareToken("x".repeat(42) + "/")).toBe(false)
  })

  it("builds a share URL without duplicate slashes", () => {
    const token = "x".repeat(43)

    expect(buildShareUrl("https://vibetravel.example/", token)).toBe(
      `https://vibetravel.example/share/${token}`
    )
  })
})
