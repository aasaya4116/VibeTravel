export const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_SITE_URL ??
  "https://vibe-travel-six.vercel.app"
).replace(/\/$/, "")

export const imageSizePresets = {
  backdrop: { width: 1200, height: 1800, quality: 78 },
  hero: { width: 1200, height: 900, quality: 80 },
  landscape: { width: 960, height: 640, quality: 78 },
  portraitCard: { width: 640, height: 800, quality: 76 },
  thumbnail: { width: 240, height: 240, quality: 72 },
} as const

export type ImageSizePreset = keyof typeof imageSizePresets

const vibeTravelPhotoPaths = new Set([
  "/api/place-photo",
  "/api/destination-photo",
])

function parseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function absoluteMediaUrl(value: string | null | undefined) {
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  return `${apiUrl}${value.startsWith("/") ? "" : "/"}${value}`
}

export function destinationPhotoUrl(destination: string) {
  return `${apiUrl}/api/destination-photo?destination=${encodeURIComponent(destination.trim())}`
}

export function optimizedMediaUrl(
  value: string | null | undefined,
  preset: ImageSizePreset = "landscape"
) {
  const absoluteUrl = absoluteMediaUrl(value)
  if (!absoluteUrl) return undefined

  const url = parseUrl(absoluteUrl)
  const configuredApiUrl = parseUrl(apiUrl)
  if (!url) return absoluteUrl

  const size = imageSizePresets[preset]

  if (url.hostname === "images.unsplash.com") {
    url.searchParams.set("auto", "format")
    url.searchParams.set("fit", "crop")
    url.searchParams.set("w", String(size.width))
    url.searchParams.set("h", String(size.height))
    url.searchParams.set("q", String(size.quality))
    return url.toString()
  }

  if (
    configuredApiUrl &&
    url.origin === configuredApiUrl.origin &&
    vibeTravelPhotoPaths.has(url.pathname)
  ) {
    url.searchParams.set("width", String(size.width))
    url.searchParams.set("height", String(size.height))
    return url.toString()
  }

  return absoluteUrl
}

export function remoteImageSource(
  value: string | null | undefined,
  accessToken?: string | null,
  preset: ImageSizePreset = "landscape"
) {
  const uri = optimizedMediaUrl(value, preset)
  if (!uri) return undefined

  const sourceUrl = parseUrl(uri)
  const configuredApiUrl = parseUrl(apiUrl)
  const headers = accessToken && sourceUrl && configuredApiUrl && sourceUrl.origin === configuredApiUrl.origin
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined

  return headers ? { uri, headers } : { uri }
}

