import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(),
}))

import { config } from "./proxy"

function middlewareMatches(pathname: string) {
  const matcher = config.matcher[0]
  return new RegExp(`^${matcher}$`).test(pathname)
}

describe("session middleware matcher", () => {
  it.each([
    "/api/search",
    "/api/destinations",
    "/api/destination-photo",
    "/api/place-photo",
    "/api/geocode",
    "/api/vlogs",
  ])("bypasses the shared Supabase session refresh for endpoint %s", (pathname) => {
    expect(middlewareMatches(pathname)).toBe(false)
  })

  it.each([
    "/api/searching",
    "/api/trips/trip-id/itinerary",
    "/dashboard",
    "/trips/trip-id",
  ])("keeps session middleware on protected or lookalike path %s", (pathname) => {
    expect(middlewareMatches(pathname)).toBe(true)
  })
})
