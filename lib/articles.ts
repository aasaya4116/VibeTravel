export interface Article {
  title: string
  url: string
  description: string
  imageUrl: string | null
  pubDate: string | null
  source: string
}

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
}

// Reputable family / travel publications. Constraining Tavily to these keeps
// the panel from returning tech-deal listicles, YouTube pages, and other
// off-topic clickbait.
const TRAVEL_DOMAINS = [
  "afar.com",
  "lonelyplanet.com",
  "timeout.com",
  "nationalgeographic.com",
  "travelandleisure.com",
  "cntraveler.com",
  "fodors.com",
  "frommers.com",
  "tripsavvy.com",
  "familyvacationcritic.com",
  "ciaobambino.com",
  "nomadicmatt.com",
  "thepointsguy.com",
]

// Tavily returns raw page content that often contains markdown (### headings,
// **bold**, links). Strip it so nothing leaks into the UI.
function clean(text: string): string {
  return (text || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // markdown images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> visible text
    .replace(/[#>*_`~]+/g, "") // heading / emphasis / code tokens
    .replace(/\s+/g, " ")
    .trim()
}

export async function fetchTravelArticles(destination?: string | null): Promise<Article[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []

  const city = destination?.split(",")[0]?.trim()
  const query = city
    ? `family travel guide to ${city} with kids: things to do and itineraries`
    : "best family travel destinations and tips for traveling with kids"

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        topic: "general",
        search_depth: "basic",
        max_results: 8,
        include_images: true,
        include_domains: TRAVEL_DOMAINS,
      }),
      next: { revalidate: 3600 }, // cache 1 hour
    })

    if (!res.ok) return []

    const json = await res.json()
    const results: TavilyResult[] = json.results ?? []
    const images: string[] = json.images ?? []

    return results
      .map((r, i) => {
        let source = ""
        try {
          source = new URL(r.url).hostname.replace(/^www\./, "")
        } catch {
          source = ""
        }
        return {
          title: clean(r.title),
          url: r.url,
          description: clean(r.content).slice(0, 150).trim(),
          imageUrl: images[i] ?? null,
          pubDate: r.published_date ?? null,
          source,
        }
      })
      .filter((a) => a.title.length > 8 && !!a.url)
      .slice(0, 5)
  } catch {
    return []
  }
}
