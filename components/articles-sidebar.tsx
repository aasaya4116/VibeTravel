import { fetchTravelArticles } from "@/lib/articles"
import { BookOpen } from "lucide-react"

interface ArticlesSidebarProps {
  destination?: string | null
}

export async function ArticlesSidebar({ destination }: ArticlesSidebarProps) {
  const articles = await fetchTravelArticles(destination)

  if (articles.length === 0) return null

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Reads
        </h2>
      </div>

      {/* Articles */}
      <div className="flex flex-col gap-6">
        {articles.map((article) => (
          <a
            key={article.url}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-2.5"
          >
            {article.imageUrl && (
              <div className="overflow-hidden rounded-xl">
                <img
                  src={article.imageUrl}
                  alt=""
                  className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            )}
            <div>
              <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {article.title}
              </p>
              {article.description && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {article.description}
                </p>
              )}
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {article.source}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export function ArticlesSidebarSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <div className="h-36 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
