"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MapPin } from "lucide-react"
import { destinations } from "@/lib/destinations"

interface DestinationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DestinationAutocomplete({
  value,
  onChange,
  placeholder = "City or region",
  className = "",
}: DestinationAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Show all matches (the list scrolls); an empty box lists every destination.
  const filtered = value.trim()
    ? destinations.filter((d) =>
        d.toLowerCase().includes(value.toLowerCase())
      )
    : destinations

  const showDropdown = open && filtered.length > 0

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.children
      if (items[highlightIndex]) {
        (items[highlightIndex] as HTMLElement).scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) {
        if (e.key === "ArrowDown") {
          setOpen(true)
          setHighlightIndex(0)
          e.preventDefault()
        }
        return
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setHighlightIndex((prev) => (prev + 1) % filtered.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1))
          break
        case "Enter":
          if (highlightIndex >= 0 && highlightIndex < filtered.length) {
            e.preventDefault()
            onChange(filtered[highlightIndex])
            setOpen(false)
            setHighlightIndex(-1)
          }
          break
        case "Escape":
          setOpen(false)
          setHighlightIndex(-1)
          break
      }
    },
    [showDropdown, filtered, highlightIndex, onChange]
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlightIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background py-3 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls="dest-listbox"
      />

      {showDropdown && (
        <ul
          ref={listRef}
          id="dest-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-background py-1 shadow-lg"
        >
          {filtered.map((dest, i) => {
            // Highlight matching text
            const matchIdx = dest.toLowerCase().indexOf(value.toLowerCase())
            const before = dest.slice(0, matchIdx)
            const match = dest.slice(matchIdx, matchIdx + value.length)
            const after = dest.slice(matchIdx + value.length)

            return (
              <li
                key={dest}
                role="option"
                aria-selected={i === highlightIndex}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  i === highlightIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault() // prevent blur before click registers
                  onChange(dest)
                  setOpen(false)
                  setHighlightIndex(-1)
                }}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {value.trim() && matchIdx >= 0 ? (
                  <span>
                    {before}
                    <strong className="font-semibold">{match}</strong>
                    {after}
                  </span>
                ) : (
                  <span>{dest}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
