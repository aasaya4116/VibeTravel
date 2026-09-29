"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { TripDateOption } from "@/lib/trip-planning"
import { MAX_GENERATION_DAYS } from "@/lib/itinerary-batching"

interface LongTripPlannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  destination: string
  dateOptions: TripDateOption[]
  plannedDates: string[]
  generating: boolean
  onGenerate: (dates: string[]) => Promise<boolean>
}

export function LongTripPlannerDialog({
  open,
  onOpenChange,
  destination,
  dateOptions,
  plannedDates,
  generating,
  onGenerate,
}: LongTripPlannerDialogProps) {
  const plannedSet = useMemo(() => new Set(plannedDates), [plannedDates])
  const unplannedOptions = useMemo(
    () => dateOptions.filter((option) => !plannedSet.has(option.value)),
    [dateOptions, plannedSet]
  )
  const quickOptions = unplannedOptions.length > 0 ? unplannedOptions : dateOptions
  const [selectedDates, setSelectedDates] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setSelectedDates(quickOptions.slice(0, 7).map((option) => option.value))
  }, [open, quickOptions])

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates])

  function toggleDate(date: string) {
    setSelectedDates((current) => {
      if (current.includes(date)) return current.filter((value) => value !== date)
      if (current.length >= MAX_GENERATION_DAYS) return current
      return [...current, date].sort()
    })
  }

  async function generateSelected() {
    if (selectedDates.length === 0 || generating) return
    const succeeded = await onGenerate(selectedDates)
    if (succeeded) onOpenChange(false)
  }

  const quickLabel = unplannedOptions.length > 0
    ? `Select next ${Math.min(7, unplannedOptions.length)} unplanned days`
    : "Select the first 7 days to rebuild"

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !generating && onOpenChange(nextOpen)}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl gap-0 overflow-hidden rounded-2xl border-border p-0">
        <div className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 px-6 py-6 pr-12">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <DialogTitle className="font-serif text-2xl font-normal">
              Plan your trip in sections
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {destination} is a longer stay. Choose up to {MAX_GENERATION_DAYS} days for a detailed plan now, then return anytime to plan more.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Start with a manageable week</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each section saves independently, so completed days stay safe.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-xl bg-background"
              onClick={() =>
                setSelectedDates(quickOptions.slice(0, 7).map((option) => option.value))
              }
              disabled={generating}
            >
              <Sparkles className="h-4 w-4" />
              {quickLabel}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {plannedDates.length} of {dateOptions.length} days already planned
            </span>
            <span className="font-medium text-primary">
              {selectedDates.length}/{MAX_GENERATION_DAYS} selected
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
            {dateOptions.map((option) => {
              const selected = selectedSet.has(option.value)
              const planned = plannedSet.has(option.value)
              const selectionFull = selectedDates.length >= MAX_GENERATION_DAYS && !selected

              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
                    selected ? "bg-primary/5" : "hover:bg-muted/50"
                  } ${selectionFull ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <Checkbox
                    checked={selected}
                    disabled={generating || selectionFull}
                    onCheckedChange={() => toggleDate(option.value)}
                    aria-label={`Plan ${option.label}`}
                  />
                  <span className="min-w-0 flex-1 text-sm text-foreground">{option.label}</span>
                  {planned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                      <Check className="h-3 w-3" />
                      Planned
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={generating}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={generating || selectedDates.length === 0}
              onClick={generateSelected}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating
                ? "Building this section…"
                : `Plan ${selectedDates.length} selected day${selectedDates.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
