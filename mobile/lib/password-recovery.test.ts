import { describe, expect, it } from "vitest"
import { parseNativeRecoveryUrl, validateRecoveryPassword } from "./password-recovery"

describe("parseNativeRecoveryUrl", () => {
  it("reads an implicit recovery session from a URL fragment", () => {
    expect(parseNativeRecoveryUrl(
      "vibetravel://reset-password#access_token=access-123&refresh_token=refresh-456&type=recovery",
    )).toEqual({ kind: "session", accessToken: "access-123", refreshToken: "refresh-456" })
  })

  it("reads PKCE codes and token hashes from query parameters", () => {
    expect(parseNativeRecoveryUrl("vibetravel://reset-password?code=pkce-123&type=recovery"))
      .toEqual({ kind: "code", code: "pkce-123" })
    expect(parseNativeRecoveryUrl("vibetravel://reset-password?token_hash=hash-123&type=recovery"))
      .toEqual({ kind: "token-hash", tokenHash: "hash-123" })
  })

  it("surfaces provider errors and decodes their message", () => {
    expect(parseNativeRecoveryUrl(
      "vibetravel://reset-password?error=access_denied&error_description=Link+has+expired",
    )).toEqual({ kind: "error", message: "Link has expired" })
  })

  it("rejects malformed and non-recovery links", () => {
    expect(parseNativeRecoveryUrl(null)).toEqual({ kind: "invalid" })
    expect(parseNativeRecoveryUrl("not a url")).toEqual({ kind: "invalid" })
    expect(parseNativeRecoveryUrl(
      "vibetravel://reset-password#access_token=a&refresh_token=b&type=signup",
    )).toEqual({ kind: "invalid" })
  })
})

describe("validateRecoveryPassword", () => {
  it("requires Supabase's minimum password length", () => {
    expect(validateRecoveryPassword("short", "short")).toBe("Use at least 6 characters.")
  })

  it("requires matching passwords", () => {
    expect(validateRecoveryPassword("new-pass", "different"))
      .toBe("The passwords don’t match.")
  })

  it("accepts a valid matching password", () => {
    expect(validateRecoveryPassword("new-pass", "new-pass")).toBeNull()
  })
})
