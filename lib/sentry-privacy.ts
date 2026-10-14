import type * as SentryTypes from "@sentry/nextjs"

type InitOptions = Parameters<typeof SentryTypes.init>[0]
type ErrorEvent = Parameters<NonNullable<InitOptions["beforeSend"]>>[0]
type TransactionEvent = Parameters<NonNullable<InitOptions["beforeSendTransaction"]>>[0]
type Event = ErrorEvent | TransactionEvent

type IntegrationFactory = Extract<
  NonNullable<InitOptions["integrations"]>,
  (...args: never[]) => unknown
>
type DefaultIntegrations = Parameters<IntegrationFactory>[0]
type SendableSpan = Parameters<NonNullable<InitOptions["beforeSendSpan"]>>[0]
type EventWithStacktrace = Event & {
  stacktrace?: { frames?: Array<Record<string, unknown>> }
}

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const URL_WITH_QUERY_PATTERN = /([a-z][a-z0-9+.-]*:\/\/[^\s?#]+)\?[^\s#]*/gi
const PATH_WITH_QUERY_PATTERN = /((?:^|[\s"'(])\/[a-z0-9._~!$&'()*+,;=:@%/-]+)\?[^\s#"'<>)]*/gi
const TRIP_ROUTE_PATTERN = /(\/(?:api\/)?trips\/)[0-9a-f]{8}-[0-9a-f-]{27,}/gi
const SHARE_ROUTE_PATTERN = /(\/share\/)[a-z0-9_-]{12,}/gi
const BEARER_PATTERN = /\bBearer\s+[a-z0-9._~+\/-]+=*/gi

const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "destination",
  "email",
  "family",
  "name",
  "password",
  "prompt",
  "query",
  "requestbody",
  "sharetoken",
  "token",
  "tripid",
  "userid",
]

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "")
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
}

/** Removes identifiers and URL parameters while preserving a useful route shape. */
export function scrubSentryText(value: string) {
  return value
    .replace(URL_WITH_QUERY_PATTERN, "$1")
    .replace(PATH_WITH_QUERY_PATTERN, "$1")
    .replace(TRIP_ROUTE_PATTERN, "$1[trip_id]")
    .replace(SHARE_ROUTE_PATTERN, "$1[share_token]")
    .replace(UUID_PATTERN, "[id]")
    .replace(EMAIL_PATTERN, "[email]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
}

function scrubUnknown(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return scrubSentryText(value)
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) return "[circular]"
  seen.add(value)

  if (Array.isArray(value)) return value.map((entry) => scrubUnknown(entry, seen))

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : scrubUnknown(entry, seen),
    ]),
  )
}

function scrubStacktrace(stacktrace: { frames?: Array<Record<string, unknown>> } | undefined) {
  stacktrace?.frames?.forEach((frame) => {
    if (typeof frame.filename === "string") frame.filename = scrubSentryText(frame.filename)
    if (typeof frame.abs_path === "string") frame.abs_path = scrubSentryText(frame.abs_path)
    delete frame.vars
  })
}

/** Final defensive scrub for both error and transaction events. */
export function scrubSentryEvent<T extends Event>(event: T): T {
  event.user = undefined
  event.server_name = undefined
  event.breadcrumbs = undefined

  if (event.request) {
    event.request.url = event.request.url ? scrubSentryText(event.request.url) : event.request.url
    event.request.headers = undefined
    event.request.data = undefined
    event.request.cookies = undefined
    event.request.query_string = undefined
    event.request.env = undefined
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

  if (event.transaction) event.transaction = scrubSentryText(event.transaction)
  if (event.extra) event.extra = scrubUnknown(event.extra) as Event["extra"]
  if (event.contexts) event.contexts = scrubUnknown(event.contexts) as Event["contexts"]
  if (event.tags) event.tags = scrubUnknown(event.tags) as Event["tags"]
  if (event.spans) event.spans = scrubUnknown(event.spans) as Event["spans"]

  return event
}

function scrubSpan(span: SendableSpan): SendableSpan {
  return {
    ...span,
    name: scrubSentryText(span.name),
    attributes: scrubUnknown(span.attributes) as SendableSpan["attributes"],
    links: scrubUnknown(span.links) as SendableSpan["links"],
  }
}

/** Shared browser/server/edge options. No request bodies, identity data, replay, or feedback are collected. */
export function createSentryOptions(dsn: string | undefined) {
  const normalizedDsn = dsn?.trim()
  const production = process.env.NODE_ENV === "production"

  return {
    dsn: normalizedDsn,
    enabled: Boolean(normalizedDsn),
    environment: process.env.VERCEL_ENV ?? (production ? "production" : "development"),
    sampleRate: 1,
    tracesSampleRate: production ? 0.05 : 0,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    integrations(defaultIntegrations: DefaultIntegrations) {
      return defaultIntegrations.filter(
        (integration: DefaultIntegrations[number]) => !/(replay|feedback|profil)/i.test(integration.name),
      )
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
}
