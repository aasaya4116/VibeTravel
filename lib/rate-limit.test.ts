import { afterEach, describe, expect, it, vi } from "vitest"
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_TIERS,
  enforceRateLimit,
  getClientIp,
  rateLimitResponse,
} from "./rate-limit"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function request(ip: string, header = "x-vercel-forwarded-for") {
  return new Request("https://vibetravel.example/api/test", {
    headers: { [header]: ip },
  })
}

describe("rate limit identity", () => {
  it("prefers hosting-provider addresses and safely reads the first proxy hop", () => {
    const req = new Request("https://vibetravel.example/api/test", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-forwarded-for": "198.51.100.20",
      },
    })
    expect(getClientIp(req)).toBe("203.0.113.10")
  })

  it("uses a shared fail-safe identity when no address is available", () => {
    expect(getClientIp(request("", "unrelated"))).toBe("unknown")
  })
})

describe("local rate limiting", () => {
  it("enforces the stricter user bucket while still returning standard headers", async () => {
    vi.stubEnv("NODE_ENV", "test")
    const ip = `198.51.100.${Math.floor(Math.random() * 100) + 1}`
    const req = request(ip)
    const policy = RATE_LIMIT_POLICIES[RATE_LIMIT_TIERS.ITINERARY_GENERATION]

    let result = await enforceRateLimit(req, RATE_LIMIT_TIERS.ITINERARY_GENERATION, {
      userId: `user-${crypto.randomUUID()}`,
    })
    expect(result.allowed).toBe(true)
    expect(result.headers["RateLimit-Limit"]).toBe(String(policy.user.limit))
    expect(result.headers["RateLimit-Remaining"]).toBe(String(policy.user.limit - 1))
    expect(result.headers["Retry-After"]).toBeUndefined()

    const userId = `limited-${crypto.randomUUID()}`
    for (let attempt = 0; attempt <= policy.user.limit; attempt += 1) {
      result = await enforceRateLimit(req, RATE_LIMIT_TIERS.ITINERARY_GENERATION, {
        userId,
      })
    }

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe("rate-limited")
    expect(result.remaining).toBe(0)
    expect(Number(result.headers["Retry-After"])).toBeGreaterThan(0)

    const response = rateLimitResponse(result)
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe(result.headers["Retry-After"])
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("does not let one user's strict bucket consume another user's allowance", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const req = request(`192.0.2.${Math.floor(Math.random() * 100) + 1}`)
    const policy = RATE_LIMIT_POLICIES[RATE_LIMIT_TIERS.ITINERARY_GENERATION]
    const firstUser = `first-${crypto.randomUUID()}`

    for (let attempt = 0; attempt < policy.user.limit; attempt += 1) {
      const result = await enforceRateLimit(
        req,
        RATE_LIMIT_TIERS.ITINERARY_GENERATION,
        { userId: firstUser }
      )
      expect(result.allowed).toBe(true)
    }

    const nextUser = await enforceRateLimit(
      req,
      RATE_LIMIT_TIERS.ITINERARY_GENERATION,
      { userId: `second-${crypto.randomUUID()}` }
    )
    expect(nextUser.allowed).toBe(true)
  })

  it("still enforces the shared IP bucket across rotating user ids", async () => {
    vi.stubEnv("NODE_ENV", "test")
    const req = request(`203.0.113.${Math.floor(Math.random() * 100) + 101}`)
    const policy = RATE_LIMIT_POLICIES[RATE_LIMIT_TIERS.ITINERARY_GENERATION]
    let result

    for (let attempt = 0; attempt <= policy.ip.limit; attempt += 1) {
      result = await enforceRateLimit(
        req,
        RATE_LIMIT_TIERS.ITINERARY_GENERATION,
        { userId: `rotated-${attempt}-${crypto.randomUUID()}` }
      )
    }

    expect(result?.allowed).toBe(false)
    expect(result?.reason).toBe("rate-limited")
    expect(result?.limit).toBe(policy.ip.limit)
  })

})

describe("production safety", () => {
  it("fails closed when production Upstash configuration is absent", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")

    const result = await enforceRateLimit(
      request(`203.0.113.${Math.floor(Math.random() * 100) + 1}`),
      RATE_LIMIT_TIERS.PROVIDER_SEARCH
    )

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe("unavailable")
    expect(result.retryAfterSeconds).toBe(30)

    const response = rateLimitResponse(result)
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: "RATE_LIMIT_UNAVAILABLE",
      retryAfter: 30,
    })
  })

  it("fails closed when the production Upstash check errors", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://rate-limit.invalid")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Redis unavailable")))

    const result = await enforceRateLimit(
      request(`192.0.2.${Math.floor(Math.random() * 100) + 1}`),
      RATE_LIMIT_TIERS.PROVIDER_AUTOCOMPLETE
    )

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe("unavailable")
    expect(rateLimitResponse(result).status).toBe(503)
  })

  it("rejects turning an allowed result into an error response", async () => {
    vi.stubEnv("NODE_ENV", "test")
    const result = await enforceRateLimit(
      request(`198.51.100.${Math.floor(Math.random() * 100) + 1}`),
      RATE_LIMIT_TIERS.PROVIDER_MEDIA
    )
    expect(() => rateLimitResponse(result)).toThrow(
      "rateLimitResponse requires a denied rate-limit result"
    )
  })
})
