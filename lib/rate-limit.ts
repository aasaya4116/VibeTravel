import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

/**
 * Central rate-limit tiers for routes that incur third-party API cost.
 *
 * Each authenticated request consumes both a per-user and a per-IP bucket.
 * Anonymous requests consume the IP bucket. This prevents a signed-in user
 * from rotating accounts while still keeping unrelated users behind one IP
 * from sharing the stricter per-user allowance.
 */
export const RATE_LIMIT_TIERS = {
  AI_CHAT: "ai-chat",
  ITINERARY_GENERATION: "itinerary-generation",
  ITINERARY_DRAFT: "itinerary-draft",
  FEEDBACK_WRITE: "feedback-write",
  PROVIDER_SEARCH: "provider-search",
  PROVIDER_AUTOCOMPLETE: "provider-autocomplete",
  PROVIDER_MEDIA: "provider-media",
} as const

export type RateLimitTier = (typeof RATE_LIMIT_TIERS)[keyof typeof RATE_LIMIT_TIERS]

type Window = `${number} s` | `${number} m` | `${number} h` | `${number} d`

type BucketPolicy = {
  readonly limit: number
  readonly window: Window
  readonly windowMs: number
}

type TierPolicy = {
  readonly user: BucketPolicy
  readonly ip: BucketPolicy
}

const seconds = (value: number): number => value * 1_000
const minutes = (value: number): number => seconds(value * 60)

/**
 * Public so route tests and operational documentation can assert the limits
 * without duplicating magic numbers. Treat these values as product policy.
 */
export const RATE_LIMIT_POLICIES: Readonly<Record<RateLimitTier, TierPolicy>> = {
  [RATE_LIMIT_TIERS.AI_CHAT]: {
    user: { limit: 20, window: "10 m", windowMs: minutes(10) },
    ip: { limit: 40, window: "10 m", windowMs: minutes(10) },
  },
  [RATE_LIMIT_TIERS.ITINERARY_GENERATION]: {
    user: { limit: 6, window: "30 m", windowMs: minutes(30) },
    // Scout can dispatch this authenticated route server-to-server, so its
    // requests share Vercel egress. Keep a broad abuse ceiling here while the
    // per-user bucket remains the normal control.
    ip: { limit: 60, window: "30 m", windowMs: minutes(30) },
  },
  // Fast drafts and saved-place merges are deterministic database operations,
  // so they should not consume the much tighter model-generation allowance.
  [RATE_LIMIT_TIERS.ITINERARY_DRAFT]: {
    user: { limit: 30, window: "10 m", windowMs: minutes(10) },
    ip: { limit: 240, window: "10 m", windowMs: minutes(10) },
  },
  // Feedback is inexpensive, but each accepted write reaches the database and
  // can trigger an external notification. This tier allows normal testing and
  // retries without leaving either service open to authenticated spam.
  [RATE_LIMIT_TIERS.FEEDBACK_WRITE]: {
    user: { limit: 30, window: "10 m", windowMs: minutes(10) },
    ip: { limit: 120, window: "10 m", windowMs: minutes(10) },
  },
  [RATE_LIMIT_TIERS.PROVIDER_SEARCH]: {
    user: { limit: 40, window: "1 m", windowMs: minutes(1) },
    ip: { limit: 80, window: "1 m", windowMs: minutes(1) },
  },
  [RATE_LIMIT_TIERS.PROVIDER_AUTOCOMPLETE]: {
    user: { limit: 90, window: "1 m", windowMs: minutes(1) },
    ip: { limit: 180, window: "1 m", windowMs: minutes(1) },
  },
  [RATE_LIMIT_TIERS.PROVIDER_MEDIA]: {
    user: { limit: 240, window: "1 m", windowMs: minutes(1) },
    ip: { limit: 360, window: "1 m", windowMs: minutes(1) },
  },
}

export type RateLimitOptions = {
  /** Supabase user id when the route has authenticated the request. */
  userId?: string | null
  /** Trusted IP override, primarily for non-Request adapters. */
  ip?: string | null
}

export type RateLimitReason = "allowed" | "rate-limited" | "unavailable"

export type RateLimitResult = {
  readonly allowed: boolean
  readonly reason: RateLimitReason
  readonly tier: RateLimitTier
  readonly limit: number
  readonly remaining: number
  /** Unix epoch time in milliseconds. */
  readonly resetAt: number
  readonly retryAfterSeconds: number
  /** Ready to spread into a Response's headers. */
  readonly headers: Readonly<Record<string, string>>
}

type BucketScope = "user" | "ip"

type BucketResult = {
  readonly allowed: boolean
  readonly limit: number
  readonly remaining: number
  readonly resetAt: number
  readonly scope: BucketScope
}

type LocalWindow = {
  timestamps: number[]
  lastSeenAt: number
}

const localWindows = new Map<string, LocalWindow>()
const UPSTASH_UNAVAILABLE_RETRY_SECONDS = 30
const UPSTASH_CHECK_TIMEOUT_MS = 1_500
const LOCAL_STORE_MAX_KEYS = 2_000

type UpstashLimiterPair = {
  user: Ratelimit
  ip: Ratelimit
}

let upstashCache:
  | {
      signature: string
      limiters: Map<RateLimitTier, UpstashLimiterPair>
    }
  | undefined

function cleanIpCandidate(value: string | null): string | null {
  const candidate = value?.split(",", 1)[0]?.trim()
  if (!candidate || candidate.length > 128 || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return null
  }
  return candidate
}

/** Resolve the client address using hosting-provider headers before fallbacks. */
export function getClientIp(request: Pick<Request, "headers">): string {
  return (
    cleanIpCandidate(request.headers.get("x-vercel-forwarded-for")) ||
    cleanIpCandidate(request.headers.get("cf-connecting-ip")) ||
    cleanIpCandidate(request.headers.get("x-real-ip")) ||
    cleanIpCandidate(request.headers.get("x-forwarded-for")) ||
    "unknown"
  )
}

async function hashIdentifier(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function buildIdentities(
  request: Pick<Request, "headers">,
  options: RateLimitOptions
): Promise<Array<{ scope: BucketScope; identifier: string }>> {
  const identities: Array<{ scope: BucketScope; identifier: string }> = []
  const userId = options.userId?.trim()

  if (userId) {
    identities.push({
      scope: "user",
      identifier: await hashIdentifier(`user:${userId}`),
    })
  }

  const ip = cleanIpCandidate(options.ip ?? null) || getClientIp(request)
  identities.push({
    scope: "ip",
    identifier: await hashIdentifier(`ip:${ip}`),
  })

  return identities
}

function getUpstashLimiters(): Map<RateLimitTier, UpstashLimiterPair> | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null

  const signature = `${url}\u0000${token}`
  if (upstashCache?.signature === signature) return upstashCache.limiters

  const redis = new Redis({ url, token })
  const limiters = new Map<RateLimitTier, UpstashLimiterPair>()

  for (const tier of Object.values(RATE_LIMIT_TIERS)) {
    const policy = RATE_LIMIT_POLICIES[tier]
    limiters.set(tier, {
      user: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(policy.user.limit, policy.user.window),
        analytics: false,
        // The SDK's default timeout intentionally fails open. Cost-bearing
        // routes must instead surface an unavailable result on Redis failure.
        timeout: 0,
        prefix: `vibetravel:ratelimit:${tier}:user`,
      }),
      ip: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(policy.ip.limit, policy.ip.window),
        analytics: false,
        timeout: 0,
        prefix: `vibetravel:ratelimit:${tier}:ip`,
      }),
    })
  }

  upstashCache = { signature, limiters }
  return limiters
}

function pruneLocalStore(now: number): void {
  if (localWindows.size <= LOCAL_STORE_MAX_KEYS) return
  const oldestUsefulTimestamp = now - Math.max(
    ...Object.values(RATE_LIMIT_POLICIES).flatMap(({ user, ip }) => [
      user.windowMs,
      ip.windowMs,
    ])
  )
  for (const [key, value] of localWindows) {
    if (value.lastSeenAt < oldestUsefulTimestamp) localWindows.delete(key)
  }
}

function consumeLocalBucket(
  tier: RateLimitTier,
  scope: BucketScope,
  identifier: string,
  now: number
): BucketResult {
  const policy = RATE_LIMIT_POLICIES[tier][scope]
  const key = `${tier}:${scope}:${identifier}`
  const previous = localWindows.get(key)
  const timestamps = (previous?.timestamps ?? []).filter(
    (timestamp) => timestamp > now - policy.windowMs
  )

  // Count denied attempts too. Otherwise a client can hammer the endpoint at
  // the boundary without extending its cooldown.
  timestamps.push(now)
  localWindows.set(key, { timestamps, lastSeenAt: now })
  pruneLocalStore(now)

  const allowed = timestamps.length <= policy.limit
  const resetAt = timestamps[0] + policy.windowMs
  return {
    allowed,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - timestamps.length),
    resetAt,
    scope,
  }
}

function normalizeResetAt(reset: number, now: number): number {
  if (!Number.isFinite(reset) || reset <= 0) return now
  // @upstash/ratelimit returns milliseconds; normalize defensively in case a
  // future adapter supplies Unix seconds.
  return reset < 10_000_000_000 ? reset * 1_000 : reset
}

async function consumeUpstashBuckets(
  tier: RateLimitTier,
  identities: Array<{ scope: BucketScope; identifier: string }>,
  limiters: Map<RateLimitTier, UpstashLimiterPair>,
  now: number
): Promise<BucketResult[]> {
  const tierLimiters = limiters.get(tier)
  if (!tierLimiters) throw new Error(`No rate limiter configured for ${tier}`)

  return Promise.all(
    identities.map(async ({ scope, identifier }) => {
      const policy = RATE_LIMIT_POLICIES[tier][scope]
      const result = await tierLimiters[scope].limit(identifier)
      return {
        allowed: result.success,
        limit: result.limit ?? policy.limit,
        remaining: Math.max(0, result.remaining ?? 0),
        resetAt: normalizeResetAt(result.reset, now),
        scope,
      }
    })
  )
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Rate limiter timed out")),
      timeoutMs
    )
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function secondsUntil(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1_000))
}

function buildHeaders(
  bucket: Pick<BucketResult, "limit" | "remaining" | "resetAt">,
  now: number,
  includeRetryAfter: boolean
): Readonly<Record<string, string>> {
  const resetSeconds = secondsUntil(bucket.resetAt, now)
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(bucket.limit),
    "RateLimit-Remaining": String(bucket.remaining),
    "RateLimit-Reset": String(resetSeconds),
    "X-RateLimit-Limit": String(bucket.limit),
    "X-RateLimit-Remaining": String(bucket.remaining),
    "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1_000)),
  }
  if (includeRetryAfter) headers["Retry-After"] = String(resetSeconds)
  return headers
}

function unavailableResult(tier: RateLimitTier, now: number): RateLimitResult {
  const policy = RATE_LIMIT_POLICIES[tier].ip
  const resetAt = now + UPSTASH_UNAVAILABLE_RETRY_SECONDS * 1_000
  const bucket = { limit: policy.limit, remaining: 0, resetAt }
  return {
    allowed: false,
    reason: "unavailable",
    tier,
    ...bucket,
    retryAfterSeconds: UPSTASH_UNAVAILABLE_RETRY_SECONDS,
    headers: buildHeaders(bucket, now, true),
  }
}

/**
 * Consume the configured user/IP buckets for a request.
 *
 * Development and test runs use an in-memory sliding window so local work is
 * deterministic and never requires cloud credentials. Production fails closed
 * with a 503-ready result when Upstash is missing or unreachable; paid APIs are
 * therefore never silently exposed without a limiter.
 */
export async function enforceRateLimit(
  request: Pick<Request, "headers">,
  tier: RateLimitTier,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const now = Date.now()
  const identities = await buildIdentities(request, options)
  let buckets: BucketResult[]

  if (process.env.NODE_ENV === "production") {
    try {
      const limiters = getUpstashLimiters()
      if (!limiters) return unavailableResult(tier, now)
      buckets = await withTimeout(
        consumeUpstashBuckets(tier, identities, limiters, now),
        UPSTASH_CHECK_TIMEOUT_MS
      )
    } catch {
      return unavailableResult(tier, now)
    }
  } else {
    buckets = identities.map(({ scope, identifier }) =>
      consumeLocalBucket(tier, scope, identifier, now)
    )
  }

  const denied = buckets.filter((bucket) => !bucket.allowed)
  // When more than one bucket is exhausted, clients must wait for the longest
  // cooldown. On success, report the bucket with the least headroom.
  const representative = denied.length
    ? denied.reduce((current, bucket) =>
        bucket.resetAt > current.resetAt ? bucket : current
      )
    : buckets.reduce((current, bucket) => {
        const currentRatio = current.remaining / current.limit
        const nextRatio = bucket.remaining / bucket.limit
        return nextRatio < currentRatio ? bucket : current
      })
  const allowed = denied.length === 0
  const retryAfterSeconds = allowed ? 0 : secondsUntil(representative.resetAt, now)

  return {
    allowed,
    reason: allowed ? "allowed" : "rate-limited",
    tier,
    limit: representative.limit,
    remaining: representative.remaining,
    resetAt: representative.resetAt,
    retryAfterSeconds,
    headers: buildHeaders(representative, now, !allowed),
  }
}

/** Turn a denied limiter result into a consistent JSON response. */
export function rateLimitResponse(
  result: RateLimitResult,
  message?: string
): Response {
  if (result.allowed) {
    throw new Error("rateLimitResponse requires a denied rate-limit result")
  }

  const unavailable = result.reason === "unavailable"
  return Response.json(
    {
      error:
        message ||
        (unavailable
          ? "This service is temporarily unavailable. Please try again shortly."
          : "Too many requests. Please wait a moment and try again."),
      code: unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: unavailable ? 503 : 429,
      headers: {
        ...result.headers,
        "Cache-Control": "private, no-store",
      },
    }
  )
}
