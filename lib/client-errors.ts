export type ErrorOperation = "save" | "search" | "load"

const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "fetch failed",
  "networkerror",
  "network error",
  "load failed",
  "internet connection",
]

export function isConnectionError(error: unknown, isOnline = true) {
  if (!isOnline) return true
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

export function getUserFacingError(
  error: unknown,
  fallback: string,
  operation: ErrorOperation = "save",
  isOnline = typeof navigator === "undefined" ? true : navigator.onLine
) {
  if (isConnectionError(error, isOnline)) {
    if (operation === "search") {
      return "You appear to be offline. Reconnect, then try your search again."
    }
    if (operation === "load") {
      return "You appear to be offline. Reconnect, then try again."
    }
    return "You appear to be offline. Your change wasn’t saved—reconnect and try again."
  }

  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback
}
