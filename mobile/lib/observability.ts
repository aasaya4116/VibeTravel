import * as Sentry from "@sentry/react-native"
import type { ErrorEvent, Event, ReactNativeOptions, Span, TransactionEvent } from "@sentry/react-native"

type IntegrationFactory = Extract<
  NonNullable<ReactNativeOptions["integrations"]>,
  (...args: never[]) => unknown
>
type DefaultIntegrations = Parameters<IntegrationFactory>[0]
type SendableSpan = Parameters<NonNullable<ReactNativeOptions["beforeSendSpan"]>>[0]
type EventWithStacktrace = Event & {
  stacktrace?: { frames?: Array<Record<string, unknown>> }
}

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const URL_WITH_QUERY_PATTERN = /([a-z][a-z0-9+.-]*:\/\/[^\s?#]+)\?[^\s#]*/gi
const PATH_WITH_QUERY_PATTERN = /((?:^|[\s"'(])\/[a-z0-9._~!$&'()*+,;=:@%/-]+)\?[^\s#"'<>)]*/gi
const TRIP_ROUTE_PATTERN = /(\/(?:api\/)?trips\/)[0-9a-f]{8}-[0-9a-f-]{27,}/gi
const SHARE_ROUTE_PATTERN = /(\/share\/)[a-z0-9_-]{12,}/gi
const BEARER_PATTERN = /\bBearer\s+[a-z0-9._~+\/-]+=*/gi

const SAFE_ATTRIBUTE_KEYS = new Set([
  "aborted",
  "cache_hit",
  "date_count",
  "fast_draft",
  "had_results",
  "http_status",
  "included_count",
  "offline",
  "pull_to_refresh",
  "refinement",
  "result_count",
  "result_day_count",
  "result_stop_count",
  "saved_count",
  "single_day",
])

const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "destination",
  "email",
  "family",
  "name",
  "password",
  "query",
  "requestbody",
  "sharetoken",
  "token",
  "tripid",
  "userid",
]

export interface ObservabilityAttributes {
  aborted?: boolean
  cache_hit?: boolean
  date_count?: number
  fast_draft?: boolean
  had_results?: boolean
  http_status?: number
  included_count?: number
  offline?: boolean
  pull_to_refresh?: boolean
  refinement?: boolean
  result_count?: number
  result_day_count?: number
  result_stop_count?: number
  saved_count?: number
  single_day?: boolean
}

export interface OperationTiming {
  finish: (attributes?: ObservabilityAttributes) => number
  fail: (error: unknown, attributes?: ObservabilityAttributes) => number
}

let observabilityEnabled = false

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "")
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
}

/** Removes identifiers and URL parameters while leaving a useful route shape. */
export function scrubObservabilityText(value: string) {
  return value
    .replace(URL_WITH_QUERY_PATTERN, "$1")
    .replace(PATH_WITH_QUERY_PATTERN, "$1")
    .replace(TRIP_ROUTE_PATTERN, "$1[trip_id]")
    .replace(SHARE_ROUTE_PATTERN, "$1[share_token]")
    .replace(UUID_PATTERN, "[id]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
}

function scrubUnknown(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return scrubObservabilityText(value)
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) return "[circular]"
  seen.add(value)

  if (Array.isArray(value)) return value.map((entry) => scrubUnknown(entry, seen))

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : scrubUnknown(entry, seen),
    ])
  )
}

function scrubHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return headers
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !/^(authorization|cookie|set-cookie)$/i.test(key))
      .map(([key, value]) => [key, scrubObservabilityText(value)])
  )
}

function scrubStacktrace(stacktrace: { frames?: Array<Record<string, unknown>> } | undefined) {
  stacktrace?.frames?.forEach((frame) => {
    if (typeof frame.filename === "string") frame.filename = scrubObservabilityText(frame.filename)
    if (typeof frame.abs_path === "string") frame.abs_path = scrubObservabilityText(frame.abs_path)
    delete frame.vars
  })
}

/** Exported for a focused privacy regression test and used by both error and trace events. */
export function scrubSentryEvent<T extends Event>(event: T): T {
  event.user = undefined
  event.server_name = undefined

  if (event.request) {
    event.request.url = event.request.url ? scrubObservabilityText(event.request.url) : event.request.url
    event.request.headers = scrubHeaders(event.request.headers)
    event.request.data = undefined
    event.request.cookies = undefined
    event.request.query_string = undefined
  }

  if (event.message) event.message = "[redacted error message]"
  if (event.logentry) {
    event.logentry.message = "[redacted error message]"
    event.logentry.params = undefined
  }

  event.exception?.values?.forEach((exception: NonNullable<NonNullable<Event["exception"]>["values"]>[number]) => {
    exception.value = "[redacted error message]"
    scrubStacktrace(exception.stacktrace as { frames?: Array<Record<string, unknown>> } | undefined)
  })
  scrubStacktrace((event as EventWithStacktrace).stacktrace)

  if (event.transaction) event.transaction = scrubObservabilityText(event.transaction)
  if (event.extra) event.extra = scrubUnknown(event.extra) as Event["extra"]
  if (event.contexts) event.contexts = scrubUnknown(event.contexts) as Event["contexts"]
  if (event.tags) event.tags = scrubUnknown(event.tags) as Event["tags"]
  if (event.breadcrumbs) event.breadcrumbs = scrubUnknown(event.breadcrumbs) as Event["breadcrumbs"]
  if (event.spans) event.spans = scrubUnknown(event.spans) as Event["spans"]

  return event
}

export function sanitizeObservabilityAttributes(attributes: ObservabilityAttributes = {}) {
  const result: Record<string, number | boolean> = {}
  Object.entries(attributes).forEach(([key, value]) => {
    if (!SAFE_ATTRIBUTE_KEYS.has(key)) return
    if (typeof value === "boolean") result[key] = value
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value
  })
  return result
}

function normalizeOperationName(operation: string) {
  return /^[a-z][a-z0-9_.-]{0,63}$/.test(operation) ? operation : "app.operation"
}

function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now()
}

function captureOperationalError(
  operation: string,
  error: unknown,
  attributes: ObservabilityAttributes = {},
) {
  if (!observabilityEnabled) return
  const exception = error instanceof Error ? error : new Error("Operational error")
  Sentry.captureException(exception, {
    tags: { operation: normalizeOperationName(operation) },
    extra: sanitizeObservabilityAttributes(attributes),
  })
}

/** Starts a low-cardinality span and provides one-shot success/failure finishers. */
export function startOperationTiming(
  operation: string,
  attributes: ObservabilityAttributes = {},
): OperationTiming {
  const safeOperation = normalizeOperationName(operation)
  const startedAt = monotonicNow()
  let ended = false
  let span: Span | null = null

  if (observabilityEnabled) {
    span = Sentry.startInactiveSpan({
      name: safeOperation,
      op: `app.${safeOperation}`,
      attributes: sanitizeObservabilityAttributes(attributes),
    })
  }

  const end = (finalAttributes: ObservabilityAttributes, failed: boolean) => {
    const duration = Math.max(0, Math.round(monotonicNow() - startedAt))
    if (ended) return duration
    ended = true
    span?.setAttributes(sanitizeObservabilityAttributes(finalAttributes))
    span?.setStatus({ code: failed ? 2 : 1 })
    span?.end()
    return duration
  }

  return {
    finish(finalAttributes = {}) {
      return end(finalAttributes, false)
    },
    fail(error, finalAttributes = {}) {
      captureOperationalError(safeOperation, error, finalAttributes)
      return end(finalAttributes, true)
    },
  }
}

function scrubSpan<T extends { data: Record<string, unknown>; description?: string }>(span: T): T {
  return {
    ...span,
    description: span.description ? scrubObservabilityText(span.description) : span.description,
    data: scrubUnknown(span.data) as Record<string, unknown>,
  }
}

/** Initializes Sentry only when a DSN is supplied; safe to call more than once. */
export function initializeObservability() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn || observabilityEnabled) return false

  const development = typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production"

  const options: ReactNativeOptions = {
    dsn,
    environment: development ? "development" : "production",
    sampleRate: 1,
    tracesSampleRate: development ? 0 : 0.1,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    enableUserInteractionTracing: false,
    maxBreadcrumbs: 0,
    integrations(defaultIntegrations: DefaultIntegrations) {
      return defaultIntegrations.filter((integration: DefaultIntegrations[number]) => !/(replay|profil)/i.test(integration.name))
    },
    beforeSend(event: ErrorEvent) {
      return scrubSentryEvent(event)
    },
    beforeSendTransaction(event: TransactionEvent) {
      return scrubSentryEvent(event)
    },
    beforeSendSpan(span: SendableSpan) {
      return scrubSpan(span)
    },
  }

  try {
    Sentry.init(options)
  } catch {
    return false
  }

  observabilityEnabled = true
  return true
}
