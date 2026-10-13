export type NativeRecoveryCredentials =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string }
  | { kind: "token-hash"; tokenHash: string }
  | { kind: "error"; message: string }
  | { kind: "invalid" }

function mergedRecoveryParams(url: URL) {
  const params = new URLSearchParams(url.search)
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
  new URLSearchParams(hash).forEach((value, key) => params.set(key, value))
  return params
}

/** Parse both Supabase implicit-token and PKCE recovery redirects. */
export function parseNativeRecoveryUrl(value: string | null | undefined): NativeRecoveryCredentials {
  if (!value) return { kind: "invalid" }

  try {
    const params = mergedRecoveryParams(new URL(value))
    const authError = params.get("error_description") || params.get("error")
    if (authError) return { kind: "error", message: authError }

    const type = params.get("type")
    if (type && type !== "recovery") return { kind: "invalid" }

    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken }

    const code = params.get("code")
    if (code) return { kind: "code", code }

    const tokenHash = params.get("token_hash")
    if (tokenHash) return { kind: "token-hash", tokenHash }

    return { kind: "invalid" }
  } catch {
    return { kind: "invalid" }
  }
}

export function validateRecoveryPassword(password: string, confirmation: string) {
  if (password.length < 6) return "Use at least 6 characters."
  if (password !== confirmation) return "The passwords don’t match."
  return null
}
