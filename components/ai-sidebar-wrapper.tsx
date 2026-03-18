"use client"

import { AISidebar } from "@/components/ai-sidebar"
import type { FamilyVibe, Trip } from "@/lib/types"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface AISidebarWrapperProps {
  familyVibe: FamilyVibe | null
}

export function AISidebarWrapper({ familyVibe }: AISidebarWrapperProps) {
  const pathname = usePathname()
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null)

  useEffect(() => {
    const match = pathname.match(/^\/trips\/([^/]+)/)
    if (!match) {
      setCurrentTrip(null)
      return
    }

    const tripId = match[1]
    const supabase = createClient()
    supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single()
      .then(({ data }: { data: Trip | null }) => setCurrentTrip(data ?? null))
  }, [pathname])

  return <AISidebar familyVibe={familyVibe} currentTrip={currentTrip} />
}
