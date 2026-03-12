/**
 * Fetches a relevant image URL from Wikipedia/Wikimedia Commons for a given attraction.
 * Free, no API key required.
 */
async function fetchWikipediaImageForQuery(query: string): Promise<string | null> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`

  const searchRes = await fetch(searchUrl, { next: { revalidate: 86400 } })
  if (!searchRes.ok) return null

  const searchData = await searchRes.json()
  const pageTitle = searchData?.query?.search?.[0]?.title
  if (!pageTitle) return null

  // Get the page's main image (thumbnail)
  const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=600&format=json&origin=*`

  const imageRes = await fetch(imageUrl, { next: { revalidate: 86400 } })
  if (!imageRes.ok) return null

  const imageData = await imageRes.json()
  const pages = imageData?.query?.pages
  if (!pages) return null

  const page = Object.values(pages)[0] as {
    thumbnail?: { source?: string; width?: number; height?: number }
  }
  const src = page?.thumbnail?.source
  if (!src) return null

  // Reject portrait-style images (height > width) — these are almost always
  // headshots of people, not venue photos
  const w = page.thumbnail?.width ?? 0
  const h = page.thumbnail?.height ?? 0
  if (h > w * 1.1) return null

  // Reject filenames that are typical portrait/person images
  const portraitPatterns = /portrait|headshot|person|people|face|photo_of|(\b(born|died)\b)/i
  if (portraitPatterns.test(src)) return null

  return src
}

export async function getWikipediaImage(
  attractionName: string,
  location?: string
): Promise<string | null> {
  try {
    // Search by attraction name only first — adding location causes Wikipedia
    // to match city/region articles and return the wrong thumbnail.
    const nameOnly = await fetchWikipediaImageForQuery(attractionName)
    if (nameOnly) return nameOnly

    // Fall back to name + location if no image found on the first pass
    if (location) {
      return await fetchWikipediaImageForQuery(`${attractionName} ${location}`)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Fetches Wikipedia images for multiple attractions in parallel.
 * Returns a map of attraction name -> image URL.
 */
export async function getWikipediaImages(
  attractions: { name: string; location?: string }[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  const promises = attractions.map(async (attr) => {
    const imageUrl = await getWikipediaImage(attr.name, attr.location)
    if (imageUrl) {
      results.set(attr.name, imageUrl)
    }
  })

  // Fetch all in parallel with a timeout
  await Promise.allSettled(promises)

  return results
}
