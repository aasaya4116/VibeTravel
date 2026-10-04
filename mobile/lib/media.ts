export const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_SITE_URL ??
  "https://vibe-travel-six.vercel.app"
).replace(/\/$/, "")

export function absoluteMediaUrl(value: string | null | undefined) {
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  return `${apiUrl}${value.startsWith("/") ? "" : "/"}${value}`
}

export function destinationPhotoUrl(destination: string) {
  return `${apiUrl}/api/destination-photo?destination=${encodeURIComponent(destination.trim())}`
}

export function remoteImageSource(
  value: string | null | undefined,
  accessToken?: string | null
) {
  const uri = absoluteMediaUrl(value)
  if (!uri) return undefined

  const headers = accessToken && uri.startsWith(apiUrl)
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined

  return headers ? { uri, headers } : { uri }
}

