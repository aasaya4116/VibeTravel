"use client"

import { useState, useEffect, useCallback } from "react"

const PREFIX = "vt_hint_"

export function useOnboardingHints() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))
    setDismissed(new Set(keys.map((k) => k.slice(PREFIX.length))))
    setMounted(true)
  }, [])

  const isDismissed = useCallback(
    (id: string) => !mounted || dismissed.has(id),
    [dismissed, mounted]
  )

  const dismiss = useCallback((id: string) => {
    localStorage.setItem(`${PREFIX}${id}`, "1")
    setDismissed((prev) => new Set([...prev, id]))
  }, [])

  return { isDismissed, dismiss, mounted }
}
