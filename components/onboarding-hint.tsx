"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

interface OnboardingHintProps {
  message: string
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  onDismiss: () => void
  children: React.ReactNode
}

const sideClasses: Record<string, string> = {
  top: "bottom-full mb-2.5",
  bottom: "top-full mt-2.5",
  left: "right-full mr-2.5 top-0",
  right: "left-full ml-2.5 top-0",
}

const alignClasses: Record<string, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
}

export function OnboardingHint({
  message,
  side = "bottom",
  align = "start",
  onDismiss,
  children,
}: OnboardingHintProps) {
  const [open, setOpen] = useState(false)

  // Auto-open the bubble after a short delay so it doesn't feel instant
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative">
      {children}

      {/* Pulsing ring around the target */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[inherit] animate-pulse ring-2 ring-primary/40"
      />

      {/* Dot indicator (visible when tooltip is closed) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Show tip"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow"
        >
          <span className="absolute h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        </button>
      )}

      {/* Tooltip bubble */}
      {open && (
        <div
          className={`absolute ${sideClasses[side]} ${alignClasses[align]} z-50 w-64 rounded-2xl border border-border bg-card p-4 shadow-xl`}
        >
          {/* Arrow notch */}
          <span
            aria-hidden
            className={`absolute h-2.5 w-2.5 rotate-45 border border-border bg-card ${
              side === "bottom"
                ? "-top-1.5 " + (align === "center" ? "left-1/2 -translate-x-1/2" : align === "end" ? "right-4" : "left-4")
                : side === "top"
                ? "-bottom-1.5 " + (align === "center" ? "left-1/2 -translate-x-1/2" : align === "end" ? "right-4" : "left-4")
                : ""
            }`}
          />
          <p className="pr-5 text-sm leading-snug text-foreground">{message}</p>
          <button
            onClick={onDismiss}
            aria-label="Dismiss tip"
            className="absolute right-2.5 top-2.5 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDismiss}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
