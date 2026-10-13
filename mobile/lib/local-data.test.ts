import { beforeEach, describe, expect, it, vi } from "vitest"

const imageCache = vi.hoisted(() => ({
  clearDiskCache: vi.fn(),
  clearMemoryCache: vi.fn(),
}))

vi.mock("expo-image", () => ({ Image: imageCache }))

import { clearCurrentUserDownloadedData } from "./local-data"

const values = new Map<string, string>()
const storage = {
  get length() { return values.size },
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  key: vi.fn((index: number) => [...values.keys()][index] ?? null),
  removeItem: vi.fn((key: string) => { values.delete(key) }),
}

describe("mobile downloaded-data cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    values.clear()
    imageCache.clearDiskCache.mockResolvedValue(true)
    imageCache.clearMemoryCache.mockResolvedValue(true)
  })

  it("removes only the current traveler's offline data and prompt flags", async () => {
    values.set("vibetravel:mobile:v1:dashboard:user-1", JSON.stringify({
      trips: [{ id: "trip-from-dashboard" }],
    }))
    values.set("vibetravel:mobile:v1:family-pace:user-1", JSON.stringify("moderate"))
    values.set("vibetravel:mobile:v1:trip:user-1:trip-from-cache", "{}")
    values.set("vibetravel:mobile:v1:trip-destination:user-1:trip-from-cache", "{}")
    values.set("vibetravel:mobile:onboarding-draft:v1:user-1", "{}")
    values.set("vibetravel:explore-build-prompt:trip-from-dashboard", "1")
    values.set("vibetravel:explore-build-prompt:trip-from-cache", "1")
    values.set("vibetravel:explore-build-prompt:trip-from-screen", "1")

    values.set("vibetravel:mobile:v1:dashboard:user-2", "{}")
    values.set("vibetravel:mobile:v1:trip:user-2:trip-other", "{}")
    values.set("vibetravel:explore-build-prompt:trip-other", "1")
    values.set("sb-project-auth-token", "keep-the-session")

    const result = await clearCurrentUserDownloadedData(
      "user-1",
      ["trip-from-screen"],
      { storage, imageCache },
    )

    expect(result.removedKeys).toHaveLength(8)
    expect(result.imageCacheCleared).toBe(true)
    expect([...values.keys()]).toEqual([
      "vibetravel:mobile:v1:dashboard:user-2",
      "vibetravel:mobile:v1:trip:user-2:trip-other",
      "vibetravel:explore-build-prompt:trip-other",
      "sb-project-auth-token",
    ])
    expect(imageCache.clearMemoryCache).toHaveBeenCalledOnce()
    expect(imageCache.clearDiskCache).toHaveBeenCalledOnce()
  })

  it("does not fail account cleanup when an image cache is unavailable", async () => {
    imageCache.clearDiskCache.mockRejectedValue(new Error("not available"))
    values.set("vibetravel:mobile:v1:dashboard:user-1", "{}")

    await expect(clearCurrentUserDownloadedData(
      "user-1",
      [],
      { storage, imageCache },
    )).resolves.toMatchObject({ imageCacheCleared: false })
    expect(values.has("vibetravel:mobile:v1:dashboard:user-1")).toBe(false)
  })

  it("reports partial cleanup instead of rejecting when storage enumeration fails", async () => {
    const unavailableStorage = {
      get length(): number { throw new Error("storage unavailable") },
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      removeItem: vi.fn(),
    }

    await expect(clearCurrentUserDownloadedData(
      "user-1",
      [],
      { storage: unavailableStorage, imageCache },
    )).resolves.toMatchObject({ localDataCleared: false })
  })

  it("captures synchronous image-cache errors", async () => {
    imageCache.clearMemoryCache.mockImplementation(() => {
      throw new Error("memory cache unavailable")
    })

    await expect(clearCurrentUserDownloadedData(
      "user-1",
      [],
      { storage, imageCache },
    )).resolves.toMatchObject({ imageCacheCleared: false })
  })
})
