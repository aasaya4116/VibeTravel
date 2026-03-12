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

export async function fetchTravelArticles(destination?: string | null): Promise<Article[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return []

  const query = destination
    ? `${destination.split(",")[0]} family travel with kids tips guide`
    : "best family travel destinations with kids 2026"

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 6,
        include_images: true,
      }),
      next: { revalidate: 3600 }, // cache 1 hour
    })

    if (!res.ok) return []

    const json = await res.json()
    const results: TavilyResult[] = json.results ?? []
    const images: string[] = json.images ?? []

    return results.map((r, i) => ({
      title: r.title,
      url: r.url,
      description: r.content?.slice(0, 160).trim() ?? "",
      imageUrl: images[i] ?? null,
      pubDate: r.published_date ?? null,
      source: new URL(r.url).hostname.replace(/^www\./, ""),
    }))
  } catch {
    return []
  }
}
