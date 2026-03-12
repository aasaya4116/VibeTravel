"use client"

import { AISidebar } from "@/components/ai-sidebar"
import type { FamilyVibe } from "@/lib/types"

interface AISidebarWrapperProps {
  familyVibe: FamilyVibe | null
}

export function AISidebarWrapper({ familyVibe }: AISidebarWrapperProps) {
  return <AISidebar familyVibe={familyVibe} currentTrip={null} />
}
