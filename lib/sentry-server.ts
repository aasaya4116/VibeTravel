import * as Sentry from "@sentry/nextjs"

type ApiFailureContext = {
  route: string
  operation: string
}

type PrivacySafeEvent = Record<string, unknown> & {
  breadcrumbs?: unknown
  contexts?: unknown
  extra?: unknown
  request?: unknown
  tags?: Record<string, string>
  transaction?: string
  user?: unknown
}

type PrivacyScope = {
  addEventProcessor: (
    processor: (event: PrivacySafeEvent) => PrivacySafeEvent
  ) => void
  clearBreadcrumbs: () => void
  setUser: (user: null) => void
}

// Sentry 11's combined Next.js type entry omits several runtime exports that
// are present on both its server and edge bundles. Keep the compatibility cast
// local so route handlers remain fully typed.
const sentryRuntime = Sentry as unknown as {
  captureException: (error: unknown) => string
  withScope: <T>(callback: (scope: PrivacyScope) => T) => T
}

function safeErrorName(error: unknown) {
  const name = error instanceof Error ? error.name : "NonErrorFailure"
  return /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(name) ? name : "Error"
}

function privacySafeError(error: unknown) {
  const safe = new Error("Unexpected API operation failure")
  safe.name = safeErrorName(error)

  // Preserve useful call sites without retaining the original exception
  // message, which can contain traveler input or provider response details.
  if (error instanceof Error && error.stack) {
    const frames = error.stack.split("\n").slice(1).join("\n")
    if (frames) safe.stack = `${safe.name}: ${safe.message}\n${frames}`
  }

  return safe
}

export function isExpectedRequestInterruption(error: unknown) {
  if (!(error instanceof Error)) return false
  return error.name === "AbortError" || error.name === "TimeoutError"
}

export function isExpectedDataRejection(error: unknown) {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  if (typeof code !== "string") return false
  return (
    code === "PGRST116" ||
    code === "42501" ||
    code.startsWith("22") ||
    code.startsWith("23")
  )
}

/**
 * Reports a handled API failure without request data, query values, user
 * identity, provider payloads, or high-cardinality resource identifiers.
 */
export function captureUnexpectedApiError(
  error: unknown,
  { route, operation }: ApiFailureContext
) {
  if (error instanceof Error && error.name === "AbortError") return

  sentryRuntime.withScope((scope) => {
    scope.setUser(null)
    scope.clearBreadcrumbs()
    scope.addEventProcessor((event) => ({
      ...event,
      breadcrumbs: undefined,
      contexts: undefined,
      extra: undefined,
      request: undefined,
      transaction: route,
      user: undefined,
      tags: {
        operation,
        route,
        surface: "api",
      },
    }))
    sentryRuntime.captureException(privacySafeError(error))
  })
}
