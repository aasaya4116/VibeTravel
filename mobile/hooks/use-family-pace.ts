import { useEffect, useState } from "react"
import { loadFamilyPace, readFamilyPaceCache } from "@/lib/data"
import type { FamilyVibe } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

export function useFamilyPace(): FamilyVibe["pace"] {
  const { user } = useAuth()
  const [pace, setPace] = useState<FamilyVibe["pace"]>("moderate")

  useEffect(() => {
    if (!user) {
      setPace("moderate")
      return
    }

    const userId = user.id
    const cached = readFamilyPaceCache(userId)
    setPace(cached ?? "moderate")
    let active = true

    void loadFamilyPace(userId).then((nextPace) => {
      if (active) setPace(nextPace)
    })

    return () => {
      active = false
    }
  }, [user?.id])

  return pace
}
