"use client"

import {
  Clock,
  DollarSign,
  Baby,
  MapPin,
  Star,
  ChevronDown,
  ChevronUp,
  Accessibility,
  Volume2,
  ExternalLink,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Plus,
  Check,
  CalendarDays,
  MessageCircle,
  Sparkles,
} from "lucide-react"
import { useState } from "react"
import type { Attraction } from "@/lib/types"
import { getAttractionImage } from "@/lib/attraction-images"
import { formatPlannedDate } from "@/lib/trip-planning"
import type { RecommendationFeedbackReason } from "@/lib/recommendation-personalization"

const feedbackOptions: {
  value: RecommendationFeedbackReason
  label: string
}[] = [
  { value: "too_busy", label: "Too busy" },
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_age_appropriate", label: "Not age-appropriate" },
]

const categoryColors: Record<string, string> = {
  Museum: "from-indigo-500/20 to-purple-500/20",
  Nature: "from-emerald-500/20 to-teal-500/20",
  "Creative Play": "from-pink-500/20 to-rose-500/20",
  Playground: "from-amber-500/20 to-orange-500/20",
  Cultural: "from-violet-500/20 to-fuchsia-500/20",
  Adventure: "from-cyan-500/20 to-blue-500/20",
  "Theme Park": "from-yellow-500/20 to-orange-500/20",
  Entertainment: "from-purple-500/20 to-pink-500/20",
}

const categoryEmoji: Record<string, string> = {
  Museum: "🏛️",
  Nature: "🌿",
  "Creative Play": "🎨",
  Playground: "🛝",
  Cultural: "🎭",
  Adventure: "🧗",
  "Theme Park": "🎢",
  Entertainment: "🎮",
}

interface AttractionCardProps {
  attraction: Attraction
  isSaved: boolean
  onPlan: () => void
  tripTitle?: string | null
  plannedDate?: string | null
  isInspiration?: boolean
  showSave?: boolean
  feedbackReason?: RecommendationFeedbackReason | null
  onFitFeedback?: (reason: RecommendationFeedbackReason | null) => void
}

export function AttractionCard({
  attraction,
  isSaved,
  onPlan,
  tripTitle = null,
  plannedDate = null,
  isInspiration = false,
  showSave = true,
  feedbackReason = null,
  onFitFeedback,
}: AttractionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const gradientClass = categoryColors[attraction.category] || "from-slate-500/20 to-gray-500/20"
  const emoji = categoryEmoji[attraction.category] || "📍"

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/20 hover:shadow-md">
      {/* Image / Visual Header */}
      <div className="relative h-40 w-full overflow-hidden">
        <img
          src={attraction.imageUrl || getAttractionImage(attraction.category, attraction.name)}
          alt={attraction.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            const target = e.currentTarget
            // If the primary image fails, try the category fallback
            const fallbackSrc = getAttractionImage(attraction.category, attraction.name)
            if (target.src !== fallbackSrc) {
              target.src = fallbackSrc
              return
            }
            // If even the fallback fails, show gradient
            target.style.display = "none"
            const parent = target.parentElement
            if (parent) {
              parent.className = `relative flex h-32 w-full items-center justify-center bg-gradient-to-br ${gradientClass}`
              const emojiEl = document.createElement("span")
              emojiEl.className = "text-4xl"
              emojiEl.textContent = emoji
              parent.prepend(emojiEl)
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
            {attraction.category}
          </span>
        </div>
      </div>

      <div className="p-6">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {attraction.rating && (
            <div className="mb-1 flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-primary text-primary" />
                {attraction.rating}
                {attraction.userRatingCount != null && (
                  <span className="text-muted-foreground/70">
                    ({attraction.userRatingCount.toLocaleString()})
                  </span>
                )}
              </span>
              {attraction._sources?.rating && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  attraction._sources.rating === "ai"
                    ? "bg-muted text-muted-foreground"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                }`}>
                  {attraction._sources.rating === "google" ? "✓ Google" : attraction._sources.rating === "yelp" ? "✓ Yelp" : "AI est."}
                </span>
              )}
            </div>
          )}
          {attraction.verifiedPlace && (
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              Place verified by Google
            </div>
          )}
          <h3 className="text-lg font-medium text-foreground">
            {attraction.name}
          </h3>
        </div>
        {showSave && <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            onClick={onPlan}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              isSaved
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
            aria-label={
              isSaved
                ? tripTitle ? `Edit trip plan for ${attraction.name} in ${tripTitle}` : `Edit trip plan for ${attraction.name}`
                : `Add ${attraction.name} to a trip`
            }
          >
            {isSaved ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isSaved ? "In trip" : "Add to trip"}
          </button>
          {isSaved && plannedDate && (
            <span className="flex items-center gap-1 text-[10px] font-medium leading-tight text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {formatPlannedDate(plannedDate)}
            </span>
          )}
        </div>}
      </div>

      {isInspiration && (
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Inspiration example · Not a live listing
        </p>
      )}

      {/* Description */}
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        {attraction.description}
      </p>

      {attraction.familyFitReason && (
        <div className="mb-4 rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3 w-3" />
            {attraction.personalizedForFamily
              ? "Why this fits your family"
              : "Why it matched"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/80">
            {attraction.familyFitReason}
          </p>
          {attraction.familyFitSignals && attraction.familyFitSignals.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {attraction.familyFitSignals.map((signal, index) => (
                <span
                  key={`${signal.type}-${signal.label}-${index}`}
                  className="rounded-full border border-primary/15 bg-background/70 px-2.5 py-1 text-[10px] font-medium text-foreground/75"
                >
                  {signal.label}
                </span>
              ))}
            </div>
          )}

          {onFitFeedback && (
            <div className="mt-3 border-t border-primary/10 pt-2.5">
              {feedbackReason ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Got it — future results will adjust
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowFeedback(!showFeedback)}
                    className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : !showFeedback ? (
                <button
                  type="button"
                  onClick={() => setShowFeedback(true)}
                  className="inline-flex min-h-8 items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Not a fit? Tell us why
                </button>
              ) : null}

              {showFeedback && (
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Why ${attraction.name} is not a fit`}>
                  {feedbackOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onFitFeedback(
                          feedbackReason === option.value ? null : option.value
                        )
                        setShowFeedback(false)
                      }}
                      aria-pressed={feedbackReason === option.value}
                      className={`min-h-8 rounded-full border px-2.5 text-[10px] font-medium transition-colors ${
                        feedbackReason === option.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vibe Tags */}
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        AI planning tags
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {attraction.vibes.map((vibe) => (
          <span
            key={vibe}
            className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {vibe}
          </span>
        ))}
      </div>

      {/* Quick Info */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {attraction.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          Est. {attraction.estimatedDuration}
        </span>
        {attraction.priceRange && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            {attraction.priceRange}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Baby className="h-3.5 w-3.5" />
          Suggested: {attraction.ageRange}
        </span>
      </div>

      {/* Expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
      >
        {expanded ? "Show less" : "More details"}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {attraction.strollerFriendly != null && (
              <span className="flex items-center gap-1">
                <Accessibility className="h-3.5 w-3.5" />
                {attraction.strollerFriendly
                  ? "Stroller-friendly guidance"
                  : "Stroller access may be difficult"}
              </span>
            )}
            {attraction.accessibleEntrance != null && (
              <span className="flex items-center gap-1">
                <Accessibility className="h-3.5 w-3.5" />
                {attraction.accessibleEntrance
                  ? "Step-free entrance · Google"
                  : "No step-free entrance reported"}
              </span>
            )}
            {attraction.openNow != null && (
              <span className={`flex items-center gap-1 font-medium ${attraction.openNow ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                {attraction.openNow
                  ? <><CheckCircle className="h-3.5 w-3.5" /> Open now</>
                  : <><XCircle className="h-3.5 w-3.5" /> Closed now</>}
              </span>
            )}
            {attraction.sensoryNotes && (
              <span className="flex items-center gap-1">
                <Volume2 className="h-3.5 w-3.5" />
                Planning note: {attraction.sensoryNotes}
              </span>
            )}
          </div>

          {attraction.tips && attraction.tips.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-foreground">
                Planning tips (AI):
              </p>
              <ul className="flex flex-col gap-1">
                {attraction.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    {"- "}
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* External links */}
          {(attraction.googleMapsUri || attraction.websiteUri || attraction.yelpUrl) && (
            <div className="flex flex-wrap gap-2">
              {attraction.googleMapsUri && (
                <a
                  href={attraction.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                  Google Maps
                </a>
              )}
              {attraction.websiteUri && (
                <a
                  href={attraction.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                  Official website
                </a>
              )}
              {attraction.yelpUrl && (
                <a
                  href={attraction.yelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                  Yelp{attraction.yelpReviewCount ? ` (${attraction.yelpReviewCount} reviews)` : ""}
                </a>
              )}
            </div>
          )}

          {/* Data source indicator */}
          {attraction._sources && (
            <div className="flex items-center gap-1.5 border-t border-border pt-2">
              <span className="text-[10px] text-muted-foreground/60">Data:</span>
              {attraction.verifiedPlace && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  ✓ Place identity · Google
                </span>
              )}
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                attraction._sources.image === "google" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                : attraction._sources.image === "yelp" ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                : attraction._sources.image === "wikipedia" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                : "bg-muted text-muted-foreground"
              }`}>
                {attraction._sources.image === "google" ? "📸 Google" : attraction._sources.image === "yelp" ? "📸 Yelp" : attraction._sources.image === "wikipedia" ? "📸 Wikipedia" : "📸 Fallback"}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                attraction._sources.rating === "google" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                : attraction._sources.rating === "yelp" ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                : "bg-muted text-muted-foreground"
              }`}>
                {attraction._sources.rating === "google" ? "⭐ Google" : attraction._sources.rating === "yelp" ? "⭐ Yelp" : "⭐ AI est."}
              </span>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
