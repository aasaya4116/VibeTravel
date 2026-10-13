import { describe, expect, it } from "vitest"
import { sanitizeAuthRedirect } from "./auth-redirect"

describe("sanitizeAuthRedirect", () => {
  it("keeps valid in-app paths, queries, and fragments", () => {
    expect(sanitizeAuthRedirect("/dashboard")).toBe("/dashboard")
    expect(sanitizeAuthRedirect("/auth/reset-password?source=email#form")).toBe(
      "/auth/reset-password?source=email#form",
    )
  })

  it("uses the fallback when no destination is supplied", () => {
    expect(sanitizeAuthRedirect(null)).toBe("/dashboard")
    expect(sanitizeAuthRedirect(undefined, "/trips")).toBe("/trips")
  })

  it.each([
    "https://example.com/steal-session",
    "//example.com/steal-session",
    "/\\example.com/steal-session",
    "javascript:alert(1)",
    "   ",
    "/dashboard\nSet-Cookie: stolen=true",
  ])("rejects unsafe redirect value %s", (value) => {
    expect(sanitizeAuthRedirect(value)).toBe("/dashboard")
  })
})
