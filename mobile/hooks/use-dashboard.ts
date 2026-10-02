import { useCallback, useEffect, useState } from "react"
import { loadDashboard } from "@/lib/data"
import type { DashboardData } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"

export function useDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (pullToRefresh = false) => {
    if (!user) return
    if (pullToRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      setData(await loadDashboard(user))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your trips")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, refreshing, error, refresh }
}
