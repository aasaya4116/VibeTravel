export interface RSSArticle {
  title: string
  url: string
  description: string
  imageUrl: string | null
  pubDate: string | null
  source: string
}

function parseCDATA(str: string): string {
  return str.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim()
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))
  if (!match) return ""
  return parseCDATA(match[1].trim())
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i"))
  return match?.[1] ?? null
}

function parseItems(xml: string, sourceName: string): RSSArticle[] {
  const items: RSSArticle[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractTag(item, "title")

    // <link> may appear as plain text or as an atom href attribute
    let url = extractTag(item, "link")
    if (!url) {
      url = item.match(/<link>([^<\s]+)/)?.[1] ?? ""
    }

    const rawDesc = extractTag(item, "description")
    const description = rawDesc.replace(/<[^>]+>/g, "").slice(0, 150).trim()

    const pubDate = extractTag(item, "pubDate") || null

    // Images: try media:thumbnail → media:content → enclosure
    const imageUrl =
      extractAttr(item, "media:thumbnail", "url") ??
      extractAttr(item, "media:content", "url") ??
      extractAttr(item, "enclosure", "url") ??
      null

    if (title && url) {
      items.push({ title, url, description, imageUrl, pubDate, source: sourceName })
    }
  }

  return items
}

async function fetchFeed(url: string, sourceName: string): Promise<RSSArticle[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // cache 1 hour
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VibeTravelBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseItems(xml, sourceName).slice(0, 8)
  } catch {
    return []
  }
}

export async function fetchTravelArticles(destination?: string | null): Promise<RSSArticle[]> {
  const [familyFeed, travelFeed] = await Promise.allSettled([
    fetchFeed("https://www.theguardian.com/travel/family-holidays/rss", "The Guardian"),
    fetchFeed("https://www.theguardian.com/travel/rss", "The Guardian"),
  ])

  const familyArticles =
    familyFeed.status === "fulfilled" ? familyFeed.value : []
  const travelArticles =
    travelFeed.status === "fulfilled" ? travelFeed.value : []

  // Merge, deduplicate by URL
  const seen = new Set<string>()
  const all = [...familyArticles, ...travelArticles].filter((a) => {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })

  // Prioritize articles that mention the destination
  if (destination) {
    const dest = destination.split(",")[0].toLowerCase()
    const relevant = all.filter(
      (a) =>
        a.title.toLowerCase().includes(dest) ||
        a.description.toLowerCase().includes(dest)
    )
    if (relevant.length >= 2) {
      const rest = all.filter((a) => !relevant.includes(a))
      return [...relevant, ...rest].slice(0, 6)
    }
  }

  return all.slice(0, 6)
}
