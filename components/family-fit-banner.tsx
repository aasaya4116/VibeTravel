"use client"

import Link from "next/link"
import { Pencil, Sparkles, Users } from "lucide-react"
import type { FamilyVibe } from "@/lib/types"
import { getFamilyVibeHighlights } from "@/lib/recommendation-personalization"

export function FamilyFitBanner({ familyVibe }: { familyVibe: FamilyVibe }) {
  const highlights = getFamilyVibeHighlights(familyVibe)

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/10 via-card to-accent/10 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Personalized for {familyVibe.family_name || "your family"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                These profile details influence ranking and the fit notes on every place.
              </p>
            </div>
            <Link
              href="/profile/vibe"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Pencil className="h-3 w-3" /> Edit Family Vibe
            </Link>
          </div>
          {highlights.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {highlights.map((highlight) => (
                <span
                  key={highlight}
                  className="rounded-full border border-primary/10 bg-background/75 px-2.5 py-1 text-[11px] font-medium text-foreground/80"
                >
                  {highlight}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
