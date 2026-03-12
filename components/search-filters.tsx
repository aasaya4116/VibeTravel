"use client"

import { X } from "lucide-react"

interface Filters {
  ageRange: string
  strollerFriendly: boolean
  budget: string
  category: string
}

interface SearchFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
  onClose: () => void
}

const ageRanges = ["0-2", "2-5", "5-8", "8-12", "12+", "All ages"]
const budgets = ["Free", "$", "$$", "$$$"]
const categories = [
  "Museum",
  "Park",
  "Restaurant",
  "Shop",
  "Tour",
  "Cultural",
  "Nature",
  "Workshop",
  "Entertainment",
]

export function SearchFilters({ filters, onChange, onClose }: SearchFiltersProps) {
  const hasActiveFilters =
    filters.ageRange !== "" ||
    filters.budget !== "" ||
    filters.category !== "" ||
    filters.strollerFriendly

  function clearAll() {
    onChange({ ageRange: "", strollerFriendly: false, budget: "", category: "" })
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground">Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close filters"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Age Range */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Age Range
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ageRanges.map((age) => (
              <button
                key={age}
                onClick={() =>
                  onChange({
                    ...filters,
                    ageRange: filters.ageRange === age ? "" : age,
                  })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filters.ageRange === age
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Budget
          </label>
          <div className="flex flex-wrap gap-1.5">
            {budgets.map((b) => (
              <button
                key={b}
                onClick={() =>
                  onChange({
                    ...filters,
                    budget: filters.budget === b ? "" : b,
                  })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filters.budget === b
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  onChange({
                    ...filters,
                    category: filters.category === cat ? "" : cat,
                  })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filters.category === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Stroller */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Accessibility
          </label>
          <button
            onClick={() =>
              onChange({
                ...filters,
                strollerFriendly: !filters.strollerFriendly,
              })
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.strollerFriendly
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Stroller-friendly
          </button>
        </div>
      </div>
    </div>
  )
}
