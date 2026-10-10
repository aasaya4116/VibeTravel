import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  from: vi.fn(),
  deleteRows: vi.fn(),
  matchId: vi.fn(),
  matchOwner: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock("./supabase", () => ({
  supabase: { from: database.from },
}))

vi.mock("./observability", () => ({
  startOperationTiming: vi.fn(),
}))

import { deleteTrip } from "./data"

const cachePrefix = "vibetravel:mobile:v1"
const values = new Map<string, string>()
const storage = {
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  removeItem: vi.fn((key: string) => values.delete(key)),
  clear: vi.fn(() => values.clear()),
  key: vi.fn((index: number) => [...values.keys()][index] ?? null),
  get length() { return values.size },
} as Storage

describe("mobile trip deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    values.clear()
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    })

    database.from.mockReturnValue({ delete: database.deleteRows })
    database.deleteRows.mockReturnValue({ eq: database.matchId })
    database.matchId.mockReturnValue({ eq: database.matchOwner })
    database.matchOwner.mockReturnValue({ select: database.select })
    database.select.mockReturnValue({ maybeSingle: database.maybeSingle })
  })

  it("matches both trip and owner, then removes the trip from offline caches", async () => {
    database.maybeSingle.mockResolvedValue({ data: { id: "trip-1" }, error: null })
    values.set(`${cachePrefix}:trip:owner-1:trip-1`, JSON.stringify({ id: "trip-1" }))
    values.set(`${cachePrefix}:trip-destination:owner-1:trip-1`, JSON.stringify({ label: "Lisbon" }))
    values.set(`${cachePrefix}:dashboard:owner-1`, JSON.stringify({
      profile: null,
      familyVibe: null,
      trips: [{ id: "trip-1", itinerary: [] }, { id: "trip-2", itinerary: [] }],
      readinessByTrip: { "trip-1": { bookings: {}, checklist: [] }, "trip-2": { bookings: {}, checklist: [] } },
      offline: false,
    }))

    await expect(deleteTrip("owner-1", "trip-1")).resolves.toBe("trip-1")

    expect(database.from).toHaveBeenCalledWith("trips")
    expect(database.matchId).toHaveBeenCalledWith("id", "trip-1")
    expect(database.matchOwner).toHaveBeenCalledWith("user_id", "owner-1")
    expect(values.has(`${cachePrefix}:trip:owner-1:trip-1`)).toBe(false)
    expect(values.has(`${cachePrefix}:trip-destination:owner-1:trip-1`)).toBe(false)

    const dashboard = JSON.parse(values.get(`${cachePrefix}:dashboard:owner-1`) ?? "{}")
    expect(dashboard.trips.map((trip: { id: string }) => trip.id)).toEqual(["trip-2"])
    expect(dashboard.readinessByTrip).not.toHaveProperty("trip-1")
    expect(dashboard.readinessByTrip).toHaveProperty("trip-2")
  })

  it("does not clear local data when no owned trip was deleted", async () => {
    database.maybeSingle.mockResolvedValue({ data: null, error: null })
    values.set(`${cachePrefix}:trip:owner-1:trip-1`, JSON.stringify({ id: "trip-1" }))

    await expect(deleteTrip("owner-1", "trip-1")).rejects.toThrow("belongs to another account")
    expect(values.has(`${cachePrefix}:trip:owner-1:trip-1`)).toBe(true)
  })
})
