import { Image } from "expo-image"

const OFFLINE_CACHE_PREFIX = "vibetravel:mobile:v1"
const ONBOARDING_DRAFT_PREFIX = "vibetravel:mobile:onboarding-draft:v1"
const BUILD_PROMPT_PREFIX = "vibetravel:explore-build-prompt"

interface LocalStorageLike {
  readonly length: number
  getItem(key: string): string | null
  key(index: number): string | null
  removeItem(key: string): void
}

interface ImageCacheLike {
  clearMemoryCache(): Promise<boolean>
  clearDiskCache(): Promise<boolean>
}

export interface ClearDownloadedDataResult {
  removedKeys: string[]
  localDataCleared: boolean
  imageCacheCleared: boolean
}

interface ClearDownloadedDataOptions {
  storage?: LocalStorageLike
  imageCache?: ImageCacheLike
}

function storageKeys(storage: LocalStorageLike) {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key) keys.push(key)
  }
  return keys
}

function tripIdsFromDashboard(storage: LocalStorageLike, userId: string) {
  try {
    const raw = storage.getItem(`${OFFLINE_CACHE_PREFIX}:dashboard:${userId}`)
    if (!raw) return []
    const dashboard = JSON.parse(raw) as { trips?: Array<{ id?: unknown }> }
    return (dashboard.trips ?? [])
      .map((trip) => trip.id)
      .filter((tripId): tripId is string => typeof tripId === "string" && tripId.length > 0)
  } catch {
    return []
  }
}

/**
 * Removes only the signed-in traveler's VibeTravel device data. Supabase auth
 * keys and every other account's cached data are intentionally left alone.
 */
export async function clearCurrentUserDownloadedData(
  userId: string,
  tripIds: string[] = [],
  options: ClearDownloadedDataOptions = {},
): Promise<ClearDownloadedDataResult> {
  const storage = options.storage ?? globalThis.localStorage
  const imageCache = options.imageCache ?? Image
  const removedKeys: string[] = []
  let localDataCleared = true

  if (storage && userId) {
    let knownKeys: string[] = []
    try {
      knownKeys = storageKeys(storage)
    } catch {
      // Continue with the exact keys we can derive. Flag the partial cleanup so
      // the UI can explain that some downloaded data may remain.
      localDataCleared = false
    }
    const cachedTripPrefix = `${OFFLINE_CACHE_PREFIX}:trip:${userId}:`
    const cachedDestinationPrefix = `${OFFLINE_CACHE_PREFIX}:trip-destination:${userId}:`
    const currentTripIds = new Set([
      ...tripIds,
      ...tripIdsFromDashboard(storage, userId),
      ...knownKeys
        .filter((key) => key.startsWith(cachedTripPrefix))
        .map((key) => key.slice(cachedTripPrefix.length))
        .filter(Boolean),
    ])

    const exactKeys = new Set([
      `${OFFLINE_CACHE_PREFIX}:dashboard:${userId}`,
      `${OFFLINE_CACHE_PREFIX}:family-pace:${userId}`,
      `${ONBOARDING_DRAFT_PREFIX}:${userId}`,
      ...[...currentTripIds].map((tripId) => `${BUILD_PROMPT_PREFIX}:${tripId}`),
    ])

    const keysToRemove = new Set([
      ...knownKeys.filter((key) => (
        exactKeys.has(key)
        || key.startsWith(cachedTripPrefix)
        || key.startsWith(cachedDestinationPrefix)
      )),
      // Remove exact keys even when a Storage adapter cannot enumerate them.
      ...exactKeys,
    ])

    for (const key of keysToRemove) {
      try {
        const existed = storage.getItem(key) !== null
        storage.removeItem(key)
        if (existed) removedKeys.push(key)
      } catch {
        localDataCleared = false
        // Device cleanup is best-effort and must never block sign-out or a
        // successful account deletion.
      }
    }
  }

  const imageResults = await Promise.allSettled([
    Promise.resolve().then(() => imageCache.clearMemoryCache()),
    Promise.resolve().then(() => imageCache.clearDiskCache()),
  ])
  const imageCacheCleared = imageResults.every(
    (result) => result.status === "fulfilled" && result.value !== false,
  )

  return { removedKeys, localDataCleared, imageCacheCleared }
}
