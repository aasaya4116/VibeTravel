"use client"

import { useEffect, useState } from "react"
import { Play } from "lucide-react"

interface Vlog {
  id: string
  title: string
  channel: string
  thumbnail: string
  url: string
}

export function VlogStrip({ destination }: { destination: string }) {
  const [vlogs, setVlogs] = useState<Vlog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!destination) return
    setLoading(true)
    setVlogs([])
    fetch(`/api/vlogs?destination=${encodeURIComponent(destination)}`)
      .then((r) => r.json())
      .then((data) => setVlogs(data.videos ?? []))
      .catch(() => setVlogs([]))
      .finally(() => setLoading(false))
  }, [destination])

  if (!destination || (!loading && vlogs.length === 0)) return null

  return (
    <div className="w-64 shrink-0">
      <div className="mb-3 sticky top-4">
        <h2 className="font-serif text-base text-foreground leading-snug">
          Watch families explore {destination}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Real trips, real families</p>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-12rem)] pr-1" style={{ scrollbarWidth: "thin" }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card">
                <div className="h-32 rounded-t-2xl bg-muted" />
                <div className="p-3">
                  <div className="mb-2 h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))
          : vlogs.map((v) => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative h-32 overflow-hidden bg-muted">
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                      <Play className="h-4 w-4 fill-current text-foreground" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                    {v.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{v.channel}</p>
                </div>
              </a>
            ))}
      </div>
    </div>
  )
}
