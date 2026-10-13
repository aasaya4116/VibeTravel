const AUTH_REDIRECT_BASE = "https://vibetravel.local"

/**
 * Keep post-auth navigation inside VibeTravel. Supabase callback URLs can be
 * opened from email, so their `next` value must never be treated as a trusted
 * external URL.
 */
export function sanitizeAuthRedirect(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  if (!value) return fallback

  const candidate = value.trim()
  if (
    !candidate.startsWith("/")
    || candidate.startsWith("//")
    || candidate.includes("\\")
    || /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return fallback
  }

  try {
    const resolved = new URL(candidate, AUTH_REDIRECT_BASE)
    if (resolved.origin !== AUTH_REDIRECT_BASE) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}
