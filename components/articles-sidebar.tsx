import { fetchTravelArticles } from "@/lib/articles"
import { BookOpen } from "lucide-react"

interface ArticlesSidebarProps {
  destination?: string | null
}

// Deterministic gradient stand-ins for articles that arrive without a
// thumbnail — keeps every card in the rail visually consistent.
const THUMB_GRADIENTS = [
  "from-[#e0a06a] to-[#b8623a]",
  "from-[#6b8fb5] to-[#2e5a7a]",
  "from-[#79ae86] to-[#356b4e]",
  "from-[#c98b5e] to-[#8a5a3c]",
  "from-[#8a7bb0] to-[#4a3f6b]",
]

export async function ArticlesSidebar({ destination }: ArticlesSidebarProps) {
  const articles = await fetchTravelArticles(destination)

  if (articles.length === 0) return null

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Reads for your trip
        </h2>
      </div>

      {/* Articles */}
      <div className="flex flex-col gap-3">
        {articles.map((article, i) => (
          <a
            key={article.url}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 rounded-2xl border border-border bg-card p-3 card-soft transition-all hover:-translate-y-0.5 hover:border-primary/25"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              {article.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div
                  className={`h-full w-full bg-gradient-to-br ${THUMB_GRADIENTS[i % THUMB_GRADIENTS.length]}`}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-foreground line-clamp-2 transition-colors group-hover:text-primary">
                {article.title}
              </p>
              {article.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-1">
                  {article.description}
                </p>
              )}
              {article.source && (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/80">
                  {article.source}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export function ArticlesSidebarSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="mb-4 h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-muted" />
            <div className="min-w-0 flex-1 pt-1">
              <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
